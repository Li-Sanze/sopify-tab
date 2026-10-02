'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn, spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const EXT = path.join(REPO, 'extension');
function writableDir(candidates) {
  let last = null;
  for (const dir of candidates) {
    if (!dir) continue;
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, '.write-probe');
      fs.writeFileSync(probe, 'ok');
      fs.unlinkSync(probe);
      return dir;
    } catch (err) {
      last = err;
      console.log(`screenshot dir unavailable: ${dir} (${err && err.code ? err.code : err})`);
    }
  }
  console.log(`screenshots skipped: ${last && last.message ? last.message : last}`);
  return null;
}

const ARTIFACTS = writableDir([
  process.env.SOPIFY_ARTIFACT_DIR || '/opt/cursor/artifacts/r1-r7',
  path.join(os.tmpdir(), 'sopify-r1-r7'),
]);

const SOPIFY_EXTENSION_ID = 'cgkhllpelkjmfamddkjpnmchjikdcbgp';

function isThisExtensionTarget(target, extensionId) {
  const id = String(extensionId || '');
  if (!id) return false;
  const url = String(target && target.url || '');
  const prefix = 'chrome-extension://' + id;
  return url === prefix || url.startsWith(prefix + '/');
}

function targetBlob(target) {
  return [target && target.url, target && target.title].filter(Boolean).join(' ');
}

function mentionsExtension(target, extensionId) {
  const id = String(extensionId || '');
  if (!id) return false;
  const blob = targetBlob(target);
  return blob.includes('chrome-extension://' + id + '/') || blob === 'chrome-extension://' + id;
}

function isExtensionWorker(target) {
  const type = String(target && target.type || '');
  return type === 'service_worker' || type === 'background_page';
}

function classifyExtensionTargets(targets, extensionId) {
  const list = Array.isArray(targets) ? targets : [];
  const id = String(extensionId || '');
  const ours = list.filter((target) => isExtensionWorker(target) && mentionsExtension(target, id));
  if (ours.length) {
    const sample = ours[0];
    return {
      ok: true,
      id,
      kind: 'service_worker',
      detail: String(sample.url || sample.title || ''),
    };
  }
  const foreign = list.filter((target) => /chrome-extension:\/\//.test(targetBlob(target)) && !mentionsExtension(target, id));
  if (foreign.length) {
    const sample = foreign[0];
    return {
      ok: false,
      id,
      kind: 'foreign',
      detail: 'foreign extension target is not ' + id + ': ' + String(sample.url || sample.title || ''),
    };
  }
  return {
    ok: false,
    id,
    kind: 'absent',
    detail: 'service worker for chrome-extension://' + id + '/ was not in the target list',
  };
}

function assertExtensionIdentity() {
  const id = SOPIFY_EXTENSION_ID;
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  if (!manifest.key) throw new Error('manifest.key missing');
  if (!isThisExtensionTarget({ url: 'chrome-extension://' + id + '/newtab.html' }, id)) {
    throw new Error('own extension url was rejected');
  }
  const foreign = { url: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/newtab.html', title: 'Sopify Tab' };
  if (isThisExtensionTarget(foreign, id)) throw new Error('foreign extension was accepted');
  const onlyForeign = classifyExtensionTargets([
    foreign,
    { url: 'https://example.com/', title: 'Sopify' },
  ], id);
  if (onlyForeign.ok) throw new Error('foreign-only targets counted as this extension');
  if (!/foreign extension/.test(onlyForeign.detail)) throw new Error('foreign-only check did not fail');
  const titled = classifyExtensionTargets([{ url: 'about:blank', title: 'Sopify Tab' }], id);
  if (titled.ok) throw new Error('a Sopify title counted as this extension');
  const absent = classifyExtensionTargets([], id);
  if (absent.ok) throw new Error('empty targets counted as this extension');
  if (/ignores --load-extension/.test(absent.detail)) throw new Error('missing worker blamed branded Chrome');
  const worker = classifyExtensionTargets([
    {
      type: 'service_worker',
      url: 'chrome-extension://' + id + '/background.js',
      title: 'Service Worker chrome-extension://' + id + '/background.js',
    },
    foreign,
  ], id);
  if (!worker.ok) throw new Error('own service worker was rejected: ' + worker.detail);
  const titledWorker = classifyExtensionTargets([{
    type: 'service_worker',
    url: '',
    title: 'Service Worker chrome-extension://' + id + '/background.js',
  }], id);
  if (!titledWorker.ok) throw new Error('service worker title was rejected');
  const pageOnly = classifyExtensionTargets([{
    type: 'page',
    url: 'chrome-extension://' + id + '/newtab.html',
    title: 'chrome-extension://' + id + '/newtab.html',
  }], id);
  if (pageOnly.ok) throw new Error('a page url without a service worker counted as loaded');
  console.log('extension id check: foreign target fails, id ' + id);
}

function requireWebSocket() {
  if (typeof WebSocket === 'function') return;
  console.error('FAIL browser: global WebSocket is missing. Browser checks need Node 22 or newer.');
  process.exit(1);
}

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
      hostUpstream: seed.hostUpstream || 'cursor',
      themePreset: seed.theme || 'day',
    };
    let noteWrites = 0;
    let readsLeft = seed.failReads || 0;
    let failCreate = seed.failCreate || '';
    window.__sopifySetFailCreate = (value) => { failCreate = value || ''; };
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
            if (seed.failWorksetReads && defaults && Object.prototype.hasOwnProperty.call(defaults, 'worksets') && !deskRead) {
              return Promise.reject(new Error('worksets read failed'));
            }
            if (seed.failUpstream && defaults && Object.prototype.hasOwnProperty.call(defaults, 'hostUpstream')) {
              return Promise.reject(new Error('upstream read failed'));
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
                if (partial && Object.prototype.hasOwnProperty.call(partial, 'hostUpstream')) {
                  window.__sopifyUpstreamWrites = (window.__sopifyUpstreamWrites || 0) + 1;
                }
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
        sendMessage(msg, cb) {
          const done = (res) => { if (typeof cb === 'function') cb(res); };
          if (msg && msg.type === 'sopify-collection-commit') {
            const run = window.__sopifyCollectionCommit;
            if (typeof run !== 'function') {
              done({ ok: false, error: true });
              return;
            }
            Promise.resolve(run(msg.req)).then(done, () => done({ ok: false, error: true }));
            return;
          }
          if (!msg || msg.type !== 'sopify-note-commit') {
            done({ ok: true });
            return;
          }
          const run = window.__sopifyNoteCommit;
          if (typeof run !== 'function') {
            done({ ok: false, error: true });
            return;
          }
          Promise.resolve(run(msg.req)).then(done, () => done({ ok: false, error: true }));
        },
        getURL(p) { return String(p || ''); },
        lastError: null,
      },
      tabs: {
        query() {
          if (seed.failQuery) return Promise.reject(new Error('query failed'));
          return Promise.resolve(seed.tabs || []);
        },
        create(opts) {
          const url = opts && opts.url ? String(opts.url) : '';
          if (failCreate && url.includes(failCreate)) return Promise.reject(new Error('blocked'));
          const tab = { id: 500 + created.length, url: url, title: url };
          created.push(tab);
          return Promise.resolve(tab);
        },
        update() { return Promise.resolve(); },
        remove(ids) {
          const list = Array.isArray(ids) ? ids : [ids];
          const blocked = (id) => seed.failRemove === true || (Array.isArray(seed.failRemove) && seed.failRemove.indexOf(id) !== -1);
          if (list.some(blocked)) return Promise.reject(new Error('remove failed'));
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

function getJson(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname }, (res) => {
      let buf = '';
      res.on('data', (d) => { buf += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch (err) { reject(err); }
      });
    });
    req.on('error', reject);
  });
}

function chromeProductLine(bin) {
  try {
    const out = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 5000 });
    const line = String((out && out.stdout) || '').trim() || String((out && out.stderr) || '').trim();
    return line || 'unknown browser';
  } catch (err) {
    return 'unknown browser';
  }
}

function realLoadIsRequired(productLine) {
  const line = String(productLine || '');
  if (/for Testing/i.test(line)) return true;
  if (/(^|\s)Chromium\b/i.test(line)) return true;
  return false;
}

async function evalOn(cdp, expression) {
  const out = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (out.exceptionDetails) {
    const described = out.exceptionDetails.exception && out.exceptionDetails.exception.description;
    throw new Error(described || out.exceptionDetails.text || JSON.stringify(out.exceptionDetails));
  }
  return out.result ? out.result.value : undefined;
}

async function waitPage(port, targetId) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const list = await getJson(port, '/json/list');
    const hit = list.find((target) => target.id === targetId && target.webSocketDebuggerUrl);
    if (hit) return hit;
    await sleep(40);
  }
  throw new Error('extension page target missing ' + targetId);
}

async function waitDesk(cdp) {
  const deadline = Date.now() + 8000;
  const id = JSON.stringify(SOPIFY_EXTENSION_ID);
  while (Date.now() < deadline) {
    const ready = await evalOn(cdp, `!!(document.getElementById('todo-input') && document.getElementById('notes') && document.getElementById('resume') && document.getElementById('resume').dataset.has !== 'pending' && chrome.runtime && chrome.runtime.id === ${id})`);
    if (ready) return true;
    await sleep(40);
  }
  return false;
}

async function raceTodos(cdpA, cdpB) {
  const fire = (text) => `(() => { const input = document.getElementById('todo-input'); input.value = ${JSON.stringify(text)}; document.getElementById('todo-form').requestSubmit(); return true; })()`;
  await Promise.all([
    cdpA.send('Runtime.evaluate', { expression: fire('甲待办'), returnByValue: true }),
    cdpB.send('Runtime.evaluate', { expression: fire('乙待办'), returnByValue: true }),
  ]);
  let stored = [];
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    stored = await evalOn(cdpA, `(async () => { const data = await chrome.storage.local.get({ todos: [] }); return (data.todos || []).map((t) => t && t.text); })()`);
    if (stored.includes('甲待办') && stored.includes('乙待办')) break;
    await sleep(50);
  }
  const domA = await evalOn(cdpA, `[...document.querySelectorAll('#todos .todo span')].map((n) => n.textContent)`);
  const domB = await evalOn(cdpB, `[...document.querySelectorAll('#todos .todo span')].map((n) => n.textContent)`);
  const ok = stored.includes('甲待办') && stored.includes('乙待办')
    && domA.includes('甲待办') && domA.includes('乙待办')
    && domB.includes('甲待办') && domB.includes('乙待办');
  return { ok, detail: JSON.stringify({ stored, domA, domB }) };
}

async function raceNotes(cdpA, cdpB) {
  const fire = (text) => `(() => { const ta = document.getElementById('notes'); ta.focus(); ta.value = ${JSON.stringify(text)}; ta.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`;
  await Promise.all([
    cdpA.send('Runtime.evaluate', { expression: fire('甲便签正文'), returnByValue: true }),
    cdpB.send('Runtime.evaluate', { expression: fire('乙便签正文'), returnByValue: true }),
  ]);
  const read = `(() => {
    const saved = document.getElementById('notes-saved');
    const open = document.getElementById('note-show-conflict');
    return {
      value: document.getElementById('notes').value,
      status: saved ? saved.textContent : '',
      conflictOpen: !!(open && open.hidden === false),
    };
  })()`;
  let snapA;
  let snapB;
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    snapA = await evalOn(cdpA, read);
    snapB = await evalOn(cdpB, read);
    const pending = [snapA, snapB].some((snap) => snap.status === '保存中…' || snap.status === '');
    const sawConflict = [snapA, snapB].some((snap) => snap.conflictOpen);
    if (sawConflict && !pending) break;
    await sleep(50);
  }
  const stored = await evalOn(cdpA, `(async () => { const data = await chrome.storage.local.get({ notes: '', notesRev: 0 }); return { notes: data.notes, rev: data.notesRev }; })()`);
  const draftsOk = snapA.value === '甲便签正文' && snapB.value === '乙便签正文';
  const storedOk = stored.notes === '甲便签正文' || stored.notes === '乙便签正文';
  const loserIsA = snapA.value !== stored.notes;
  const loser = loserIsA ? snapA : snapB;
  const loserCdp = loserIsA ? cdpA : cdpB;
  const loserShows = loser.conflictOpen === true && loser.status === '便签在另一页更新了';
  let panel = null;
  if (loserShows) {
    panel = await evalOn(loserCdp, `(() => {
      document.getElementById('note-show-conflict').click();
      const box = document.getElementById('note-conflict');
      return {
        hidden: box ? box.hidden : true,
        local: document.getElementById('note-local-preview').textContent,
        remote: document.getElementById('note-remote-preview').textContent,
      };
    })()`);
  }
  const panelOk = !!(panel && panel.hidden === false && panel.local === loser.value && panel.remote === stored.notes && panel.local !== panel.remote);
  const ok = draftsOk && storedOk && loserShows && panelOk;
  return { ok, detail: JSON.stringify({ snapA, snapB, stored, panel }) };
}

async function runTwoPages(port, opened) {
  const ver = await getJson(port, '/json/version');
  const browser = await connectCdp(ver.webSocketDebuggerUrl);
  opened.push(browser);
  const pageUrl = 'chrome-extension://' + SOPIFY_EXTENSION_ID + '/newtab.html';
  const createdA = await browser.send('Target.createTarget', { url: pageUrl });
  const createdB = await browser.send('Target.createTarget', { url: pageUrl });
  const pageA = await waitPage(port, createdA.targetId);
  const pageB = await waitPage(port, createdB.targetId);
  const cdpA = await connectCdp(pageA.webSocketDebuggerUrl);
  const cdpB = await connectCdp(pageB.webSocketDebuggerUrl);
  opened.push(cdpA, cdpB);
  await cdpA.send('Runtime.enable');
  await cdpB.send('Runtime.enable');
  await cdpA.send('Page.enable');
  await cdpB.send('Page.enable');
  if (!await waitDesk(cdpA) || !await waitDesk(cdpB)) {
    return {
      detail: 'newtab did not boot',
      todo: { ok: false, detail: 'boot' },
      note: { ok: false, detail: 'boot' },
    };
  }
  await evalOn(cdpA, `chrome.storage.local.set({ todos: [], todosRev: 0, notes: '', notesRev: 0, notesStamp: 'seed', sites: [], name: '' })`);
  await Promise.all([
    cdpA.send('Page.reload', { ignoreCache: true }),
    cdpB.send('Page.reload', { ignoreCache: true }),
  ]);
  if (!await waitDesk(cdpA) || !await waitDesk(cdpB)) {
    return {
      detail: 'newtab did not reboot',
      todo: { ok: false, detail: 'reboot' },
      note: { ok: false, detail: 'reboot' },
    };
  }
  const todo = await raceTodos(cdpA, cdpB);
  await evalOn(cdpA, `chrome.storage.local.set({ notes: '', notesRev: 0, notesStamp: 'seed' })`);
  await Promise.all([
    cdpA.send('Page.reload', { ignoreCache: true }),
    cdpB.send('Page.reload', { ignoreCache: true }),
  ]);
  if (!await waitDesk(cdpA) || !await waitDesk(cdpB)) {
    return { detail: 'note reboot failed', todo, note: { ok: false, detail: 'reboot' } };
  }
  const note = await raceNotes(cdpA, cdpB);
  return { detail: 'two pages shared storage.local', todo, note };
}

async function exerciseRealExtension(bin) {
  const product = chromeProductLine(bin);
  const required = realLoadIsRequired(product);
  const realProfile = trackProfile(fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-r17-ext-')));
  const realPort = await freePort();
  const realChrome = trackChrome(spawn(bin, [
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
  ], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] }));
  const opened = [];
  let confirmed = false;
  const finish = (result) => {
    for (const cdp of opened) {
      try { cdp.close(); } catch { /* already closed */ }
    }
    killChrome(realChrome);
    rmDir(realProfile);
    return result;
  };
  try {
    await waitJson(realPort);
    let targets = [];
    let classified = classifyExtensionTargets([], SOPIFY_EXTENSION_ID);
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      targets = await getJson(realPort, '/json/list');
      classified = classifyExtensionTargets(targets, SOPIFY_EXTENSION_ID);
      if (classified.ok) break;
      await sleep(100);
    }
    if (!classified.ok) {
      return finish({
        ok: false,
        skipped: !required,
        product,
        detail: classified.detail + '. ' + product + ' did not show this extension service worker on this launch',
        twoPage: false,
      });
    }
    const worker = targets.find((target) => isExtensionWorker(target) && mentionsExtension(target, SOPIFY_EXTENSION_ID) && target.webSocketDebuggerUrl);
    if (!worker) {
      return finish({
        ok: false,
        skipped: !required,
        product,
        detail: 'service worker for ' + SOPIFY_EXTENSION_ID + ' had no debugger url. ' + product,
        twoPage: false,
      });
    }
    const sw = await connectCdp(worker.webSocketDebuggerUrl);
    opened.push(sw);
    await sw.send('Runtime.enable');
    const probe = await evalOn(sw, `({ id: chrome.runtime && chrome.runtime.id, listeners: !!(chrome.action && chrome.action.onClicked && chrome.action.onClicked.hasListeners && chrome.action.onClicked.hasListeners()) })`);
    if (!probe || probe.id !== SOPIFY_EXTENSION_ID || probe.listeners !== true) {
      return finish({
        ok: false,
        skipped: false,
        product,
        detail: 'service worker ' + (worker.url || '') + ' did not report id ' + SOPIFY_EXTENSION_ID + ' with chrome.action.onClicked.hasListeners(); got ' + JSON.stringify(probe),
        twoPage: false,
      });
    }
    confirmed = true;
    const loaded = (worker.url || classified.detail) + '; chrome.runtime.id matched; chrome.action.onClicked.hasListeners() is true';
    const pages = await runTwoPages(realPort, opened);
    const twoPage = !!(pages.todo && pages.todo.ok && pages.note && pages.note.ok);
    return finish({
      ok: true,
      skipped: false,
      product,
      detail: loaded + '; ' + pages.detail,
      twoPage,
      todo: pages.todo,
      note: pages.note,
    });
  } catch (err) {
    return finish({
      ok: false,
      skipped: !confirmed && !required,
      product,
      detail: String(err && err.message ? err.message : err),
      twoPage: false,
    });
  }
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
            const timer = setTimeout(() => {
              pending.delete(id);
              rej(new Error(`CDP timeout ${method} after 10000ms`));
            }, 10000);
            pending.set(id, {
              resolve: (value) => {
                clearTimeout(timer);
                res(value);
              },
              reject: (err) => {
                clearTimeout(timer);
                rej(err);
              },
            });
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

const chromeChildren = [];
const profileDirs = [];

function trackChrome(child) {
  chromeChildren.push(child);
  return child;
}

function trackProfile(dir) {
  profileDirs.push(dir);
  return dir;
}

function killChrome(child) {
  if (!child || child.pid == null) return;
  try { process.kill(-child.pid, 'SIGKILL'); } catch {
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  }
}

function cleanupBrowser() {
  for (const child of chromeChildren) killChrome(child);
  for (const dir of profileDirs) rmDir(dir);
}

function armWatchdog() {
  const timer = setTimeout(() => {
    console.error('FAIL watchdog: browser test exceeded 240s');
    cleanupBrowser();
    process.exit(1);
  }, 240000);
  const onSignal = () => {
    console.error('FAIL watchdog: browser test exceeded 240s');
    cleanupBrowser();
    process.exit(1);
  };
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);
  process.on('exit', cleanupBrowser);
  return () => clearTimeout(timer);
}

async function main() {
  assertExtensionIdentity();
  const bin = findChrome();
  requireWebSocket();
  const stopWatchdog = armWatchdog();
  const liveHits = [];
  const live = await serve(EXT, liveHits);
  const origin = `http://127.0.0.1:${live.address().port}`;
  const cdpPort = process.env.SOPIFY_CDP_PORT ? Number(process.env.SOPIFY_CDP_PORT) : await freePort();
  const profile = trackProfile(fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-r17-')));
  const chrome = trackChrome(spawn(bin, [
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
  ], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] }));
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
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
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
      if (!ARTIFACTS) return;
      const png = await cdp.send('Page.captureScreenshot', { format: 'png' });
      try {
        fs.writeFileSync(path.join(ARTIFACTS, name), Buffer.from(png.data, 'base64'));
      } catch (err) {
        console.log(`screenshot skipped: ${name} (${err && err.code ? err.code : err})`);
      }
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
          loadError: document.getElementById('todo-load-error') ? !document.getElementById('todo-load-error').hidden : null,
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
    const focusedClean = await evalJson(`(() => {
      const ta = document.getElementById('notes');
      ta.focus();
      window.__pushNotes('那边改的', 2, 'other:2:x');
      const box = document.getElementById('note-conflict');
      return {
        value: ta.value,
        status: document.getElementById('notes-saved').textContent,
        hidden: box.hidden,
      };
    })()`);
    check('focused clean note applies the other page', focusedClean.value === '那边改的' && focusedClean.hidden === true && focusedClean.status !== '便签在另一页更新了', JSON.stringify(focusedClean));

    await loadSeed(1440, 900, { todos: [], sites: [], notes: '这边', notesRev: 1, notesStamp: 'seed' }, 'day');
    const conflict = await evalJson(`(() => {
      const ta = document.getElementById('notes');
      ta.focus();
      ta.value = '这边草稿';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      window.__pushNotes('那边改的', 2, 'other:2:x');
      document.getElementById('note-show-conflict').click();
      const box = document.getElementById('note-conflict');
      return {
        value: ta.value,
        status: document.getElementById('notes-saved').textContent,
        notice: document.getElementById('note-show-conflict').textContent,
        buttons: !box.hidden,
        local: document.getElementById('note-local-preview').textContent,
        remote: document.getElementById('note-remote-preview').textContent,
        useRemote: document.getElementById('note-use-remote').textContent,
        keepLocal: document.getElementById('note-keep-local').textContent,
      };
    })()`);
    check('dirty note keeps the local draft', conflict.value === '这边草稿' && conflict.status === '便签在另一页更新了' && conflict.buttons && conflict.notice === '查看更新' && conflict.useRemote === '使用另一页内容' && conflict.keepLocal === '保存我的内容', JSON.stringify(conflict));
    check('conflict shows both drafts before a choice', conflict.local === '这边草稿' && conflict.remote === '那边改的' && conflict.local !== conflict.remote, JSON.stringify(conflict));
    const expanded = await evalJson(`(() => {
      const ta = document.getElementById('notes');
      const long = '长'.repeat(80);
      ta.value = long;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      window.__pushNotes('页'.repeat(90), 9, 'other:9:long');
      document.getElementById('note-show-conflict').click();
      const btn = document.getElementById('note-remote-expand');
      const before = document.getElementById('note-remote-preview').textContent;
      btn.click();
      const after = document.getElementById('note-remote-preview').textContent;
      return {
        hidden: btn.hidden,
        label: btn.textContent,
        beforeEnd: before.slice(-1),
        afterLen: [...after].length,
        kept: ta.value === long,
      };
    })()`);
    check('conflict expands the full remote text', expanded.hidden === false && expanded.beforeEnd === '…' && expanded.afterLen === 90 && expanded.kept === true && expanded.label === '收起', JSON.stringify(expanded));
    await shot('stub-note-conflict-1440.png');

    await loadSeed(1440, 900, {
      todos: [{ id: 'later', text: '读回来了', done: false }],
      sites: sites(1, false),
      notes: '原便签',
      failReads: 1,
    }, 'day');
    const bootFail = await box();
    check('boot read failure stays usable', bootFail.loadError === true && bootFail.has !== 'pending' && bootFail.text.includes('下一件事'), JSON.stringify(bootFail));
    await shot('stub-boot-fail-1440.png');
    const blockedAdd = await evalJson(`(async () => {
      const ta = document.getElementById('notes');
      ta.value = '不该盖掉便签';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const input = document.getElementById('todo-input');
      input.value = '不该盖掉待办';
      input.form.requestSubmit();
      await new Promise((r) => setTimeout(r, 40));
      const err = document.getElementById('todo-save-error');
      const toast = document.getElementById('toast');
      return {
        todoValue: input.value,
        error: err ? err.textContent : '',
        hidden: err ? err.hidden : true,
        todos: window.__sopifyStore.todos.map((t) => t.text),
        notes: window.__sopifyStore.notes,
        sites: window.__sopifyStore.sites.length,
        noteStatus: document.getElementById('notes-saved').textContent,
        toastOn: toast.classList.contains('show'),
        toast: toast.textContent,
      };
    })()`);
    check('read failure blocks the add and keeps the original todos', blockedAdd.todos.length === 1 && blockedAdd.todos[0] === '读回来了' && blockedAdd.todos[0] !== '不该盖掉待办' && blockedAdd.todoValue === '不该盖掉待办' && blockedAdd.hidden === false && blockedAdd.error.includes('待办暂时没能读取') && blockedAdd.notes === '原便签' && blockedAdd.noteStatus === '暂未保存' && blockedAdd.sites === 1 && !(blockedAdd.toastOn && /已加入|已存下|已存在/.test(blockedAdd.toast)), JSON.stringify(blockedAdd));
    const dialogBlocked = await evalJson(`(async () => {
      document.getElementById('todos-open').click();
      const list = document.getElementById('todos-dialog-list');
      const input = document.getElementById('todo-input-dialog');
      input.value = '弹窗不该写入';
      document.getElementById('todo-add-btn').click();
      await new Promise((r) => setTimeout(r, 40));
      const stored = window.__sopifyStore.todos.map((t) => ({ id: t.id, text: t.text, done: t.done }));
      document.getElementById('ops-todos-dialog').close();
      return {
        list: list ? list.innerText : '',
        value: input.value,
        stored,
      };
    })()`);
    check('dialog add during read failure does not write', dialogBlocked.stored.length === 1 && dialogBlocked.stored[0].id === 'later' && dialogBlocked.stored[0].text === '读回来了' && dialogBlocked.stored[0].done === false && dialogBlocked.value === '弹窗不该写入' && dialogBlocked.list.includes('待办暂时没能读取') && !dialogBlocked.list.includes('还没有待办'), JSON.stringify(dialogBlocked));
    const siteBlocked = await evalJson(`(async () => {
      document.getElementById('site-add-toggle').click();
      document.getElementById('site-name').value = '不该盖掉的站';
      document.getElementById('site-url').value = 'https://overwrite.example';
      document.getElementById('site-form').requestSubmit();
      await new Promise((r) => setTimeout(r, 40));
      const err = document.getElementById('site-save-error');
      const stored = window.__sopifyStore.sites.map((s) => ({ name: s.name, url: s.url }));
      const dialog = document.getElementById('ops-sites-dialog');
      if (dialog && dialog.open) dialog.close();
      return {
        error: err ? err.textContent : '',
        hidden: err ? err.hidden : true,
        stored,
        emptyCopy: (document.getElementById('sites') || {}).innerText || '',
      };
    })()`);
    check('site add during read failure does not overwrite sites', siteBlocked.hidden === false && siteBlocked.error.includes('常用站暂时没能读取') && siteBlocked.stored.length === 1 && siteBlocked.stored[0].name === '站1' && siteBlocked.stored[0].url === 'https://example.com/1' && !siteBlocked.emptyCopy.includes('还没有常用站'), JSON.stringify(siteBlocked));
    const otherPage = await evalJson(`(() => {
      window.__sopifyStore.todos = window.__sopifyStore.todos.concat([{ id: 'other', text: '另一页加上的', done: false }]);
      return window.__sopifyStore.todos.map((t) => ({ id: t.id, text: t.text, done: t.done }));
    })()`);
    check('other page can add while this page is unread', otherPage.length === 2 && otherPage[0].text === '读回来了' && otherPage[1].id === 'other' && otherPage[1].text === '另一页加上的', JSON.stringify(otherPage));
    await evalJson(`document.getElementById('todo-load-retry').click()`);
    await sleep(80);
    const retried = await box();
    const retriedStore = await evalJson(`window.__sopifyStore.todos.map((t) => ({ id: t.id, text: t.text, done: t.done }))`);
    check('retry loads the desk', retried.loadError === false && retried.title === '读回来了' && retried.has === '1', JSON.stringify(retried));
    check('retry keeps the other page todo', retriedStore.length === 2 && retriedStore[0].id === 'later' && retriedStore[0].text === '读回来了' && retriedStore[0].done === false && retriedStore[1].id === 'other' && retriedStore[1].text === '另一页加上的' && retriedStore[1].done === false, JSON.stringify(retriedStore));
    const addedAfter = await evalJson(`(async () => {
      const input = document.getElementById('todo-input');
      input.value = '重试后再加';
      input.form.requestSubmit();
      await new Promise((r) => setTimeout(r, 40));
      return {
        value: input.value,
        loadError: !document.getElementById('todo-load-error').hidden,
        empty: (document.getElementById('todos') || {}).innerText.includes('还没有待办'),
        stored: window.__sopifyStore.todos.map((t) => ({ id: t.id, text: t.text, done: t.done })),
        notes: window.__sopifyStore.notes,
      };
    })()`);
    check('add after retry stores old plus new', addedAfter.value === '' && addedAfter.loadError === false && addedAfter.empty === false && addedAfter.notes === '原便签' && addedAfter.stored.length === 3 && addedAfter.stored[0].id === 'later' && addedAfter.stored[0].text === '读回来了' && addedAfter.stored[1].text === '另一页加上的' && addedAfter.stored[2].text === '重试后再加' && addedAfter.stored[2].done === false, JSON.stringify(addedAfter));

    await loadSeed(1440, 900, {
      todos: [{ id: 'keep-todo', text: '待办还在', done: false }],
      sites: [{ name: '原站', url: 'https://site.example/' }],
      worksets: [{
        id: 'ws-keep',
        name: '必须保留的窗口',
        savedAt: 1,
        tabs: [{ title: 'keep', url: 'https://keep.example/' }],
      }],
      tabs: [{ id: 9, title: '新网页', url: 'https://new.example/' }],
      failWorksetReads: true,
    }, 'day');
    const worksetUnread = await evalJson(`(async () => {
      const btn = document.getElementById('workset-save');
      btn.click();
      await new Promise((r) => setTimeout(r, 40));
      const err = document.getElementById('workset-save-error');
      const loadErr = document.getElementById('workset-load-error');
      const toast = document.getElementById('toast');
      return {
        title: document.getElementById('resume-title').textContent,
        disabled: btn.disabled,
        loadHidden: loadErr ? loadErr.hidden : true,
        loadText: loadErr ? loadErr.textContent : '',
        emptyHidden: document.getElementById('last-empty') ? document.getElementById('last-empty').hidden : null,
        error: err ? err.textContent : '',
        errorHidden: err ? err.hidden : true,
        toast: toast.textContent,
        toastOn: toast.classList.contains('show'),
        stored: window.__sopifyStore.worksets.map((w) => ({ id: w.id, name: w.name, tabs: (w.tabs || []).length })),
        sites: window.__sopifyStore.sites.map((s) => s.name),
      };
    })()`);
    check('workset read failure does not overwrite with an empty list', worksetUnread.title === '待办还在' && worksetUnread.disabled === false && worksetUnread.loadHidden === false && worksetUnread.loadText.includes('存下的窗口暂时没能读取') && worksetUnread.emptyHidden === true && worksetUnread.errorHidden === false && worksetUnread.error.includes('存下的窗口暂时没能读取') && !(worksetUnread.toastOn && worksetUnread.toast.includes('已存下')) && worksetUnread.stored.length === 1 && worksetUnread.stored[0].id === 'ws-keep' && worksetUnread.stored[0].name === '必须保留的窗口' && worksetUnread.sites[0] === '原站', JSON.stringify(worksetUnread));

    await loadSeed(1440, 900, {
      todos: [{ id: 'slow', text: '慢读原待办', done: false }],
      sites: sites(1, false),
      failReads: 1,
    }, 'day');
    await evalJson(`(() => {
      const orig = chrome.storage.local.get.bind(chrome.storage.local);
      let deskReads = 0;
      let releaseLate;
      window.__lateRead = new Promise((resolve) => { releaseLate = resolve; });
      window.__releaseLateRead = () => releaseLate();
      chrome.storage.local.get = function (defaults) {
        const desk = defaults && Object.prototype.hasOwnProperty.call(defaults, 'notes');
        if (desk) {
          deskReads += 1;
          if (deskReads === 1) {
            return window.__lateRead.then(() => Promise.reject(new Error('late fail')));
          }
        }
        return orig(defaults);
      };
      document.getElementById('todo-load-retry').click();
      document.getElementById('todo-load-retry').click();
      return deskReads;
    })()`);
    await sleep(120);
    await evalJson(`window.__releaseLateRead()`);
    await sleep(80);
    const late = await evalJson(`({
      title: document.getElementById('resume-title').textContent,
      has: document.getElementById('resume').dataset.has,
      loadError: !document.getElementById('todo-load-error').hidden,
      empty: (document.getElementById('todos') || {}).innerText.includes('还没有待办'),
      stored: window.__sopifyStore.todos.map((t) => ({ id: t.id, text: t.text, done: t.done })),
    })`);
    check('late read failure does not wipe a newer retry', late.title === '慢读原待办' && late.has === '1' && late.loadError === false && late.empty === false && late.stored.length === 1 && late.stored[0].id === 'slow' && late.stored[0].text === '慢读原待办' && late.stored[0].done === false, JSON.stringify(late));

    await loadSeed(1440, 900, {
      todos: [{ id: 'up', text: '书桌还在', done: false }],
      sites: [],
      failUpstream: true,
      hostUpstream: 'claude',
    }, 'day');
    const upstreamFail = await evalJson(`({
      title: document.getElementById('resume-title').textContent,
      has: document.getElementById('resume').dataset.has,
      loadError: !document.getElementById('todo-load-error').hidden,
      writes: window.__sopifyUpstreamWrites || 0,
      stored: window.__sopifyStore.hostUpstream,
    })`);
    check('upstream read failure does not save a default', upstreamFail.title === '书桌还在' && upstreamFail.has === '1' && upstreamFail.loadError === false && upstreamFail.writes === 0 && upstreamFail.stored === 'claude', JSON.stringify(upstreamFail));

    await loadSeed(1440, 900, { todos: [], sites: [], notes: '组词前', notesRev: 1, notesStamp: 'seed' }, 'day');
    const composing = await evalJson(`(() => {
      const notes = document.getElementById('notes');
      let editor = document.getElementById('desk3d-note-editor');
      if (!editor) {
        editor = document.createElement('textarea');
        editor.id = 'desk3d-note-editor';
        document.body.appendChild(editor);
      }
      editor.value = notes.value;
      editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      window.__pushNotes('外部打断', 4, 'other:4:ime');
      return {
        notes: notes.value,
        editor: editor.value,
        status: document.getElementById('notes-saved').textContent,
        stored: window.__sopifyStore.notes,
      };
    })()`);
    check('composition on the space note blocks a remote overwrite', composing.notes === '组词前' && composing.editor === '组词前' && composing.status === '便签在另一页更新了' && composing.stored === '外部打断', JSON.stringify(composing));

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
      tabs: [
        { id: 1, title: 'one', url: 'https://github.com/a' },
        { id: 2, title: 'two', url: 'https://github.com/b' },
      ],
      failRemove: [2],
    }, 'day');
    const partialClose = await evalJson(`(async () => {
      document.querySelector('[data-view="tabs"]').click();
      const btn = document.querySelector('[data-close-host="github.com"]');
      btn.click();
      await new Promise((r) => setTimeout(r, 40));
      const toast = document.getElementById('toast');
      return {
        toast: toast.textContent,
        toastOn: toast.classList.contains('show'),
        removed: window.__sopifyRemoved.slice(),
      };
    })()`);
    check('partial close does not claim full success', partialClose.toastOn && partialClose.toast.includes('还有 1 个没关掉') && !partialClose.toast.includes('已关闭') && JSON.stringify(partialClose.removed) === '[1]', JSON.stringify(partialClose));

    await loadSeed(1440, 900, {
      todos: [],
      sites: [],
      tabs: [{ id: 8, title: 'stuck', url: 'https://github.com/stuck' }],
      failRemove: true,
    }, 'day');
    const failedClose = await evalJson(`(async () => {
      document.querySelector('[data-view="tabs"]').click();
      document.querySelector('[data-close-host="github.com"]').click();
      await new Promise((r) => setTimeout(r, 40));
      const toast = document.getElementById('toast');
      return {
        toast: toast.textContent,
        toastOn: toast.classList.contains('show'),
        removed: window.__sopifyRemoved.slice(),
      };
    })()`);
    check('failed close does not toast success', failedClose.toastOn && failedClose.toast.includes('没关掉') && !failedClose.toast.includes('已关闭') && failedClose.removed.length === 0, JSON.stringify(failedClose));

    await loadSeed(1440, 900, {
      todos: [],
      sites: [],
      worksets: workset,
      failQuery: true,
    }, 'day');
    const queryAbort = await evalJson(`(async () => {
      document.getElementById('workset-restore-recent').click();
      await new Promise((r) => setTimeout(r, 40));
      return {
        toast: document.getElementById('toast').textContent,
        created: window.__sopifyCreated.map((t) => t.url),
        retryHidden: document.getElementById('workset-retry-unopened').hidden,
      };
    })()`);
    check('query failure aborts restore', queryAbort.toast.includes('没有恢复') && !queryAbort.toast.includes('已恢复') && queryAbort.created.length === 0 && queryAbort.retryHidden, JSON.stringify(queryAbort));

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
      const retry = document.getElementById('workset-retry-unopened');
      return {
        toast: document.getElementById('toast').textContent,
        created: window.__sopifyCreated.map((t) => t.url),
        retryHidden: retry.hidden,
        retryText: retry.textContent,
      };
    })()`);
    check('partial restore does not claim full success', restored.toast.includes('没打开') && !restored.toast.includes('已恢复'), JSON.stringify(restored));
    check('partial restore opened the healthy url only', restored.created.length === 1 && restored.created[0].includes('ok.example'), JSON.stringify(restored.created));
    check('partial restore offers retry for what failed', restored.retryHidden === false && restored.retryText === '重试未打开', JSON.stringify(restored));
    await shot('stub-partial-restore-1440.png');
    const retriedOpen = await evalJson(`(async () => {
      window.__sopifySetFailCreate('');
      document.getElementById('workset-retry-unopened').click();
      await new Promise((r) => setTimeout(r, 40));
      const retry = document.getElementById('workset-retry-unopened');
      return {
        toast: document.getElementById('toast').textContent,
        created: window.__sopifyCreated.map((t) => t.url),
        retryHidden: retry.hidden,
      };
    })()`);
    check('retry opens only the tab that failed', retriedOpen.created.length === 2 && retriedOpen.created.filter((url) => url.includes('ok.example')).length === 1 && retriedOpen.created.some((url) => url.includes('fail.example')) && retriedOpen.toast.includes('已恢复') && !retriedOpen.toast.includes('没打开') && retriedOpen.retryHidden, JSON.stringify(retriedOpen));

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
    killChrome(chrome);
    live.close();
    rmDir(profile);
  }

  const realRun = await exerciseRealExtension(bin);
  const real = {
    ok: realRun.ok === true,
    skipped: realRun.skipped === true,
    id: SOPIFY_EXTENSION_ID,
    detail: realRun.detail,
    twoPage: realRun.twoPage === true,
  };
  if (real.skipped) {
    console.log(`real extension: skip ${realRun.product}: ${real.detail}`);
  } else if (!real.ok) {
    console.log(`real extension: fail ${real.detail}`);
    check('real extension loaded', false, real.detail);
  } else {
    console.log(`real extension: loaded ${real.detail}`);
    check('real extension loaded', true, real.detail);
    check('real extension keeps both concurrent todos', realRun.todo && realRun.todo.ok, realRun.todo && realRun.todo.detail);
    check('real extension note race shows both drafts', realRun.note && realRun.note.ok, realRun.note && realRun.note.detail);
  }

  const report = {
    kind: 'stub-browser',
    browser: version,
    os: `${os.platform()} ${os.release()}`,
    port: cdpPort,
    checks,
    realExtension: real,
  };
  const failedNames = new Set(failures.map((line) => line.split(':')[0]));
  let staticCol = '未测';
  try {
    const markerDir = process.env.SOPIFY_ARTIFACT_DIR || '/opt/cursor/artifacts/r1-r7';
    if (fs.existsSync(path.join(markerDir, 'static-ok'))) staticCol = 'pass';
  } catch { /* leave 未测 */ }
  function col(name) {
    const row = checks.find((c) => c.name === name);
    if (!row) return '未测';
    return row.ok ? 'pass' : 'fail';
  }
  function realCol(name) {
    const row = checks.find((c) => c.name === name);
    if (row) return row.ok ? 'pass' : 'fail';
    if (real.skipped) return 'skip';
    return '未测';
  }
  function cols(names) {
    const rows = names.map(col);
    if (rows.some((v) => v === 'fail')) return 'fail';
    if (rows.every((v) => v === 'pass')) return 'pass';
    return '未测';
  }
  const acceptance = {
    columns: ['静态', '替身', '真扩展', 'IME', '未测'],
    note: '替身是桩浏览器里的界面。系统中文输入法没有跑，不能记成通过。合成 composition 事件算替身，不算真 IME。',
    rows: [
      {
        item: 'A 读失败不当成空数据，禁止覆盖写',
        静态: staticCol,
        替身: cols([
          'read failure blocks the add and keeps the original todos',
          'dialog add during read failure does not write',
          'site add during read failure does not overwrite sites',
          'retry keeps the other page todo',
          'add after retry stores old plus new',
          'workset read failure does not overwrite with an empty list',
          'late read failure does not wipe a newer retry',
          'upstream read failure does not save a default',
        ]),
        真扩展: '未测',
        IME: '未测',
        未测: '真扩展 / 真中文 IME。A1–A6 只在替身里点过新增并核对存储',
      },
      {
        item: 'B 便签同一队列，先写的留下，后写的冲突并保留草稿',
        静态: staticCol,
        替身: '未测',
        真扩展: realCol('real extension note race shows both drafts'),
        IME: '未测',
        未测: '系统中文输入法没有跑。空间视图默认关，3D 便签未打开；组词守卫只用合成事件。',
      },
      {
        item: 'C 确认只覆盖刚看过的版本，冲突可展开全文',
        静态: staticCol,
        替身: col('conflict expands the full remote text'),
        真扩展: '未测',
        IME: '未测',
        未测: '版本被改掉后再确认只在静态单测。真扩展 / 真中文 IME',
      },
      {
        item: 'P1 待办／常用站／窗口按意图合并，双成功不丢新增',
        静态: staticCol,
        替身: '未测',
        真扩展: realCol('real extension keeps both concurrent todos'),
        IME: '未测',
        未测: '真中文输入法没有跑。交叉新增的存储断言在静态协调器里。',
      },
      {
        item: 'P2 旧便签回执不压掉较新冲突',
        静态: staticCol,
        替身: '未测',
        真扩展: '未测',
        IME: '未测',
        未测: '真双页扩展 / 3D 便签 / 真扩展 / 真中文 IME。3D 与普通便签走同一保存函数，运行时未开空间视图',
      },
      {
        item: '表单重试复用同一条编号，不按文字去重',
        静态: staticCol,
        替身: '未测',
        真扩展: '未测',
        IME: '未测',
        未测: '重试编号在 node 里走 form-ops 和协调器。替身 / 真扩展 / 真中文 IME / 3D',
      },
      {
        item: '旧冲突回执不盖掉较新冲突，确认只用当前有效冲突',
        静态: staticCol,
        替身: '未测',
        真扩展: '未测',
        IME: '未测',
        未测: '冲突门闸在 node 里走 note-sync。真双页 / 3D / 真扩展 / 真中文 IME',
      },
      {
        item: '扩展目标只认 cgkhllpelkjmfamddkjpnmchjikdcbgp',
        静态: 'pass',
        替身: '未测',
        真扩展: real.ok ? 'pass' : (real.skipped ? 'skip' : '未测'),
        IME: '未测',
        未测: '反例在 node 里拒绝其他 chrome-extension。真中文 IME / 3D 运行时',
      },
      {
        item: 'R1–R7 关闭、恢复、输入法守卫、读失败提示',
        静态: staticCol,
        替身: failures.length ? 'fail' : 'pass',
        真扩展: '未测',
        IME: '未测',
        未测: '真扩展 / 真中文 IME。桩里的 Enter/229 只是合成事件',
      },
    ],
    realExtension: real.twoPage === true
      ? { ok: true, id: SOPIFY_EXTENSION_ID, detail: real.detail }
      : { ok: false, id: SOPIFY_EXTENSION_ID, detail: real.detail || 'two-page onChanged was not run' },
    failedChecks: [...failedNames],
  };
  if (ARTIFACTS) {
    try {
      fs.writeFileSync(path.join(ARTIFACTS, 'report.json'), JSON.stringify(report, null, 2));
      fs.writeFileSync(path.join(ARTIFACTS, 'acceptance.json'), JSON.stringify(acceptance, null, 2));
    } catch (err) {
      console.log(`report skipped: ${err && err.code ? err.code : err}`);
    }
  }
  if (failures.length) {
    console.log(`test-r1-r7-browser: FAIL ${failures.length}`);
    throw new Error(failures.join('\n'));
  }
  stopWatchdog();
  console.log('test-r1-r7-browser: ok');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
