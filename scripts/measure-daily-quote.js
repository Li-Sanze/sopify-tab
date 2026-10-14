'use strict';

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const guard = require('./quote-guard');

const ROOT = path.join(__dirname, '..');
const EXT = path.join(ROOT, 'extension');
const MAIN_SHA = '6b0c9c78268c6d98505ea63bf89ee45feda83ca0';
const EXT_ID = 'cgkhllpelkjmfamddkjpnmchjikdcbgp';
const QUOTE_FILE = JSON.parse(fs.readFileSync(path.join(EXT, 'quotes.json'), 'utf8'));
const longestQuote = QUOTE_FILE.reduce((best, quote) => (guard.bodyLength(quote.text) > guard.bodyLength(best.text) ? quote : best));
const longestSource = QUOTE_FILE.reduce((best, quote) => {
  const line = guard.sourceLine(quote);
  const bestLine = guard.sourceLine(best);
  if ([...line].length !== [...bestLine].length) return [...line].length > [...bestLine].length ? quote : best;
  return line > bestLine ? quote : best;
});
const LONG = longestQuote.text;
const LONG_SRC = guard.sourceLine(longestSource);
const OUT = process.env.SOPIFY_QUOTE_OUT || path.join(ROOT, 'docs', 'evidence', 'daily-quote-c1');
const CHROME = process.env.CHROME_BIN || '/usr/local/bin/google-chrome';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function getJson(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname }, (res) => {
      let buf = '';
      res.on('data', (chunk) => { buf += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch (err) { reject(err); }
      });
    });
    req.on('error', reject);
  });
}

function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let seq = 0;
    const pending = new Map();
    const events = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const item = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) item.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else item.resolve(msg.result || {});
      } else if (msg.method) {
        events.push(msg);
      }
    });
    ws.addEventListener('error', () => reject(new Error('cdp websocket failed')));
    ws.addEventListener('open', () => {
      resolve({
        events,
        send(method, params, timeoutMs) {
          const id = ++seq;
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              pending.delete(id);
              rej(new Error('CDP timeout ' + method));
            }, timeoutMs || 20000);
            pending.set(id, {
              resolve(value) {
                clearTimeout(timer);
                res(value);
              },
              reject(err) {
                clearTimeout(timer);
                rej(err);
              },
            });
            ws.send(JSON.stringify({ id, method, params: params || {} }));
          });
        },
        close() { try { ws.close(); } catch { /* gone */ } },
      });
    });
  });
}

async function evalOn(cdp, expression) {
  const out = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (out.exceptionDetails) {
    const described = out.exceptionDetails.exception && out.exceptionDetails.exception.description;
    throw new Error(described || out.exceptionDetails.text || 'evaluate failed');
  }
  return out.result ? out.result.value : undefined;
}

function launchChrome(extDir, port, profile) {
  const child = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
    '--load-extension=' + extDir,
    '--disable-extensions-except=' + extDir,
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--force-device-scale-factor=1',
    '--window-size=1280,800',
    'about:blank',
  ], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  return child;
}

function killChrome(child) {
  if (!child || child.pid == null) return;
  try { process.kill(-child.pid, 'SIGKILL'); } catch {
    try { child.kill('SIGKILL'); } catch { /* gone */ }
  }
}

async function waitTargets(port) {
  const deadline = Date.now() + 8000;
  let last = [];
  while (Date.now() < deadline) {
    try {
      last = await getJson(port, '/json/list');
      if (last.some((target) => String(target.url || '').includes(EXT_ID))) return last;
    } catch { /* booting */ }
    await sleep(100);
  }
  return last;
}

async function attachBrowser(port) {
  const version = await getJson(port, '/json/version');
  return connectCdp(version.webSocketDebuggerUrl);
}

async function settle(page, sky) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const ok = await evalOn(page, `(function () {
      return document.body && document.body.classList.contains('studio-home')
        && document.documentElement.dataset.sky === ${JSON.stringify(sky)}
        && document.documentElement.dataset.theme === ${JSON.stringify(sky)};
    })()`);
    if (ok) return;
    await sleep(40);
  }
  const state = await evalOn(page, `({ sky: document.documentElement.dataset.sky, theme: document.documentElement.dataset.theme, home: document.body.classList.contains('studio-home') })`);
  throw new Error('page did not settle to ' + sky + ' ' + JSON.stringify(state));
}

async function freezeClock(page) {
  await evalOn(page, `(function () {
    const lock = (id, value) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.dqFrozen) return;
      el.dataset.dqFrozen = '1';
      const proto = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
      proto.set.call(el, value);
      Object.defineProperty(el, 'textContent', {
        configurable: true,
        get() { return proto.get.call(this); },
        set() { proto.set.call(this, value); },
      });
    };
    lock('greet-word', '你好');
    lock('date-line', '10月13日 星期二');
    lock('clock-hm', '15:25');
  })()`);
}

async function platformFonts(page) {
  await page.send('DOM.enable');
  await page.send('CSS.enable');
  const doc = await page.send('DOM.getDocument', { depth: 1 });
  const found = await page.send('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: '.dq-text',
  });
  if (!found.nodeId) return [];
  const fonts = await page.send('CSS.getPlatformFontsForNode', { nodeId: found.nodeId });
  return fonts.fonts || [];
}

const SWEEP_JS = `(function () {
  const card = document.getElementById('daily-quote');
  if (!card) return { width: window.innerWidth, missing: true };
  const collided = card.classList.contains('dq-collide');
  if (collided) card.classList.remove('dq-collide');
  const cardRect = card.getBoundingClientRect();
  if (collided) card.classList.add('dq-collide');
  function area(a, b) {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (!(w > 0) || !(h > 0)) return 0;
    return w * h;
  }
  const hits = [];
  let total = 0;
  const boxSelector = 'a, button, input, textarea, select, img, svg, .col, .tile, .studio-nav, .studio-brand';
  document.querySelectorAll('#main *').forEach((el) => {
    if (el === card || card.contains(el) || el.contains(card) || el.id === 'dq-probe') return;
    const cs = getComputedStyle(el);
    if (el.hidden || cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;
    if (el.closest('[hidden]') || el.matches('.stars-layer')) return;
    if (el.getAttribute('aria-hidden') === 'true' && !el.closest('button, a')) return;
    const useBox = el.matches(boxSelector) || el.childElementCount === 0;
    const rects = [];
    if (useBox) {
      for (const rect of el.getClientRects()) rects.push(rect);
    } else {
      for (const child of el.childNodes) {
        if (child.nodeType !== 3 || !String(child.textContent || '').trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(child);
        for (const rect of range.getClientRects()) rects.push(rect);
      }
    }
    let hit = 0;
    for (const rect of rects) {
      if (rect.width < 1 || rect.height < 1) continue;
      hit += area(cardRect, rect);
    }
    if (hit > 0) {
      total += hit;
      hits.push(el.id || (typeof el.className === 'string' ? el.className : '') || el.tagName);
    }
  });
  return {
    width: window.innerWidth,
    total: Math.round(total),
    hits,
    card: [cardRect.x, cardRect.y, cardRect.width, cardRect.height],
    display: getComputedStyle(card).display,
    collapsed: card.classList.contains('dq-collide'),
  };
})()`;

async function openPage(browser, url) {
  const created = await browser.send('Target.createTarget', { url: 'about:blank' });
  const targets = await getJson(browser.port, '/json/list');
  const target = targets.find((item) => item.id === created.targetId);
  const page = await connectCdp(target.webSocketDebuggerUrl);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Network.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-reduced-motion', value: 'reduce' },
      { name: 'prefers-color-scheme', value: 'light' },
    ],
  });
  page.events.length = 0;
  await page.send('Page.navigate', { url });
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const state = await evalOn(page, 'document.readyState');
    if (state === 'complete') break;
    await sleep(50);
  }
  await evalOn(page, 'document.fonts ? document.fonts.ready : true');
  await evalOn(page, 'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  return page;
}

async function setStorage(port, values) {
  const targets = await getJson(port, '/json/list');
  const worker = targets.find((target) => String(target.url || '').includes(EXT_ID) && (target.type === 'service_worker' || target.type === 'background_page'));
  if (!worker) throw new Error('extension service worker missing');
  const sw = await connectCdp(worker.webSocketDebuggerUrl);
  await sw.send('Runtime.enable');
  await evalOn(sw, 'chrome.storage.local.set(' + JSON.stringify(values) + ')');
  sw.close();
}

function png(page, file) {
  return page.send('Page.captureScreenshot', { format: 'png', fromSurface: true }).then((shot) => {
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  });
}

const MEASURE_JS = `(function () {
  const LONG = ${JSON.stringify(LONG)};
  const card = document.getElementById('daily-quote');
  const text = card && card.querySelector('.dq-text');
  const src = card && card.querySelector('.dq-src');
  if (text) text.textContent = LONG;
  if (src) src.textContent = ${JSON.stringify(LONG_SRC)};
  const anchors = {
    title: '#resume-title',
    kicker: '#resume-kicker',
    next: '.next',
    eyebrow: '.eyebrow',
    shelf: '.shelf',
    sitesRow: '.sites-row',
    nav: '.studio-nav',
    brand: '.studio-brand',
    navSettings: '#studio-nav-settings',
    col0: '.shelf .col:nth-child(1)',
    col1: '.shelf .col:nth-child(2)',
    col2: '.shelf .col:nth-child(3)',
  };
  function box(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  }
  function area(a, b) {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (!(w > 0) || !(h > 0)) return 0;
    return w * h;
  }
  function shown(el) {
    if (!el || el.hidden || (el.closest && el.closest('[hidden]'))) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) !== 0;
  }
  const layout = {};
  Object.keys(anchors).forEach((key) => { layout[key] = box(document.querySelector(anchors[key])); });
  let lines = 0;
  let quoteStyle = null;
  let srcStyle = null;
  let cardBox = null;
  let xHit = null;
  if (text) {
    const range = document.createRange();
    range.selectNodeContents(text);
    lines = range.getClientRects().length;
    const cs = getComputedStyle(text);
    quoteStyle = {
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      fontWeight: cs.fontWeight,
      color: cs.color,
      overflow: cs.overflow,
      textOverflow: cs.textOverflow,
      lineClamp: cs.webkitLineClamp || 'none',
      fontFamily: cs.fontFamily,
    };
  }
  if (src) {
    const cs = getComputedStyle(src);
    srcStyle = { fontSize: cs.fontSize, color: cs.color, text: src.textContent };
  }
  if (card) {
    const r = card.getBoundingClientRect();
    cardBox = [r.x, r.y, r.width, r.height];
    const btn = card.querySelector('.dq-x');
    if (btn) {
      const b = btn.getBoundingClientRect();
      xHit = [b.width, b.height];
    }
  }
  const hits = [];
  let checked = 0;
  let total = 0;
  if (card && cardBox && cardBox[2] > 0) {
    const cardRect = card.getBoundingClientRect();
    const boxSelector = 'a, button, input, textarea, select, img, svg, .col, .tile, .studio-nav, .studio-brand';
    document.querySelectorAll('#main *').forEach((el) => {
      if (el === card || card.contains(el) || el.contains(card)) return;
      if (!shown(el)) return;
      if (el.matches('.stars-layer')) return;
      if (el.getAttribute('aria-hidden') === 'true' && !el.closest('button, a')) return;
      const useBox = el.matches(boxSelector) || el.childElementCount === 0;
      const rects = [];
      if (useBox) {
        for (const rect of el.getClientRects()) rects.push(rect);
      } else {
        for (const child of el.childNodes) {
          if (child.nodeType !== 3 || !child.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(child);
          for (const rect of range.getClientRects()) rects.push(rect);
        }
      }
      let hit = 0;
      for (const rect of rects) {
        if (rect.width < 1 || rect.height < 1) continue;
        checked += 1;
        hit += area(cardRect, rect);
      }
      if (hit > 0) {
        total += hit;
        hits.push({ el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : ''), area: hit });
      }
    });
  }
  const title = document.getElementById('resume-title');
  const titleCs = title ? getComputedStyle(title) : null;
  return {
    clock: (document.getElementById('clock-hm') || {}).textContent || '',
    date: (document.getElementById('date-line') || {}).textContent || '',
    sky: document.documentElement.dataset.sky || '',
    dqOn: document.body.classList.contains('dq-on'),
    cardPresent: !!card,
    cardDisplay: card ? getComputedStyle(card).display : '',
    cardBox,
    xHit,
    lines,
    quoteStyle,
    srcStyle,
    quoteText: text ? text.textContent : '',
    layout,
    overlapTotal: total,
    overlapHits: hits,
    overlapChecked: checked,
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollY: window.scrollY,
    titleFontSize: titleCs ? titleCs.fontSize : '',
    titleWeight: titleCs ? titleCs.fontWeight : '',
    guardClass: card ? card.classList.contains('dq-collide') : false,
  };
})()`;

async function readMeasure(page) {
  return evalOn(page, MEASURE_JS);
}

async function shotPair(page, file) {
  await evalOn(page, 'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await png(page, file);
  return readMeasure(page);
}

function analyzeImages(job) {
  const py = `
import json, sys
from PIL import Image
job = json.loads(sys.stdin.read())
out = {}

def rel(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

def lum(rgb):
    return 0.2126 * rel(rgb[0]) + 0.7152 * rel(rgb[1]) + 0.0722 * rel(rgb[2])

def contrast(fg, bg):
    a, b = lum(fg), lum(bg)
    hi, lo = (a, b) if a > b else (b, a)
    return (hi + 0.05) / (lo + 0.05)

def parse_rgb(text):
    nums = [int(float(n)) for n in text.replace('rgba', '').replace('rgb', '').replace('(', '').replace(')', '').split(',')[:3]]
    return nums

def crop(path, box):
    im = Image.open(path).convert('RGB')
    x, y, w, h = box
    x0 = max(0, int(round(x)))
    y0 = max(0, int(round(y)))
    x1 = min(im.width, int(round(x + w)))
    y1 = min(im.height, int(round(y + h)))
    return im.crop((x0, y0, x1, y1))

def worst(path, box, color):
    im = crop(path, box)
    fg = parse_rgb(color)
    worst_v = 99
    for px in im.getdata():
        value = contrast(fg, px)
        if value < worst_v:
            worst_v = value
    return round(worst_v, 2), im.size

def mean_delta(a_path, b_path, box):
    a = crop(a_path, box)
    b = crop(b_path, box)
    if a.size != b.size:
        return None
    total = 0
    n = 0
    for p, q in zip(a.getdata(), b.getdata()):
        total += (abs(p[0] - q[0]) + abs(p[1] - q[1]) + abs(p[2] - q[2])) / 3
        n += 1
    return round(total / n, 2) if n else None

def diff_count(a_path, b_path):
    a = Image.open(a_path).convert('RGB')
    b = Image.open(b_path).convert('RGB')
    if a.size != b.size:
        return {'width': [a.size, b.size], 'nonzero': -1}
    n = 0
    for p, q in zip(a.getdata(), b.getdata()):
        if p != q:
            n += 1
    return {'size': list(a.size), 'nonzero': n}

for item in job.get('contrast', []):
    value, size = worst(item['png'], item['box'], item['color'])
    out[item['name']] = {'worst': value, 'sample': list(size), 'color': item['color']}
for item in job.get('glass', []):
    out[item['name']] = {'meanPixelDelta': mean_delta(item['with'], item['without'], item['box'])}
for item in job.get('diff', []):
    out[item['name']] = diff_count(item['a'], item['b'])
print(json.dumps(out))
`;
  const child = spawnSync('python3', ['-c', py], {
    input: JSON.stringify(job),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (child.status !== 0) throw new Error(child.stderr || 'image analysis failed');
  return JSON.parse(child.stdout);
}

async function withSession(extDir, run) {
  const port = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-dq-'));
  const child = launchChrome(extDir, port, profile);
  let browser = null;
  try {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      try {
        await getJson(port, '/json/version');
        break;
      } catch { await sleep(80); }
    }
    const targets = await waitTargets(port);
    if (!targets.some((target) => String(target.url || '').includes(EXT_ID))) {
      throw new Error('extension did not load: ' + JSON.stringify(targets.map((t) => t.url)));
    }
    browser = await attachBrowser(port);
    browser.port = port;
    return await run(browser, port);
  } finally {
    if (browser) browser.close();
    killChrome(child);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

async function prepareMain() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-main-'));
  const archive = spawnSync('git', ['archive', MAIN_SHA, 'extension'], { cwd: ROOT, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  if (archive.status !== 0) throw new Error('git archive failed');
  const extracted = spawnSync('tar', ['-x', '-C', dir], { input: archive.stdout });
  if (extracted.status !== 0) throw new Error('tar failed');
  return path.join(dir, 'extension');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const mainExt = await prepareMain();
  const report = { quote: LONG, source: LONG_SRC, shots: {}, notes: ['macOS PingFang wrapping is unverified. Linux Chrome for Testing with Noto Sans CJK SC.'] };
  const requests = { feature: [], main: [] };

  async function capture(extDir, label, values, viewport, file, media) {
    return withSession(extDir, async (browser, port) => {
      await setStorage(port, values);
      const page = await openPage(browser, 'chrome-extension://' + EXT_ID + '/newtab.html');
      const sky = (values.themePreset === 'night') ? 'night' : 'day';
      if (media) {
        await page.send('Emulation.setEmulatedMedia', { features: media });
      }
      await page.send('Emulation.setDeviceMetricsOverride', {
        width: viewport[0],
        height: viewport[1],
        deviceScaleFactor: 1,
        mobile: false,
      });
      await settle(page, sky);
      await freezeClock(page);
      await evalOn(page, 'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      const urls = page.events
        .filter((event) => event.method === 'Network.requestWillBeSent')
        .map((event) => event.params && event.params.request && event.params.request.url)
        .filter(Boolean);
      const measure = await shotPair(page, file);
      page.close();
      return { measure, urls };
    });
  }

  const dayMedia = [
    { name: 'prefers-reduced-motion', value: 'reduce' },
    { name: 'prefers-color-scheme', value: 'light' },
  ];
  const nightMedia = [
    { name: 'prefers-reduced-motion', value: 'reduce' },
    { name: 'prefers-color-scheme', value: 'dark' },
  ];

  const offDay = path.join(OUT, 'off-day-1280x800.png');
  const mainDay = path.join(OUT, 'main-day-1280x800.png');
  const offNight = path.join(OUT, 'off-night-1280x800.png');
  const mainNight = path.join(OUT, 'main-night-1280x800.png');
  const onDay = path.join(OUT, 'on-day-1280x800.png');
  const onNight = path.join(OUT, 'on-night-1280x800.png');
  const onDay720 = path.join(OUT, 'on-day-1280x720.png');
  const onNight720 = path.join(OUT, 'on-night-1280x720.png');

  const offDayResult = await capture(EXT, 'off-day', { themePreset: 'day' }, [1280, 800], offDay, dayMedia);
  const mainDayResult = await capture(mainExt, 'main-day', { themePreset: 'day' }, [1280, 800], mainDay, dayMedia);
  const offNightResult = await capture(EXT, 'off-night', { themePreset: 'night' }, [1280, 800], offNight, nightMedia);
  const mainNightResult = await capture(mainExt, 'main-night', { themePreset: 'night' }, [1280, 800], mainNight, nightMedia);
  requests.feature.push(...offDayResult.urls);
  requests.main.push(...mainDayResult.urls);

  const behavior = await withSession(EXT, async (browser, port) => {
    await setStorage(port, { dailyQuote: true, themePreset: 'day', dailyQuoteDismissedOn: '' });
    const page = await openPage(browser, 'chrome-extension://' + EXT_ID + '/newtab.html');
    await page.send('Emulation.setEmulatedMedia', { features: dayMedia });
    await settle(page, 'day');
    await freezeClock(page);
    const natural = await evalOn(page, `(function () {
      const card = document.getElementById('daily-quote');
      const text = card && card.querySelector('.dq-text');
      return {
        present: !!card,
        text: text ? text.textContent : '',
        src: card ? card.querySelector('.dq-src').textContent : '',
        font: text ? getComputedStyle(text).fontFamily : '',
      };
    })()`);
    const hoverFile = path.join(OUT, 'x-hover-day-1280x800.png');
    const focusFile = path.join(OUT, 'x-focus-day-1280x800.png');
    await evalOn(page, MEASURE_JS);
    await evalOn(page, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    const hoverPoint = await evalOn(page, `(function () {
      const btn = document.querySelector('.dq-x');
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    })()`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hoverPoint.x, y: hoverPoint.y });
    await sleep(50);
    await png(page, hoverFile);
    await evalOn(page, `document.querySelector('.dq-x').focus({ focusVisible: true })`);
    await sleep(30);
    await png(page, focusFile);
    const focusState = await evalOn(page, `(function () {
      const btn = document.querySelector('.dq-x');
      const cs = getComputedStyle(btn);
      return { active: document.activeElement === btn, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, offset: cs.outlineOffset };
    })()`);
    const emptyReady = await evalOn(page, `(async function () {
      await chrome.storage.local.set({ todos: [], dailyQuote: true, dailyQuoteDismissedOn: '' });
      const deadline = Date.now() + 2500;
      while (Date.now() < deadline) {
        const title = document.getElementById('resume-title');
        const filled = document.querySelector('.next-filled');
        const card = document.querySelector('.dq-x');
        const hidden = title && filled && (getComputedStyle(title).display === 'none' || getComputedStyle(filled).display === 'none');
        if (hidden && card) break;
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      const title = document.getElementById('resume-title');
      const filled = document.querySelector('.next-filled');
      const button = document.querySelector('.dq-x');
      if (button) button.focus();
      return {
        has: (document.getElementById('resume') || {}).dataset.has || '',
        titleDisplay: title ? getComputedStyle(title).display : '',
        filledDisplay: filled ? getComputedStyle(filled).display : '',
        scrollY: window.scrollY,
      };
    })()`);
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r' });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await sleep(80);
    const afterEnter = await evalOn(page, `(async function () {
      const data = await chrome.storage.local.get(['dailyQuote', 'dailyQuoteDismissedOn']);
      return { card: !!document.getElementById('daily-quote'), focus: document.activeElement && document.activeElement.id, scrollY: window.scrollY, storage: data };
    })()`);
    await evalOn(page, `chrome.storage.local.set({ dailyQuote: true, dailyQuoteDismissedOn: '' })`);
    await sleep(80);
    await evalOn(page, `document.querySelector('.dq-x').focus()`);
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
    await sleep(80);
    const afterSpace = await evalOn(page, `(async function () {
      const data = await chrome.storage.local.get(['dailyQuote', 'dailyQuoteDismissedOn']);
      return { card: !!document.getElementById('daily-quote'), focus: document.activeElement && document.activeElement.id, scrollY: window.scrollY, storage: data };
    })()`);
    await evalOn(page, `chrome.storage.local.set({ dailyQuote: true, dailyQuoteDismissedOn: '' })`);
    await sleep(80);
    await evalOn(page, MEASURE_JS);
    await evalOn(page, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    const day800 = await shotPair(page, onDay);
    let fonts = [];
    try { fonts = await platformFonts(page); } catch (err) { fonts = [{ error: String(err.message || err) }]; }
    const textBox = await evalOn(page, `(function () {
      const text = document.querySelector('.dq-text');
      const src = document.querySelector('.dq-src');
      const card = document.getElementById('daily-quote');
      text.style.color = 'transparent';
      src.style.color = 'transparent';
      const tr = text.getBoundingClientRect();
      const sr = src.getBoundingClientRect();
      const cr = card.getBoundingClientRect();
      return {
        text: { box: [tr.x, tr.y, tr.width, tr.height], color: ${JSON.stringify('rgb(70, 75, 86)')} },
        src: { box: [sr.x, sr.y, sr.width, sr.height] },
        card: [cr.x, cr.y, cr.width, cr.height],
        quoteColor: getComputedStyle(document.querySelector('.dq-text')).color,
      };
    })()`);
    const bareDay = path.join(OUT, 'contrast-day-bare.png');
    await png(page, bareDay);
    const noGlass = path.join(OUT, 'contrast-day-noglass.png');
    await evalOn(page, `document.getElementById('daily-quote').style.background = 'transparent'; document.getElementById('daily-quote').style.boxShadow = 'none'; document.getElementById('daily-quote').style.backdropFilter = 'none';`);
    await png(page, noGlass);
    await evalOn(page, `document.getElementById('daily-quote').style.background = ''; document.getElementById('daily-quote').style.boxShadow = ''; document.getElementById('daily-quote').style.backdropFilter = ''; document.querySelector('.dq-text').style.color = ''; document.querySelector('.dq-src').style.color = '';`);

    await page.send('Emulation.setEmulatedMedia', { features: nightMedia });
    await evalOn(page, `chrome.storage.local.set({ themePreset: 'night' })`);
    const nightDeadline = Date.now() + 3000;
    while (Date.now() < nightDeadline) {
      const sky = await evalOn(page, `document.documentElement.dataset.sky`);
      if (sky === 'night') break;
      await sleep(40);
    }
    await evalOn(page, MEASURE_JS);
    await evalOn(page, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    const night800 = await shotPair(page, onNight);
    const nightHover = path.join(OUT, 'x-hover-night-1280x800.png');
    const nightFocus = path.join(OUT, 'x-focus-night-1280x800.png');
    const nightPoint = await evalOn(page, `(function () { const r = document.querySelector('.dq-x').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: nightPoint.x, y: nightPoint.y });
    await png(page, nightHover);
    await evalOn(page, `document.querySelector('.dq-x').focus({ focusVisible: true })`);
    await png(page, nightFocus);
    const nightText = await evalOn(page, `(function () {
      const text = document.querySelector('.dq-text');
      const src = document.querySelector('.dq-src');
      const saved = { text: getComputedStyle(text).color, src: getComputedStyle(src).color };
      text.style.color = 'transparent';
      src.style.color = 'transparent';
      const tr = text.getBoundingClientRect();
      const sr = src.getBoundingClientRect();
      const cr = document.getElementById('daily-quote').getBoundingClientRect();
      return { text: [tr.x, tr.y, tr.width, tr.height], src: [sr.x, sr.y, sr.width, sr.height], card: [cr.x, cr.y, cr.width, cr.height], colors: saved };
    })()`);
    const bareNight = path.join(OUT, 'contrast-night-bare.png');
    await png(page, bareNight);
    const noGlassNight = path.join(OUT, 'contrast-night-noglass.png');
    await evalOn(page, `document.getElementById('daily-quote').style.background = 'transparent'; document.getElementById('daily-quote').style.boxShadow = 'none'; document.getElementById('daily-quote').style.webkitBackdropFilter = 'none'; document.getElementById('daily-quote').style.backdropFilter = 'none';`);
    await png(page, noGlassNight);
    await evalOn(page, `document.getElementById('daily-quote').style.background = ''; document.getElementById('daily-quote').style.boxShadow = ''; document.querySelector('.dq-text').style.color = ''; document.querySelector('.dq-src').style.color = '';`);
    await page.send('Emulation.setEmulatedMedia', { features: dayMedia });
    await evalOn(page, `chrome.storage.local.set({ themePreset: 'day' })`);
    await sleep(100);

    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await evalOn(page, MEASURE_JS);
    await evalOn(page, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    const day720 = await shotPair(page, onDay720);
    await page.send('Emulation.setEmulatedMedia', { features: nightMedia });
    await evalOn(page, `chrome.storage.local.set({ themePreset: 'night' })`);
    await sleep(120);
    await evalOn(page, MEASURE_JS);
    const night720 = await shotPair(page, onNight720);
    await page.send('Emulation.setEmulatedMedia', { features: dayMedia });
    await evalOn(page, `chrome.storage.local.set({ themePreset: 'day' })`);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await sleep(80);

    const offLayout = await evalOn(page, `(async function () {
      await chrome.storage.local.set({ dailyQuote: false });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return ${MEASURE_JS};
    })()`);
    await evalOn(page, `chrome.storage.local.set({ dailyQuote: true, dailyQuoteDismissedOn: '' })`);
    await sleep(80);
    await evalOn(page, MEASURE_JS);

    const probe = await evalOn(page, `(function () {
      const card = document.getElementById('daily-quote');
      const desk = document.querySelector('.studio-desk');
      const main = document.getElementById('main');
      const probe = document.createElement('div');
      probe.id = 'dq-probe';
      const cr = card.getBoundingClientRect();
      const mr = main.getBoundingClientRect();
      probe.style.cssText = 'position:absolute;width:80px;height:40px;background:#c0392b;z-index:9;pointer-events:none';
      probe.style.left = (cr.left - mr.left + 16) + 'px';
      probe.style.top = (cr.top - mr.top + 12) + 'px';
      desk.appendChild(probe);
      return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          resolve({
            collided: card.classList.contains('dq-collide'),
            display: getComputedStyle(card).display,
            parent: probe.parentElement && probe.parentElement.className,
          });
        }));
      });
    })()`);
    const cleared = await evalOn(page, `new Promise((resolve) => {
      document.getElementById('dq-probe').remove();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const card = document.getElementById('daily-quote');
        resolve({ collided: card.classList.contains('dq-collide'), display: getComputedStyle(card).display });
      }));
    })`);

    await evalOn(page, `(function () {
      const style = document.createElement('style');
      style.id = 'dq-sweep-force';
      style.textContent = '#daily-quote.dq-v2 { display: block !important; }';
      document.head.appendChild(style);
    })()`);
    const sweepRows = [];
    let firstOverlap = null;
    let lastClean = null;
    for (let width = 900; width >= 700; width -= 1) {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 800,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await evalOn(page, 'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      const row = await evalOn(page, SWEEP_JS);
      sweepRows.push(row);
      if (row.total > 0 && !firstOverlap) firstOverlap = row;
      if (!(row.total > 0) && !firstOverlap) lastClean = row;
    }
    await evalOn(page, `document.getElementById('dq-sweep-force') && document.getElementById('dq-sweep-force').remove()`);
    const cssHide = {};
    for (const width of [755, 754]) {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 800,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await evalOn(page, 'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      cssHide[width] = await evalOn(page, `(function () {
        const card = document.getElementById('daily-quote');
        if (card) card.classList.remove('dq-collide');
        const shown = card ? getComputedStyle(card).display : 'missing';
        return { width: window.innerWidth, display: shown };
      })()`);
    }
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const focusReady = await evalOn(page, `(async function () {
      await chrome.storage.local.set({
        dailyQuote: true,
        dailyQuoteDismissedOn: '',
        todos: [{ id: 't-focus', text: '把季度复盘的提纲写完', done: false }],
      });
      const deadline = Date.now() + 2500;
      while (Date.now() < deadline) {
        const title = document.getElementById('resume-title');
        const card = document.getElementById('daily-quote');
        if (title && title.textContent.indexOf('季度') !== -1 && card) break;
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      const card = document.getElementById('daily-quote');
      if (card) card.classList.remove('dq-collide');
      const btn = document.querySelector('.dq-x');
      if (btn) btn.focus();
      return {
        title: (document.getElementById('resume-title') || {}).textContent || '',
        has: (document.getElementById('resume') || {}).dataset.has || '',
        scrollBefore: window.scrollY,
        button: document.activeElement && document.activeElement.className,
      };
    })()`);
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r' });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await sleep(120);
    const focusWithTitle = await evalOn(page, `(async function () {
      const data = await chrome.storage.local.get(['dailyQuote', 'dailyQuoteDismissedOn']);
      return {
        card: !!document.getElementById('daily-quote'),
        focus: document.activeElement && document.activeElement.id,
        scrollY: window.scrollY,
        storage: data,
      };
    })()`);
    await evalOn(page, `chrome.storage.local.set({ dailyQuote: true, dailyQuoteDismissedOn: '' })`);
    await sleep(120);
    await evalOn(page, `(async function () {
      const deadline = Date.now() + 2500;
      while (Date.now() < deadline) {
        const title = document.getElementById('resume-title');
        const card = document.getElementById('daily-quote');
        if (title && title.textContent.indexOf('季度') !== -1 && getComputedStyle(title).display !== 'none' && card) break;
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      const button = document.querySelector('.dq-x');
      if (button) button.focus();
      return window.scrollY;
    })()`);
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
    await sleep(120);
    const focusWithTitleSpace = await evalOn(page, `(async function () {
      const data = await chrome.storage.local.get(['dailyQuote', 'dailyQuoteDismissedOn']);
      return {
        card: !!document.getElementById('daily-quote'),
        focus: document.activeElement && document.activeElement.id,
        scrollY: window.scrollY,
        tabindex: (document.getElementById('resume-title') || {}).tabIndex,
        storage: data,
      };
    })()`);

    const perf = await evalOn(page, `performance.getEntriesByType('resource').map((entry) => entry.name)`);
    page.close();
    return {
      natural,
      focusState,
      afterEnter,
      afterSpace,
      day800,
      night800,
      day720,
      night720,
      offLayout,
      probe,
      cleared,
      fonts,
      firstOverlap,
      lastClean,
      cssHide,
      emptyReady,
      focusReady,
      focusWithTitle,
      focusWithTitleSpace,
      sweepSample: sweepRows.filter((row) => row.width === 755 || row.width === 754 || row.width === 753),
      textBox,
      nightText,
      bareDay,
      noGlass,
      bareNight,
      noGlassNight,
      perf,
    };
  });

  const images = analyzeImages({
    contrast: [
      { name: 'dayText', png: behavior.bareDay, box: behavior.textBox.text.box, color: behavior.day800.quoteStyle.color },
      { name: 'daySrc', png: behavior.bareDay, box: behavior.textBox.src.box, color: behavior.day800.srcStyle.color },
      { name: 'nightText', png: behavior.bareNight, box: behavior.nightText.text, color: behavior.nightText.colors.text },
      { name: 'nightSrc', png: behavior.bareNight, box: behavior.nightText.src, color: behavior.nightText.colors.src },
    ],
    glass: [
      { name: 'day', with: behavior.bareDay, without: behavior.noGlass, box: behavior.textBox.card },
      { name: 'night', with: behavior.bareNight, without: behavior.noGlassNight, box: behavior.nightText.card },
    ],
    diff: [
      { name: 'offDayVsMain', a: offDay, b: mainDay },
      { name: 'offNightVsMain', a: offNight, b: mainNight },
    ],
  });

  function delta(onLayout, offLayout) {
    const out = {};
    let max = 0;
    for (const key of Object.keys(onLayout)) {
      const a = onLayout[key];
      const b = offLayout[key];
      if (!a || !b) {
        out[key] = null;
        continue;
      }
      const d = a.map((value, i) => value - b[i]);
      out[key] = d;
      d.forEach((value) => { max = Math.max(max, Math.abs(value)); });
    }
    return { max, delta: out };
  }

  const external = requests.feature.filter((url) => /^https?:/i.test(url));
  report.viewport1280x800 = {
    day: behavior.day800,
    night: behavior.night800,
    offDay: offDayResult.measure,
    onVsOff: delta(behavior.day800.layout, behavior.offLayout.layout),
  };
  report.viewport1280x720 = { day: behavior.day720, night: behavior.night720 };
  report.contrast = images;
  report.measuredQuote = { text: LONG, chars: [...LONG].length, source: LONG_SRC, sourceChars: [...LONG_SRC].length };
  report.keyboard = {
    emptyDesk: { ready: behavior.emptyReady, afterEnter: behavior.afterEnter, afterSpace: behavior.afterSpace },
    withTitle: { ready: behavior.focusReady, afterEnter: behavior.focusWithTitle, afterSpace: behavior.focusWithTitleSpace },
    focusState: behavior.focusState,
  };
  report.probe = { injected: behavior.probe, cleared: behavior.cleared };
  report.breakpoint = {
    firstOverlap: behavior.firstOverlap,
    lastClean: behavior.lastClean,
    sample: behavior.sweepSample,
    cssHide: behavior.cssHide,
  };
  report.fonts = behavior.fonts;
  report.naturalQuote = behavior.natural;
  report.network = {
    featureUrls: requests.feature,
    mainUrls: requests.main,
    httpCount: external.length,
    performance: behavior.perf,
  };
  report.clock = {
    off: offDayResult.measure.clock,
    main: mainDayResult.measure.clock,
    offNight: offNightResult.measure.clock,
    mainNight: mainNightResult.measure.clock,
  };
  fs.writeFileSync(path.join(OUT, 'measurements.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    contrast: images,
    keyboard: report.keyboard,
    probe: report.probe,
    breakpoint: report.breakpoint,
    fonts: behavior.fonts,
    card: behavior.day800.cardBox,
    lines: behavior.day800.lines,
    overlap: behavior.day800.overlapTotal,
    hits: behavior.day800.overlapHits,
    guard: behavior.day800.guardClass,
    scroll: [behavior.day800.scrollHeight, behavior.day720.scrollHeight],
    delta: report.viewport1280x800.onVsOff.max,
    http: external.length,
    clocks: report.clock,
    natural: behavior.natural,
    sky: [behavior.day800.sky, behavior.night800.sky],
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
