'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const daily = require(path.join(root, 'extension', 'daily-quote.js'));
const catalog = require(path.join(root, 'extension', 'quotes.js'));

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createChromeStorage(initial) {
  const data = Object.assign({}, initial || {});
  const listeners = [];
  return {
    snapshot() { return Object.assign({}, data); },
    local: {
      get(defaults) {
        return Promise.resolve().then(() => {
          const out = {};
          Object.keys(defaults || {}).forEach((key) => {
            out[key] = Object.prototype.hasOwnProperty.call(data, key) ? data[key] : defaults[key];
          });
          return out;
        });
      },
      set(partial) {
        return Promise.resolve().then(() => {
          const changes = {};
          Object.keys(partial).forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(data, key) && Object.is(data[key], partial[key])) return;
            changes[key] = { oldValue: data[key], newValue: partial[key] };
            data[key] = partial[key];
          });
          if (Object.keys(changes).length) listeners.forEach((fn) => fn(changes, 'local'));
        });
      },
    },
    onChanged: { addListener(fn) { listeners.push(fn); } },
  };
}

function createDoc() {
  const all = [];
  const doc = {
    nodeType: 9,
    hidden: false,
    listeners: {},
    addEventListener(type, fn) { (doc.listeners[type] || (doc.listeners[type] = [])).push(fn); },
    dispatch(type) { return Promise.all((doc.listeners[type] || []).map((fn) => fn())); },
    getElementById(id) { return all.find((node) => node.id === id && node.parentNode) || null; },
  };
  function make(tag) {
    const node = {
      tagName: tag.toUpperCase(), id: '', className: '', nodeType: 1, hidden: false,
      textContent: '', parentNode: null, children: [], dataset: {}, listeners: {},
    };
    node.classList = {
      add() {},
      remove() {},
      contains() { return false; },
    };
    node.setAttribute = (key, value) => { if (key === 'id') node.id = String(value); };
    node.appendChild = (child) => { child.parentNode = node; node.children.push(child); return child; };
    node.addEventListener = (type, fn) => { (node.listeners[type] || (node.listeners[type] = [])).push(fn); };
    node.dispatch = (type) => Promise.all((node.listeners[type] || []).map((fn) => fn()));
    node.querySelector = (sel) => {
      const name = sel.slice(1);
      const walk = (current) => {
        for (const child of current.children) {
          if (String(child.className).split(/\s+/).includes(name)) return child;
          const found = walk(child);
          if (found) return found;
        }
        return null;
      };
      return walk(node);
    };
    all.push(node);
    return node;
  }
  doc.createElement = make;
  doc.body = make('body');
  doc.body.parentNode = doc;
  const desk = make('section');
  const sites = make('section');
  const sitesH = make('h2');
  sitesH.id = 'h-sites';
  sitesH.textContent = '常用站';
  sites.appendChild(sitesH);
  const block = make('section');
  block.id = 'daily-quote';
  block.className = 'desk-quote';
  block.hidden = true;
  const heading = make('h2');
  heading.id = 'h-quote';
  heading.textContent = '每日一句';
  const text = make('blockquote');
  text.className = 'dq-text';
  const src = make('p');
  src.className = 'dq-src';
  block.appendChild(heading);
  block.appendChild(text);
  block.appendChild(src);
  desk.appendChild(sites);
  desk.appendChild(block);
  doc.body.appendChild(desk);
  const toggle = make('input');
  toggle.id = 'daily-quote-toggle';
  toggle.checked = false;
  const previewText = make('blockquote');
  previewText.id = 'dq-settings-text';
  const previewSrc = make('p');
  previewSrc.id = 'dq-settings-src';
  doc.body.appendChild(toggle);
  doc.body.appendChild(previewText);
  doc.body.appendChild(previewSrc);
  return doc;
}

function blockOf(doc) {
  return doc.getElementById('daily-quote');
}

async function main() {
  assert.deepStrictEqual(daily.validateQuotes(catalog), []);
  assert.strictEqual(catalog.length, 377);
  const signed = catalog.find((quote) => quote.speaker === '子夏' && quote.book === '论语' && quote.chapter === '颜渊');
  const unsigned = catalog.find((quote) => !quote.speaker && quote.book === '论语' && quote.chapter);
  const classic = catalog.find((quote) => quote.id === 'dq-41fca28d');
  assert.strictEqual(daily.sourceLine(signed), '——子夏《论语·颜渊》');
  assert.strictEqual(daily.sourceLine(unsigned), '——《论语·' + unsigned.chapter + '》');
  assert.strictEqual(daily.sourceLine({ book: '道德经', chapter: '第八章' }), '——《道德经·第八章》');
  assert.strictEqual(classic.book, '中庸');
  assert.strictEqual(classic.chapter, '');
  assert.strictEqual(classic.speaker, undefined);
  assert.strictEqual(daily.sourceLine(classic), '——《中庸》');
  const signedClassic = catalog.find((quote) => quote.book === '中庸' && quote.speaker);
  assert.ok(signedClassic);
  assert.strictEqual(daily.sourceLine(signedClassic), '——' + signedClassic.speaker + '《中庸》');
  assert.ok(daily.validateQuotes([{ id: 'e', text: '学而时习之。', book: '论语', chapter: '学而', speaker: '—孔子' }]).some((line) => line.includes('bad source format')));

  const morning = new Date(2026, 9, 13, 9, 30, 0);
  const evening = new Date(2026, 9, 13, 23, 59, 0);
  assert.strictEqual(daily.quoteForDate(catalog, morning).id, daily.quoteForDate(catalog, evening).id);
  assert.notDeepStrictEqual(
    daily.shuffleYear(catalog, 2026).map((quote) => quote.id),
    daily.shuffleYear(catalog, 2027).map((quote) => quote.id),
  );

  let clock = new Date(2026, 9, 13, 9, 30, 0);
  const storage = createChromeStorage();
  const doc = createDoc();
  let armed = null;
  const widget = daily.createDailyQuote({
    document: doc,
    storage,
    catalog,
    now: () => clock,
    schedule(fn, ms) { armed = { fn, ms }; return 7; },
    cancel() { armed = null; },
  });
  await widget.start();
  assert.strictEqual(blockOf(doc).hidden, true);
  assert.strictEqual(doc.getElementById('dq-settings-text').textContent, daily.quoteForDate(catalog, clock).text);
  assert.strictEqual(doc.getElementById('dq-settings-src').textContent, daily.sourceLine(daily.quoteForDate(catalog, clock)));

  doc.getElementById('daily-quote-toggle').checked = true;
  await doc.getElementById('daily-quote-toggle').dispatch('change');
  await flush();
  const shown = daily.quoteForDate(catalog, clock);
  assert.strictEqual(blockOf(doc).hidden, false);
  assert.strictEqual(blockOf(doc).querySelector('.dq-text').textContent, shown.text);
  assert.strictEqual(blockOf(doc).querySelector('.dq-src').textContent, daily.sourceLine(shown));
  assert.ok(deskOrder(doc));
  const shownText = blockText(blockOf(doc));
  assert.ok(!shownText.includes('今天'));
  assert.ok(!/\d/.test(shownText));
  assert.strictEqual(storage.snapshot().dailyQuote, true);
  assert.ok(!Object.prototype.hasOwnProperty.call(storage.snapshot(), 'dailyQuoteDismissedOn'));

  clock = new Date(2026, 9, 14, 0, 30, 0);
  await doc.dispatch('visibilitychange');
  const next = daily.quoteForDate(catalog, clock);
  assert.notStrictEqual(next.id, shown.id);
  assert.strictEqual(blockOf(doc).querySelector('.dq-text').textContent, next.text);
  assert.strictEqual(doc.getElementById('dq-settings-text').textContent, next.text);

  doc.getElementById('daily-quote-toggle').checked = false;
  await doc.getElementById('daily-quote-toggle').dispatch('change');
  await flush();
  assert.strictEqual(blockOf(doc).hidden, true);
  assert.strictEqual(doc.getElementById('dq-settings-text').textContent, next.text);

  clock = new Date(2026, 9, 16, 23, 59, 50);
  await doc.dispatch('visibilitychange');
  const before = doc.getElementById('dq-settings-text').textContent;
  assert.strictEqual(armed.ms, 11000);
  clock = new Date(2026, 9, 17, 0, 0, 5);
  armed.fn();
  assert.notStrictEqual(doc.getElementById('dq-settings-text').textContent, before);
  assert.strictEqual(doc.getElementById('dq-settings-text').textContent, daily.quoteForDate(catalog, clock).text);

  const html = fs.readFileSync(path.join(root, 'extension', 'newtab.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'extension', 'newtab.css'), 'utf8');
  const src = fs.readFileSync(path.join(root, 'extension', 'daily-quote.js'), 'utf8');
  const quotesSrc = fs.readFileSync(path.join(root, 'extension', 'quotes.js'), 'utf8');
  assert.ok(html.indexOf('id="h-sites"') < html.indexOf('id="daily-quote"'));
  assert.ok(html.includes('<section class="desk-quote" id="daily-quote" hidden aria-labelledby="h-quote">'));
  assert.ok(html.includes('<h2 class="col-h" id="h-quote">每日一句</h2>'));
  assert.ok(html.includes('每天一句，出自《论语》《孟子》《道德经》等，离线可用。'));
  assert.ok(html.indexOf('src="quotes.js"') < html.indexOf('src="daily-quote.js"'));
  assert.ok(!html.includes('今天不再显示'));
  assert.ok(!src.includes('MutationObserver'));
  assert.ok(!src.includes('ResizeObserver'));
  assert.ok(!src.includes('requestAnimationFrame'));
  assert.ok(!src.includes('dailyQuoteDismissedOn'));
  assert.ok(!css.includes('.dq-v2'));
  assert.ok(!css.includes('dq-collide'));
  assert.ok(!/@media\s*\(\s*max-width:\s*754px\s*\)/.test(css));
  assert.strictEqual(quotesSrc.split('\n').filter((line) => line.startsWith('{')).length, 377);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'manifest.json'), 'utf8'));
  assert.deepStrictEqual(manifest.permissions, ['storage', 'tabs']);

  const child = spawnSync(process.execPath, ['-e', `
    const daily = require(${JSON.stringify(path.join(root, 'extension', 'daily-quote.js'))});
    const instant = new Date('2026-10-13T16:30:00.000Z');
    if (daily.localDateKey(instant) !== '2026-10-14') process.exit(1);
  `], { env: Object.assign({}, process.env, { TZ: 'Asia/Taipei' }) });
  assert.strictEqual(child.status, 0);
  console.log('daily quote ok ' + catalog.length);
}

function blockText(node) {
  let out = node.textContent || '';
  for (const child of node.children || []) out += blockText(child);
  return out;
}

function deskOrder(doc) {
  const block = blockOf(doc);
  const sites = doc.getElementById('h-sites').parentNode;
  const kids = sites.parentNode.children;
  return kids.indexOf(sites) >= 0 && kids.indexOf(sites) < kids.indexOf(block);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
