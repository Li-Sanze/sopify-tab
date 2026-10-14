'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const guard = require('./quote-guard');
const { validateQuotes, BUNDLED_QUOTES } = require('../extension/daily-quote');

const root = path.join(__dirname, '..');
const quotes = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'quotes.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(guard.FIXTURES, 'manifest.json'), 'utf8'));
const allowlist = JSON.parse(fs.readFileSync(path.join(guard.FIXTURES, 'quote-blocklist-allow.json'), 'utf8'));
const forced = JSON.parse(fs.readFileSync(path.join(guard.FIXTURES, 'forced-no-speaker.json'), 'utf8'));
const comparison = JSON.parse(fs.readFileSync(path.join(guard.FIXTURES, 'quote-comparison.json'), 'utf8'));
const errors = [];

function fail(message) {
  errors.push(message);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

validateQuotes(quotes).forEach(fail);
if (JSON.stringify(BUNDLED_QUOTES) !== JSON.stringify(quotes)) {
  fail('daily-quote.js catalog does not match quotes.json');
}

if (!manifest.conversion || !Array.isArray(manifest.conversion.files)) {
  fail('manifest missing conversion provenance');
}
for (const row of manifest.conversion.files || []) {
  const file = path.join(root, row.file);
  if (!row.url || !row.fetched || !row.sha256) fail('conversion row missing provenance ' + row.file);
  else if (!fs.existsSync(file)) fail('missing conversion file ' + row.file);
  else if (sha256(file) !== row.sha256) fail('conversion sha256 mismatch ' + row.file);
}

const classics = path.join(guard.FIXTURES, 'classics');
const listed = new Set();
for (const snap of manifest.snapshots || []) {
  if (!snap.file || !snap.sourceUrl || !snap.fetched || !snap.sha256 || !snap.book) {
    fail('snapshot missing provenance ' + (snap && snap.file));
    continue;
  }
  listed.add(snap.file);
  const file = path.join(classics, snap.file);
  if (!fs.existsSync(file)) {
    fail('missing snapshot ' + snap.file);
    continue;
  }
  const bytes = fs.readFileSync(file);
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== snap.sha256) {
    fail('snapshot sha256 mismatch ' + snap.file);
  }
  if (snap.parent) {
    const parent = path.join(classics, snap.parent);
    if (!fs.existsSync(parent) || !fs.readFileSync(parent, 'utf8').includes(bytes.toString('utf8'))) {
      fail('chapter slice is not inside its parent ' + snap.file);
    }
  }
}
for (const name of fs.existsSync(classics) ? fs.readdirSync(classics) : []) {
  if (!listed.has(name)) fail('snapshot file is not in the manifest ' + name);
}

const byKey = new Map();
for (const snap of manifest.snapshots || []) {
  if (snap.whole) continue;
  byKey.set(snap.book + '\0' + snap.chapter, snap);
}

const cache = new Map();
function loaded(snap) {
  if (cache.has(snap.file)) return cache.get(snap.file);
  const wikitext = fs.readFileSync(path.join(classics, snap.file), 'utf8');
  const row = {
    wikitext,
    plain: guard.plainForMatch(wikitext),
  };
  cache.set(snap.file, row);
  return row;
}

quotes.forEach((quote, index) => {
  const where = 'quote[' + index + ']';
  const line = guard.sourceLine(quote);
  if (!guard.sourceFormatOk(line)) fail(where + ' bad source format ' + line);
  if (guard.bodyLength(quote.text) > 36) fail(where + ' text length ' + guard.bodyLength(quote.text));
  const snap = byKey.get((quote.book || '') + '\0' + (quote.chapter || ''));
  if (!snap) {
    fail(where + ' no snapshot for ' + quote.book + ' ' + quote.chapter);
    return;
  }
  const row = loaded(snap);
  if (!row.plain.includes(guard.normalizeMatch(quote.text))) {
    fail(where + ' not contiguous in ' + snap.file + ' ' + quote.text);
  }
  const residue = guard.residueChars(quote.text + line);
  if (residue.length) fail(where + ' traditional residue ' + residue.join(''));
  if (!guard.attributionOk(row.wikitext, quote)) {
    fail(where + ' attribution ' + line + ' ' + quote.text);
  }
  const edge = guard.edgePunctuation(quote.text);
  if (edge) fail(where + ' edge punctuation ' + edge + ' ' + quote.text);
  const knownHit = guard.knownSnapshotError(quote.text);
  if (knownHit) fail(where + ' known snapshot error ' + knownHit.pattern + ' ' + quote.text);
  if (guard.shiShuCitation(row.wikitext, quote)) {
    fail(where + ' shi shu citation ' + line + ' ' + quote.text);
  }
});

for (const row of forced) {
  const quote = quotes.find((item) => item.id === row.id);
  if (!quote) fail('forced no-speaker id missing ' + row.id);
  else if (quote.speaker) fail('forced no-speaker id has a speaker ' + row.id);
  else if (quote.text !== row.text) fail('forced no-speaker text changed ' + row.id);
}

if (comparison.normalization !== guard.NORMALIZATION) fail('comparison normalization name');
if (!String(comparison.normalizationNote || '').includes('variant-map.json')) fail('comparison note omits the variant map');
for (const row of comparison.rows || []) {
  const where = 'comparison ' + (row.originalId || row.id || '?');
  if (row.action === '删除') {
    if (row.newText || row.start != null || row.end != null) fail(where + ' delete row should have empty text and null offsets');
    continue;
  }
  if (!row.snapshotFile || typeof row.start !== 'number' || typeof row.end !== 'number') {
    fail(where + ' missing slice');
    continue;
  }
  const snap = (manifest.snapshots || []).find((item) => item.file === row.snapshotFile);
  if (!snap) {
    fail(where + ' unknown snapshot ' + row.snapshotFile);
    continue;
  }
  const plain = loaded(snap).plain;
  if (plain.slice(row.start, row.end) !== row.newText) fail(where + ' offset slice mismatch');
  const quote = quotes.find((item) => item.id === (row.id || row.originalId));
  if (!quote || quote.text !== row.newText) fail(where + ' catalog text mismatch');
  if (guard.sourceLine(quote) !== row.source) fail(where + ' source mismatch');
}

let nearCount = 0;
for (let i = 0; i < quotes.length; i += 1) {
  for (let j = i + 1; j < quotes.length; j += 1) {
    if (!guard.nearDuplicate(quotes[i].text, quotes[j].text)) continue;
    nearCount += 1;
    if (nearCount <= 12) {
      fail('near-duplicate ' + quotes[i].text + ' || ' + quotes[j].text);
    }
  }
}
if (nearCount > 12) fail('near-duplicate pairs ' + nearCount);

const shortAllow = JSON.parse(fs.readFileSync(path.join(guard.FIXTURES, 'short-allowlist.json'), 'utf8'));
const reviewed = new Map((Array.isArray(allowlist) ? allowlist : []).map((row) => [row.text, row.reason || '']));
let warnings = 0;
quotes.forEach((quote) => {
  const hits = guard.blocklistHits(quote.text);
  if (!hits.length) return;
  warnings += 1;
  const reason = reviewed.get(quote.text);
  const note = reason ? 'allow: ' + reason : 'UNREVIEWED';
  console.log('blocklist WARN ' + hits.join('') + ' ' + note + ' ' + quote.text);
});
console.log('blocklist WARN count ' + warnings);

let shortWarnings = 0;
quotes.forEach((quote) => {
  const note = guard.shortBodyWarning(quote, shortAllow);
  if (!note) return;
  shortWarnings += 1;
  console.log('short WARN ' + note);
});
console.log('short WARN count ' + shortWarnings);

if (errors.length) {
  errors.forEach((line) => console.error(line));
  process.exit(1);
}
const longest = quotes.reduce((best, quote) => Math.max(best, guard.bodyLength(quote.text)), 0);
console.log('quotes ok ' + quotes.length + ' longest ' + longest);
