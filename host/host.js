'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const HOST_ID = 'com.sopify.tab';
const ASK_ARGS = ['--print', '--output-format', 'stream-json', '--mode', 'ask'];
const FORBIDDEN_FLAGS = new Set(['--force', '-f', '--yolo']);
const MAX_IN = 10 * 1024 * 1024;
const MAX_OUT = 800000;

let shuttingDown = false;
let active = null;

function readPaths() {
  const file = path.join(__dirname, 'local-paths.json');
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeMessage(obj) {
  const json = Buffer.from(JSON.stringify(obj), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  try {
    fs.writeSync(1, header);
    fs.writeSync(1, json);
  } catch {
    shutdown(true);
  }
}

function detectPayload() {
  const paths = readPaths();
  return {
    type: 'pong',
    ok: true,
    host: HOST_ID,
    wave: 3,
    proxySnapshotted: Boolean(paths.cursorAgentProxy),
  };
}

function contentText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((part) => {
    if (typeof part === 'string') return part;
    if (part && typeof part.text === 'string') return part.text;
    return '';
  }).join('');
}

function eventKind(ev) {
  if (!ev || typeof ev !== 'object') return { kind: 'none' };
  if (ev.type === 'assistant') {
    return { kind: 'assistant', text: contentText(ev.message && ev.message.content) };
  }
  if (ev.type === 'result' && typeof ev.result === 'string') {
    return { kind: 'result', text: ev.result, error: Boolean(ev.is_error) };
  }
  if (ev.type === 'error') {
    const text = typeof ev.error === 'string' ? ev.error
      : typeof ev.message === 'string' ? ev.message : '';
    return { kind: 'error', text };
  }
  return { kind: 'none' };
}

function emitDelta(text) {
  if (!text) return;
  for (let i = 0; i < text.length; i += MAX_OUT) {
    writeMessage({ type: 'ask_delta', text: text.slice(i, i + MAX_OUT) });
  }
}

function feedStream(state, ev) {
  const got = eventKind(ev);
  if (got.kind === 'assistant' && got.text) {
    const last = state.segments[state.segments.length - 1] || '';
    if (state.segments.length && got.text.startsWith(last)) {
      const extra = got.text.slice(last.length);
      state.segments[state.segments.length - 1] = got.text;
      emitDelta(extra);
      return;
    }
    state.segments.push(got.text);
    emitDelta((state.segments.length > 1 ? '\n' : '') + got.text);
    return;
  }
  if (got.kind === 'result') {
    if (got.error && got.text) state.stderr = state.stderr || got.text;
    const acc = state.segments.join('\n');
    const compact = state.segments.join('');
    if (!acc && got.text) {
      state.segments.push(got.text);
      emitDelta(got.text);
    } else if (got.text && got.text !== acc && got.text !== compact && !got.text.startsWith(acc) && !acc.startsWith(got.text)) {
      // Terminal result is a new summary only when we have no usable assistant text.
    }
    return;
  }
  if (got.kind === 'error' && got.text) {
    state.stderr = got.text;
  }
}

function attachParser(readable, state) {
  let buf = '';
  readable.setEncoding('utf8');
  readable.on('data', (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx).replace(/\r$/, '').trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        feedStream(state, JSON.parse(line));
      } catch {
        // Non-JSON banners stay on the child's stdout; ignore.
      }
    }
  });
  readable.on('end', () => {
    const tail = buf.trim();
    if (!tail) return;
    try {
      feedStream(state, JSON.parse(tail));
    } catch {
      if (!state.segments.length) emitDelta(tail);
    }
  });
}

function childPids(pid) {
  const pids = [];
  try {
    if (fs.existsSync('/proc')) {
      for (const name of fs.readdirSync('/proc')) {
        if (!/^\d+$/.test(name)) continue;
        try {
          const stat = fs.readFileSync(path.join('/proc', name, 'stat'), 'utf8');
          const close = stat.lastIndexOf(')');
          const rest = stat.slice(close + 2).split(' ');
          const ppid = Number(rest[1]);
          if (ppid === pid) pids.push(Number(name));
        } catch { /* ESRCH / race */ }
      }
      return pids;
    }
    const { execFileSync } = require('child_process');
    const out = execFileSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' });
    for (const line of out.split('\n')) {
      const n = Number(line.trim());
      if (Number.isInteger(n) && n > 1) pids.push(n);
    }
  } catch { /* pgrep exits 1 when empty */ }
  return pids;
}

function descendants(pid) {
  const out = [];
  const stack = [pid];
  const seen = new Set([pid]);
  while (stack.length) {
    const cur = stack.pop();
    for (const c of childPids(cur)) {
      if (seen.has(c)) continue;
      seen.add(c);
      out.push(c);
      stack.push(c);
    }
  }
  return out;
}

function signalPid(pid, sig) {
  try { process.kill(pid, sig); } catch { /* gone */ }
}

function signalGroup(pid, sig) {
  try { process.kill(-pid, sig); } catch { /* no group */ }
}

function killTree(pid, immediate) {
  if (!pid) return;
  const ids = [pid, ...descendants(pid)];
  const sig = immediate ? 'SIGKILL' : 'SIGTERM';
  signalGroup(pid, sig);
  for (const id of ids) signalPid(id, sig);
  if (!immediate) {
    const t = setTimeout(() => {
      const later = [pid, ...descendants(pid)];
      signalGroup(pid, 'SIGKILL');
      for (const id of later) signalPid(id, 'SIGKILL');
    }, 250);
    if (typeof t.unref === 'function') t.unref();
  }
}

function killActive(immediate) {
  const job = active;
  active = null;
  if (!job || !job.child || !job.child.pid) return Promise.resolve();
  job.stopped = true;
  killTree(job.child.pid, immediate);
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    job.child.once('exit', done);
    setTimeout(done, immediate ? 200 : 600);
  });
}

function askArgs(prompt) {
  const args = ASK_ARGS.slice();
  if (prompt.startsWith('-')) args.push('--');
  args.push(prompt);
  if (args.some((a) => FORBIDDEN_FLAGS.has(a))) {
    throw new Error('force_forbidden');
  }
  return args;
}

function startAsk(msg) {
  const prompt = typeof msg.prompt === 'string' ? msg.prompt : '';
  if (!prompt.trim()) {
    writeMessage({ type: 'error', ok: false, error: 'empty_prompt' });
    return;
  }
  const cwd = typeof msg.cwd === 'string' ? msg.cwd.trim() : '';
  const paths = readPaths();
  const proxy = paths.cursorAgentProxy;
  if (!proxy || typeof proxy !== 'string') {
    writeMessage({ type: 'error', ok: false, error: 'proxy_not_snapshotted' });
    return;
  }

  let args;
  try {
    args = askArgs(prompt);
  } catch {
    writeMessage({ type: 'error', ok: false, error: 'force_forbidden' });
    return;
  }

  const opts = {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  };
  if (cwd) opts.cwd = cwd;

  let child;
  try {
    child = spawn(proxy, args, opts);
  } catch (e) {
    writeMessage({ type: 'error', ok: false, error: 'spawn_failed' });
    return;
  }

  const state = { segments: [], stderr: '' };
  const job = { child, stopped: false, state };
  active = job;
  writeMessage({ type: 'ask_start', ok: true });

  if (child.stdout) attachParser(child.stdout, state);
  if (child.stderr) {
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      state.stderr = (state.stderr + chunk).slice(-4000);
    });
  }

  child.on('error', () => {
    if (active === job) active = null;
    if (!job.stopped) writeMessage({ type: 'error', ok: false, error: 'spawn_failed' });
  });

  child.on('exit', (code, signal) => {
    if (active === job) active = null;
    killTree(child.pid, true);
    if (job.stopped) return;
    if (code && !state.segments.length) {
      writeMessage({
        type: 'error',
        ok: false,
        error: 'ask_failed',
        detail: (state.stderr || signal || `exit_${code}`).trim().slice(0, 500),
      });
      return;
    }
    writeMessage({ type: 'ask_done', ok: true });
  });
}

async function handleMessage(msg) {
  const type = msg && msg.type;
  if (type === 'detect' || type === 'ping') {
    writeMessage(detectPayload());
    return;
  }
  if (type === 'ask') {
    if (active) {
      await killActive(true);
      writeMessage({ type: 'stopped', ok: true });
    }
    startAsk(msg);
    return;
  }
  if (type === 'stop') {
    if (active) {
      await killActive(false);
      writeMessage({ type: 'stopped', ok: true });
    }
    return;
  }
  if (type === 'shutdown') {
    await shutdown(true);
    return;
  }
  writeMessage({ type: 'error', ok: false, error: 'unknown_message' });
}

function onBytes(feed, chunk) {
  feed.buf = Buffer.concat([feed.buf, chunk]);
  while (feed.buf.length >= 4) {
    const len = feed.buf.readUInt32LE(0);
    if (!Number.isFinite(len) || len <= 0 || len > MAX_IN) {
      writeMessage({ type: 'error', ok: false, error: 'bad_message' });
      shutdown(true);
      return;
    }
    if (feed.buf.length < 4 + len) break;
    const body = feed.buf.subarray(4, 4 + len).toString('utf8');
    feed.buf = feed.buf.subarray(4 + len);
    let msg;
    try {
      msg = JSON.parse(body);
    } catch {
      writeMessage({ type: 'error', ok: false, error: 'bad_message' });
      continue;
    }
    Promise.resolve(handleMessage(msg)).catch(() => {
      writeMessage({ type: 'error', ok: false, error: 'bad_message' });
    });
  }
}

async function shutdown(immediate) {
  if (shuttingDown) return;
  shuttingDown = true;
  await killActive(Boolean(immediate));
  process.exit(0);
}

function main() {
  const feed = { buf: Buffer.alloc(0) };
  process.stdin.on('data', (chunk) => onBytes(feed, chunk));
  process.stdin.on('end', () => { shutdown(true); });
  process.stdin.on('error', () => { shutdown(true); });
  process.on('SIGTERM', () => { shutdown(true); });
  process.on('SIGHUP', () => { shutdown(true); });
  process.stdin.resume();
}

main();
