(() => {
  'use strict';

  const ENABLED_KEY = 'dailyQuote';
  const MAX_BODY = 36;
  const BOOKS = ['论语', '孟子', '道德经', '中庸', '大学'];
  const CLASSICS = ['中庸', '大学'];
  const SPEAKERS = ['孔子', '老子', '孟子', '子夏', '曾子', '有子', '子张', '告子'];

  function loadCatalog() {
    if (typeof window !== 'undefined' && Array.isArray(window.SopifyQuotes)) return window.SopifyQuotes;
    if (typeof require === 'function') return require('./quotes.js');
    return [];
  }

  function localDateKey(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function dayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 1);
    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((current.getTime() - start.getTime()) / 86400000) + 1;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleYear(quotes, year) {
    const list = quotes.slice();
    const rand = mulberry32(year);
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
    return list;
  }

  function quoteForDate(quotes, date) {
    if (!quotes || !quotes.length) return null;
    const order = shuffleYear(quotes, date.getFullYear());
    return order[(dayOfYear(date) - 1) % order.length];
  }

  function sourceLine(quote) {
    const book = quote && quote.book ? quote.book : '';
    const chapter = quote && quote.chapter ? quote.chapter : '';
    const speaker = quote && quote.speaker ? quote.speaker : '';
    const work = chapter ? '《' + book + '·' + chapter + '》' : '《' + book + '》';
    const name = String(speaker).trim() === String(book).trim() ? '' : speaker;
    return '——' + name + work;
  }

  function validateQuotes(quotes) {
    const errors = [];
    if (!Array.isArray(quotes)) {
      errors.push('catalog must be an array');
      return errors;
    }
    const ids = new Set();
    const texts = new Set();
    for (let i = 0; i < quotes.length; i += 1) {
      const quote = quotes[i];
      const where = 'quote[' + i + ']';
      if (!quote || typeof quote !== 'object') {
        errors.push(where + ' must be an object');
        continue;
      }
      if (typeof quote.id !== 'string' || !quote.id.trim()) errors.push(where + ' missing id');
      else if (ids.has(quote.id)) errors.push(where + ' duplicate id ' + quote.id);
      else ids.add(quote.id);
      if (typeof quote.text !== 'string' || !quote.text) errors.push(where + ' missing text');
      else {
        const n = Array.from(quote.text).length;
        if (n > MAX_BODY) errors.push(where + ' text length ' + n);
        if (texts.has(quote.text)) errors.push(where + ' duplicate text');
        else texts.add(quote.text);
      }
      if (!BOOKS.includes(quote.book)) errors.push(where + ' bad book');
      const chapter = typeof quote.chapter === 'string' ? quote.chapter : '';
      if (CLASSICS.includes(quote.book)) {
        if (chapter) errors.push(where + ' chapter must be empty');
      } else if (!chapter.trim()) errors.push(where + ' missing chapter');
      const speaker = quote.speaker == null ? '' : quote.speaker;
      if (speaker !== '' && !SPEAKERS.includes(speaker)) errors.push(where + ' bad speaker');
      const line = sourceLine({ book: quote.book || '', chapter, speaker: typeof speaker === 'string' ? speaker : '' });
      if (!/^——(?:[\u4e00-\u9fff]{1,4})?《[\u4e00-\u9fff]{1,4}(?:·[\u4e00-\u9fff]{1,12})?》$/.test(line)) {
        errors.push(where + ' bad source format');
      }
    }
    return errors;
  }

  function msUntilNextLocalTick(now) {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
    return Math.max(next.getTime() - now.getTime(), 1000);
  }

  function createDailyQuote(options) {
    const doc = options.document;
    const storage = options.storage;
    const catalog = options.catalog;
    const now = options.now || (() => new Date());
    const schedule = options.schedule || ((fn, ms) => setTimeout(fn, ms));
    const cancel = options.cancel || ((id) => clearTimeout(id));
    let enabled = false;
    let timer = null;
    let listening = false;
    let started = false;

    function paint() {
      const quote = quoteForDate(catalog, now());
      const text = quote ? quote.text : '';
      const src = quote ? sourceLine(quote) : '';
      const block = doc.getElementById('daily-quote');
      if (block) {
        block.hidden = enabled !== true;
        const textNode = block.querySelector('.dq-text');
        const srcNode = block.querySelector('.dq-src');
        if (textNode) textNode.textContent = text;
        if (srcNode) srcNode.textContent = src;
      }
      const previewText = doc.getElementById('dq-settings-text');
      const previewSrc = doc.getElementById('dq-settings-src');
      if (previewText) previewText.textContent = text;
      if (previewSrc) previewSrc.textContent = src;
      const box = doc.getElementById('daily-quote-toggle');
      if (box && box.checked !== (enabled === true)) box.checked = enabled === true;
    }

    function arm() {
      if (timer != null) cancel(timer);
      timer = schedule(() => {
        timer = null;
        paint();
        arm();
      }, msUntilNextLocalTick(now()));
    }

    function apply() {
      paint();
      arm();
    }

    function onStorage(changes, area) {
      if (area !== 'local' || !changes || !(ENABLED_KEY in changes)) return;
      enabled = changes[ENABLED_KEY].newValue === true;
      apply();
    }

    async function start() {
      if (started) {
        apply();
        return;
      }
      started = true;
      const box = doc.getElementById('daily-quote-toggle');
      if (box && !box.dataset.dqBound) {
        box.dataset.dqBound = '1';
        box.addEventListener('change', () => {
          enabled = box.checked === true;
          if (storage && storage.local) storage.local.set({ [ENABLED_KEY]: enabled });
          apply();
        });
      }
      if (storage && storage.onChanged && !listening) {
        storage.onChanged.addListener(onStorage);
        listening = true;
      }
      doc.addEventListener('visibilitychange', () => apply());
      if (storage && storage.local) {
        try {
          const data = await storage.local.get({ [ENABLED_KEY]: false });
          enabled = data[ENABLED_KEY] === true;
        } catch {
          enabled = false;
        }
      }
      apply();
    }

    return { start, apply };
  }

  function boot() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const catalog = loadCatalog();
    if (validateQuotes(catalog).length) return;
    const storage = typeof chrome !== 'undefined' && chrome.storage ? chrome.storage : null;
    createDailyQuote({ document, storage, catalog }).start();
  }

  const api = {
    ENABLED_KEY,
    localDateKey,
    dayOfYear,
    shuffleYear,
    quoteForDate,
    sourceLine,
    validateQuotes,
    createDailyQuote,
  };

  if (typeof window !== 'undefined') window.SopifyDailyQuote = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document !== 'undefined' && document.documentElement) boot();
})();
