'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const REPO = path.join(__dirname, '..');
const EXT = path.join(REPO, 'extension');
const ARTIFACTS = process.env.SOPIFY_ARTIFACT_DIR || '/opt/cursor/artifacts/r1-r7';

function findChrome() {
  if (process.env.CHROME_BIN) {
    if (fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
    console.log(`SKIP browser: CHROME_BIN does not exist (${process.env.CHROME_BIN})`);
    process.exit(2);
  }
  const candidates = [
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  ];
  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin;
  }
  console.log('SKIP browser: no Chrome/Chromium binary found. Set CHROME_BIN.');
  process.exit(2);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function stubSource(seed) {
  return `(() => {
    const seed = ${JSON.stringify(seed)};
    const store = {
      sites: seed.sites || [],
      todos: seed.todos || [],
      notes: typeof seed.notes === 'string' ? seed.notes : '',
      name: seed.name || '',
      notesRev: seed.notesRev || 0,
      notesStamp: seed.notesStamp || '',
      worksets: seed.worksets || [],
      spaceView: false,
      cwd: '',
      hostUpstream: 'cursor',
      themePreset: seed.theme || 'day',
    };
    let noteWrites = 0;
    let readsLeft = seed.failReads || 0;
    const removed = [];
    const created = [];
    const listeners = [];
    const delay = seed.storageDelay || 0;
    window.__sopifyStore = store;
    window.__sopifyRemoved = removed;
    window.__sopifyCreated = created;
    window.__sopifyNoteWrites = () => noteWrites;
    window.__pushNotes = (notes, rev, stamp) => {
      const changes = {
        notes: { oldValue: store.notes, newValue: notes },
        notesRev: { oldValue: store.notesRev, newValue: rev },
        notesStamp: { oldValue: store.notesStamp, newValue: stamp },
      };
      store.notes = notes;
      store.notesRev = rev;
      store.notesStamp = stamp;
      listeners.forEach((fn) => fn(changes, 'local'));
    };
    function deliver(partial) {
      const changes = {};
      Object.keys(partial || {}).forEach((k) => {
        changes[k] = { oldValue: store[k], newValue: partial[k] };
        store[k] = partial[k];
      });
      listeners.forEach((fn) => fn(changes, 'local'));
    }
    window.chrome = {
      storage: {
        local: {
          get(defaults) {
            const deskRead = !!(defaults && Object.prototype.hasOwnProperty.call(defaults, 'notes'));
            if (deskRead && readsLeft > 0) {
              readsLeft -= 1;
              return Promise.reject(new Error('storage read failed'));
            }
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
                if (seed.failTodos && partial && Object.prototype.hasOwnProperty.call(partial, 'todos')) {
                  reject(new Error('storage failed'));
                  return;
                }
                if (seed.failSites && partial && Object.prototype.hasOwnProperty.call(partial, 'sites')) {
                  reject(new Error('storage failed'));
                  return;
                }
                if (seed.failWorksets && partial && Object.prototype.hasOwnProperty.call(partial, 'worksets')) {
                  reject(new Error('storage failed'));
                  return;
                }
                if (partial && Object.prototype.hasOwnProperty.call(partial, 'notes')) noteWrites += 1;
                deliver(partial || {});
                resolve();
              };
              if (delay) setTimeout(run, delay);
              else run();
            });
          },
        },
        onChanged: { addListener(fn) { listeners.push(fn); } },
      },
      runtime: {
        onMessage: { addListener() {} },
        sendMessage() {},
        getURL(p) { return String(p || ''); },
        lastError: null,
      },
      tabs: {
        query() { return Promise.resolve(seed.tabs || []); },
        create(opts) {
          const url = opts && opts.url ? String(opts.url) : '';
          if (seed.failCreate && url.includes(seed.failCreate)) return Promise.reject(new Error('blocked'));
          const tab = { id: 500 + created.length, url: url, title: url };
          created.push(tab);
          return Promise.resolve(tab);
        },
        update() { return Promise.resolve(); },
        remove(ids) {
          const list = Array.isArray(ids) ? ids : [ids];
          list.forEach((id) => removed.push(id));
          return Promise.resolve();
        },
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

function serve(root, hits) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    hits.push(urlPath);
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
      res.writeHead(200, { 'content-type': type });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
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
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const item = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) item.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else item.resolve(msg.result || {});
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
        close() { ws.close(); },
      });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rmDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* already gone */ }
}

async function main() {
  const bin = findChrome();
  const liveHits = [];
  const live = await serve(EXT, liveHits);
  const origin = `http://127.0.0.1:${live.address().port}`;
  const cdpPort = process.env.SOPIFY_CDP_PORT ? Number(process.env.SOPIFY_CDP_PORT) : await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-r17-'));
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const chrome = spawn(bin, [
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
  const failures = [];
  const checks = [];
  function check(name, ok, detail) {
    checks.push({ name, ok: !!ok, detail: detail || '' });
    if (!ok) {
      failures.push(`${name}: ${detail || ''}`);
      console.error(`FAIL ${name}: ${detail || ''}`);
    }
  }
  let cdp;
  let version = '';
  try {
    const ver = await waitJson(cdpPort);
    version = ver.Browser || '';
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
    if (!page || !page.webSocketDebuggerUrl) throw new Error('chrome page target missing');
    cdp = await connectCdp(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
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

    async function loadSeed(width, height, seed, scheme) {
      if (scriptId) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId });
      const added = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: stubSource(seed) });
      scriptId = added.identifier;
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: 1, mobile: false,
      });
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [
          { name: 'prefers-color-scheme', value: scheme === 'night' ? 'dark' : 'light' },
          { name: 'prefers-reduced-motion', value: seed.reduced ? 'reduce' : 'no-preference' },
        ],
      });
      caseNo += 1;
      await cdp.send('Page.navigate', { url: `${origin}/newtab.html?case=${caseNo}` });
      const start = Date.now();
      while (Date.now() - start < 8000) {
        const ready = await evalJson(`!!(document.body && document.getElementById('resume') && document.getElementById('resume').dataset.has !== 'pending')`);
        if (ready) break;
        await sleep(40);
      }
      const ready = await evalJson(`document.getElementById('resume') && document.getElementById('resume').dataset.has`);
      if (ready === 'pending' || !ready) {
        const text = await evalJson(`document.body ? document.body.innerText.slice(0, 160) : 'no body'`);
        throw new Error(`boot timeout: ${text}`);
      }
      if (scheme) await evalJson(`document.documentElement.setAttribute('data-sky', ${JSON.stringify(scheme)})`);
    }

    async function shot(name) {
      const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACTS, name), Buffer.from(png.data, 'base64'));
    }

    async function box() {
      return evalJson(`(() => {
        const el = document.scrollingElement || document.documentElement;
        const mount = document.getElementById('desk-3d-mount');
        const more = document.getElementById('sites-more');
        const open = document.getElementById('todos-open');
        return {
          overflowX: el.scrollWidth - window.innerWidth,
          overflowY: el.scrollHeight - window.innerHeight,
          spaceHidden: !!(mount && mount.hidden),
          homeSites: document.querySelectorAll('#sites .tile').length,
          moreText: more ? more.textContent : '',
          moreHidden: !more || more.hidden,
          openText: open ? open.textContent : '',
          has: document.getElementById('resume').dataset.has,
          title: (document.getElementById('resume-title') || {}).textContent || '',
          loadError: document.getElementById('desk-load-error') ? !document.getElementById('desk-load-error').hidden : null,
          text: document.body.innerText.slice(0, 80),
        };
      })()`);
    }

    const oneTodo = [{ id: 't1', text: '回一封邮件', done: false }];
    const manyTodos = [1, 2, 3, 4, 5].map((n) => ({ id: `t${n}`, text: `待办${n}`, done: false }));
    const longTitle = `${'把首屏长标题排满'.repeat(18)}第四行`;
    const longSite = '超级长的常用站名称用来考验省略号';
    const sites = (n, long) => Array.from({ length: n }, (_, i) => ({
      name: long ? `${longSite}${i + 1}` : `站${i + 1}`,
      url: `https://example.com/${i + 1}`,
    }));
    const workset = [{
      id: 'w-am',
      name: '上午',
      savedAt: Date.now(),
      tabs: [
        { title: 'keep', url: 'https://keep.example/' },
        { title: 'ok', url: 'https://ok.example/' },
        { title: 'bad', url: 'https://fail.example/x' },
      ],
    }];

    await loadSeed(1440, 900, {
      todos: oneTodo,
      sites: sites(6, false),
      worksets: workset,
      tabs: [{ id: 7, title: 'keep', url: 'https://keep.example/' }],
    }, 'day');
    let layout = await box();
    check('day 1440 space view off', layout.spaceHidden === true, JSON.stringify(layout.spaceHidden));
    check('day 1440 no horizontal overflow', layout.overflowX <= 1, String(layout.overflowX));
    check('one todo says 全部待办', layout.openText === '全部待办', layout.openText);
    check('six sites and no 全部', layout.homeSites === 6 && layout.moreHidden, JSON.stringify(layout));
    check('saved workset is on the desk', await evalJson(`!document.getElementById('workset-restore-recent').hidden && document.getElementById('workset-restore-recent').textContent.includes('恢复')`), '');
    const threeHits = liveHits.filter((u) => u.includes('three.module.js'));
    check('space off does not request Three', threeHits.length === 0, threeHits.join(','));
    await shot('stub-day-1440x900.png');

    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    const tabFocus = await evalJson(`document.activeElement && document.activeElement.id`);
    check('Tab moves focus', !!tabFocus && tabFocus !== 'resume-act', String(tabFocus));
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Tab', code: 'Tab', modifiers: 8, windowsVirtualKeyCode: 9,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Tab', code: 'Tab', modifiers: 8, windowsVirtualKeyCode: 9,
    });

    await evalJson(`document.getElementById('todos-open').click()`);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(40);
    const esc = await evalJson(`(() => {
      const dialog = document.getElementById('ops-todos-dialog');
      return { open: dialog.open, active: document.activeElement && document.activeElement.id };
    })()`);
    check('Escape closes todos', esc.open === false, JSON.stringify(esc));

    await loadSeed(1440, 900, { todos: [], sites: [] }, 'day');
    const ime = await evalJson(`(() => {
      const input = document.getElementById('todo-input');
      input.focus();
      input.value = '组词';
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      const ev = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true });
      const prevented = !input.dispatchEvent(ev);
      const during = document.querySelectorAll('#todos .todo').length;
      const hasDuring = document.getElementById('resume').dataset.has;
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      return { prevented, during, hasDuring };
    })()`);
    check('IME Enter does not add a todo', ime.prevented === true && ime.hasDuring === '0' && ime.during === 0, JSON.stringify(ime));
    await sleep(50);
    const typed = await evalJson(`(async () => {
      const input = document.getElementById('todo-input');
      input.focus();
      input.value = '写一条真的';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      input.form.requestSubmit();
      await new Promise((r) => setTimeout(r, 40));
      return document.getElementById('resume-title').textContent;
    })()`);
    check('Enter after IME still submits', typed === '写一条真的', String(typed));

    await loadSeed(1440, 900, { todos: oneTodo, sites: [], storageDelay: 250 }, 'day');
    await evalJson(`(() => {
      const ta = document.getElementById('notes');
      ta.focus();
      ta.value = '第一笔';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(40);
    const pending = await evalJson(`document.getElementById('notes-saved').textContent`);
    check('save status waits during the write', pending === '保存中…', pending);
    await sleep(500);
    const saved = await evalJson(`({
      status: document.getElementById('notes-saved').textContent,
      notes: window.__sopifyStore.notes,
    })`);
    check('saved UI matches storage', saved.status === '已存在本机' && saved.notes === '第一笔', JSON.stringify(saved));

    await loadSeed(1440, 900, { todos: [], sites: [], failNotes: true, notes: '原样' }, 'day');
    await evalJson(`(() => {
      const ta = document.getElementById('notes');
      ta.value = '写不进去';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(80);
    const failed = await evalJson(`({
      status: document.getElementById('notes-saved').textContent,
      notes: window.__sopifyStore.notes,
      value: document.getElementById('notes').value,
    })`);
    check('failed write says 没存上 and keeps the draft', failed.status === '没存上' && failed.notes === '原样' && failed.value === '写不进去', JSON.stringify(failed));

    await loadSeed(1440, 900, { todos: [], sites: [], notes: '这边', notesRev: 1, notesStamp: 'seed' }, 'day');
    const conflict = await evalJson(`(() => {
      const ta = document.getElementById('notes');
      ta.focus();
      window.__pushNotes('那边改的', 2, 'other:2:x');
      const box = document.getElementById('note-conflict');
      return {
        value: ta.value,
        status: document.getElementById('notes-saved').textContent,
        buttons: !box.hidden,
        local: document.getElementById('note-local-preview').textContent,
        remote: document.getElementById('note-remote-preview').textContent,
      };
    })()`);
    check('focused note shows conflict and keeps local text', conflict.value === '这边' && conflict.status === '另一页改过，没覆盖' && conflict.buttons, JSON.stringify(conflict));
    check('conflict shows both drafts before a choice', conflict.local === '这边' && conflict.remote === '那边改的' && conflict.local !== conflict.remote, JSON.stringify(conflict));
    await shot('stub-note-conflict-1440.png');

    await loadSeed(1440, 900, {
      todos: [{ id: 'later', text: '读回来了', done: false }],
      sites: sites(1, false),
      failReads: 1,
    }, 'day');
    const bootFail = await box();
    check('boot read failure stays usable', bootFail.loadError === true && bootFail.has !== 'pending' && bootFail.text.includes('下一件事'), JSON.stringify(bootFail));
    await shot('stub-boot-fail-1440.png');
    await evalJson(`document.getElementById('desk-load-retry').click()`);
    await sleep(80);
    const retried = await box();
    check('retry loads the desk', retried.loadError === false && retried.title === '读回来了', JSON.stringify(retried));

    await loadSeed(1440, 900, {
      todos: manyTodos.concat([{ id: 'd1', text: '已经做完', done: true }]),
      sites: sites(9, false),
      worksets: [],
    }, 'night');
    layout = await box();
    check('night many todos', layout.openText === '全部待办 · 还有 4 条', layout.openText);
    check('more than 8 sites', layout.homeSites === 8 && layout.moreText === '全部 9 个' && !layout.moreHidden, JSON.stringify(layout));
    check('no saved workset copy', await evalJson(`document.getElementById('last-empty') && !document.getElementById('last-empty').hidden`), '');
    check('night 1440 no horizontal overflow', layout.overflowX <= 1, String(layout.overflowX));
    await shot('stub-night-1440x900.png');

    await loadSeed(1280, 720, { todos: [], sites: [] }, 'day');
    layout = await box();
    check('empty 1280 focuses the composer', layout.has === '0' && layout.homeSites === 0, JSON.stringify(layout));
    check('1280 no horizontal overflow', layout.overflowX <= 1, String(layout.overflowX));
    await shot('stub-empty-1280x720.png');

    await loadSeed(1366, 650, {
      todos: [{ id: 'long', text: longTitle, done: false }],
      sites: sites(8, true),
    }, 'day');
    layout = await box();
    check('long title and 8 long sites', layout.title.includes('第四行') && layout.homeSites === 8 && layout.moreHidden, JSON.stringify({ title: layout.title.slice(0, 20), sites: layout.homeSites }));
    check('1366 no horizontal overflow', layout.overflowX <= 1, String(layout.overflowX));
    await shot('stub-long-1366x650.png');

    await loadSeed(1366, 650, {
      todos: [{ id: 'done-1', text: '已经做完', done: true }],
      sites: [],
    }, 'day');
    const doneLabel = await evalJson(`document.getElementById('todos-open').textContent`);
    check('done-only says 已完成', doneLabel === '全部待办 · 已完成 1 件', doneLabel);

    for (const [w, h] of [[600, 800], [390, 700]]) {
      await loadSeed(w, h, { todos: manyTodos, sites: sites(9, true), worksets: workset }, 'day');
      layout = await box();
      check(`${w} no horizontal overflow`, layout.overflowX <= 1, String(layout.overflowX));
    }
    await shot('stub-spot-390.png');

    await loadSeed(1440, 900, {
      todos: oneTodo,
      sites: [],
      tabs: [
        { id: 1, title: 'alpha issue', url: 'https://github.com/a' },
        { id: 2, title: 'other page', url: 'https://github.com/b' },
        { id: 3, title: 'alpha docs', url: 'https://example.com/alpha' },
      ],
    }, 'day');
    const closed = await evalJson(`(async () => {
      document.querySelector('[data-view="tabs"]').click();
      const filter = document.getElementById('tab-filter');
      filter.value = 'alpha';
      filter.dispatchEvent(new Event('input', { bubbles: true }));
      const btn = document.querySelector('[data-close-host="github.com"]');
      const title = btn ? btn.getAttribute('title') : '';
      const count = btn ? btn.parentElement.querySelector('.count').textContent : '';
      btn.click();
      await new Promise((r) => setTimeout(r, 30));
      return { title, count, label: btn ? btn.textContent.trim() : '', removed: window.__sopifyRemoved.slice() };
    })()`);
    check('filtered close removes only the visible host tabs', JSON.stringify(closed.removed) === '[1]' && closed.count === '1' && closed.title.includes('筛选') && closed.label === '关闭这 1 个标签', JSON.stringify(closed));

    await loadSeed(1440, 900, {
      todos: [],
      sites: [],
      worksets: workset,
      tabs: [{ id: 7, title: 'keep', url: 'https://keep.example/' }],
      failCreate: 'fail.example',
    }, 'day');
    const restored = await evalJson(`(async () => {
      document.getElementById('workset-restore-recent').click();
      await new Promise((r) => setTimeout(r, 40));
      return {
        toast: document.getElementById('toast').textContent,
        created: window.__sopifyCreated.map((t) => t.url),
      };
    })()`);
    check('partial restore does not claim full success', restored.toast.includes('没打开') && !restored.toast.includes('已恢复'), JSON.stringify(restored));
    check('partial restore opened the healthy url only', restored.created.length === 1 && restored.created[0].includes('ok.example'), JSON.stringify(restored.created));
    await shot('stub-partial-restore-1440.png');

    await loadSeed(1440, 900, { todos: [], sites: [], failTodos: true }, 'day');
    const todoFail = await evalJson(`(async () => {
      const input = document.getElementById('todo-input');
      input.value = '新待办';
      input.form.requestSubmit();
      await new Promise((r) => setTimeout(r, 40));
      const err = document.getElementById('todo-save-error');
      return {
        value: input.value,
        has: document.getElementById('resume').dataset.has,
        error: err ? err.textContent : '',
        hidden: err ? err.hidden : true,
        stored: window.__sopifyStore.todos.length,
      };
    })()`);
    check('todo save failure keeps the input', todoFail.value === '新待办' && todoFail.has === '0' && todoFail.hidden === false && todoFail.error.includes('再按一次') && todoFail.stored === 0, JSON.stringify(todoFail));

    await loadSeed(1440, 900, { todos: [], sites: [] }, 'day');
    const todoOk = await evalJson(`(async () => {
      const input = document.getElementById('todo-input');
      input.value = '存得下';
      input.form.requestSubmit();
      await new Promise((r) => setTimeout(r, 40));
      const err = document.getElementById('todo-save-error');
      return {
        value: input.value,
        title: document.getElementById('resume-title').textContent,
        hidden: err ? err.hidden : true,
        stored: window.__sopifyStore.todos.map((t) => t.text),
      };
    })()`);
    check('todo save success clears only after persist', todoOk.value === '' && todoOk.title === '存得下' && todoOk.hidden === true && todoOk.stored.length === 1 && todoOk.stored[0] === '存得下', JSON.stringify(todoOk));

    await loadSeed(1440, 900, { todos: [], sites: [], failSites: true }, 'day');
    const siteFail = await evalJson(`(async () => {
      document.getElementById('site-add-toggle').click();
      document.getElementById('site-name').value = '没加上的站';
      document.getElementById('site-url').value = 'https://keep.example';
      document.getElementById('site-form').requestSubmit();
      await new Promise((r) => setTimeout(r, 40));
      const err = document.getElementById('site-save-error');
      const toast = document.getElementById('toast');
      return {
        name: document.getElementById('site-name').value,
        url: document.getElementById('site-url').value,
        error: err ? err.textContent : '',
        hidden: err ? err.hidden : true,
        toast: toast.textContent,
        toastOn: toast.classList.contains('show'),
        stored: window.__sopifyStore.sites.length,
        open: document.getElementById('ops-sites-dialog').open,
      };
    })()`);
    check('site save failure keeps the form', siteFail.name === '没加上的站' && siteFail.url === 'https://keep.example' && siteFail.hidden === false && siteFail.stored === 0 && siteFail.open && !(siteFail.toastOn && siteFail.toast.includes('已加入')), JSON.stringify(siteFail));

    await loadSeed(1440, 900, { todos: [], sites: [] }, 'day');
    const siteOk = await evalJson(`(async () => {
      document.getElementById('site-add-toggle').click();
      document.getElementById('site-name').value = '加上了';
      document.getElementById('site-url').value = 'https://added.example';
      document.getElementById('site-form').requestSubmit();
      await new Promise((r) => setTimeout(r, 40));
      const toast = document.getElementById('toast');
      return {
        name: document.getElementById('site-name').value,
        toast: toast.textContent,
        toastOn: toast.classList.contains('show'),
        stored: window.__sopifyStore.sites.map((s) => s.name),
      };
    })()`);
    check('site save success toasts only after persist', siteOk.name === '' && siteOk.toastOn && siteOk.toast.includes('已加入') && siteOk.stored.length === 1 && siteOk.stored[0] === '加上了', JSON.stringify(siteOk));

    await loadSeed(1440, 900, {
      todos: [],
      sites: [],
      tabs: [{ id: 3, title: '要存的网页', url: 'https://save.example/' }],
      failWorksets: true,
    }, 'day');
    const windowFail = await evalJson(`(async () => {
      document.getElementById('workset-save').click();
      await new Promise((r) => setTimeout(r, 40));
      const err = document.getElementById('workset-save-error');
      const toast = document.getElementById('toast');
      return {
        error: err ? err.textContent : '',
        hidden: err ? err.hidden : true,
        toast: toast.textContent,
        toastOn: toast.classList.contains('show'),
        stored: window.__sopifyStore.worksets.length,
        empty: document.getElementById('last-empty') ? !document.getElementById('last-empty').hidden : null,
      };
    })()`);
    check('window save failure does not claim success', windowFail.hidden === false && windowFail.error.includes('再点一次') && windowFail.stored === 0 && windowFail.empty === true && !(windowFail.toastOn && windowFail.toast.includes('已存下')), JSON.stringify(windowFail));

    await loadSeed(1440, 900, {
      todos: [],
      sites: [],
      tabs: [{ id: 4, title: '存得下的网页', url: 'https://saved.example/' }],
    }, 'day');
    const windowOk = await evalJson(`(async () => {
      document.getElementById('workset-save').click();
      await new Promise((r) => setTimeout(r, 40));
      const toast = document.getElementById('toast');
      const err = document.getElementById('workset-save-error');
      return {
        toast: toast.textContent,
        toastOn: toast.classList.contains('show'),
        hidden: err ? err.hidden : true,
        stored: window.__sopifyStore.worksets.length,
      };
    })()`);
    check('window save success toasts only after persist', windowOk.toastOn && windowOk.toast.includes('已存下这个窗口') && windowOk.hidden === true && windowOk.stored === 1, JSON.stringify(windowOk));

    await loadSeed(1440, 900, { todos: oneTodo, sites: [], reduced: true }, 'day');
    const reduced = await evalJson(`(async () => {
      document.getElementById('resume-act').click();
      await new Promise((r) => setTimeout(r, 40));
      return {
        done: document.getElementById('resume').dataset.has,
        title: document.getElementById('resume-title').textContent,
      };
    })()`);
    check('reduced motion still completes the todo', reduced.done === '0', JSON.stringify(reduced));

    console.log(`browser ${version} os ${os.platform()} ${os.release()} port ${cdpPort}`);
    console.log(`artifact ${ARTIFACTS}`);
  } catch (err) {
    if (chromeLog) console.error(chromeLog.slice(-1500));
    throw err;
  } finally {
    if (cdp) cdp.close();
    chrome.kill('SIGKILL');
    live.close();
    rmDir(profile);
  }

  let real = { ok: false, detail: 'not run' };
  const realProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-r17-ext-'));
  const realPort = await freePort();
  const realChrome = spawn(bin, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
    `--load-extension=${EXT}`,
    `--disable-extensions-except=${EXT}`,
    `--remote-debugging-port=${realPort}`,
    `--user-data-dir=${realProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await waitJson(realPort);
    const targets = await new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: realPort, path: '/json/list' }, (res) => {
        let buf = '';
        res.on('data', (d) => { buf += d; });
        res.on('end', () => {
          try { resolve(JSON.parse(buf)); } catch (err) { reject(err); }
        });
      }).on('error', reject);
    });
    const extTarget = targets.find((t) => /chrome-extension:/.test(t.url || '') || /Sopify/.test(t.title || ''));
    real = extTarget
      ? { ok: true, detail: extTarget.url || extTarget.title || 'extension target' }
      : { ok: false, detail: 'CLI load did not expose an extension target; branded Chrome ignores --load-extension' };
  } catch (err) {
    real = { ok: false, detail: String(err && err.message ? err.message : err) };
  } finally {
    realChrome.kill('SIGKILL');
    rmDir(realProfile);
  }
  console.log(`real extension: ${real.ok ? 'loaded' : 'unverified'} ${real.detail}`);

  const report = {
    kind: 'stub-browser',
    browser: version,
    os: `${os.platform()} ${os.release()}`,
    port: cdpPort,
    checks,
    realExtension: real,
  };
  fs.writeFileSync(path.join(ARTIFACTS, 'report.json'), JSON.stringify(report, null, 2));
  if (failures.length) {
    console.log(`test-r1-r7-browser: FAIL ${failures.length}`);
    throw new Error(failures.join('\n'));
  }
  console.log('test-r1-r7-browser: ok (stub, not a loaded extension)');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
