'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawn } = require('child_process');

const REPO = path.join(__dirname, '..');
const HOST_SRC = path.join(__dirname, 'host.js');
const EXT = path.join(REPO, 'extension');

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

function writeMock(dir) {
  const mock = path.join(dir, 'cursor-agent-proxy');
  const src = `#!/usr/bin/env node
const fs = require('fs');
const { spawn } = require('child_process');
const argv = process.argv.slice(2);
if (argv.includes('--force') || argv.includes('-f') || argv.includes('--yolo')) {
  process.stderr.write('forbidden_force\\n');
  process.exit(2);
}
if (process.env.SOPIFY_MOCK_ARGS) {
  fs.writeFileSync(process.env.SOPIFY_MOCK_ARGS, JSON.stringify({ argv, cwd: process.cwd() }));
}
let kid = null;
if (process.env.SOPIFY_MOCK_KID) {
  kid = spawn(process.execPath, ['-e', 'setInterval(()=>{},1e9)'], { stdio: 'ignore' });
  fs.writeFileSync(process.env.SOPIFY_MOCK_KID, String(kid.pid));
}
const prompt = argv[argv.length - 1] || '';
if (process.env.SOPIFY_MOCK_HANG) {
  process.stdout.write(JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'partial' }] } }) + '\\n');
  setInterval(() => {}, 1e9);
  return;
}
const events = [
  { type: 'system', subtype: 'init' },
  { type: 'user', message: { role: 'user', content: [{ type: 'text', text: prompt }] } },
  { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'hello' }] } },
  { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'hello world' }] } },
  { type: 'result', subtype: 'success', is_error: false, result: 'hello world' },
];
for (const ev of events) process.stdout.write(JSON.stringify(ev) + '\\n');
`;
  fs.writeFileSync(mock, src, { mode: 0o755 });
  return mock;
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

function writePaths(dir, proxy) {
  fs.writeFileSync(path.join(dir, 'local-paths.json'), JSON.stringify({
    node: process.execPath,
    cursorAgentProxy: proxy,
    hostJs: path.join(dir, 'host.js'),
    wrapper: path.join(dir, 'run'),
    extensionId: 'cgkhllpelkjmfamddkjpnmchjikdcbgp',
    hostId: 'com.sopify.tab',
  }, null, 2));
}

async function closeHost(child) {
  try { child.stdin.end(); } catch { /* ignore */ }
  const start = Date.now();
  while (alive(child.pid) && Date.now() - start < 2000) await sleep(30);
  if (alive(child.pid)) {
    try { child.kill('SIGKILL'); } catch { /* ignore */ }
  }
}

async function testStatic() {
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  assert.equal(manifest.key.slice(0, 20), 'MIIBIjANBgkqhkiG9w0B');
  assert.ok(manifest.key.includes('1rqRBCaMmZBoPt1LMtFpxREI'));
  assert.deepEqual(manifest.optional_permissions, ['nativeMessaging']);
  assert.ok(manifest.permissions.includes('sidePanel'));
  assert.ok(manifest.permissions.includes('storage'));
  assert.ok(manifest.permissions.includes('tabs'));
  assert.ok(!manifest.permissions.includes('nativeMessaging'));
  assert.equal(manifest.side_panel.default_path, 'sidepanel.html');
  assert.equal(manifest.action.default_title, '对话');
  assert.equal(manifest.background.service_worker, 'background.js');

  const host = fs.readFileSync(HOST_SRC, 'utf8');
  assert.ok(host.includes("'--print', '--output-format', 'stream-json', '--mode', 'ask'"));
  assert.ok(host.includes("FORBIDDEN_FLAGS"));
  assert.ok(host.includes('killTree'));
  assert.ok(!/spawn\([^)]*--force/.test(host));

  const panel = fs.readFileSync(path.join(EXT, 'sidepanel.js'), 'utf8');
  assert.ok(!/storage\.local\.set/.test(panel));
  assert.ok(!/chrome\.storage\.sync/.test(panel));
  assert.ok(panel.includes("connectNative(HOST_ID)"));
  assert.ok(panel.includes("type: 'shutdown'"));
  assert.ok(panel.includes("type: 'stop'"));

  const newtab = fs.readFileSync(path.join(EXT, 'newtab.html'), 'utf8');
  assert.ok(newtab.includes('id="open-chat"'));
  assert.ok(newtab.includes('对话'));
  assert.ok(!newtab.includes('class="chat"'));
  assert.ok(!newtab.includes('id="panel-body"'));
  const desk = newtab.split('data-view="desk"')[1].split('data-view="tabs"')[0];
  assert.ok(!/未检测到/.test(desk));
  assert.ok(!/Host/.test(desk));

  const css = fs.readFileSync(path.join(EXT, 'newtab.css'), 'utf8');
  assert.ok(css.includes('grid-template-columns: var(--rail-w) minmax(0, 1fr)'));
  assert.ok(!css.includes('--chat-col'));
  assert.ok(!/chatbtn.*badge|badge.*chatbtn/.test(css));
}

async function testDetect() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w3-'));
  const mock = writeMock(dir);
  writePaths(dir, mock);
  const host = startHost(dir);
  host.send({ type: 'detect' });
  await waitFor(() => host.msgs().some((m) => m.type === 'pong'), 1500, 'detect pong');
  const pong = host.msgs().find((m) => m.type === 'pong');
  assert.equal(pong.ok, true);
  assert.equal(pong.host, 'com.sopify.tab');
  assert.equal(pong.wave, 3);
  await closeHost(host);
}

async function testAskStream() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w3-'));
  const mock = writeMock(dir);
  writePaths(dir, mock);
  const argsFile = path.join(dir, 'args.json');
  const cwdDir = path.join(dir, 'work');
  fs.mkdirSync(cwdDir);
  const host = startHost(dir, { SOPIFY_MOCK_ARGS: argsFile });
  host.send({ type: 'ask', prompt: 'hello there', cwd: cwdDir, force: true, flags: ['--force'] });
  await waitFor(() => host.msgs().some((m) => m.type === 'ask_done'), 2000, 'ask_done');
  const types = host.msgs().map((m) => m.type);
  assert.ok(types.includes('ask_start'));
  assert.ok(types.includes('ask_delta'));
  assert.ok(types.includes('ask_done'));
  const text = host.msgs().filter((m) => m.type === 'ask_delta').map((m) => m.text).join('');
  assert.equal(text, 'hello world');
  const dumped = JSON.parse(fs.readFileSync(argsFile, 'utf8'));
  assert.deepEqual(dumped.argv.slice(0, 5), ['--print', '--output-format', 'stream-json', '--mode', 'ask']);
  assert.ok(!dumped.argv.includes('--force'));
  assert.ok(!dumped.argv.includes('-f'));
  assert.ok(!dumped.argv.includes('--yolo'));
  assert.equal(dumped.argv[dumped.argv.length - 1], 'hello there');
  assert.equal(dumped.cwd, cwdDir);
  await closeHost(host);
}

async function testEmptyCwd() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w3-'));
  const mock = writeMock(dir);
  writePaths(dir, mock);
  const argsFile = path.join(dir, 'args.json');
  const host = startHost(dir, { SOPIFY_MOCK_ARGS: argsFile });
  host.send({ type: 'ask', prompt: 'x', cwd: '' });
  await waitFor(() => host.msgs().some((m) => m.type === 'ask_done'), 2000, 'empty cwd ask');
  const dumped = JSON.parse(fs.readFileSync(argsFile, 'utf8'));
  assert.ok(!dumped.argv.includes('--force'));
  await closeHost(host);
}

async function testKillOnStdinClose() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w3-'));
  const mock = writeMock(dir);
  writePaths(dir, mock);
  const kidFile = path.join(dir, 'kid.pid');
  const host = startHost(dir, { SOPIFY_MOCK_HANG: '1', SOPIFY_MOCK_KID: kidFile });
  host.send({ type: 'ask', prompt: 'hang' });
  await waitFor(() => fs.existsSync(kidFile), 1500, 'kid pid');
  const kid = Number(fs.readFileSync(kidFile, 'utf8').trim());
  assert.ok(alive(kid), 'grandchild should be alive while streaming');
  await waitFor(() => host.msgs().some((m) => m.type === 'ask_start'), 1500, 'ask_start');
  await closeHost(host);
  await waitFor(() => !alive(kid), 2000, 'grandchild killed on stdin EOF');
  assert.ok(!alive(host.pid), 'host should exit after stdin close');
}

async function testStopKillsTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w3-'));
  const mock = writeMock(dir);
  writePaths(dir, mock);
  const kidFile = path.join(dir, 'kid.pid');
  const host = startHost(dir, { SOPIFY_MOCK_HANG: '1', SOPIFY_MOCK_KID: kidFile });
  host.send({ type: 'ask', prompt: 'hang' });
  await waitFor(() => fs.existsSync(kidFile), 1500, 'kid pid');
  const kid = Number(fs.readFileSync(kidFile, 'utf8').trim());
  assert.ok(alive(kid));
  host.send({ type: 'stop' });
  await waitFor(() => host.msgs().some((m) => m.type === 'stopped'), 2000, 'stopped');
  await waitFor(() => !alive(kid), 2000, 'grandchild killed on stop');
  assert.ok(alive(host.pid), 'host stays up after stop');
  await closeHost(host);
}

async function main() {
  await testStatic();
  await testDetect();
  await testAskStream();
  await testEmptyCwd();
  await testKillOnStdinClose();
  await testStopKillsTree();
  console.log('w3 ask/kill tests ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
