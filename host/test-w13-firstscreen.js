'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const EXT = path.join(__dirname, '..', 'extension');

function read(name) {
  return fs.readFileSync(path.join(EXT, name), 'utf8');
}

function relChannel(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = relChannel((n >> 16) & 255);
  const g = relChannel((n >> 8) & 255);
  const b = relChannel(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const L1 = luminance(a);
  const L2 = luminance(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

function ruleBlock(css, start) {
  const i = css.indexOf(start);
  assert.ok(i !== -1, `missing ${start}`);
  const j = css.indexOf('}', i);
  return css.slice(i, j);
}

function hexToken(block, name) {
  const m = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `${name} missing in ${block.slice(0, 40)}`);
  return m[1].toLowerCase();
}

const html = read('newtab.html');
const css = read('newtab.css');
const js = read('newtab.js');
const boot = read('desk-3d/boot.js');
const desk = html.slice(html.indexOf('data-view="desk"'), html.indexOf('data-view="tabs"'));
const settings = html.slice(html.indexOf('data-view="settings"'));

assert.ok(!html.includes('我的工作台'));
assert.ok(!html.includes('studio-theme-toggle'));
assert.ok(!desk.includes('工作集') && !settings.includes('工作集'));
assert.ok(html.includes('接着上次') && html.includes('保存这个窗口') && html.includes('存下的窗口'));

const whitelist = new Set(['todo-input-dialog']);
const ids = [...js.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]);
for (const id of new Set(ids)) {
  if (whitelist.has(id) || id.startsWith('desk3d-')) continue;
  assert.ok(html.includes(`id="${id}"`), `ungarded $('#${id}') must exist in newtab.html`);
}

assert.ok(boot.includes('import('));
assert.ok(!/import\s+[^;]*from\s+['"]\.\/embed\.js['"]/.test(boot));

assert.ok(/let spaceViewOn = false/.test(js));
assert.ok(js.includes('data.spaceView === true'));
assert.ok(!/localStorage/.test(js));
assert.ok(!/DESK_KEYS = \[[^\]]*spaceView/.test(js));

const day = ruleBlock(css, 'html[data-sky="day"]');
const night = ruleBlock(css, 'html[data-sky="night"]');
const dayPaper = hexToken(day, '--studio-paper');
const dayMuted = hexToken(day, '--studio-muted');
const dayFaint = hexToken(day, '--studio-faint');
const nightPaper = hexToken(night, '--studio-paper');
const nightMuted = hexToken(night, '--studio-muted');
const nightFaint = hexToken(night, '--studio-faint');
assert.ok(contrast(dayMuted, dayPaper) >= 4.5, 'day secondary text contrast');
assert.ok(contrast(dayFaint, dayPaper) >= 3, 'day placeholder contrast');
assert.ok(contrast(nightMuted, nightPaper) >= 4.5, 'night secondary text contrast');
assert.ok(contrast(nightFaint, nightPaper) >= 3, 'night placeholder contrast');

const shared = ['--ink', '--ink-2', '--accent', '--line', '--line-2'];
for (const name of shared) {
  const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`, 'g');
  assert.strictEqual((css.match(re) || []).length, 0, `newtab.css must not assign ${name}`);
}

assert.ok(/id="resume"[^>]*data-has="pending"/.test(html), 'resume starts pending');
assert.ok(css.includes('.next[data-has="pending"] .next-compose { display: none; }'));
assert.ok(css.includes('.next[data-has="pending"] .next-filled { visibility: hidden; }'));
assert.ok(css.includes('.next[data-has="pending"] .next-title { min-height: 1.2em; }'));
assert.ok(/root\.dataset\.has = has \? '1' : '0'/.test(js), 'renderResume writes 0 or 1');
assert.ok(css.includes('.studio-desk .shelf textarea.note'));
assert.ok(!/\.studio-desk \.note \{/.test(css), 'note field styles must not match the 3D label');

const firstScreen = css.slice(css.indexOf('v3 first screen'));
assert.ok(firstScreen.includes('18% 40%'));
assert.ok(!firstScreen.includes('42% 42%'), 'first screen chips must not use 42% 42%');
assert.ok(firstScreen.includes('max-width: calc(1040px + 64px)'));
assert.ok(/body\.studio-home:not\(\.sidepanel\) \.main/.test(firstScreen));

const starsAt = css.indexOf('.stars-layer {');
assert.ok(starsAt !== -1);
const starsRule = css.slice(starsAt, css.indexOf('}', starsAt));
assert.ok(!/animation\s*:/.test(starsRule));
assert.ok(/html\[data-sky="night"\][^{]*\.stars-layer\s*\{[^}]*opacity:\s*1/.test(css));
assert.ok(!/<canvas/i.test(html));
assert.ok(!/getContext\s*\(\s*['"](?:webgl|experimental-webgl)['"]/i.test(html + js + css));

const SANS_FALLBACK = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif';
const SONG_STACK = `"Songti SC", "Songti TC", "STSong", "Source Han Serif SC", "Noto Serif CJK SC", "Noto Serif SC", "Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "MS PMincho", ${SANS_FALLBACK}`;
const titleInput = ruleBlock(css, '.studio-desk .next-title, .studio-desk .next-input');
assert.ok(titleInput.includes(`font-family: ${SONG_STACK}`), 'next title and input use the Songti stack');
assert.ok(titleInput.includes('font-weight: 700'), 'next title and input are weight 700');
assert.ok(titleInput.includes('letter-spacing: -0.01em'), 'default tracking is -0.01em');
assert.ok(titleInput.includes('.next-title') && titleInput.includes('.next-input'));
const family = (titleInput.split('font-family:')[1] || '').split(';')[0];
assert.ok(family.includes(SANS_FALLBACK), 'Songti stack falls back to the system sans');
assert.ok(!/SimSun|宋体/.test(family), 'Songti stack must not name SimSun or 宋体');
assert.ok(!/(^|,)\s*serif\s*(,|$)/i.test(family), 'Songti stack must not use bare serif');
assert.ok(/letter-spacing:\s*-0\.02em/.test(ruleBlock(css, '.next-title[data-size="l"]')), 'long titles keep their own tracking');
assert.ok(day.includes('--studio-field: rgba(38, 42, 51, 0.04);'));
assert.ok(day.includes('--studio-field-hi: rgba(38, 42, 51, 0.07);'));
assert.ok(night.includes('--studio-field: rgba(255, 255, 255, 0.04);'));
assert.ok(night.includes('--studio-field-hi: rgba(255, 255, 255, 0.07);'));
assert.ok(css.includes('.studio-desk .shelf textarea.note:placeholder-shown { background: var(--studio-field); }'));
assert.ok(css.includes('.studio-desk .shelf textarea.note:placeholder-shown:hover { background: var(--studio-field-hi); }'));

function braceBlock(src, start) {
  const i = src.indexOf(start);
  assert.ok(i !== -1, `missing ${start}`);
  const open = src.indexOf('{', i);
  let depth = 0;
  for (let p = open; p < src.length; p += 1) {
    if (src[p] === '{') depth += 1;
    else if (src[p] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(i, p + 1);
    }
  }
  throw new Error(`unclosed ${start}`);
}

assert.ok(!/height:\s*calc\(\s*100dvh\s*-\s*64px\s*\)/.test(css), 'studio-screen height lock is gone');
const screenRule = braceBlock(css, '.studio-screen {');
assert.ok(!/(?:^|[^-])height\s*:/.test(screenRule), 'studio-screen rule does not set a height');
assert.ok(!/overflow\s*:/.test(screenRule), 'studio-screen rule does not clip overflow');

const shortQ = braceBlock(css, '@media (max-height: 760px)');
assert.ok(shortQ.includes('.hero') && shortQ.includes('.next-actions') && shortQ.includes('.shelf') && shortQ.includes('.sites'));
assert.ok(!/overflow\s*:/.test(shortQ), 'short viewport query does not clip overflow');
assert.ok(!/font-size\s*:/.test(shortQ), 'short viewport query does not shrink type');
assert.ok(css.includes('.studio-desk .sites .tile .lbl { font-size: 13px; max-width: 6em; color: inherit; }'));
assert.ok(css.includes('html[data-boot-focus] #resume-act:focus-visible { outline: none; }'));
assert.ok(css.includes('html[data-boot-focus] .next-input:focus-visible { outline: none; }'));
assert.ok(!/(^|\n)\.next-input:focus-visible \{ outline: none; \}/.test(css), 'input ring is suppressed only while html[data-boot-focus]');
assert.ok(css.includes('.next-input:focus { border-bottom-color: var(--studio-accent); }'));
assert.ok(!css.includes('.next-input[data-boot-focus]'), 'boot mark is on html, not the input');
const studioFocusVis = css.indexOf('.studio-desk :focus-visible');
const nextInputFocusVis = css.indexOf('html[data-boot-focus] .next-input:focus-visible { outline: none; }');
assert.ok(studioFocusVis !== -1 && nextInputFocusVis > studioFocusVis, 'boot input rule follows the studio ring');
assert.ok(css.includes('.studio-desk .shelf textarea.note:focus-visible'));
assert.ok(css.includes('--studio-danger:'));
assert.ok(/z-index:\s*70/.test(braceBlock(css, '.toast')), 'toast z-index stays 70');

assert.ok(html.includes('id="todos-open">全部待办'));
assert.ok(html.includes('id="site-url-error"'));
assert.ok(html.includes('id="sites-more"'));
assert.ok(html.includes('aria-describedby="site-url-error"'));

function fnBody(src, signature) {
  return braceBlock(src, signature);
}
const queueBody = fnBody(js, 'function queueNoteSave()');
assert.ok(!/setTimeout/.test(queueBody), 'queueNoteSave has no debounce timer');
assert.ok(!/\b400\b/.test(queueBody));
const pumpBody = fnBody(js, 'function pumpNoteSave()');
assert.ok(pumpBody.includes('saveDesk({ notes: state.notes })'));
assert.ok(pumpBody.includes("setNotesSavedStatus('已存在本机')"));
assert.ok(pumpBody.includes("setNotesSavedStatus('没存上')"));
assert.ok(queueBody.includes("setNotesSavedStatus('保存中…')"));
assert.ok(!js.includes('没存上，稍后再试'));
assert.ok(fnBody(js, 'function saveDeskNoteFrom3d(').includes('queueNoteSave()'));
assert.ok(js.includes('state.sites.slice(0, 8)'));
assert.ok(js.includes('more.textContent = `全部 ${state.sites.length} 个`'));
assert.ok(js.includes('showSiteUrlError('));
assert.ok(!/toast\('网址需要是 http\(s\)'\)/.test(js));
assert.ok(!js.includes('这是最后一条'), 'button copy never says 这是最后一条');
assert.ok(!js.includes('之后还有'), 'button copy does not use 之后还有');
const resumeBody = fnBody(js, 'function renderResume()');
assert.ok(resumeBody.includes('全部待办 · 还有 '));
assert.ok(resumeBody.includes('全部待办 · 已完成 '));
assert.ok(resumeBody.includes("open.textContent = '全部待办'"));
assert.ok(!resumeBody.includes('这是最后一条'));
const bootBody = fnBody(js, 'async function boot()');
const bootMark = bootBody.indexOf("document.documentElement.setAttribute('data-boot-focus', '')");
const bootFocus = bootBody.indexOf('focusDeskPrimary()');
assert.ok(bootMark !== -1 && bootFocus !== -1 && bootMark < bootFocus, 'boot marks html before focusDeskPrimary');
assert.ok(bootBody.includes("addEventListener('keydown', clearBootFocus)"));
assert.ok(bootBody.includes("addEventListener('pointerdown', clearBootFocus)"));
assert.ok(bootBody.includes("document.documentElement.removeAttribute('data-boot-focus')"));
const setViewBody = fnBody(js, 'function setView(v, opts)');
assert.ok(setViewBody.includes('focusDeskPrimary()'));
assert.ok(!setViewBody.includes('data-boot-focus'), 'only boot() sets data-boot-focus');
const closeAt = js.indexOf("todosDialog.addEventListener('close'");
const closeNext = js.indexOf("todosDialog.addEventListener('keydown'", closeAt);
assert.ok(closeAt !== -1 && closeNext > closeAt);
assert.ok(js.slice(closeAt, closeNext).includes('focusDeskPrimary()'), 'todos dialog close returns focus via focusDeskPrimary');
assert.ok(fnBody(js, 'function focusDeskPrimary()').includes("$('#resume-act')"));
assert.ok(fnBody(js, 'function focusDeskPrimary()').includes("$('#todo-input')"));

const ui = read('desk-3d/ui.js');
assert.ok(ui.includes('this.host.saveNote(this.noteEditor.value)'), '3D note editor uses the host save path');
assert.ok(!/chrome\.storage/.test(ui));

console.log('test-w13-firstscreen static: ok');

const http = require('http');
const { spawn } = require('child_process');

const FOUR_LINE_TITLE = `${'把首屏长标题排满'.repeat(24)}第四行`;
const LONG_SITE = '超级长的常用站名称用来考验省略号不会把第一屏撑高';
const SIZES = [
  [1440, 900],
  [1512, 823],
  [1280, 720],
  [1366, 650],
];
const TODO_KINDS = ['empty', '1', '5', 'long'];
const SITE_COUNTS = [0, 6, 16, 40];

function todoItems(kind) {
  if (kind === 'empty') return [];
  if (kind === '1') return [{ id: 't1', text: '回一封邮件', done: false }];
  if (kind === '5') return [1, 2, 3, 4, 5].map((n) => ({ id: `t${n}`, text: `待办${n}`, done: false }));
  return [{ id: 'long', text: FOUR_LINE_TITLE, done: false }];
}

function siteItems(count, longNames) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      name: longNames ? `${LONG_SITE}${i + 1}` : `站${i + 1}`,
      url: `https://example.com/${longNames ? 'long' : 's'}/${i + 1}`,
    });
  }
  return out;
}

function stubSource(seed) {
  return `(() => {
    const seed = ${JSON.stringify(seed)};
    try { localStorage.setItem('themePreset', 'day'); } catch (e) {}
    const store = {
      sites: seed.sites || [],
      todos: seed.todos || [],
      notes: typeof seed.notes === 'string' ? seed.notes : '',
      name: seed.name || '',
      worksets: [],
      spaceView: false,
      cwd: '',
      hostUpstream: 'cursor',
      themePreset: 'day',
    };
    let noteWrites = 0;
    const delay = seed.storageDelay || 0;
    window.__sopifyStore = store;
    window.__sopifyNoteWrites = () => noteWrites;
    window.chrome = {
      storage: {
        local: {
          get(defaults) {
            const out = {};
            const src = defaults && typeof defaults === 'object' ? defaults : {};
            Object.keys(src).forEach((k) => {
              out[k] = Object.prototype.hasOwnProperty.call(store, k) ? store[k] : src[k];
            });
            return Promise.resolve(out);
          },
          set(partial) {
            return new Promise((resolve, reject) => {
              const run = () => {
                if (seed.failNotes && partial && Object.prototype.hasOwnProperty.call(partial, 'notes')) {
                  reject(new Error('storage failed'));
                  return;
                }
                if (partial && Object.prototype.hasOwnProperty.call(partial, 'notes')) noteWrites += 1;
                Object.assign(store, partial || {});
                resolve();
              };
              if (delay) setTimeout(run, delay);
              else run();
            });
          },
        },
        onChanged: { addListener() {} },
      },
      runtime: {
        onMessage: { addListener() {} },
        sendMessage() {},
        getURL(p) { return String(p || ''); },
        lastError: null,
      },
      tabs: {
        query() { return Promise.resolve([]); },
        onCreated: { addListener() {} },
        onRemoved: { addListener() {} },
        onUpdated: { addListener() {} },
        onMoved: { addListener() {} },
        onAttached: { addListener() {} },
        onDetached: { addListener() {} },
      },
    };
  })();`;
}

function chromeBin() {
  const list = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome-stable', 'google-chrome'];
  for (const bin of list) {
    if (bin.includes('/') && fs.existsSync(bin)) return bin;
  }
  return 'google-chrome';
}

function serve(root) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = urlPath === '/' ? '/newtab.html' : urlPath;
    const file = path.normalize(path.join(root, rel));
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      const ext = path.extname(file);
      const type = ext === '.html' ? 'text/html; charset=utf-8'
        : ext === '.css' ? 'text/css; charset=utf-8'
        : ext === '.js' ? 'text/javascript; charset=utf-8'
        : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function waitJson(port) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/json/version' }, (res) => {
        let buf = '';
        res.on('data', (d) => { buf += d; });
        res.on('end', () => {
          try { resolve(JSON.parse(buf)); } catch (err) { reject(err); }
        });
      });
      req.on('error', () => {
        if (Date.now() - start > 10000) reject(new Error('chrome devtools did not open'));
        else setTimeout(tick, 80);
      });
    };
    tick();
  });
}

function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let seq = 0;
    const pending = new Map();
    const waits = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const item = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) item.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else item.resolve(msg.result || {});
        return;
      }
      if (msg.method) {
        for (let i = waits.length - 1; i >= 0; i -= 1) {
          if (waits[i].method === msg.method) {
            const w = waits.splice(i, 1)[0];
            w.resolve(msg.params || {});
          }
        }
      }
    });
    ws.addEventListener('error', () => reject(new Error('cdp websocket failed')));
    ws.addEventListener('open', () => {
      resolve({
        send(method, params) {
          const id = ++seq;
          return new Promise((res, rej) => {
            pending.set(id, { resolve: res, reject: rej });
            ws.send(JSON.stringify({ id, method, params: params || {} }));
          });
        },
        waitEvent(method, timeout = 8000) {
          return new Promise((res, rej) => {
            const timer = setTimeout(() => rej(new Error(`timeout ${method}`)), timeout);
            waits.push({
              method,
              resolve: (payload) => {
                clearTimeout(timer);
                res(payload);
              },
            });
          });
        },
        close() { ws.close(); },
      });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const server = await serve(EXT);
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  const profile = fs.mkdtempSync(path.join('/tmp', 'sopify-firstscreen-'));
  const cdpPort = 9477;
  const chrome = spawn(chromeBin(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--disable-extensions',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let chromeLog = '';
  chrome.stdout.on('data', (d) => { chromeLog += d; });
  chrome.stderr.on('data', (d) => { chromeLog += d; });
  const shotDir = '/opt/cursor/artifacts/firstscreen-reliability';
  fs.mkdirSync(shotDir, { recursive: true });
  let cdp;
  try {
    const version = await waitJson(cdpPort);
    const listRes = await new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: cdpPort, path: '/json/list' }, (res) => {
        let buf = '';
        res.on('data', (d) => { buf += d; });
        res.on('end', () => {
          try { resolve(JSON.parse(buf)); } catch (err) { reject(err); }
        });
      }).on('error', reject);
    });
    const page = listRes.find((t) => t.type === 'page') || listRes[0];
    assert.ok(page && page.webSocketDebuggerUrl, 'chrome page target');
    cdp = await connectCdp(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    });
    let scriptId = null;
    let caseNo = 0;

    async function evalJson(expression) {
      const out = await cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (out.exceptionDetails) {
        throw new Error(out.exceptionDetails.text || JSON.stringify(out.exceptionDetails));
      }
      return out.result ? out.result.value : undefined;
    }

    async function loadSeed(width, height, seed) {
      if (scriptId) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId });
      const added = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: stubSource(seed) });
      scriptId = added.identifier;
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      caseNo += 1;
      const loaded = cdp.waitEvent('Page.loadEventFired', 12000);
      await cdp.send('Page.navigate', { url: `${origin}/newtab.html?case=${caseNo}` });
      await loaded;
      const start = Date.now();
      while (Date.now() - start < 6000) {
        const ready = await evalJson(`!!(document.body && document.body.classList.contains('studio-home') && document.getElementById('resume') && document.getElementById('resume').dataset.has !== 'pending')`);
        if (ready) return;
        await sleep(30);
      }
      const snippet = await evalJson(`document.body ? document.body.innerText.slice(0, 180) : 'no body'`);
      throw new Error(`boot timeout: ${snippet}`);
    }

    async function readLayout() {
      return evalJson(`(() => {
        const el = document.scrollingElement || document.documentElement;
        const title = document.getElementById('resume-title');
        let lines = 0;
        if (title && title.getBoundingClientRect().height) {
          const lh = parseFloat(getComputedStyle(title).lineHeight);
          if (lh) lines = Math.round(title.getBoundingClientRect().height / lh);
        }
        const lbl = document.querySelector('#sites .lbl');
        let lblMax = null;
        let lblTitle = '';
        if (lbl) {
          const cs = getComputedStyle(lbl);
          lblMax = Math.abs(parseFloat(cs.maxWidth) - parseFloat(cs.fontSize) * 6) < 1.5;
          lblTitle = lbl.getAttribute('title') || '';
        }
        const more = document.getElementById('sites-more');
        const open = document.getElementById('todos-open');
        const mount = document.getElementById('desk-3d-mount');
        const htmlCs = getComputedStyle(document.documentElement);
        const bodyCs = getComputedStyle(document.body);
        return {
          overflow: Math.round((el.scrollHeight - window.innerHeight) * 100) / 100,
          scrollTop: el.scrollTop,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          lines,
          homeSites: document.querySelectorAll('#sites .tile').length,
          allSites: document.querySelectorAll('#sites-all .tile').length,
          moreText: more ? more.textContent : '',
          moreHidden: !more || more.hidden,
          openText: open ? open.textContent : '',
          spaceHidden: !!(mount && mount.hidden),
          overflowY: htmlCs.overflowY + '/' + bodyCs.overflowY,
          lblMax,
          lblTitle,
          has: document.getElementById('resume').dataset.has,
        };
      })()`);
    }

    async function wheelScrolls() {
      await evalJson(`window.scrollTo(0, 0)`);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 480, y: 140, button: 'none' });
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel', x: 480, y: 140, deltaX: 0, deltaY: 360, button: 'none',
      });
      await sleep(40);
      return evalJson(`(document.scrollingElement || document.documentElement).scrollTop`);
    }

    async function shoot(name) {
      await evalJson(`if (document.activeElement && document.activeElement.blur) document.activeElement.blur()`);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(shotDir, name), Buffer.from(shot.data, 'base64'));
    }

    const behavior = [];
    function check(name, ok, detail) {
      behavior.push({ name, ok: !!ok, detail: detail || '' });
      if (!ok) console.error(`FAIL ${name}: ${detail || ''}`);
    }

    await loadSeed(1440, 900, { todos: todoItems('1'), sites: siteItems(6, false) });
    let layout = await readLayout();
    check('day spatial off', layout.spaceHidden, JSON.stringify(layout.spaceHidden));
    check('boot does not clip the page', !/hidden/.test(layout.overflowY), layout.overflowY);
    check('one open todo says only 全部待办', layout.openText === '全部待办' && !layout.openText.includes('这是最后一条'), layout.openText);
    const bootTodo = await evalJson(`(() => {
      const act = document.getElementById('resume-act');
      const cs = getComputedStyle(act);
      return {
        active: document.activeElement === act,
        html: document.documentElement.hasAttribute('data-boot-focus'),
        inputMarked: document.getElementById('todo-input').hasAttribute('data-boot-focus'),
        outline: cs.outlineStyle,
      };
    })()`);
    check('boot marks html and focuses 完成', bootTodo.active && bootTodo.html && !bootTodo.inputMarked && bootTodo.outline === 'none', JSON.stringify(bootTodo));
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16, nativeVirtualKeyCode: 16,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16, nativeVirtualKeyCode: 16,
    });
    const afterKey = await evalJson(`(() => {
      const cleared = !document.documentElement.hasAttribute('data-boot-focus');
      document.documentElement.setAttribute('data-boot-focus', '');
      const act = document.getElementById('resume-act');
      act.blur();
      act.focus({ focusVisible: true });
      const suppressed = getComputedStyle(act).outlineStyle;
      document.documentElement.removeAttribute('data-boot-focus');
      act.blur();
      act.focus({ focusVisible: true });
      const cs = getComputedStyle(act);
      return {
        cleared,
        suppressed,
        outline: cs.outlineStyle,
        width: cs.outlineWidth,
        match: act.matches(':focus-visible'),
        stillClear: !document.documentElement.hasAttribute('data-boot-focus'),
      };
    })()`);
    check('first keydown clears html boot mark', afterKey.cleared && afterKey.stillClear, JSON.stringify(afterKey));
    check('boot mark suppresses 完成 focus ring', afterKey.suppressed === 'none', JSON.stringify(afterKey));
    check('keyboard focus rings 完成 after boot mark clears', afterKey.outline === 'solid' && parseFloat(afterKey.width) >= 2 && afterKey.match, JSON.stringify(afterKey));
    await shoot('day-1440x900.png');

    await loadSeed(1440, 900, { todos: [], sites: [] });
    const bootEmpty = await evalJson(`(() => {
      const el = document.getElementById('todo-input');
      el.style.transition = 'none';
      el.blur();
      const blurred = getComputedStyle(el).borderBottomColor;
      el.focus();
      const cs = getComputedStyle(el);
      return {
        active: document.activeElement === el,
        html: document.documentElement.hasAttribute('data-boot-focus'),
        inputMarked: el.hasAttribute('data-boot-focus'),
        outline: cs.outlineStyle,
        focusVisible: el.matches(':focus-visible'),
        underline: cs.borderBottomWidth === '2px',
        before: blurred,
        after: cs.borderBottomColor,
      };
    })()`);
    check('boot focuses the input with underline and no ring', bootEmpty.active && bootEmpty.html && !bootEmpty.inputMarked && bootEmpty.outline === 'none' && bootEmpty.underline, JSON.stringify(bootEmpty));
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 720, y: 280, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 720, y: 280, button: 'left', clickCount: 1 });
    const afterPointer = await evalJson(`(() => {
      const el = document.getElementById('todo-input');
      if (document.activeElement !== el) el.focus();
      const cs = getComputedStyle(el);
      return {
        html: document.documentElement.hasAttribute('data-boot-focus'),
        outline: cs.outlineStyle,
        match: el.matches(':focus-visible'),
        underline: cs.borderBottomWidth,
      };
    })()`);
    const ringReleased = afterPointer.match ? afterPointer.outline === 'solid' : afterPointer.outline === 'none';
    check('first pointerdown clears html boot mark', !afterPointer.html && afterPointer.underline === '2px' && ringReleased, JSON.stringify(afterPointer));

    await loadSeed(1440, 900, {
      todos: todoItems('5'),
      sites: siteItems(16, false),
      storageDelay: 80,
    });
    layout = await readLayout();
    check('five open todos say 还有 4 条', layout.openText === '全部待办 · 还有 4 条' && !layout.openText.includes('这是最后一条'), layout.openText);
    check('home shows 8 of 16', layout.homeSites === 8 && layout.moreText === '全部 16 个' && !layout.moreHidden, JSON.stringify(layout));
    const note = await evalJson(`(() => {
      const ta = document.getElementById('notes');
      ta.focus();
      for (let i = 1; i <= 8; i += 1) {
        ta.value = i === 8 ? '最新一笔' : ('草稿' + i);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return true;
    })()`);
    assert.ok(note);
    await sleep(400);
    const saved = await evalJson(`({
      status: document.getElementById('notes-saved').textContent,
      notes: window.__sopifyStore.notes,
      writes: window.__sopifyNoteWrites(),
      desk: (document.getElementById('desk3d-note-status') || {}).textContent || '',
    })`);
    check('note status matches persisted text', saved.status === '已存在本机' && saved.notes === '最新一笔', JSON.stringify(saved));
    check('note writes coalesce to in-flight plus latest', saved.writes === 2, JSON.stringify(saved));

    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9,
    });
    const noteFocus = await evalJson(`(() => {
      const ta = document.getElementById('notes');
      ta.blur();
      ta.focus({ focusVisible: true });
      const cs = getComputedStyle(ta);
      return {
        outline: cs.outlineStyle,
        width: cs.outlineWidth,
        color: cs.outlineColor,
        match: ta.matches(':focus-visible'),
        active: document.activeElement === ta,
      };
    })()`);
    check('note focus-visible ring', noteFocus.outline === 'solid' && parseFloat(noteFocus.width) >= 2, JSON.stringify(noteFocus));

    const dialogFocus = await evalJson(`(() => {
      document.getElementById('todos-open').click();
      const input = document.getElementById('todo-input-dialog');
      const first = document.activeElement === input;
      const box = document.querySelector('#todos-dialog-list input[type="checkbox"]');
      const id = box.dataset.todoId;
      box.focus();
      box.checked = !box.checked;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      const now = document.activeElement;
      return {
        first,
        restored: !!(now && now.dataset && now.dataset.todoId === id),
        jumpedToInput: !!(now && now.id === 'todo-input-dialog'),
      };
    })()`);
    check('todos dialog first-open focuses the field', dialogFocus.first, JSON.stringify(dialogFocus));
    check('todos dialog refresh keeps the checkbox', dialogFocus.restored && !dialogFocus.jumpedToInput, JSON.stringify(dialogFocus));

    const closeFocus = await evalJson(`(() => {
      const dialog = document.getElementById('ops-todos-dialog');
      if (!dialog.open) document.getElementById('todos-open').click();
      dialog.close();
      return { open: dialog.open, has: document.getElementById('resume').dataset.has };
    })()`);
    await sleep(40);
    const closeActive = await evalJson(`document.activeElement && document.activeElement.id`);
    check('todos dialog close focuses 完成', !closeFocus.open && closeActive === 'resume-act' && closeFocus.has === '1', JSON.stringify({ ...closeFocus, active: closeActive }));
    await evalJson(`document.getElementById('todos-open').click()`);
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
    });
    await sleep(40);
    const escFocus = await evalJson(`(() => {
      const dialog = document.getElementById('ops-todos-dialog');
      return {
        open: dialog.open,
        active: document.activeElement && document.activeElement.id,
        body: document.activeElement === document.body,
      };
    })()`);
    check('Esc closes todos dialog onto 完成', !escFocus.open && escFocus.active === 'resume-act' && !escFocus.body, JSON.stringify(escFocus));
    await evalJson(`(() => {
      const dialog = document.getElementById('ops-todos-dialog');
      if (!dialog.open) document.getElementById('todos-open').click();
      dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    })()`);
    await sleep(40);
    const backdropFocus = await evalJson(`(() => {
      const dialog = document.getElementById('ops-todos-dialog');
      return {
        open: dialog.open,
        active: document.activeElement && document.activeElement.id,
        body: document.activeElement === document.body,
      };
    })()`);
    check('backdrop closes todos dialog onto 完成', !backdropFocus.open && backdropFocus.active === 'resume-act' && !backdropFocus.body, JSON.stringify(backdropFocus));

    const opened = await evalJson(`(() => {
      document.getElementById('sites-more').click();
      const dialog = document.getElementById('ops-sites-dialog');
      return { open: !!(dialog && dialog.open), all: document.querySelectorAll('#sites-all .tile').length };
    })()`);
    check('全部 N 个 opens the sites dialog', opened.open && opened.all === 16, JSON.stringify(opened));

    await loadSeed(1440, 900, { todos: [], sites: [] });
    const urlError = await evalJson(`(() => {
      document.getElementById('site-add-toggle').click();
      document.getElementById('site-name').value = '坏站';
      document.getElementById('site-url').value = 'ftp://example.com/x';
      document.getElementById('site-form').requestSubmit();
      const err = document.getElementById('site-url-error');
      const input = document.getElementById('site-url');
      const field = input.closest('.site-url-field');
      const inputBox = input.getBoundingClientRect();
      const errBox = err.getBoundingClientRect();
      return {
        text: err.textContent,
        hidden: err.hidden,
        invalid: input.getAttribute('aria-invalid'),
        described: input.getAttribute('aria-describedby'),
        focused: document.activeElement === input,
        toast: document.getElementById('toast').classList.contains('show'),
        beside: !!(field && errBox.left >= inputBox.left && errBox.top < inputBox.bottom + 8),
      };
    })()`);
    check('url error sits on the field', urlError.text === '网址需要是 http(s)' && !urlError.hidden && urlError.invalid === 'true' && urlError.described === 'site-url-error' && urlError.focused && !urlError.toast && urlError.beside, JSON.stringify(urlError));
    await shoot('site-url-error.png');
    const urlCleared = await evalJson(`(() => {
      const input = document.getElementById('site-url');
      const err = document.getElementById('site-url-error');
      input.value = 'https://example.com';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return { hidden: err.hidden, invalid: input.hasAttribute('aria-invalid') };
    })()`);
    check('url error clears on input', urlCleared.hidden && !urlCleared.invalid, JSON.stringify(urlCleared));

    await loadSeed(1440, 900, { todos: todoItems('1'), sites: [], failNotes: true });
    await evalJson(`(() => {
      const ta = document.getElementById('notes');
      ta.value = '写不进去';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(50);
    const failed = await evalJson(`({
      status: document.getElementById('notes-saved').textContent,
      notes: window.__sopifyStore.notes,
    })`);
    check('failed write says 没存上', failed.status === '没存上' && failed.notes === '', JSON.stringify(failed));

    await loadSeed(1440, 900, {
      todos: [{ id: 'done-1', text: '已经做完', done: true }],
      sites: [],
    });
    const doneLabel = await evalJson(`document.getElementById('todos-open').textContent`);
    check('done-only todos say 已完成 1 件', doneLabel === '全部待办 · 已完成 1 件', doneLabel);
    await loadSeed(1440, 900, {
      todos: [
        { id: 'open-1', text: '还剩一件', done: false },
        { id: 'done-2', text: '已经做完', done: true },
        { id: 'done-3', text: '另一件也做完', done: true },
      ],
      sites: [],
    });
    const mixedLabel = await evalJson(`document.getElementById('todos-open').textContent`);
    check('one open plus done says 已完成', mixedLabel === '全部待办 · 已完成 2 件', mixedLabel);
    const lastClose = await evalJson(`(() => {
      document.getElementById('todos-open').click();
      const box = document.querySelector('#todos-dialog-list input[type="checkbox"]:not(:checked)');
      const id = box.dataset.todoId;
      box.focus();
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      const after = document.activeElement;
      const kept = !!(after && after.dataset && after.dataset.todoId === id);
      document.querySelector('#ops-todos-dialog [data-dialog-close]').click();
      const dialog = document.getElementById('ops-todos-dialog');
      const filled = document.querySelector('.next-filled');
      return {
        kept,
        open: dialog.open,
        has: document.getElementById('resume').dataset.has,
        openerHidden: getComputedStyle(filled).display === 'none',
        label: document.getElementById('todos-open').textContent,
      };
    })()`);
    await sleep(40);
    const lastActive = await evalJson(`document.activeElement && document.activeElement.id`);
    check('close after the last open todo focuses the input', lastClose.kept && !lastClose.open && lastClose.has === '0' && lastActive === 'todo-input' && lastClose.openerHidden && lastClose.label === '全部待办 · 已完成 3 件', JSON.stringify({ ...lastClose, active: lastActive }));
    await loadSeed(1366, 650, { todos: todoItems('5'), sites: siteItems(6, false) });
    await shoot('short-1366x650.png');

    const rows = [];
    const failures = [];
    for (const [width, height] of SIZES) {
      for (const kind of TODO_KINDS) {
        for (const count of SITE_COUNTS) {
          await loadSeed(width, height, { todos: todoItems(kind), sites: siteItems(count, false) });
          const box = await readLayout();
          const scrolled = await wheelScrolls();
          const pass = box.overflow <= 1 && scrolled === 0 && !/hidden/.test(box.overflowY) && box.spaceHidden;
          const sitesOk = count > 8
            ? box.homeSites === 8 && box.moreText === `全部 ${count} 个` && !box.moreHidden
            : box.homeSites === count && box.moreHidden;
          const label = `${width}×${height} 待办${kind} 站${count}`;
          rows.push({
            size: `${width}×${height}`,
            todos: kind,
            sites: count,
            overflow: box.overflow,
            wheel: scrolled,
            lines: box.lines,
            pass: pass && sitesOk,
            exception: false,
          });
          if (!pass || !sitesOk) failures.push(`${label} overflow=${box.overflow} wheel=${scrolled} sitesOk=${sitesOk} ${box.overflowY}`);
          const expectedOpen = kind === '5' ? '全部待办 · 还有 4 条' : '全部待办';
          if (box.openText !== expectedOpen || box.openText.includes('这是最后一条')) {
            failures.push(`${label} todos-open=${box.openText}`);
          }
        }
      }
    }

    await loadSeed(1366, 650, { todos: todoItems('long'), sites: siteItems(8, true) });
    const exception = await readLayout();
    const exceptionWheel = await wheelScrolls();
    rows.push({
      size: '1366×650',
      todos: '4行长标题',
      sites: '8超长站名',
      overflow: exception.overflow,
      wheel: exceptionWheel,
      lines: exception.lines,
      pass: null,
      exception: true,
      lblMax: exception.lblMax,
      lblTitle: exception.lblTitle,
    });
    if (exception.lines < 4) failures.push(`exception title rendered ${exception.lines} lines, expected 4`);
    if (!exception.lblMax) failures.push('exception label max-width is not 6em');
    if (exception.lblTitle !== `${LONG_SITE}1`) failures.push(`exception label title=${exception.lblTitle}`);
    if (exception.homeSites !== 8 || !exception.moreHidden) failures.push('exception should render all 8 sites without 全部');

    console.log('size\ttodos\tsites\toverflow_px\twheel_scrollTop\tlines\tresult');
    for (const row of rows) {
      const result = row.exception ? 'exception-recorded' : (row.pass ? 'pass' : 'FAIL');
      console.log(`${row.size}\t${row.todos}\t${row.sites}\t${row.overflow}\t${row.wheel}\t${row.lines}\t${result}`);
    }
    const matrixPath = path.join(shotDir, 'matrix.json');
    fs.writeFileSync(matrixPath, JSON.stringify({ behavior, rows, version: version.Browser || '' }, null, 2));
    console.log(`matrix ${matrixPath}`);
    const behaviorFails = [];
    for (const item of behavior) {
      if (!item.ok) behaviorFails.push(`behavior ${item.name}: ${item.detail}`);
    }
    const matrixFails = failures.slice();
    console.log(`test-w13-firstscreen behavior: ${behaviorFails.length ? 'FAIL' : 'ok'}`);
    console.log(`test-w13-firstscreen matrix: ${matrixFails.length ? 'FAIL' : 'ok'}`);
    if (behaviorFails.length || matrixFails.length) {
      throw new Error([...behaviorFails, ...matrixFails].join('\n'));
    }
    console.log('test-w13-firstscreen: ok');
  } catch (err) {
    if (chromeLog) console.error(chromeLog.slice(-2000));
    throw err;
  } finally {
    if (cdp) cdp.close();
    chrome.kill('SIGKILL');
    server.close();
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
