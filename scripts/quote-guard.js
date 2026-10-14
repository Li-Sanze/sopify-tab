'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
const OPENCC_DIR = path.join(FIXTURES, 'opencc');

const CLASSICAL_OVERRIDE = {
  乾: '乾',
};

// OpenCC TSCharacters has no row for 擧. It is the variant of 舉 used in this Wikisource edition.
const EXTRA_VARIANT = {
  擧: '举',
};

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
    if (Object.prototype.hasOwnProperty.call(EXTRA_VARIANT, ch)) {
      out += EXTRA_VARIANT[ch];
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

module.exports = {
  BLOCKLIST,
  CLASSICAL_OVERRIDE,
  EXTRA_VARIANT,
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
};
