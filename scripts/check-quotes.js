'use strict';

const path = require('path');

const quotes = require(path.join(__dirname, '..', 'extension', 'quotes.js'));
const BOOKS = new Set(['论语', '孟子', '道德经', '中庸', '大学']);
const SPEAKERS = new Set(['孔子', '老子', '孟子', '子夏', '曾子', '有子', '子张', '告子']);
const UNSIGNED = ['dq-7cac66ea', 'dq-8dd45666', 'dq-41fca28d', 'dq-e1a2473a'];
const errors = [];

function fail(msg) {
  errors.push(msg);
}

function invisible(text) {
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) {
    const cu = s.charCodeAt(i);
    if (cu >= 0xD800 && cu <= 0xDBFF) {
      const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (next >= 0xDC00 && next <= 0xDFFF) {
        i += 1;
        continue;
      }
      return true;
    }
    if (cu >= 0xDC00 && cu <= 0xDFFF) return true;
    if (cu === 0x09 || cu === 0x0A) continue;
    if (cu <= 0x1F || cu === 0x7F) return true;
    if (cu >= 0x80 && cu <= 0x9F) return true;
    if ((cu >= 0x200B && cu <= 0x200F) || cu === 0x2060 || cu === 0xFEFF || cu === 0xFFFD) return true;
    if (cu >= 0xE000 && cu <= 0xF8FF) return true;
  }
  return false;
}

if (!Array.isArray(quotes) || quotes.length !== 377) fail('count ' + (quotes && quotes.length));

const ids = new Set();
const texts = new Set();
for (let i = 0; i < (quotes || []).length; i += 1) {
  const quote = quotes[i] || {};
  const where = 'quote[' + i + ']';
  if (typeof quote.id !== 'string' || !quote.id || ids.has(quote.id)) fail(where + ' id');
  else ids.add(quote.id);
  if (typeof quote.text !== 'string' || !quote.text || texts.has(quote.text)) fail(where + ' text');
  else texts.add(quote.text);
  if (Array.from(quote.text || '').length > 36) fail(where + ' length');
  if (invisible(quote.text || '')) fail(where + ' invisible');
  if (!BOOKS.has(quote.book)) fail(where + ' book ' + quote.book);
  if ((quote.book === '中庸' || quote.book === '大学') && quote.chapter) fail(where + ' chapter');
  const speaker = quote.speaker || '';
  if (speaker && !SPEAKERS.has(speaker)) fail(where + ' speaker ' + speaker);
}

for (const id of UNSIGNED) {
  const quote = (quotes || []).find((item) => item && item.id === id);
  if (!quote) fail('missing ' + id);
  else if (quote.speaker) fail(id + ' must be unsigned');
}

if (errors.length) {
  errors.forEach((line) => console.error(line));
  process.exit(1);
}

console.log('quotes ok ' + quotes.length);
