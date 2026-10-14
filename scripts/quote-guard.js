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

const NORMALIZATION = 'quote-guard.plainForMatch';
const NORMALIZATION_NOTE = 'Offsets are UTF-16 code units into quote-guard.plainForMatch, end exclusive. The snapshot is prepareWikitext, or chapterBodies for 道德经 (colon commentary and the colophon dropped). Then OpenCC TSPhrases, longest first, and TSCharacters, first simplified form, then tests/fixtures/variant-map.json. 乾 stays 乾. Whitespace and 「」『』 drop. ， and , become ，. ： and : become ：. ！？；。 and their ASCII forms become 。. A 删除 row has empty newText and null offsets and is not a slice.';

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

function poisonTemplates(input) {
  let text = String(input);
  let prev = '';
  while (text !== prev) {
    prev = text;
    text = text.replace(/\{\{[^{}]*\}\}/g, '\u0001');
  }
  return text;
}

function prepareWikitext(wikitext) {
  let text = String(wikitext);
  const only = text.match(/<onlyinclude>([\s\S]*?)<\/onlyinclude>/);
  if (only) text = only[1];
  text = text.replace(/<ref[\s\S]*?<\/ref>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<[^>]+>/g, '');
  text = poisonTemplates(text);
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
    chapters.push({ heading, text: stripConverter(lines.join('')) });
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
  return ATTRIBUTION_ALLOW.find((row) => row.book === quote.book && row.speaker === speaker) || null;
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
};
