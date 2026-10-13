'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const daily = require(path.join(root, 'extension', 'daily-quote.js'));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'quotes.json'), 'utf8'));
const LONG = '天下皆知美之为美，斯恶已；皆知善之为善，斯不善已。故有无相生，难易相成。';

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createChromeStorage(initial) {
  const data = Object.assign({}, initial || {});
  const listeners = [];
  return {
    snapshot() {
      return Object.assign({}, data);
    },
    local: {
      get(defaults) {
        return Promise.resolve().then(() => {
          const out = {};
          const keys = defaults && typeof defaults === 'object' ? Object.keys(defaults) : [];
          for (const key of keys) {
            out[key] = Object.prototype.hasOwnProperty.call(data, key) ? data[key] : defaults[key];
          }
          return out;
        });
      },
      set(partial) {
        return Promise.resolve().then(() => {
          const changes = {};
          for (const key of Object.keys(partial)) {
            const prev = data[key];
            const next = partial[key];
            const known = Object.prototype.hasOwnProperty.call(data, key);
            if (known && Object.is(prev, next)) continue;
            changes[key] = { oldValue: prev, newValue: next };
            data[key] = next;
          }
          if (Object.keys(changes).length) listeners.forEach((fn) => fn(changes, 'local'));
        });
      },
    },
    onChanged: {
      addListener(fn) { listeners.push(fn); },
    },
  };
}

function createDoc() {
  const all = [];
  const doc = {
    hidden: false,
    lastFocus: null,
    activeElement: null,
    listeners: {},
    defaultView: undefined,
    addEventListener(type, fn) {
      (doc.listeners[type] || (doc.listeners[type] = [])).push(fn);
    },
    dispatch(type) {
      return Promise.all((doc.listeners[type] || []).map((fn) => fn()));
    },
    getElementById(id) {
      return all.find((node) => node.id === id && node.parentNode) || null;
    },
    querySelector(sel) {
      return all.find((node) => node.parentNode && match(node, sel)) || null;
    },
  };

  function classNames(node) {
    return String(node.className || '').split(/\s+/).filter(Boolean);
  }

  function match(node, sel) {
    if (sel.startsWith('#')) return node.id === sel.slice(1);
    if (sel.startsWith('.')) return classNames(node).includes(sel.slice(1));
    return node.tagName === sel.toUpperCase();
  }

  function make(tag) {
    const node = {
      tagName: tag.toUpperCase(),
      id: '',
      className: '',
      hidden: false,
      type: '',
      textContent: '',
      children: [],
      childNodes: [],
      parentNode: null,
      attributes: {},
      dataset: {},
      listeners: {},
      checked: false,
    };
    Object.defineProperty(node, 'childElementCount', {
      get() { return node.children.length; },
    });
    node.classList = {
      add(...names) {
        const set = new Set(classNames(node));
        names.forEach((name) => set.add(name));
        node.className = [...set].join(' ');
      },
      remove(...names) {
        const set = new Set(classNames(node));
        names.forEach((name) => set.delete(name));
        node.className = [...set].join(' ');
      },
      contains(name) { return classNames(node).includes(name); },
    };
    node.setAttribute = (key, value) => {
      node.attributes[key] = String(value);
      if (key === 'id') node.id = String(value);
    };
    node.getAttribute = (key) => (Object.prototype.hasOwnProperty.call(node.attributes, key) ? node.attributes[key] : null);
    node.hasAttribute = (key) => Object.prototype.hasOwnProperty.call(node.attributes, key);
    node.appendChild = (child) => {
      child.parentNode = node;
      node.children.push(child);
      node.childNodes.push(child);
      return child;
    };
    node.removeChild = (child) => {
      node.children = node.children.filter((item) => item !== child);
      node.childNodes = node.childNodes.filter((item) => item !== child);
      child.parentNode = null;
      return child;
    };
    node.addEventListener = (type, fn) => {
      (node.listeners[type] || (node.listeners[type] = [])).push(fn);
    };
    node.querySelector = (sel) => {
      const found = [];
      const walk = (current) => {
        for (const child of current.children) {
          if (match(child, sel)) found.push(child);
          walk(child);
        }
      };
      walk(node);
      return found[0] || null;
    };
    node.focus = (opts) => {
      doc.lastFocus = { id: node.id, preventScroll: !!(opts && opts.preventScroll) };
      doc.activeElement = node;
    };
    node.click = () => Promise.all((node.listeners.click || []).map((fn) => fn()));
    node.dispatch = (type) => Promise.all((node.listeners[type] || []).map((fn) => fn()));
    all.push(node);
    return node;
  }

  doc.createElement = make;
  doc.body = make('body');
  doc.body.parentNode = doc;
  const desk = make('section');
  desk.className = 'studio-desk';
  doc.body.appendChild(desk);
  const title = make('h1');
  title.id = 'resume-title';
  desk.appendChild(title);
  const toggle = make('input');
  toggle.id = 'daily-quote-toggle';
  toggle.type = 'checkbox';
  doc.body.appendChild(toggle);
  return doc;
}

function cardOf(doc) {
  return doc.getElementById('daily-quote');
}

function textOf(doc) {
  const card = cardOf(doc);
  return card ? card.querySelector('.dq-text').textContent : '';
}

async function runTz() {
  const instant = new Date('2026-10-13T16:30:00.000Z');
  assert.strictEqual(daily.localDateKey(instant), '2026-10-14');
  assert.strictEqual(instant.toISOString().slice(0, 10), '2026-10-13');
  const doc = createDoc();
  const storage = createChromeStorage({ dailyQuote: true });
  const quote = daily.createDailyQuote({
    document: doc,
    storage,
    catalog,
    now: () => instant,
    schedule() { return 1; },
    cancel() {},
  });
  await quote.start();
  const button = cardOf(doc).querySelector('button');
  await button.click();
  await flush();
  assert.strictEqual(storage.snapshot().dailyQuoteDismissedOn, '2026-10-14');
  assert.notStrictEqual(storage.snapshot().dailyQuoteDismissedOn, instant.toISOString().slice(0, 10));
  assert.strictEqual(storage.snapshot().dailyQuote, true);
}

async function main() {
  const dup = daily.validateQuotes([
    { id: 'a', text: '学而时习之。', author: '孔子', work: '论语' },
    { id: 'a', text: '温故而知新。', author: '孔子', work: '论语' },
  ]);
  assert.deepStrictEqual(dup, ['quote[1] duplicate id a']);

  const longErrors = daily.validateQuotes([
    { id: 'b', text: '学'.repeat(37), author: '孔子', work: '论语' },
  ]);
  assert.deepStrictEqual(longErrors, ['quote[0] text length 37']);

  const missing = daily.validateQuotes([
    { text: '学而时习之。', author: '孔子', work: '论语' },
  ]);
  assert.deepStrictEqual(missing, ['quote[0] missing id']);

  const missingAuthor = daily.validateQuotes([
    { id: 'c', text: '学而时习之。', work: '论语' },
  ]);
  assert.deepStrictEqual(missingAuthor, ['quote[0] missing author']);

  const missingWork = daily.validateQuotes([
    { id: 'd', text: '学而时习之。', author: '孔子' },
  ]);
  assert.deepStrictEqual(missingWork, ['quote[0] missing work']);

  assert.deepStrictEqual(daily.validateQuotes(catalog), []);
  assert.deepStrictEqual(daily.BUNDLED_QUOTES, catalog);
  assert.ok(catalog.length >= 366, 'catalog ' + catalog.length);

  const longQuote = catalog.find((quote) => quote.text === LONG);
  assert.ok(longQuote);
  assert.strictEqual(longQuote.author, '老子');
  assert.strictEqual(longQuote.work, '道德经');
  assert.strictEqual(longQuote.chapter, undefined);
  assert.strictEqual(daily.sourceLine(longQuote), '老子·《道德经》');
  assert.strictEqual(daily.bodyLength(LONG), 36);
  assert.strictEqual(
    daily.sourceLine({ author: '孔子', work: '论语', chapter: '学而' }),
    '孔子·《论语·学而》',
  );

  const day = new Date(2026, 9, 13, 9, 30, 0);
  const later = new Date(2026, 9, 13, 23, 59, 0);
  assert.strictEqual(daily.quoteForDate(catalog, day).id, daily.quoteForDate(catalog, later).id);
  assert.notStrictEqual(daily.quoteForDate(catalog, day).id, daily.quoteForDate(catalog, new Date(2026, 9, 14, 0, 0, 5)).id);
  assert.notDeepStrictEqual(
    daily.shuffleYear(catalog, 2026).map((quote) => quote.id),
    daily.shuffleYear(catalog, 2027).map((quote) => quote.id),
  );
  assert.deepStrictEqual(
    daily.shuffleYear(catalog, 2026).map((quote) => quote.id),
    daily.shuffleYear(catalog, 2026).map((quote) => quote.id),
  );

  assert.strictEqual(daily.dayOfYear(new Date(2024, 11, 31)), 366);
  assert.strictEqual(daily.dayOfYear(new Date(2025, 11, 31)), 365);
  assert.strictEqual(daily.dayOfYear(new Date(2024, 1, 29)), 60);
  assert.strictEqual(daily.dayOfYear(new Date(2026, 0, 1)), 1);
  assert.strictEqual(daily.msUntilNextLocalTick(new Date(2026, 9, 13, 23, 59, 50)), 11000);

  const leap = [];
  for (let doy = 1; doy <= 366; doy += 1) leap.push(daily.quoteForDate(catalog, new Date(2024, 0, doy)).id);
  assert.strictEqual(new Set(leap).size, 366);
  const plain = [];
  for (let doy = 1; doy <= 365; doy += 1) plain.push(daily.quoteForDate(catalog, new Date(2025, 0, doy)).id);
  assert.strictEqual(new Set(plain).size, 365);
  assert.strictEqual(daily.quoteForDate(catalog, new Date(2026, 0, 1)).id, daily.shuffleYear(catalog, 2026)[0].id);
  assert.strictEqual(daily.quoteForDate(catalog, new Date(2024, 11, 31)).id, daily.shuffleYear(catalog, 2024)[365].id);

  const tiny = [
    { id: 'a', text: '甲。', author: '孔子', work: '论语' },
    { id: 'b', text: '乙。', author: '孔子', work: '论语' },
    { id: 'c', text: '丙。', author: '孔子', work: '论语' },
  ];
  const tinyOrder = daily.shuffleYear(tiny, 2024);
  for (let doy = 1; doy <= 366; doy += 1) {
    assert.strictEqual(
      daily.quoteForDate(tiny, new Date(2024, 0, doy)).id,
      tinyOrder[(doy - 1) % 3].id,
    );
  }

  assert.deepStrictEqual(daily.readPrefs({}), { enabled: false, dismissedOn: '' });
  assert.deepStrictEqual(daily.readPrefs({ dailyQuote: 'true', dailyQuoteDismissedOn: '2026-10-13T16:30:00.000Z' }), {
    enabled: false,
    dismissedOn: '',
  });
  assert.strictEqual(daily.decidePhase({ enabled: false, dismissedOn: '' }, '2026-10-13'), 'off');
  assert.strictEqual(daily.decidePhase({ enabled: true, dismissedOn: '2026-10-13' }, '2026-10-13'), 'dismissed');
  assert.strictEqual(daily.decidePhase({ enabled: true, dismissedOn: '2026-10-12' }, '2026-10-13'), 'shown');
  assert.strictEqual(daily.intersectionArea(
    { left: 0, right: 10, top: 0, bottom: 10 },
    { left: 8, right: 12, top: 8, bottom: 14 },
  ), 4);
  assert.strictEqual(daily.intersectionArea(
    { left: 0, right: 10, top: 0, bottom: 10 },
    { left: 10, right: 20, top: 0, bottom: 10 },
  ), 0);

  let clock = new Date(2026, 9, 13, 9, 30, 0);
  const storage = createChromeStorage();
  const pageA = createDoc();
  const pageB = createDoc();
  const shared = {
    storage,
    catalog,
    now: () => clock,
    schedule(fn, ms) { return { fn, ms }; },
    cancel() {},
  };
  const quoteA = daily.createDailyQuote(Object.assign({ document: pageA }, shared));
  const quoteB = daily.createDailyQuote(Object.assign({ document: pageB }, shared));
  await quoteA.start();
  await quoteB.start();
  assert.strictEqual(cardOf(pageA), null);
  assert.strictEqual(cardOf(pageB), null);
  assert.strictEqual(pageA.body.classList.contains('dq-on'), false);
  assert.strictEqual(pageA.getElementById('daily-quote-toggle').checked, false);
  assert.deepStrictEqual(storage.snapshot(), {});

  await storage.local.set({ dailyQuote: true });
  await flush();
  const shown = textOf(pageA);
  assert.strictEqual(shown, daily.quoteForDate(catalog, clock).text);
  assert.strictEqual(textOf(pageB), shown);
  assert.strictEqual(pageA.body.classList.contains('dq-on'), true);
  assert.strictEqual(pageB.getElementById('daily-quote-toggle').checked, true);
  const button = cardOf(pageA).querySelector('button');
  assert.strictEqual(button.tagName, 'BUTTON');
  assert.strictEqual(button.type, 'button');
  assert.strictEqual(button.getAttribute('aria-label'), '今天不再显示');
  assert.strictEqual(cardOf(pageA).getAttribute('aria-label'), '每日一句');
  assert.strictEqual(cardOf(pageA).querySelector('.dq-src').textContent.includes('·《'), true);

  await button.click();
  await flush();
  assert.strictEqual(cardOf(pageA), null);
  assert.strictEqual(cardOf(pageB), null);
  assert.deepStrictEqual(storage.snapshot(), {
    dailyQuote: true,
    dailyQuoteDismissedOn: '2026-10-13',
  });
  assert.deepStrictEqual(pageA.lastFocus, { id: 'resume-title', preventScroll: true });
  assert.strictEqual(pageA.getElementById('resume-title').getAttribute('tabindex'), '-1');
  assert.strictEqual(pageB.lastFocus, null);

  clock = new Date(2026, 9, 14, 0, 30, 0);
  await pageA.dispatch('visibilitychange');
  await pageB.dispatch('visibilitychange');
  const nextText = textOf(pageA);
  assert.notStrictEqual(nextText, shown);
  assert.strictEqual(textOf(pageB), nextText);
  assert.strictEqual(nextText, daily.quoteForDate(catalog, clock).text);
  assert.strictEqual(storage.snapshot().dailyQuote, true);

  pageA.getElementById('daily-quote-toggle').checked = false;
  await pageA.getElementById('daily-quote-toggle').dispatch('change');
  await flush();
  assert.strictEqual(cardOf(pageA), null);
  assert.strictEqual(cardOf(pageB), null);
  assert.strictEqual(storage.snapshot().dailyQuote, false);
  assert.strictEqual(storage.snapshot().dailyQuoteDismissedOn, '2026-10-13');

  clock = new Date(2026, 9, 13, 12, 0, 0);
  pageA.getElementById('daily-quote-toggle').checked = true;
  await pageA.getElementById('daily-quote-toggle').dispatch('change');
  await flush();
  assert.strictEqual(cardOf(pageA), null);
  assert.strictEqual(storage.snapshot().dailyQuote, true);

  clock = new Date(2026, 9, 15, 8, 0, 0);
  await pageA.dispatch('visibilitychange');
  await pageB.dispatch('visibilitychange');
  assert.strictEqual(textOf(pageA), daily.quoteForDate(catalog, clock).text);
  assert.strictEqual(textOf(pageB), textOf(pageA));

  let armed = null;
  clock = new Date(2026, 9, 16, 23, 59, 50);
  const pageC = createDoc();
  const storageC = createChromeStorage({ dailyQuote: true });
  const quoteC = daily.createDailyQuote({
    document: pageC,
    storage: storageC,
    catalog,
    now: () => clock,
    schedule(fn, ms) {
      armed = { fn, ms };
      return 7;
    },
    cancel() { armed = null; },
  });
  await quoteC.start();
  const beforeMidnight = textOf(pageC);
  assert.strictEqual(armed.ms, 11000);
  clock = new Date(2026, 9, 17, 0, 0, 5);
  armed.fn();
  assert.notStrictEqual(textOf(pageC), beforeMidnight);
  assert.strictEqual(textOf(pageC), daily.quoteForDate(catalog, clock).text);

  const html = fs.readFileSync(path.join(root, 'extension', 'newtab.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'extension', 'newtab.css'), 'utf8');
  const src = fs.readFileSync(path.join(root, 'extension', 'daily-quote.js'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'manifest.json'), 'utf8'));
  assert.ok(html.includes('在首页显示每日一句'));
  assert.ok(html.includes('id="dq-row"'));
  assert.ok(html.includes('src="daily-quote.js"'));
  assert.ok(!html.includes('class="dq dq-v2"'));
  assert.ok(css.includes('body.dq-on.studio-home .main { position: relative; }'));
  assert.ok(css.includes('top: 10px; right: 32px;'));
  assert.ok(css.includes('width: 400px;'));
  assert.ok(css.includes('font-size: 15px; line-height: 1.6;'));
  assert.ok(css.includes('@media (max-width: 754px) { .dq-v2 { display: none !important; } }'));
  assert.ok(!/fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|new\s+Image|getContext\s*\(\s*['"]webgl/i.test(src));
  assert.ok(!/storage\.sync/.test(src));
  assert.deepStrictEqual(manifest.permissions, ['storage', 'tabs']);

  const child = spawnSync(process.execPath, [__filename], {
    env: Object.assign({}, process.env, { TZ: 'Asia/Taipei', SOPIFY_QUOTE_TZ: '1' }),
    encoding: 'utf8',
  });
  if (child.status !== 0) {
    console.error(child.stdout);
    console.error(child.stderr);
  }
  assert.strictEqual(child.status, 0);
  console.log('daily quote ok ' + catalog.length);
}

if (process.env.SOPIFY_QUOTE_TZ === '1') {
  runTz().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
