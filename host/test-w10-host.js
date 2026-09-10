'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawn, execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const HOST_SRC = path.join(__dirname, 'host.js');
const INSTALL = path.join(__dirname, 'install-host.sh');
const EXT = path.join(REPO, 'extension');
const hostMod = require('./host.js');

function encode(obj) {
  const json = Buffer.from(JSON.stringify(obj), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  return Buffer.concat([header, json]);
}

function decodeAll(buf) {
  const msgs = [];
  let off = 0;
  while (off + 4 <= buf.length) {
    const len = buf.readUInt32LE(off);
    if (off + 4 + len > buf.length) break;
    msgs.push(JSON.parse(buf.subarray(off + 4, off + 4 + len).toString('utf8')));
    off += 4 + len;
  }
  return msgs;
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(fn, ms, label) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const v = fn();
    if (v) return v;
    await sleep(30);
  }
  throw new Error(label || 'timeout');
}

function writeCursorMock(dir) {
  const mock = path.join(dir, 'cursor-agent-proxy');
  const src = `#!${process.execPath}
const fs = require('fs');
const argv = process.argv.slice(2);
if (process.env.SOPIFY_MOCK_ARGS) {
  fs.writeFileSync(process.env.SOPIFY_MOCK_ARGS, JSON.stringify({ argv, cwd: process.cwd(), bin: 'cursor' }));
}
const events = [
  { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'hello world' }] } },
  { type: 'result', subtype: 'success', is_error: false, result: 'hello world' },
];
for (const ev of events) process.stdout.write(JSON.stringify(ev) + '\\n');
`;
  fs.writeFileSync(mock, src, { mode: 0o755 });
  return mock;
}

function writeCodexMock(dir, name) {
  const mock = path.join(dir, name || 'codex');
  const src = `#!${process.execPath}
const fs = require('fs');
const { spawn } = require('child_process');
const argv = process.argv.slice(2);
const banned = [
  '--ask-for-approval',
  '--dangerously-bypass-approvals-and-sandbox',
  '--dangerously-bypass-hook-trust',
  '--full-auto',
  '--force', '-f', '--yolo',
  'workspace-write',
  'danger-full-access',
];
if (argv.some((a) => banned.includes(a))) {
  process.stderr.write('forbidden_codex\\n');
  process.exit(2);
}
let stdinIsNull = false;
try {
  stdinIsNull = fs.readlinkSync('/proc/self/fd/0') === '/dev/null';
} catch { /* non-linux */ }
if (process.env.SOPIFY_MOCK_ARGS) {
  fs.writeFileSync(process.env.SOPIFY_MOCK_ARGS, JSON.stringify({
    argv,
    cwd: process.cwd(),
    bin: 'codex',
    stdinIsNull,
  }));
}
let kid = null;
if (process.env.SOPIFY_MOCK_KID) {
  kid = spawn(process.execPath, ['-e', 'setInterval(()=>{},1e9)'], { stdio: 'ignore' });
  fs.writeFileSync(process.env.SOPIFY_MOCK_KID, String(kid.pid));
}
if (process.env.SOPIFY_MOCK_HANG) {
  process.stdout.write(JSON.stringify({ type: 'thread.started', thread_id: 't1' }) + '\\n');
  setInterval(() => {}, 1e9);
  return;
}
const events = [
  { type: 'thread.started', thread_id: 't1' },
  { type: 'turn.started' },
  { type: 'item.completed', item: { id: 'item_0', type: 'reasoning', text: 'thinking' } },
  { type: 'item.completed', item: { id: 'item_1', type: 'agent_message', text: 'hello world' } },
  { type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 2 } },
];
for (const ev of events) process.stdout.write(JSON.stringify(ev) + '\\n');
`;
  fs.writeFileSync(mock, src, { mode: 0o755 });
  return mock;
}

function writePaths(dir, extras) {
  const doc = {
    node: process.execPath,
    hostJs: path.join(dir, 'host.js'),
    wrapper: path.join(dir, 'run'),
    extensionId: 'cgkhllpelkjmfamddkjpnmchjikdcbgp',
    hostId: 'com.sopify.tab',
    ...extras,
  };
  fs.writeFileSync(path.join(dir, 'local-paths.json'), JSON.stringify(doc, null, 2));
}

function startHost(dir, env) {
  fs.copyFileSync(HOST_SRC, path.join(dir, 'host.js'));
  const child = spawn(process.execPath, [path.join(dir, 'host.js')], {
    cwd: dir,
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const out = { buf: Buffer.alloc(0), err: '' };
  child.stdout.on('data', (c) => { out.buf = Buffer.concat([out.buf, c]); });
  child.stderr.on('data', (c) => { out.err += c.toString(); });
  child.send = (obj) => child.stdin.write(encode(obj));
  child.msgs = () => decodeAll(out.buf);
  child.out = out;
  return child;
}

async function closeHost(child) {
  try { child.stdin.end(); } catch { /* ignore */ }
  const start = Date.now();
  while (alive(child.pid) && Date.now() - start < 2000) await sleep(30);
  if (alive(child.pid)) {
    try { child.kill('SIGKILL'); } catch { /* ignore */ }
  }
}

function testUnitIdentityAndParser() {
  assert.deepEqual(hostMod.UPSTREAM_IDS, ['cursor', 'claude', 'codex']);
  assert.deepEqual(Object.keys(hostMod.UPSTREAMS), ['cursor', 'claude', 'codex']);
  assert.ok(!('grok' in hostMod.UPSTREAMS));
  assert.ok(!('deepseek' in hostMod.UPSTREAMS));
  assert.equal(hostMod.UPSTREAMS.codex.pathKey, 'codexBin');
  assert.equal(hostMod.UPSTREAMS.codex.missingError, 'codex_not_found');
  assert.equal(hostMod.normalizeUpstream('codex'), 'codex');
  assert.equal(hostMod.normalizeUpstream('cursor'), 'cursor');
  assert.equal(hostMod.normalizeUpstream('claude'), 'claude');
  assert.equal(hostMod.normalizeUpstream('grok'), 'cursor');

  assert.deepEqual(hostMod.CODEX_ASK_ARGS, [
    'exec', '-s', 'read-only', '--json', '--ephemeral', '--skip-git-repo-check',
  ]);
  assert.deepEqual(hostMod.codexAskArgs('Summarize README.md'), [
    'exec', '-s', 'read-only', '--json', '--ephemeral', '--skip-git-repo-check',
    'Summarize README.md',
  ]);
  assert.deepEqual(hostMod.codexAskArgs('Summarize README.md', '  /tmp/work  '), [
    'exec', '-s', 'read-only', '--json', '--ephemeral', '--skip-git-repo-check',
    '-C', '/tmp/work',
    'Summarize README.md',
  ]);
  assert.deepEqual(hostMod.codexAskArgs('x', ''), [
    'exec', '-s', 'read-only', '--json', '--ephemeral', '--skip-git-repo-check',
    'x',
  ]);

  const args = hostMod.codexAskArgs('hello', '/tmp/x');
  assert.ok(!args.includes('--ask-for-approval'));
  assert.ok(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
  assert.ok(!args.includes('--dangerously-bypass-hook-trust'));
  assert.ok(!args.includes('--full-auto'));
  assert.ok(!args.includes('--force'));
  assert.ok(!args.includes('-f'));
  assert.ok(!args.includes('--yolo'));
  assert.ok(!args.includes('workspace-write'));
  assert.ok(!args.includes('danger-full-access'));
  assert.equal(args[args.indexOf('-s') + 1], 'read-only');

  const claudeArgs = hostMod.claudeAskArgs('Summarize README.md', '/tmp/ignored');
  assert.deepEqual(claudeArgs, [
    '--bare',
    '-p', 'Summarize README.md',
    '--permission-mode', 'dontAsk',
    '--allowedTools', 'Read',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
  ]);

  assert.deepEqual(hostMod.codexEventKind({ type: 'thread.started', thread_id: 't' }), { kind: 'none' });
  assert.deepEqual(hostMod.codexEventKind({ type: 'turn.started' }), { kind: 'none' });
  assert.deepEqual(hostMod.codexEventKind({
    type: 'item.completed',
    item: { id: 'item_1', type: 'agent_message', text: 'hello world' },
  }), { kind: 'assistant', text: 'hello world' });
  assert.deepEqual(hostMod.codexEventKind({
    type: 'item.completed',
    item: { id: 'item_9', type: 'error', message: 'truncated' },
  }), { kind: 'error', text: 'truncated' });
  assert.deepEqual(hostMod.codexEventKind({
    type: 'turn.completed',
    usage: { input_tokens: 1, output_tokens: 2 },
  }), { kind: 'none' });
  assert.deepEqual(hostMod.codexEventKind({ type: 'error', message: 'broken pipe' }), {
    kind: 'error', text: 'broken pipe',
  });
  assert.deepEqual(hostMod.codexEventKind({
    type: 'item.completed',
    item: { id: 'item_0', type: 'reasoning', text: 'thinking' },
  }), { kind: 'none' });
}

function testStaticForbidAndUi() {
  const hostSrc = fs.readFileSync(HOST_SRC, 'utf8');
  assert.ok(hostSrc.includes("'exec', '-s', 'read-only', '--json', '--ephemeral', '--skip-git-repo-check'"));
  assert.ok(hostSrc.includes("stdio: ['ignore', 'pipe', 'pipe']"));
  assert.ok(!/spawn\([^)]*codex-proxy/.test(hostSrc));
  assert.ok(!/spawn\([^)]*--ask-for-approval/.test(hostSrc));
  assert.ok(!/spawn\([^)]*--dangerously-bypass-approvals-and-sandbox/.test(hostSrc));
  assert.ok(!/spawn\([^)]*workspace-write/.test(hostSrc));
  assert.ok(!/spawn\([^)]*danger-full-access/.test(hostSrc));
  assert.ok(!/spawn\([^)]*--dangerously-bypass-hook-trust/.test(hostSrc));
  assert.ok(hostSrc.includes('CODEX_FORBIDDEN'));
  assert.ok(!/webhook/i.test(hostSrc));
  assert.ok(!/createServer|http\.listen|express\(/i.test(hostSrc));

  const install = fs.readFileSync(INSTALL, 'utf8');
  assert.ok(install.includes('find_codex'));
  assert.ok(install.includes('snapshot_codex'));
  assert.ok(install.includes('codexBin'));
  assert.ok(install.includes('SOPIFY_CODEX'));
  assert.ok(install.includes('codex-proxy'));
  assert.ok(install.includes('com.openai.codexextension'));
  assert.ok(install.includes('未找到，可选'));

  const newtab = fs.readFileSync(path.join(EXT, 'newtab.html'), 'utf8');
  const desk = newtab.split('data-view="desk"')[1].split('data-view="tabs"')[0];
  const settings = newtab.slice(newtab.indexOf('aria-labelledby="settings-h"'));
  const rail = newtab.slice(newtab.indexOf('class="rail"'), newtab.indexOf('class="main"'));
  assert.ok(settings.includes('value="codex"'));
  assert.ok(settings.includes('Codex'));
  assert.ok(!desk.includes('hostUpstream'));
  assert.ok(!desk.includes('Codex'));
  assert.ok(!rail.includes('hostUpstream'));
  assert.ok(!rail.includes('Codex'));
  assert.ok(!settings.includes('Grok') && !settings.includes('DeepSeek'));

  const panelHtml = fs.readFileSync(path.join(EXT, 'sidepanel.html'), 'utf8');
  assert.ok(!/name="hostUpstream"/.test(panelHtml));
  assert.ok(!/<select/.test(panelHtml));

  const readme = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
  assert.ok(/Codex 只读/.test(readme));
  assert.ok(/默认仍是 Cursor|默认.*Cursor/.test(readme));
  assert.ok(!/多 CLI 已全量|支持任意 Agent|任意本机 Agent/.test(readme));
  assert.ok(!/Grok|DeepSeek/.test(readme));

  const extFiles = fs.readdirSync(EXT).filter((f) => /\.(js|html|css|json)$/.test(f));
  for (const f of extFiles) {
    const src = fs.readFileSync(path.join(EXT, f), 'utf8');
    assert.ok(!/storage\.sync/.test(src), `${f} must not use chrome.storage.sync`);
    assert.ok(!/ANTHROPIC_API_KEY|OPENAI_API_KEY|apiKey/.test(src), `${f} must not store API keys`);
    assert.ok(!/\.codex\/auth\.json/.test(src), `${f} must not read Codex auth`);
  }
}

function testRejectsProxyBin() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w10-proxy-'));
  const proxy = path.join(dir, 'codex-proxy');
  fs.writeFileSync(proxy, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const alias = path.join(dir, 'codex');
  fs.symlinkSync(proxy, alias);
  assert.equal(hostMod.acceptCodexBin(proxy), '');
  assert.equal(hostMod.acceptCodexBin(alias), '');
  assert.equal(hostMod.isCodexProxyPath(proxy), true);
  assert.equal(hostMod.isCodexProxyPath(alias), true);
}

async function testDetectAndMissing() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w10-'));
  const proxy = writeCursorMock(dir);
  writePaths(dir, { cursorAgentProxy: proxy });
  const host = startHost(dir, { PATH: '/usr/bin:/bin', HOME: dir });
  host.send({ type: 'detect' });
  await waitFor(() => host.msgs().some((m) => m.type === 'pong'), 1500, 'detect pong');
  const pong = host.msgs().find((m) => m.type === 'pong');
  assert.equal(pong.ok, true);
  assert.equal(pong.cursorAvailable, true);
  assert.equal(pong.codexAvailable, false);
  assert.equal(pong.upstreams.codex.available, false);

  host.send({ type: 'ask', prompt: 'hello', upstream: 'codex' });
  await waitFor(() => host.msgs().some((m) => m.type === 'error'), 1500, 'codex missing error');
  const err = host.msgs().find((m) => m.type === 'error');
  assert.equal(err.error, 'codex_not_found');
  assert.equal(err.ok, false);

  host.send({ type: 'detect' });
  await waitFor(() => host.msgs().filter((m) => m.type === 'pong').length >= 2, 1500, 'desk stays up');
  const pong2 = host.msgs().filter((m) => m.type === 'pong').pop();
  assert.equal(pong2.ok, true);
  await closeHost(host);
}

async function testCodexAskStream() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w10-ask-'));
  const proxy = writeCursorMock(dir);
  const codex = writeCodexMock(dir);
  writePaths(dir, { cursorAgentProxy: proxy, codexBin: codex });
  const argsFile = path.join(dir, 'args.json');
  const cwdDir = path.join(dir, 'work');
  fs.mkdirSync(cwdDir);
  const host = startHost(dir, {
    SOPIFY_MOCK_ARGS: argsFile,
    PATH: '/usr/bin:/bin',
    HOME: dir,
  });
  host.send({ type: 'ask', prompt: 'hello there', cwd: cwdDir, upstream: 'codex', force: true });
  await waitFor(() => host.msgs().some((m) => m.type === 'ask_done'), 2000, 'codex ask_done');
  const types = host.msgs().map((m) => m.type);
  assert.ok(types.includes('ask_start'));
  assert.ok(types.includes('ask_delta'));
  assert.ok(types.includes('ask_done'));
  const text = host.msgs().filter((m) => m.type === 'ask_delta').map((m) => m.text).join('');
  assert.equal(text, 'hello world');
  const dumped = JSON.parse(fs.readFileSync(argsFile, 'utf8'));
  assert.equal(dumped.bin, 'codex');
  assert.deepEqual(dumped.argv, [
    'exec', '-s', 'read-only', '--json', '--ephemeral', '--skip-git-repo-check',
    '-C', cwdDir,
    'hello there',
  ]);
  assert.ok(!dumped.argv.includes('--ask-for-approval'));
  assert.equal(dumped.stdinIsNull, true);
  assert.equal(dumped.cwd, cwdDir);
  await closeHost(host);
}

async function testEmptyCwdOmitsDashC() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w10-cwd-'));
  const proxy = writeCursorMock(dir);
  const codex = writeCodexMock(dir);
  writePaths(dir, { cursorAgentProxy: proxy, codexBin: codex });
  const argsFile = path.join(dir, 'args.json');
  const host = startHost(dir, { SOPIFY_MOCK_ARGS: argsFile, PATH: '/usr/bin:/bin', HOME: dir });
  host.send({ type: 'ask', prompt: 'x', cwd: '', upstream: 'codex' });
  await waitFor(() => host.msgs().some((m) => m.type === 'ask_done'), 2000, 'empty cwd');
  const dumped = JSON.parse(fs.readFileSync(argsFile, 'utf8'));
  assert.ok(!dumped.argv.includes('-C'));
  assert.ok(!dumped.argv.includes('--cd'));
  await closeHost(host);
}

async function testDefaultAskStaysCursor() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w10-default-'));
  const proxy = writeCursorMock(dir);
  const codex = writeCodexMock(dir);
  writePaths(dir, { cursorAgentProxy: proxy, codexBin: codex });
  const argsFile = path.join(dir, 'args.json');
  const host = startHost(dir, { SOPIFY_MOCK_ARGS: argsFile, PATH: '/usr/bin:/bin', HOME: dir });
  host.send({ type: 'ask', prompt: 'hello there', force: true, flags: ['--force'] });
  await waitFor(() => host.msgs().some((m) => m.type === 'ask_done'), 2000, 'default cursor');
  const dumped = JSON.parse(fs.readFileSync(argsFile, 'utf8'));
  assert.equal(dumped.bin, 'cursor');
  await closeHost(host);
}

async function testSwitchKillsThenSpawns() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w10-switch-'));
  const proxy = writeCursorMock(dir);
  const hang = writeCodexMock(dir, 'cursor-hang');
  fs.writeFileSync(proxy, fs.readFileSync(hang, 'utf8').replace("bin: 'codex'", "bin: 'cursor'"), { mode: 0o755 });
  const codex = writeCodexMock(dir);
  writePaths(dir, { cursorAgentProxy: proxy, codexBin: codex });
  const kidFile = path.join(dir, 'kid.pid');
  const argsFile = path.join(dir, 'args.json');
  const host = startHost(dir, {
    SOPIFY_MOCK_HANG: '1',
    SOPIFY_MOCK_KID: kidFile,
    SOPIFY_MOCK_ARGS: argsFile,
    PATH: '/usr/bin:/bin',
    HOME: dir,
  });
  host.send({ type: 'ask', prompt: 'hang', upstream: 'cursor' });
  await waitFor(() => fs.existsSync(kidFile), 1500, 'cursor kid');
  const kid = Number(fs.readFileSync(kidFile, 'utf8').trim());
  assert.ok(alive(kid));
  host.send({ type: 'ask', prompt: 'next', upstream: 'codex' });
  await waitFor(() => host.msgs().some((m) => m.type === 'stopped'), 2000, 'stopped old tree');
  await waitFor(() => !alive(kid), 2000, 'old grandchild killed');
  await waitFor(() => {
    try {
      const dumped = JSON.parse(fs.readFileSync(argsFile, 'utf8'));
      return dumped.bin === 'codex';
    } catch { return false; }
  }, 2000, 'codex spawned after switch');
  await closeHost(host);
}

async function testPathThenSnapshot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w10-path-'));
  const pathDir = path.join(dir, 'bin');
  fs.mkdirSync(pathDir);
  const proxy = writeCursorMock(dir);
  writeCodexMock(pathDir);
  writePaths(dir, { cursorAgentProxy: proxy });
  const argsFile = path.join(dir, 'args.json');
  const host = startHost(dir, {
    PATH: `${pathDir}${path.delimiter}/usr/bin${path.delimiter}/bin`,
    SOPIFY_MOCK_ARGS: argsFile,
    HOME: path.join(dir, 'empty-home'),
  });
  host.send({ type: 'detect' });
  await waitFor(() => host.msgs().some((m) => m.type === 'pong'), 1500, 'path detect');
  assert.equal(host.msgs().find((m) => m.type === 'pong').codexAvailable, true);
  host.send({ type: 'ask', prompt: 'via path', upstream: 'codex' });
  await waitFor(() => host.msgs().some((m) => m.type === 'ask_done'), 2000, 'path ask');
  const dumped = JSON.parse(fs.readFileSync(argsFile, 'utf8'));
  assert.equal(dumped.bin, 'codex');
  await closeHost(host);
}

async function testInstallOptionalCodex() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w10-install-'));
  const proxy = writeCursorMock(dir);
  const codex = writeCodexMock(dir);
  fs.copyFileSync(HOST_SRC, path.join(dir, 'host.js'));
  fs.copyFileSync(INSTALL, path.join(dir, 'install-host.sh'));
  fs.chmodSync(path.join(dir, 'install-host.sh'), 0o755);
  const lib = path.join(dir, 'lib');
  const home = path.join(dir, 'home');
  fs.mkdirSync(home);
  const nmh = path.join(home, '.config/google-chrome/NativeMessagingHosts');
  fs.mkdirSync(nmh, { recursive: true });
  const foreign = path.join(nmh, 'com.openai.codexextension.json');
  fs.writeFileSync(foreign, '{"name":"com.openai.codexextension"}\n');
  const before = fs.readFileSync(foreign, 'utf8');

  execFileSync('bash', [path.join(dir, 'install-host.sh')], {
    env: {
      ...process.env,
      HOME: home,
      SOPIFY_NODE: process.execPath,
      SOPIFY_CURSOR_AGENT_PROXY: proxy,
      SOPIFY_HOST_LIB: lib,
      PATH: '/usr/bin:/bin',
    },
    encoding: 'utf8',
  });
  const paths = JSON.parse(fs.readFileSync(path.join(lib, 'local-paths.json'), 'utf8'));
  assert.equal(paths.cursorAgentProxy, proxy);
  assert.ok(!paths.codexBin);
  assert.equal(fs.readFileSync(foreign, 'utf8'), before);

  execFileSync('bash', [path.join(dir, 'install-host.sh')], {
    env: {
      ...process.env,
      HOME: home,
      SOPIFY_NODE: process.execPath,
      SOPIFY_CURSOR_AGENT_PROXY: proxy,
      SOPIFY_CODEX: codex,
      SOPIFY_HOST_LIB: lib,
      PATH: '/usr/bin:/bin',
    },
    encoding: 'utf8',
  });
  const paths2 = JSON.parse(fs.readFileSync(path.join(lib, 'local-paths.json'), 'utf8'));
  assert.equal(paths2.codexBin, codex);
  assert.equal(fs.readFileSync(foreign, 'utf8'), before);
}

async function testInstallRejectsProxyOverride() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w10-proxy-install-'));
  const proxy = writeCursorMock(dir);
  const bad = path.join(dir, 'codex-proxy');
  fs.writeFileSync(bad, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  fs.copyFileSync(HOST_SRC, path.join(dir, 'host.js'));
  fs.copyFileSync(INSTALL, path.join(dir, 'install-host.sh'));
  fs.chmodSync(path.join(dir, 'install-host.sh'), 0o755);
  const lib = path.join(dir, 'lib');
  const home = path.join(dir, 'home');
  fs.mkdirSync(home);
  let failed = false;
  try {
    execFileSync('bash', [path.join(dir, 'install-host.sh')], {
      env: {
        ...process.env,
        HOME: home,
        SOPIFY_NODE: process.execPath,
        SOPIFY_CURSOR_AGENT_PROXY: proxy,
        SOPIFY_CODEX: bad,
        SOPIFY_HOST_LIB: lib,
        PATH: '/usr/bin:/bin',
      },
      encoding: 'utf8',
    });
  } catch {
    failed = true;
  }
  assert.ok(failed, 'install must refuse SOPIFY_CODEX=codex-proxy');
}

async function main() {
  testUnitIdentityAndParser();
  testStaticForbidAndUi();
  testRejectsProxyBin();
  await testDetectAndMissing();
  await testCodexAskStream();
  await testEmptyCwdOmitsDashC();
  await testDefaultAskStaysCursor();
  await testSwitchKillsThenSpawns();
  await testPathThenSnapshot();
  await testInstallOptionalCodex();
  await testInstallRejectsProxyOverride();
  console.log('w10 codex host tests ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
