'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
const OPENCC_DIR = path.join(FIXTURES, 'opencc');

const CLASSICAL_OVERRIDE = {
  乾: '乾',
};

const VARIANT_FILE = path.join(FIXTURES, 'variant-map.json');
const VARIANT_MAP = JSON.parse(fs.readFileSync(VARIANT_FILE, 'utf8')).map;
const RED_CASES = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'attribution-red-cases.json'), 'utf8')).cases;
const ATTRIBUTION_ALLOW = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'attribution-allow.json'), 'utf8'));
const KNOWN_ERRORS = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'snapshot-known-errors.json'), 'utf8'));
const EDGE_MARKS = '（）()「」『』“”‘’"\'《》';

const NORMALIZATION = 'quote-guard.plainForMatch';
const NORMALIZATION_NOTE = 'Offsets are UTF-16 code units into quote-guard.plainForMatch, end exclusive. The snapshot is prepareWikitext, or chapterBodies for 道德经 (colon commentary and the colophon dropped). {{另}} and {{另2}} keep the displayed first parameter. Other templates are removed. Then OpenCC TSPhrases, longest first, and TSCharacters, first simplified form, then tests/fixtures/variant-map.json. 乾 stays 乾. Whitespace and 「」『』 drop. ， and , become ，. ： and : become ：. ！？；。 and their ASCII forms become 。. A 删除 row has empty newText and null offsets and is not a slice.';

const BLOCKLIST = ['杀', '死', '兵', '鬼', '丧'];

let phrases = null;
let chars = null;

function loadTable(file) {
  const rows = [];
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const tab = line.indexOf('\t');
    if (tab < 1) continue;
    const key = line.slice(0, tab);
    const value = line.slice(tab + 1).split(' ')[0];
    if (!value) continue;
    rows.push([key, value]);
  }
  return rows;
}

function tables() {
  if (!phrases) {
    phrases = loadTable(path.join(OPENCC_DIR, 'TSPhrases.txt'))
      .sort((a, b) => b[0].length - a[0].length);
    chars = new Map(loadTable(path.join(OPENCC_DIR, 'TSCharacters.txt')));
  }
  return { phrases, chars };
}

function t2s(input) {
  const { phrases: phraseRows, chars: charMap } = tables();
  let text = String(input);
  for (const [from, to] of phraseRows) {
    if (text.includes(from)) text = text.split(from).join(to);
  }
  let out = '';
  for (const ch of text) {
    if (Object.prototype.hasOwnProperty.call(CLASSICAL_OVERRIDE, ch)) {
      out += CLASSICAL_OVERRIDE[ch];
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(VARIANT_MAP, ch)) {
      out += VARIANT_MAP[ch];
      continue;
    }
    out += charMap.get(ch) || ch;
  }
  return out;
}

function normalizeMatch(input) {
  return t2s(input)
    .replace(/\s+/g, '')
    .replace(/[「」『』]/g, '')
    .replace(/[，,]/g, '，')
    .replace(/[：:]/g, '：')
    .replace(/[！？；。!?;.]/g, '。');
}

function bodyLength(text) {
  return Array.from(String(text)).length;
}

function sourceLine(quote) {
  const work = '《' + quote.book + '·' + quote.chapter + '》';
  return quote.speaker ? quote.speaker + '·' + work : work;
}

function sourceFormatOk(line) {
  return /^[\u4e00-\u9fff]{1,8}·《[\u4e00-\u9fff]{1,8}·[\u4e00-\u9fff]{1,12}》$/.test(line)
    || /^《[\u4e00-\u9fff]{1,8}·[\u4e00-\u9fff]{1,12}》$/.test(line);
}

function speakerFromPrefix(prefix) {
  let compact = t2s(prefix).replace(/\s/g, '');
  compact = compact.replace(/(?:问|对|答)+$/u, '');
  if (!compact) return '';
  const token3 = compact.slice(-3);
  const token2 = compact.slice(-2);
  const token1 = compact.slice(-1);
  if (/^子.$/.test(token2) && token2 !== '子曰') return token2;
  if (/^.子$/.test(token2)) return token2;
  if (token1 === '子') return '孔子';
  if (/^.子$/.test(token3)) return token3;
  return '';
}

function finishSentence(piece) {
  let text = t2s(piece).replace(/\s+/g, '').replace(/[「」『』]/g, '');
  text = text.replace(/[！？；。]+$/u, '。');
  if (!text.endsWith('。')) text += '。';
  return text;
}

function sentencesOf(body) {
  const parts = [];
  const re = /[^。！？；\n]+[。！？；]/g;
  const found = body.match(re) || [];
  for (const piece of found) parts.push(piece);
  return parts;
}

function acceptSentence(text) {
  const n = bodyLength(text);
  if (n < 8 || n > 36) return false;
  if (/[曰「」A-Za-z0-9{}]/.test(text)) return false;
  if (text.includes('-') || text.includes('\u0001')) return false;
  if (/注曰|音义|反。$/.test(text)) return false;
  return true;
}

function pushCandidate(bucket, seen, quote) {
  if (!acceptSentence(quote.text)) return;
  const key = quote.text;
  if (seen.has(key)) return;
  seen.add(key);
  bucket.push(quote);
}

function stripConverter(input) {
  let text = String(input);
  let prev = '';
  while (text !== prev) {
    prev = text;
    text = text.replace(/-\{([^{}]*)\}-/g, (_, inner) => {
      const hans = inner.match(/zh-hans\s*:\s*([^;]+)/);
      if (hans) return hans[1].trim();
      if (!inner.includes(':')) return inner.trim();
      const labeled = inner.match(/(?:^|;)zh\s*:\s*([^;]+)/);
      if (labeled) return labeled[1].trim();
      return inner.split(';').pop().split(':').pop().trim();
    });
  }
  return text;
}

function splitTemplateParams(inner) {
  const params = [];
  let buf = '';
  let link = 0;
  let converter = false;
  for (let i = 0; i < inner.length; i += 1) {
    const two = inner.slice(i, i + 2);
    if (!converter && two === '[[') {
      link += 1;
      buf += two;
      i += 1;
      continue;
    }
    if (!converter && link > 0 && two === ']]') {
      link -= 1;
      buf += two;
      i += 1;
      continue;
    }
    if (!converter && two === '-{') {
      converter = true;
      buf += two;
      i += 1;
      continue;
    }
    if (converter && two === '}-') {
      converter = false;
      buf += two;
      i += 1;
      continue;
    }
    if (inner[i] === '|' && link === 0 && !converter) {
      params.push(buf);
      buf = '';
      continue;
    }
    buf += inner[i];
  }
  params.push(buf);
  return params;
}

function replaceOneTemplate(text) {
  let start = -1;
  for (let i = 0; i < text.length - 1; i += 1) {
    if (text[i] === '{' && text[i + 1] === '{') {
      start = i;
      i += 1;
      continue;
    }
    if (start < 0 || text[i] !== '}' || text[i + 1] !== '}') continue;
    return {
      inner: text.slice(start + 2, i),
      text: (replacement) => text.slice(0, start) + replacement + text.slice(i + 2),
    };
  }
  return null;
}

function resolveTemplates(input) {
  const resolved = new Map();
  const removed = new Map();
  let text = String(input);
  for (let guard = 0; guard < 10000; guard += 1) {
    const found = replaceOneTemplate(text);
    if (!found) break;
    const params = splitTemplateParams(found.inner);
    const name = params[0].trim();
    if (name === '另' || name === '另2') {
      resolved.set(name, (resolved.get(name) || 0) + 1);
      text = found.text((params[1] || '').trim());
      continue;
    }
    removed.set(name || '(blank)', (removed.get(name || '(blank)') || 0) + 1);
    text = found.text('');
  }
  return { text, resolved, removed };
}

function prepareWikitext(wikitext) {
  let text = String(wikitext);
  const only = text.match(/<onlyinclude>([\s\S]*?)<\/onlyinclude>/);
  if (only) text = only[1];
  text = text.replace(/<ref[\s\S]*?<\/ref>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<[^>]+>/g, '');
  text = resolveTemplates(text).text;
  text = text.replace(/'''/g, '');
  text = text.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1');
  return stripConverter(text);
}

function chapterBodies(wikitext) {
  const marker = String(wikitext).indexOf('==一章==');
  const body = marker >= 0 ? wikitext.slice(marker) : String(wikitext);
  const chapters = [];
  const chunks = body.split(/\n(?===)/);
  for (const chunk of chunks) {
    const heading = (chunk.match(/^==\s*([^=\s]+)\s*==/) || [])[1] || '';
    if (!/^[零一二三四五六七八九十百]+章$/.test(heading)) continue;
    const lines = [];
    for (const line of chunk.split('\n').slice(1)) {
      const trimmed = line.trim();
      if (/^=[^=]/.test(trimmed)) break;
      if (!trimmed) continue;
      if (/^[:={<\|\*]/.test(trimmed)) continue;
      if (trimmed.startsWith('==')) continue;
      lines.push(trimmed);
    }
    chapters.push({ heading, text: stripConverter(resolveTemplates(lines.join('')).text) });
  }
  return chapters;
}

function extractLunyuLike(wikitext, meta) {
  const text = prepareWikitext(wikitext);
  const quotes = [];
  const seen = new Set();
  const speech = /([\u4e00-\u9fff]{0,12})曰：「([\s\S]*?)」/g;
  let match;
  const covered = [];
  while ((match = speech.exec(text))) {
    covered.push([match.index, match.index + match[0].length]);
    const speaker = speakerFromPrefix(match[1]);
    for (const piece of sentencesOf(match[2])) {
      pushCandidate(quotes, seen, {
        text: finishSentence(piece),
        book: meta.book,
        chapter: meta.chapter,
        speaker,
      });
    }
  }
  let outside = '';
  let cursor = 0;
  for (const [start, end] of covered) {
    outside += text.slice(cursor, start);
    cursor = end;
  }
  outside += text.slice(cursor);
  for (const piece of sentencesOf(outside)) {
    pushCandidate(quotes, seen, {
      text: finishSentence(piece),
      book: meta.book,
      chapter: meta.chapter,
      speaker: meta.bookSpeaker || '',
    });
  }
  return quotes;
}

function extractDaodejing(wikitext) {
  const quotes = [];
  const seen = new Set();
  for (const chapter of chapterBodies(wikitext)) {
    const name = t2s('第' + chapter.heading);
    for (const piece of sentencesOf(chapter.text)) {
      pushCandidate(quotes, seen, {
        text: finishSentence(piece),
        book: '道德经',
        chapter: name,
        speaker: '老子',
      });
    }
  }
  return quotes;
}

function plainForMatch(wikitext) {
  const source = String(wikitext);
  const ddj = source.includes('==一章==') || /^==[零一二三四五六七八九十百]+章==/.test(source.trim());
  if (ddj) {
    const chapters = chapterBodies(source);
    if (chapters.length) return normalizeMatch(chapters.map((chapter) => chapter.text).join(''));
  }
  return normalizeMatch(prepareWikitext(source));
}

function quotesFromSnapshot(meta, wikitext) {
  if (meta.book === '道德经') return extractDaodejing(wikitext);
  return extractLunyuLike(wikitext, meta);
}

function bigrams(text) {
  const compact = text.replace(/[，。：；]/g, '');
  const grams = [];
  const chars = Array.from(compact);
  for (let i = 0; i < chars.length - 1; i += 1) grams.push(chars[i] + chars[i + 1]);
  return grams;
}

function dice(a, b) {
  const left = bigrams(a);
  const right = bigrams(b);
  if (!left.length || !right.length) return 0;
  const bag = new Map();
  for (const gram of right) bag.set(gram, (bag.get(gram) || 0) + 1);
  let hit = 0;
  for (const gram of left) {
    const n = bag.get(gram) || 0;
    if (n > 0) {
      hit += 1;
      bag.set(gram, n - 1);
    }
  }
  return (2 * hit) / (left.length + right.length);
}

function nearDuplicate(a, b) {
  if (a === b) return true;
  const left = a.replace(/[，。]/g, '');
  const right = b.replace(/[，。]/g, '');
  if (left.length >= 8 && right.length >= 8 && (left.includes(right) || right.includes(left))) return true;
  return dice(a, b) >= 0.82;
}

function blocklistHits(text) {
  return BLOCKLIST.filter((ch) => text.includes(ch));
}

function residueChars(text) {
  const found = [];
  for (const ch of String(text)) {
    if (t2s(ch) !== ch && !found.includes(ch)) found.push(ch);
  }
  return found;
}

function hanChars(text) {
  const chars = [];
  for (const ch of String(text)) {
    if (/\p{Script=Han}/u.test(ch)) chars.push(ch);
  }
  return chars;
}

function hanIndex(text) {
  const chars = [];
  const at = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (/\p{Script=Han}/u.test(ch)) {
      chars.push(ch);
      at.push(i);
    }
  }
  return { chars, at };
}

function locateHan(hay, needle) {
  const want = hanChars(t2s(needle));
  if (!want.length) return -1;
  const { chars, at } = hanIndex(hay);
  for (let i = 0; i <= chars.length - want.length; i += 1) {
    let ok = true;
    for (let j = 0; j < want.length; j += 1) {
      if (chars[i + j] !== want[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return at[i];
  }
  return -1;
}

function findExcerpt(plain, hint) {
  const norm = normalizeMatch(hint);
  const size = bodyLength(norm);
  if (norm && plain.includes(norm) && size >= 4 && size <= 36 && !norm.includes('\u0001')) {
    const start = plain.indexOf(norm);
    return { text: norm, start, end: start + norm.length };
  }
  const want = hanChars(norm);
  if (want.length < 4) return null;
  const { chars, at } = hanIndex(plain);
  for (let i = 0; i <= chars.length - want.length; i += 1) {
    let ok = true;
    for (let j = 0; j < want.length; j += 1) {
      if (chars[i + j] !== want[j]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const start = at[i];
    const last = at[i + want.length - 1];
    let end = last + 1;
    while (end < plain.length && !/\p{Script=Han}/u.test(plain[end]) && plain[end] !== '。') end += 1;
    if (plain[end] !== '。') continue;
    end += 1;
    const text = plain.slice(start, end);
    if (hanChars(text).length !== want.length) continue;
    if (text.includes('\u0001')) continue;
    const n = bodyLength(text);
    if (n < 4 || n > 36) continue;
    return { text, start, end };
  }
  return null;
}

function attributionPassage(wikitext) {
  const source = String(wikitext);
  const ddj = source.includes('==一章==') || /^==[零一二三四五六七八九十百]+章==/.test(source.trim());
  if (ddj) {
    const chapters = chapterBodies(source);
    if (chapters.length) return t2s(chapters.map((chapter) => chapter.text).join(''));
  }
  return t2s(prepareWikitext(source));
}

function speechSpans(passage) {
  const spans = [];
  const re = /([\u4e00-\u9fff]{0,12})曰：「/g;
  let match;
  let carried = '';
  while ((match = re.exec(passage))) {
    const name = match[1];
    const start = match.index + match[0].length;
    const close = passage.indexOf('」', start);
    if (close < 0) continue;
    let speaker = '';
    if (!name) speaker = carried;
    else {
      speaker = speakerFromPrefix(name);
      carried = speaker;
    }
    spans.push({ start, end: close, speaker });
  }
  return spans;
}

function governingSpeakerAt(passage, index) {
  let best = null;
  for (const span of speechSpans(passage)) {
    if (index < span.start || index >= span.end) continue;
    if (!best || span.start >= best.start) best = span;
  }
  return best ? best.speaker : '';
}

function knownMisattribution(quote) {
  const speaker = quote && quote.speaker ? quote.speaker : '';
  return RED_CASES.some((row) => row.text === quote.text && row.wrongSpeaker === speaker);
}

function allowHit(quote) {
  const speaker = quote && quote.speaker ? quote.speaker : '';
  return ATTRIBUTION_ALLOW.find((row) => {
    if (row.book !== quote.book || row.speaker !== speaker) return false;
    if (row.text && row.text !== quote.text) return false;
    return true;
  }) || null;
}

function edgePunctuation(text) {
  const body = String(text || '');
  if (!body) return '';
  if (EDGE_MARKS.includes(body[0])) return body[0];
  const last = body[body.length - 1];
  if (EDGE_MARKS.includes(last)) return last;
  return '';
}

function knownSnapshotError(text) {
  const body = String(text || '');
  const rows = Array.isArray(KNOWN_ERRORS) ? KNOWN_ERRORS : [];
  return rows.find((row) => row && row.pattern && body.includes(row.pattern)) || null;
}

function shiShuCitation(wikitext, quote) {
  const speaker = quote && quote.speaker ? quote.speaker : '';
  if (speaker !== '孔子' && speaker !== '孟子') return false;
  const passage = attributionPassage(wikitext);
  const at = locateHan(passage, quote.text || '');
  if (at < 0) return false;
  const opens = '「『“‘';
  const closes = '」』”’';
  let i = at - 1;
  while (i >= 0) {
    const ch = passage[i];
    if (closes.includes(ch)) {
      let depth = 1;
      i -= 1;
      while (i >= 0 && depth > 0) {
        if (closes.includes(passage[i])) depth += 1;
        else if (opens.includes(passage[i])) depth -= 1;
        i -= 1;
      }
      while (i >= 0 && '：:'.includes(passage[i])) i -= 1;
      if (i >= 0 && (passage[i] === '曰' || passage[i] === '云')) i -= 1;
      continue;
    }
    if (ch === '曰' || ch === '云') {
      const window = passage.slice(Math.max(0, i - 6), i + 1);
      return /诗曰|诗云|书曰|书云|《诗》|《书》/.test(window);
    }
    i -= 1;
  }
  return false;
}

function controlKind(cp) {
  if (cp === 0x09 || cp === 0x0A) return '';
  if (cp <= 0x1F || cp === 0x7F) return 'C0';
  if (cp >= 0x80 && cp <= 0x9F) return 'C1';
  if ((cp >= 0x200B && cp <= 0x200F) || cp === 0x2060 || cp === 0xFEFF) return 'zero-width';
  if (cp >= 0xE000 && cp <= 0xF8FF) return 'PUA';
  return '';
}

function invisibleHits(text) {
  const hits = [];
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) {
    const cu = s.charCodeAt(i);
    if (cu >= 0xD800 && cu <= 0xDBFF) {
      const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (next >= 0xDC00 && next <= 0xDFFF) {
        i += 1;
        continue;
      }
      hits.push({ kind: 'surrogate', index: i, cp: cu });
      continue;
    }
    if (cu >= 0xDC00 && cu <= 0xDFFF) {
      hits.push({ kind: 'surrogate', index: i, cp: cu });
      continue;
    }
    const kind = controlKind(cu);
    if (kind) hits.push({ kind, index: i, cp: cu });
  }
  return hits;
}

function supplementaryChars(text) {
  const found = [];
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) {
    const cu = s.charCodeAt(i);
    if (cu < 0xD800 || cu > 0xDBFF) continue;
    const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
    if (next < 0xDC00 || next > 0xDFFF) continue;
    const cp = (cu - 0xD800) * 0x400 + (next - 0xDC00) + 0x10000;
    found.push({ index: i, cp });
    i += 1;
  }
  return found;
}

function templateResidues(text) {
  const counts = new Map();
  const re = /\{\{([^{}\n]*)/g;
  let match;
  const s = String(text);
  while ((match = re.exec(s))) {
    const inner = match[1];
    const name = (inner.split('|')[0] || '(unclosed)').trim() || '(blank)';
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return counts;
}

function addCounts(into, from) {
  for (const [key, n] of from) into.set(key, (into.get(key) || 0) + n);
}

function templateReport(wikitext) {
  const source = String(wikitext);
  const resolved = new Map();
  const removed = new Map();
  const ddj = source.includes('==一章==') || /^==[零一二三四五六七八九十百]+章==/.test(source.trim());
  if (ddj) {
    const marker = source.indexOf('==一章==');
    const body = marker >= 0 ? source.slice(marker) : source;
    for (const chunk of body.split(/\n(?===)/)) {
      const heading = (chunk.match(/^==\s*([^=\s]+)\s*==/) || [])[1] || '';
      if (!/^[零一二三四五六七八九十百]+章$/.test(heading)) continue;
      const lines = [];
      for (const line of chunk.split('\n').slice(1)) {
        const trimmed = line.trim();
        if (/^=[^=]/.test(trimmed)) break;
        if (!trimmed || /^[:={<\|\*]/.test(trimmed) || trimmed.startsWith('==')) continue;
        lines.push(trimmed);
      }
      const part = resolveTemplates(lines.join(''));
      addCounts(resolved, part.resolved);
      addCounts(removed, part.removed);
    }
    return { resolved, removed };
  }
  let text = source;
  const only = text.match(/<onlyinclude>([\s\S]*?)<\/onlyinclude>/);
  if (only) text = only[1];
  text = text.replace(/<ref[\s\S]*?<\/ref>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<[^>]+>/g, '');
  const part = resolveTemplates(text);
  addCounts(resolved, part.resolved);
  addCounts(removed, part.removed);
  return { resolved, removed };
}

function shortBodyWarning(quote, allowlist) {
  if (!quote || bodyLength(quote.text) >= 8) return '';
  const rows = Array.isArray(allowlist) ? allowlist : [];
  if (rows.some((row) => row && row.id === quote.id)) return '';
  return quote.id + ' ' + quote.text;
}

function attributionOk(wikitext, quote) {
  if (!quote || knownMisattribution(quote)) return false;
  const speaker = quote.speaker || '';
  if (!speaker) return true;
  const passage = attributionPassage(wikitext);
  const at = locateHan(passage, quote.text);
  if (at < 0) return false;
  const governing = governingSpeakerAt(passage, at);
  if (governing === speaker) return true;
  if (!governing && allowHit(quote)) return true;
  return false;
}

module.exports = {
  BLOCKLIST,
  CLASSICAL_OVERRIDE,
  EXTRA_VARIANT: VARIANT_MAP,
  VARIANT_FILE,
  NORMALIZATION,
  NORMALIZATION_NOTE,
  FIXTURES,
  OPENCC_DIR,
  t2s,
  normalizeMatch,
  bodyLength,
  sourceLine,
  sourceFormatOk,
  speakerFromPrefix,
  quotesFromSnapshot,
  extractDaodejing,
  extractLunyuLike,
  plainForMatch,
  prepareWikitext,
  nearDuplicate,
  blocklistHits,
  residueChars,
  findExcerpt,
  attributionPassage,
  governingSpeakerAt,
  knownMisattribution,
  attributionOk,
  locateHan,
  edgePunctuation,
  knownSnapshotError,
  shiShuCitation,
  shortBodyWarning,
  invisibleHits,
  supplementaryChars,
  templateResidues,
  templateReport,
};
