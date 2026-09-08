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
  const src = `#!/usr/bin/env node
const fs = require('fs');
const { spawn } = require('child_process');
const argv = process.argv.slice(2);
if (argv.includes('--force') || argv.includes('-f') || argv.includes('--yolo')) {
  process.stderr.write('forbidden_force\\n');
  process.exit(2);
}
if (process.env.SOPIFY_MOCK_ARGS) {
  fs.writeFileSync(process.env.SOPIFY_MOCK_ARGS, JSON.stringify({ argv, cwd: process.cwd(), bin: 'cursor' }));
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
  { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'hello' }] } },
  { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'hello world' }] } },
  { type: 'result', subtype: 'success', is_error: false, result: 'hello world' },
];
for (const ev of events) process.stdout.write(JSON.stringify(ev) + '\\n');
`;
  fs.writeFileSync(mock, src, { mode: 0o755 });
  return mock;
}

function writeClaudeMock(dir) {
  const mock = path.join(dir, 'claude');
  const src = `#!/usr/bin/env node
const fs = require('fs');
const { spawn } = require('child_process');
const argv = process.argv.slice(2);
const banned = ['--force', '-f', '--yolo', '--dangerously-skip-permissions', 'acceptEdits', 'bypassPermissions', 'Edit', 'Write', 'Bash'];
if (argv.some((a) => banned.includes(a))) {
  process.stderr.write('forbidden_claude\\n');
  process.exit(2);
}
if (process.env.SOPIFY_MOCK_ARGS) {
  fs.writeFileSync(process.env.SOPIFY_MOCK_ARGS, JSON.stringify({ argv, cwd: process.cwd(), bin: 'claude' }));
}
let kid = null;
if (process.env.SOPIFY_MOCK_KID) {
  kid = spawn(process.execPath, ['-e', 'setInterval(()=>{},1e9)'], { stdio: 'ignore' });
  fs.writeFileSync(process.env.SOPIFY_MOCK_KID, String(kid.pid));
}
if (process.env.SOPIFY_MOCK_HANG) {
  process.stdout.write(JSON.stringify({
    type: 'stream_event',
    event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'partial' } },
  }) + '\\n');
  setInterval(() => {}, 1e9);
  return;
}
const events = [
  { type: 'system', subtype: 'init' },
  { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hello' } } },
  { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } } },
  { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'hello world' }] } },
  { type: 'result', subtype: 'success', is_error: false, result: 'hello world' },
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

function testUnitTableAndArgv() {
  assert.deepEqual(hostMod.UPSTREAM_IDS, ['cursor', 'claude']);
  assert.deepEqual(Object.keys(hostMod.UPSTREAMS), ['cursor', 'claude']);
  assert.equal(hostMod.UPSTREAMS.cursor.pathKey, 'cursorAgentProxy');
  assert.equal(hostMod.UPSTREAMS.claude.pathKey, 'claudeBin');
  assert.equal(typeof hostMod.UPSTREAMS.cursor.buildArgs, 'function');
  assert.equal(typeof hostMod.UPSTREAMS.claude.buildArgs, 'function');
  assert.equal(typeof hostMod.UPSTREAMS.cursor.feed, 'function');
  assert.equal(typeof hostMod.UPSTREAMS.claude.feed, 'function');
  assert.ok(!('codex' in hostMod.UPSTREAMS));
  assert.ok(!('grok' in hostMod.UPSTREAMS));
  assert.ok(!('deepseek' in hostMod.UPSTREAMS));

  assert.equal(hostMod.normalizeUpstream(undefined), 'cursor');
  assert.equal(hostMod.normalizeUpstream(''), 'cursor');
  assert.equal(hostMod.normalizeUpstream('cursor'), 'cursor');
  assert.equal(hostMod.normalizeUpstream('claude'), 'claude');
  assert.equal(hostMod.normalizeUpstream('codex'), 'cursor');
  assert.equal(hostMod.normalizeUpstream('grok'), 'cursor');

  assert.deepEqual(hostMod.ASK_ARGS, ['--print', '--output-format', 'stream-json', '--mode', 'ask']);
  assert.deepEqual(hostMod.askArgs('hello there'), [
    '--print', '--output-format', 'stream-json', '--mode', 'ask', 'hello there',
  ]);

  const claudeArgs = hostMod.claudeAskArgs('Summarize README.md');
  assert.deepEqual(claudeArgs, [
    '--bare',
    '-p', 'Summarize README.md',
    '--permission-mode', 'dontAsk',
    '--allowedTools', 'Read',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
  ]);
  assert.ok(!claudeArgs.includes('--force'));
  assert.ok(!claudeArgs.includes('-f'));
  assert.ok(!claudeArgs.includes('--yolo'));
  assert.ok(!claudeArgs.includes('--dangerously-skip-permissions'));
  assert.ok(!claudeArgs.includes('acceptEdits'));
  assert.ok(!claudeArgs.includes('bypassPermissions'));
  assert.ok(!claudeArgs.includes('Edit'));
  assert.ok(!claudeArgs.includes('Write'));
  assert.ok(!claudeArgs.includes('Bash'));
  assert.equal(claudeArgs[claudeArgs.indexOf('--allowedTools') + 1], 'Read');
  assert.equal(claudeArgs[claudeArgs.indexOf('--permission-mode') + 1], 'dontAsk');

  const delta = hostMod.claudeEventKind({
    type: 'stream_event',
    event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } },
  });
  assert.deepEqual(delta, { kind: 'delta', text: 'hi' });
}

function testStaticUiAndReadme() {
  const hostSrc = fs.readFileSync(HOST_SRC, 'utf8');
  assert.ok(hostSrc.includes("'--print', '--output-format', 'stream-json', '--mode', 'ask'"));
  assert.ok(hostSrc.includes("'--bare'"));
  assert.ok(hostSrc.includes("'--permission-mode', 'dontAsk'"));
  assert.ok(hostSrc.includes("'--allowedTools', 'Read'"));
  assert.ok(hostSrc.includes("'--include-partial-messages'"));
  assert.ok(hostSrc.includes('killTree'));
  assert.ok(!/spawn\([^)]*--force/.test(hostSrc));
  assert.ok(!/webhook/i.test(hostSrc));
  assert.ok(!/createServer|http\.listen|express\(/i.test(hostSrc));
  assert.ok(!/plugin|registerUpstream|loadPlugin/i.test(hostSrc));

  const install = fs.readFileSync(INSTALL, 'utf8');
  assert.ok(install.includes('find_claude'));
  assert.ok(install.includes('snapshot_claude'));
  assert.ok(install.includes('claudeBin'));
  assert.ok(install.includes('SOPIFY_CLAUDE'));
  assert.ok(install.includes('未找到，可选'));

  const newtab = fs.readFileSync(path.join(EXT, 'newtab.html'), 'utf8');
  const desk = newtab.split('data-view="desk"')[1].split('data-view="tabs"')[0];
  const settings = newtab.split('data-view="settings"')[1];
  const rail = newtab.slice(newtab.indexOf('class="rail"'), newtab.indexOf('class="main"'));
  assert.ok(settings.includes('name="hostUpstream"'));
  assert.ok(settings.includes('value="cursor"') && settings.includes('value="claude"'));
  assert.ok(!settings.includes('value="codex"'));
  assert.ok(!settings.includes('Grok') && !settings.includes('DeepSeek') && !settings.includes('Codex'));
  assert.ok(!desk.includes('hostUpstream'));
  assert.ok(!desk.includes('上游'));
  assert.ok(!desk.includes('Claude'));
  assert.ok(!desk.includes('模型'));
  assert.ok(!rail.includes('hostUpstream'));
  assert.ok(!rail.includes('上游'));
  assert.ok(!/任意 Agent|任意本机/.test(newtab));

  const newtabJs = fs.readFileSync(path.join(EXT, 'newtab.js'), 'utf8');
  assert.ok(newtabJs.includes("chrome.storage.local.set({ hostUpstream: next })"));
  assert.ok(!/storage\.sync/.test(newtabJs));
  assert.ok(!/ANTHROPIC_API_KEY|apiKey|api_key/.test(newtabJs));

  const panel = fs.readFileSync(path.join(EXT, 'sidepanel.js'), 'utf8');
  const panelHtml = fs.readFileSync(path.join(EXT, 'sidepanel.html'), 'utf8');
  assert.ok(!/storage\.local\.set/.test(panel));
  assert.ok(!/chrome\.storage\.sync/.test(panel));
  assert.ok(panel.includes("type: 'ask'"));
  assert.ok(panel.includes('upstream: state.upstream'));
  assert.ok(panel.includes('applyUpstream'));
  assert.ok(panelHtml.includes('id="open-settings"'));
  assert.ok(panelHtml.includes('去设置'));
  assert.ok(!/name="hostUpstream"/.test(panelHtml));
  assert.ok(!/<select/.test(panelHtml));
  assert.ok(!/switcher|模型墙|任意 Agent/.test(panelHtml + panel));

  const readme = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
  assert.ok(/Claude/.test(readme), 'README may mention optional Claude after wiring');
  assert.ok(/默认仍是 Cursor|默认.*Cursor/.test(readme));
  assert.ok(!/多 CLI 已全量|任意 Agent|任意本机 Agent/.test(readme));
  assert.ok(!/webhook/i.test(readme));
  assert.ok(!/Codex|Grok|DeepSeek/.test(readme));
  assert.ok(/上架未定|暂停/.test(readme));
  assert.ok(/HTTP_PROXY|HTTPS_PROXY/.test(readme));

  const extFiles = fs.readdirSync(EXT).filter((f) => /\.(js|html|css|json)$/.test(f));
  for (const f of extFiles) {
    const src = fs.readFileSync(path.join(EXT, f), 'utf8');
    assert.ok(!/storage\.sync/.test(src), `${f} must not use chrome.storage.sync`);
    assert.ok(!/ANTHROPIC_API_KEY|apiKey/.test(src), `${f} must not store API keys`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.permissions, ['storage', 'tabs', 'sidePanel']);
  assert.deepEqual(manifest.optional_permissions, ['nativeMessaging']);
}

async function testDetectBoth() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w6-'));
  const proxy = writeCursorMock(dir);
  const claude = writeClaudeMock(dir);
  writePaths(dir, { cursorAgentProxy: proxy, claudeBin: claude });
  const host = startHost(dir, { PATH: '/usr/bin:/bin' });
  host.send({ type: 'detect' });
  await waitFor(() => host.msgs().some((m) => m.type === 'pong'), 1500, 'detect pong');
  const pong = host.msgs().find((m) => m.type === 'pong');
  assert.equal(pong.ok, true);
  assert.equal(pong.host, 'com.sopify.tab');
  assert.equal(pong.wave, 3);
  assert.equal(pong.cursorAvailable, true);
  assert.equal(pong.claudeAvailable, true);
  assert.deepEqual(Object.keys(pong.upstreams), ['cursor', 'claude']);
  await closeHost(host);
}

async function testClaudeMissingHonest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w6-'));
  const proxy = writeCursorMock(dir);
  writePaths(dir, { cursorAgentProxy: proxy });
  const host = startHost(dir, { PATH: '/usr/bin:/bin' });
  host.send({ type: 'detect' });
  await waitFor(() => host.msgs().some((m) => m.type === 'pong'), 1500, 'detect pong');
  const pong = host.msgs().find((m) => m.type === 'pong');
  assert.equal(pong.ok, true);
  assert.equal(pong.cursorAvailable, true);
  assert.equal(pong.claudeAvailable, false);

  host.send({ type: 'ask', prompt: 'hello', upstream: 'claude' });
  await waitFor(() => host.msgs().some((m) => m.type === 'error'), 1500, 'claude missing error');
  const err = host.msgs().find((m) => m.type === 'error');
  assert.equal(err.error, 'claude_not_found');
  assert.equal(err.ok, false);

  host.send({ type: 'detect' });
  await waitFor(() => host.msgs().filter((m) => m.type === 'pong').length >= 2, 1500, 'second pong');
  const pong2 = host.msgs().filter((m) => m.type === 'pong').pop();
  assert.equal(pong2.ok, true, 'desk/host stay up after Claude ENOENT');
  await closeHost(host);
}

async function testClaudeAskStream() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w6-'));
  const proxy = writeCursorMock(dir);
  const claude = writeClaudeMock(dir);
  writePaths(dir, { cursorAgentProxy: proxy, claudeBin: claude });
  const argsFile = path.join(dir, 'args.json');
  const cwdDir = path.join(dir, 'work');
  fs.mkdirSync(cwdDir);
  const host = startHost(dir, { SOPIFY_MOCK_ARGS: argsFile, PATH: '/usr/bin:/bin' });
  host.send({ type: 'ask', prompt: 'hello there', cwd: cwdDir, upstream: 'claude', force: true });
  await waitFor(() => host.msgs().some((m) => m.type === 'ask_done'), 2000, 'claude ask_done');
  const types = host.msgs().map((m) => m.type);
  assert.ok(types.includes('ask_start'));
  assert.ok(types.includes('ask_delta'));
  assert.ok(types.includes('ask_done'));
  const text = host.msgs().filter((m) => m.type === 'ask_delta').map((m) => m.text).join('');
  assert.equal(text, 'hello world');
  const dumped = JSON.parse(fs.readFileSync(argsFile, 'utf8'));
  assert.equal(dumped.bin, 'claude');
  assert.deepEqual(dumped.argv, [
    '--bare',
    '-p', 'hello there',
    '--permission-mode', 'dontAsk',
    '--allowedTools', 'Read',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
  ]);
  assert.equal(dumped.cwd, cwdDir);
  await closeHost(host);
}

async function testDefaultAskStaysCursor() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w6-'));
  const proxy = writeCursorMock(dir);
  const claude = writeClaudeMock(dir);
  writePaths(dir, { cursorAgentProxy: proxy, claudeBin: claude });
  const argsFile = path.join(dir, 'args.json');
  const host = startHost(dir, { SOPIFY_MOCK_ARGS: argsFile, PATH: '/usr/bin:/bin' });
  host.send({ type: 'ask', prompt: 'hello there', force: true, flags: ['--force'] });
  await waitFor(() => host.msgs().some((m) => m.type === 'ask_done'), 2000, 'default cursor ask');
  const dumped = JSON.parse(fs.readFileSync(argsFile, 'utf8'));
  assert.equal(dumped.bin, 'cursor');
  assert.deepEqual(dumped.argv.slice(0, 5), ['--print', '--output-format', 'stream-json', '--mode', 'ask']);
  assert.ok(!dumped.argv.includes('--force'));
  await closeHost(host);
}

async function testUnknownUpstreamFallsBackCursor() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w6-'));
  const proxy = writeCursorMock(dir);
  writePaths(dir, { cursorAgentProxy: proxy });
  const argsFile = path.join(dir, 'args.json');
  const host = startHost(dir, { SOPIFY_MOCK_ARGS: argsFile, PATH: '/usr/bin:/bin' });
  host.send({ type: 'ask', prompt: 'x', upstream: 'codex' });
  await waitFor(() => host.msgs().some((m) => m.type === 'ask_done'), 2000, 'codex falls back');
  const dumped = JSON.parse(fs.readFileSync(argsFile, 'utf8'));
  assert.equal(dumped.bin, 'cursor');
  await closeHost(host);
}

async function testSwitchKillsThenSpawns() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w6-'));
  const proxy = writeCursorMock(dir);
  const claude = writeClaudeMock(dir);
  writePaths(dir, { cursorAgentProxy: proxy, claudeBin: claude });
  const kidFile = path.join(dir, 'kid.pid');
  const argsFile = path.join(dir, 'args.json');
  const host = startHost(dir, {
    SOPIFY_MOCK_HANG: '1',
    SOPIFY_MOCK_KID: kidFile,
    SOPIFY_MOCK_ARGS: argsFile,
    PATH: '/usr/bin:/bin',
  });
  host.send({ type: 'ask', prompt: 'hang', upstream: 'cursor' });
  await waitFor(() => fs.existsSync(kidFile), 1500, 'cursor kid');
  const kid = Number(fs.readFileSync(kidFile, 'utf8').trim());
  assert.ok(alive(kid));
  host.send({ type: 'ask', prompt: 'next', upstream: 'claude' });
  await waitFor(() => host.msgs().some((m) => m.type === 'stopped'), 2000, 'stopped old tree');
  await waitFor(() => !alive(kid), 2000, 'old grandchild killed');
  await waitFor(() => {
    try {
      const dumped = JSON.parse(fs.readFileSync(argsFile, 'utf8'));
      return dumped.bin === 'claude';
    } catch { return false; }
  }, 2000, 'claude spawned after switch');
  await closeHost(host);
}

async function testClaudePathThenSnapshot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w6-'));
  const pathDir = path.join(dir, 'bin');
  fs.mkdirSync(pathDir);
  const proxy = writeCursorMock(dir);
  const pathClaude = writeClaudeMock(pathDir);
  writePaths(dir, { cursorAgentProxy: proxy });
  const argsFile = path.join(dir, 'args.json');
  const host = startHost(dir, {
    PATH: `${pathDir}${path.delimiter}/usr/bin${path.delimiter}/bin`,
    SOPIFY_MOCK_ARGS: argsFile,
  });
  host.send({ type: 'detect' });
  await waitFor(() => host.msgs().some((m) => m.type === 'pong'), 1500, 'path detect');
  assert.equal(host.msgs().find((m) => m.type === 'pong').claudeAvailable, true);
  host.send({ type: 'ask', prompt: 'via path', upstream: 'claude' });
  await waitFor(() => host.msgs().some((m) => m.type === 'ask_done'), 2000, 'path ask');
  const dumped = JSON.parse(fs.readFileSync(argsFile, 'utf8'));
  assert.equal(dumped.bin, 'claude');
  assert.ok(fs.existsSync(pathClaude));
  await closeHost(host);
}

async function testInstallOptionalClaude() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-w6-install-'));
  const proxy = writeCursorMock(dir);
  fs.copyFileSync(HOST_SRC, path.join(dir, 'host.js'));
  fs.copyFileSync(INSTALL, path.join(dir, 'install-host.sh'));
  fs.chmodSync(path.join(dir, 'install-host.sh'), 0o755);
  const lib = path.join(dir, 'lib');
  const home = path.join(dir, 'home');
  fs.mkdirSync(home);
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
  assert.ok(!paths.claudeBin);

  const claude = writeClaudeMock(dir);
  execFileSync('bash', [path.join(dir, 'install-host.sh')], {
    env: {
      ...process.env,
      HOME: home,
      SOPIFY_NODE: process.execPath,
      SOPIFY_CURSOR_AGENT_PROXY: proxy,
      SOPIFY_CLAUDE: claude,
      SOPIFY_HOST_LIB: lib,
      PATH: '/usr/bin:/bin',
    },
    encoding: 'utf8',
  });
  const paths2 = JSON.parse(fs.readFileSync(path.join(lib, 'local-paths.json'), 'utf8'));
  assert.equal(paths2.claudeBin, claude);
}

async function main() {
  testUnitTableAndArgv();
  testStaticUiAndReadme();
  await testDetectBoth();
  await testClaudeMissingHonest();
  await testClaudeAskStream();
  await testDefaultAskStaysCursor();
  await testUnknownUpstreamFallsBackCursor();
  await testSwitchKillsThenSpawns();
  await testClaudePathThenSnapshot();
  await testInstallOptionalClaude();
  console.log('w6 multi-host tests ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
