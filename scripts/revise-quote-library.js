'use strict';

// One-shot editor for the catalog this file first read. Running it again
// on the revised quotes.json applies the product list a second time.
// CI does not call this script.

const fs = require('fs');
const path = require('path');
const guard = require('./quote-guard');

const ROOT = path.join(__dirname, '..');
const AUDIT = process.argv[2] || '/home/ubuntu/.cursor/projects/workspace/uploads/product-readthrough-7be1226a_ac70.md';
const CLASSICS = path.join(guard.FIXTURES, 'classics');

const DROP_IDS = new Set([
  'dq-397e8420',
  'dq-1e5e968c',
  'dq-9e8c47de',
  'dq-3ef55f7d',
  'dq-91a9dc55',
  'dq-80cf3348',
  'dq-6ce38b72',
  'dq-0aa31411',
]);

const ADD_SPEAKER = {
  'dq-ca696784': '孔子',
  'dq-dcb196a8': '孔子',
  'dq-ec0ef0ab': '孟子',
  'dq-f430abfc': '孟子',
  'dq-bebf7462': '孟子',
  'dq-be72c8b1': '孟子',
  'dq-31844f8f': '孟子',
  'dq-e034cadf': '孟子',
};

const GLOOM = Array.from('战怒怨仇敌攻伐诛刑罚囚盗贼暴虐凶祸哀哭病亡饥贫苦痛恨欺诈辱耻乱惧忧犯弑篡叛寇谤戎役');
const PHRASES = ['四夷', '放流', '菑', '刍狗', '不孝', '如之何', '无如之何', '行违', '不君', '见危', '见不善', '为伪', '恶人', '为不善', '德行：', '言语：', '政事：', '文学：', '王弼', '晁说', '未仁', '不弘', '绝仁', '绝圣', '桀'];

function fnv(text) {
  let hash = 0x811c9dc5;
  for (const ch of text) {
    hash ^= ch.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return 'dq-' + (hash >>> 0).toString(16).padStart(8, '0');
}

function parseSource(cell) {
  const text = String(cell || '').trim();
  const match = text.match(/^(?:([^·《]+)·)?《([^·》]+)·([^》]+)》$/);
  if (!match) return null;
  return { speaker: match[1] || '', book: match[2], chapter: match[3] };
}

function parseAudit(markdown) {
  const rows = [];
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('| dq-')) continue;
    const cells = line.split('|').map((cell) => cell.trim());
    rows.push({
      id: cells[1],
      replacement: cells[6] || '',
      source: parseSource(cells[7]),
    });
  }
  return rows;
}

function replacementDrop(text) {
  if (guard.blocklistHits(text).length) return true;
  if (guard.residueChars(text).length) return true;
  if (GLOOM.some((ch) => text.includes(ch))) return true;
  return false;
}

function fillDrop(text) {
  if (guard.blocklistHits(text).length) return true;
  if (guard.residueChars(text).length) return true;
  if (GLOOM.some((ch) => text.includes(ch))) return true;
  if (PHRASES.some((phrase) => text.includes(phrase))) return true;
  if (/(?<!莫)不仁/u.test(text)) return true;
  if (/^(故|是以|此谓|夫如是|诚如是|其次|今夫|若夫)/.test(text)) return true;
  if (/如之何|何谓|敢问|有诸|岂|孰|何必|何哉|焉用|道之不行/.test(text)) return true;
  if ((text.match(/、/g) || []).length >= 3) return true;
  if (/恶|愚|小人|杀|死|亡/.test(text)) return true;
  return false;
}

function shape(quote) {
  const row = {
    text: quote.text,
    book: quote.book,
    chapter: quote.chapter,
  };
  if (quote.speaker) row.speaker = quote.speaker;
  row.id = quote.id;
  return row;
}

function main() {
  const markdown = fs.readFileSync(AUDIT, 'utf8');
  const flagged = parseAudit(markdown);
  if (flagged.length !== 167) throw new Error('expected 167 product rows, got ' + flagged.length);
  const byId = new Map(flagged.map((row) => [row.id, row]));
  const forced = JSON.parse(fs.readFileSync(path.join(guard.FIXTURES, 'forced-no-speaker.json'), 'utf8'));
  const forcedIds = new Map(forced.map((row) => [row.id, row]));
  const manifest = JSON.parse(fs.readFileSync(path.join(guard.FIXTURES, 'manifest.json'), 'utf8'));
  const quotes = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'quotes.json'), 'utf8'));
  const snaps = new Map();
  for (const snap of manifest.snapshots) {
    if (snap.whole) continue;
    snaps.set(snap.book + '\0' + snap.chapter, snap);
  }
  const cache = new Map();
  function loaded(snap) {
    if (cache.has(snap.file)) return cache.get(snap.file);
    const wikitext = fs.readFileSync(path.join(CLASSICS, snap.file), 'utf8');
    const row = {
      wikitext,
      plain: guard.plainForMatch(wikitext),
      passage: guard.attributionPassage(wikitext),
    };
    cache.set(snap.file, row);
    return row;
  }

  const comparison = [];
  const next = [];
  const used = new Set();
  const missed = [];
  let variantRetry = 0;

  function offsets(plain, text) {
    const start = plain.indexOf(text);
    if (start < 0) return null;
    return { start, end: start + text.length };
  }

  function pushRow(row) {
    comparison.push(row);
  }

  function take(quote, action, snap, plain) {
    if (used.has(quote.text)) return 'duplicate';
    const near = next.find((other) => guard.nearDuplicate(other.text, quote.text));
    if (near) return 'near ' + near.id;
    const where = offsets(plain, quote.text);
    if (!where) return 'offset';
    if (guard.residueChars(quote.text).length || guard.residueChars(guard.sourceLine(quote)).length) return 'residue';
    if (!guard.attributionOk(loaded(snap).wikitext, quote)) return 'attribution';
    used.add(quote.text);
    next.push(quote);
    if (action) {
      pushRow({
        originalId: action.originalId,
        action: action.action,
        newText: quote.text,
        source: guard.sourceLine(quote),
        snapshotFile: snap.file,
        start: where.start,
        end: where.end,
        id: quote.id,
      });
    }
    return '';
  }

  for (const quote of quotes) {
    const forcedRow = forcedIds.get(quote.id);
    if (forcedRow) {
      const snap = snaps.get(quote.book + '\0' + quote.chapter);
      const plain = loaded(snap).plain;
      const text = guard.t2s(quote.text);
      const kept = shape({ id: quote.id, text, book: quote.book, chapter: quote.chapter, speaker: '' });
      if (text !== forcedRow.text) throw new Error('forced text drifted ' + quote.id);
      const forcedReason = take(kept, { originalId: quote.id, action: '改署名' }, snap, plain);
      if (forcedReason) throw new Error('forced line failed the snapshot ' + quote.id + ' ' + forcedReason);
      continue;
    }
    if (DROP_IDS.has(quote.id)) {
      pushRow({
        originalId: quote.id,
        action: '删除',
        newText: '',
        source: guard.sourceLine(quote),
        snapshotFile: (snaps.get(quote.book + '\0' + quote.chapter) || {}).file || '',
        start: null,
        end: null,
        id: '',
      });
      continue;
    }
    const flag = byId.get(quote.id);
    if (flag) {
      const direct = flag.replacement.startsWith('直接删除');
      let placed = false;
      if (!direct && flag.source) {
        const snap = snaps.get(flag.source.book + '\0' + flag.source.chapter);
        if (snap) {
          const row = loaded(snap);
          const excerpt = guard.findExcerpt(row.plain, flag.replacement);
          if (!excerpt && guard.normalizeMatch(flag.replacement) && !row.plain.includes(guard.normalizeMatch(flag.replacement))) {
            variantRetry += 1;
          }
          if (excerpt && !replacementDrop(excerpt.text)) {
            const at = guard.locateHan(row.passage, excerpt.text);
            const governing = at < 0 ? '' : guard.governingSpeakerAt(row.passage, at);
            let speaker = governing;
            if (!speaker && flag.source.book === '道德经') speaker = '老子';
            const replacement = shape({
              id: quote.id,
              text: excerpt.text,
              book: flag.source.book,
              chapter: flag.source.chapter,
              speaker,
            });
            const reason = take(replacement, { originalId: quote.id, action: '替换' }, snap, row.plain);
            placed = !reason;
            if (reason) missed.push(quote.id + ' ' + reason + ' ' + excerpt.text);
          } else {
            missed.push(quote.id + ' no excerpt ' + flag.replacement);
          }
        } else {
          missed.push(quote.id + ' no snapshot ' + flag.source.book + ' ' + flag.source.chapter);
        }
      }
      if (!placed) {
        pushRow({
          originalId: quote.id,
          action: '删除',
          newText: '',
          source: guard.sourceLine(quote),
          snapshotFile: (snaps.get(quote.book + '\0' + quote.chapter) || {}).file || '',
          start: null,
          end: null,
          id: '',
        });
      }
      continue;
    }

    const snap = snaps.get(quote.book + '\0' + quote.chapter);
    const row = loaded(snap);
    const text = guard.t2s(quote.text);
    let speaker = quote.speaker || '';
    if (guard.knownMisattribution({ text: quote.text, speaker })) speaker = '';
    const wanted = ADD_SPEAKER[quote.id];
    if (wanted) {
      const at = guard.locateHan(row.passage, text);
      const governing = at < 0 ? '' : guard.governingSpeakerAt(row.passage, at);
      if (governing === wanted) speaker = wanted;
    }
    const kept = shape({ id: quote.id, text, book: quote.book, chapter: quote.chapter, speaker });
    let action = '';
    if (text !== quote.text) action = '修字';
    else if ((speaker || '') !== (quote.speaker || '')) action = '改署名';
    const reason = take(kept, action ? { originalId: quote.id, action } : null, snap, row.plain);
    if (reason) {
      missed.push(quote.id + ' drop ' + reason + ' ' + text.slice(0, 18));
      pushRow({
        originalId: quote.id,
        action: '删除',
        newText: '',
        source: guard.sourceLine(quote),
        snapshotFile: snap.file,
        start: null,
        end: null,
        id: '',
      });
    }
  }

  const redText = new Set(JSON.parse(fs.readFileSync(path.join(guard.FIXTURES, 'attribution-red-cases.json'), 'utf8')).cases.map((row) => row.text));
  const pool = [];
  for (const snap of snaps.values()) {
    const row = loaded(snap);
    for (const quote of guard.quotesFromSnapshot(snap, row.wikitext)) {
      if (used.has(quote.text) || redText.has(quote.text)) continue;
      if (fillDrop(quote.text)) continue;
      if (!row.plain.includes(guard.normalizeMatch(quote.text))) continue;
      if (!guard.attributionOk(row.wikitext, quote)) continue;
      pool.push({ quote: shape(quote), snap, plain: row.plain });
    }
  }
  pool.sort((a, b) => {
    const score = (text) => {
      let value = 0;
      if (/[仁义礼智信学道德善和诚敬孝友乐安静清明]/.test(text)) value += 2;
      const n = guard.bodyLength(text);
      if (n >= 10 && n <= 24) value += 2;
      if (n > 32) value -= 3;
      return value;
    };
    return score(b.quote.text) - score(a.quote.text) || guard.bodyLength(a.quote.text) - guard.bodyLength(b.quote.text);
  });
  const seenFill = new Set();
  for (const item of pool) {
    if (next.length >= 380) break;
    if (seenFill.has(item.quote.text)) continue;
    seenFill.add(item.quote.text);
    const id = fnv(item.quote.book + item.quote.chapter + item.quote.text);
    if (next.some((quote) => quote.id === id)) continue;
    item.quote.id = id;
    const before = next.length;
    if (!take(item.quote, { originalId: '', action: '新增' }, item.snap, item.plain)) {
      if (next.length === before) continue;
    }
  }

  if (next.length < 366 || next.length > 400) {
    throw new Error('catalog size ' + next.length);
  }

  const dailyPath = path.join(ROOT, 'extension', 'daily-quote.js');
  const daily = fs.readFileSync(dailyPath, 'utf8');
  const json = JSON.stringify(next, null, 2);
  const embedded = '  const BUNDLED_QUOTES = ' + json.replace(/\n/g, '\n  ') + ';';
  const start = daily.indexOf('  const BUNDLED_QUOTES = ');
  const end = daily.indexOf('  /* CATALOG_END */');
  if (start < 0 || end < 0) throw new Error('catalog markers missing');
  fs.writeFileSync(dailyPath, daily.slice(0, start) + embedded + '\n' + daily.slice(end));
  fs.writeFileSync(path.join(ROOT, 'extension', 'quotes.json'), json + '\n');
  const comparisonFile = {
    normalization: guard.NORMALIZATION,
    normalizationNote: guard.NORMALIZATION_NOTE,
    rows: comparison,
  };
  fs.writeFileSync(path.join(guard.FIXTURES, 'quote-comparison.json'), JSON.stringify(comparisonFile, null, 2) + '\n');

  const books = {};
  const speakers = {};
  let longest = 0;
  let longestText = '';
  for (const quote of next) {
    books[quote.book] = (books[quote.book] || 0) + 1;
    speakers[quote.speaker || '(none)'] = (speakers[quote.speaker || '(none)'] || 0) + 1;
    const n = guard.bodyLength(quote.text);
    if (n > longest) {
      longest = n;
      longestText = quote.text;
    }
  }
  const actions = {};
  for (const row of comparison) actions[row.action] = (actions[row.action] || 0) + 1;
  console.log(JSON.stringify({
    count: next.length,
    books,
    speakers,
    longest,
    longestText,
    actions,
    rows: comparison.length,
    missed: missed.length,
    variantRetry,
  }, null, 2));
  missed.forEach((line) => console.log('MISS ' + line));
}

guard.nearDuplicateHit = function nearDuplicateHit(list, text) {
  return list.some((quote) => guard.nearDuplicate(quote.text, text));
};

main();
