'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const guard = require('./quote-guard');

const ROOT = path.join(__dirname, '..');
const CLASSICS = path.join(guard.FIXTURES, 'classics');
const UA = 'SopifyQuoteBot/1.0 (local study fixture for an extension; contact none)';
const FETCHED = '2026-10-14';

const LUNYU = [
  ['論語/學而第一', '学而'],
  ['論語/爲政第二', '为政'],
  ['論語/八佾第三', '八佾'],
  ['論語/里仁第四', '里仁'],
  ['論語/公冶長第五', '公冶长'],
  ['論語/雍也第六', '雍也'],
  ['論語/述而第七', '述而'],
  ['論語/泰伯第八', '泰伯'],
  ['論語/子罕第九', '子罕'],
  ['論語/鄉黨第十', '乡党'],
  ['論語/先進第十一', '先进'],
  ['論語/顏淵第十二', '颜渊'],
  ['論語/子路第十三', '子路'],
  ['論語/憲問第十四', '宪问'],
  ['論語/衞靈公第十五', '卫灵公'],
  ['論語/季氏第十六', '季氏'],
  ['論語/陽貨第十七', '阳货'],
  ['論語/微子第十八', '微子'],
  ['論語/子張第十九', '子张'],
  ['論語/堯曰第二十', '尧曰'],
];

const MENGZI = [
  ['孟子/梁惠王上', '梁惠王上'],
  ['孟子/梁惠王下', '梁惠王下'],
  ['孟子/公孫丑上', '公孙丑上'],
  ['孟子/公孫丑下', '公孙丑下'],
  ['孟子/滕文公上', '滕文公上'],
  ['孟子/滕文公下', '滕文公下'],
  ['孟子/離婁上', '离娄上'],
  ['孟子/離婁下', '离娄下'],
  ['孟子/萬章上', '万章上'],
  ['孟子/萬章下', '万章下'],
  ['孟子/告子上', '告子上'],
  ['孟子/告子下', '告子下'],
  ['孟子/盡心上', '尽心上'],
  ['孟子/盡心下', '尽心下'],
];

const GLOOM = Array.from('战怒怨仇敌攻伐诛刑罚囚盗贼暴虐凶祸哀哭病亡饥贫苦痛恨欺诈辱耻乱惧忧犯弑篡叛寇谤戎役');
const PHRASES = ['四夷', '放流', '菑', '刍狗', '不孝', '如之何', '无如之何', '行违', '不君', '见危', '见不善', '为伪', '恶人', '为不善', '德行：', '言语：', '政事：', '文学：', '王弼', '晁说', '未仁', '不弘', '绝仁', '绝圣', '桀'];

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function wiki(page) {
  const api = 'https://zh.wikisource.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&page=' + encodeURIComponent(page);
  let last = page;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(api, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
    if (response.status === 429) {
      await sleep(1500 * (attempt + 1));
      last = page + ' HTTP 429';
      continue;
    }
    if (!response.ok) throw new Error(page + ' HTTP ' + response.status);
    const json = await response.json();
    if (json.error) throw new Error(page + ' ' + json.error.info);
    return { api, wikitext: json.parse.wikitext, sourceUrl: 'https://zh.wikisource.org/wiki/' + encodeURIComponent(page).replace(/%2F/g, '/') };
  }
  throw new Error(last);
}

function fnv(text) {
  let hash = 0x811c9dc5;
  for (const ch of text) {
    hash ^= ch.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return 'dq-' + (hash >>> 0).toString(16).padStart(8, '0');
}

function score(text) {
  let value = 0;
  if (bodyIn(text, '仁义礼智信学道德善和诚敬孝友乐安静清明')) value += 2;
  const n = guard.bodyLength(text);
  if (n >= 12 && n <= 28) value += 1;
  return value;
}

function bodyIn(text, alphabet) {
  return Array.from(alphabet).some((ch) => text.includes(ch));
}

function gloomHit(text) {
  return Array.from(GLOOM).some((ch) => text.includes(ch));
}

function curatorDrop(text) {
  if (guard.blocklistHits(text).length) return true;
  if (gloomHit(text)) return true;
  if (PHRASES.some((phrase) => text.includes(phrase))) return true;
  if (/(?<!莫)不仁/u.test(text)) return true;
  return false;
}

function trimChapter(chunk) {
  const lines = chunk.split('\n');
  const kept = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (i > 0 && /^=[^=]/.test(lines[i].trim())) break;
    kept.push(lines[i]);
  }
  while (kept.length && !kept[kept.length - 1].trim()) kept.pop();
  return kept.join('\n');
}

function prune(list) {
  const kept = [];
  const sorted = list.slice().sort((a, b) => guard.bodyLength(b.text) - guard.bodyLength(a.text) || score(b.text) - score(a.text));
  for (const quote of sorted) {
    if (kept.some((other) => guard.nearDuplicate(other.text, quote.text))) continue;
    kept.push(quote);
  }
  return kept;
}

function pick(groups) {
  const buckets = {};
  for (const quote of groups) {
    (buckets[quote.book] || (buckets[quote.book] = [])).push(quote);
  }
  for (const book of Object.keys(buckets)) {
    buckets[book].sort((a, b) => score(b.text) - score(a.text) || guard.bodyLength(b.text) - guard.bodyLength(a.text));
  }
  const names = Object.keys(buckets).sort();
  const chosen = [];
  while (chosen.length < 380) {
    let added = false;
    for (const name of names) {
      const next = buckets[name].shift();
      if (!next) continue;
      chosen.push(next);
      added = true;
      if (chosen.length >= 380) break;
    }
    if (!added) break;
  }
  return chosen;
}

async function main() {
  fs.mkdirSync(CLASSICS, { recursive: true });
  fs.mkdirSync(guard.OPENCC_DIR, { recursive: true });
  for (const name of ['TSCharacters.txt', 'TSPhrases.txt']) {
    const from = path.join('/tmp/opencc', name);
    if (!fs.existsSync(from)) throw new Error('missing ' + from);
    fs.copyFileSync(from, path.join(guard.OPENCC_DIR, name));
  }

  const snapshots = [];
  async function savePage(page, meta) {
    const existing = path.join(CLASSICS, meta.file);
    const fetched = fs.existsSync(existing) && !process.argv.includes('--refresh')
      ? {
        api: 'https://zh.wikisource.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&page=' + encodeURIComponent(page),
        wikitext: fs.readFileSync(existing, 'utf8'),
        sourceUrl: 'https://zh.wikisource.org/wiki/' + encodeURIComponent(page).replace(/%2F/g, '/'),
      }
      : await wiki(page);
    const file = meta.file;
    fs.writeFileSync(path.join(CLASSICS, file), fetched.wikitext);
    snapshots.push({
      file,
      book: meta.book,
      chapter: meta.chapter,
      whole: !!meta.whole,
      bookSpeaker: meta.bookSpeaker || '',
      sourceUrl: fetched.sourceUrl,
      api: fetched.api,
      edition: meta.edition,
      fetched: FETCHED,
      sha256: sha256(fetched.wikitext),
    });
    await sleep(fs.existsSync(existing) && !process.argv.includes('--refresh') ? 0 : 900);
    return fetched.wikitext;
  }

  const pages = [];
  for (const [page, chapter] of LUNYU) {
    pages.push([page, { file: 'lunyu-' + chapter + '.wikitext', book: '论语', chapter, edition: 'Wikisource ' + page }]);
  }
  for (const [page, chapter] of MENGZI) {
    pages.push([page, { file: 'mengzi-' + chapter + '.wikitext', book: '孟子', chapter, edition: 'Wikisource ' + page }]);
  }
  pages.push(['禮記/大學', { file: 'daxue.wikitext', book: '礼记', chapter: '大学', edition: 'Wikisource 禮記/大學' }]);
  pages.push(['禮記/中庸', { file: 'zhongyong.wikitext', book: '礼记', chapter: '中庸', edition: 'Wikisource 禮記/中庸' }]);

  const pool = [];
  for (const [page, meta] of pages) {
    process.stdout.write('fetch ' + page + '\n');
    let wikitext;
    try {
      wikitext = await savePage(page, meta);
    } catch (err) {
      process.stdout.write('FAIL ' + page + ' ' + err.message + '\n');
      continue;
    }
    const found = guard.quotesFromSnapshot(meta, wikitext);
    process.stdout.write('  candidates ' + found.length + '\n');
    pool.push(...found);
  }

  process.stdout.write('fetch 道德經 (王弼本)\n');
  const ddj = await savePage('道德經 (王弼本)', {
    file: 'daodejing-wangbi.wikitext',
    book: '道德经',
    chapter: '',
    whole: true,
    edition: 'Wikisource 道德經 (王弼本)，王弼注，正文行',
  });
  const ddjQuotes = guard.extractDaodejing(ddj);
  process.stdout.write('  ddj candidates ' + ddjQuotes.length + '\n');
  const ddjStart = ddj.indexOf('==一章==');
  const ddjBody = ddj.slice(ddjStart);
  const ddjChunks = ddjBody.split(/\n(?===)/);
  for (const chunk of ddjChunks) {
    const heading = (chunk.match(/^==\s*([^=\s]+)\s*==/) || [])[1] || '';
    if (!/^[零一二三四五六七八九十百]+章$/.test(heading)) continue;
    const chapter = guard.t2s('第' + heading);
    const file = 'ddj-' + chapter + '.wikitext';
    const slice = trimChapter(chunk);
    if (!ddj.includes(slice)) throw new Error('slice missing ' + chapter);
    fs.writeFileSync(path.join(CLASSICS, file), slice);
    snapshots.push({
      file,
      book: '道德经',
      chapter,
      whole: false,
      bookSpeaker: '老子',
      sourceUrl: 'https://zh.wikisource.org/wiki/道德經_(王弼本)',
      api: snapshots.find((row) => row.file === 'daodejing-wangbi.wikitext').api,
      edition: 'Verbatim chapter slice of Wikisource 道德經 (王弼本)',
      parent: 'daodejing-wangbi.wikitext',
      fetched: FETCHED,
      sha256: sha256(slice),
    });
  }
  pool.push(...ddjQuotes);

  const calm = pool.filter((quote) => !curatorDrop(quote.text));
  const pruned = prune(calm);
  let chosen = pick(pruned);
  if (chosen.length < 366) {
    const wider = prune(pool.filter((quote) => !guard.blocklistHits(quote.text).length && !PHRASES.some((phrase) => quote.text.includes(phrase)) && !/(?<!莫)不仁/u.test(quote.text)));
    chosen = pick(wider);
    process.stdout.write('relaxed gloom, chosen ' + chosen.length + '\n');
  }
  if (chosen.length < 366 || chosen.length > 400) {
    throw new Error('quote count ' + chosen.length + ' outside 366-400 (pool ' + pool.length + ' calm ' + calm.length + ' pruned ' + pruned.length + ')');
  }

  const used = new Set();
  chosen.forEach((quote) => {
    let id = fnv(quote.text);
    while (used.has(id)) id = fnv(id + quote.text);
    used.add(id);
    quote.id = id;
    if (!quote.speaker) delete quote.speaker;
  });
  chosen.sort((a, b) => a.book.localeCompare(b.book, 'zh') || a.chapter.localeCompare(b.chapter, 'zh') || a.text.localeCompare(b.text, 'zh'));

  const needed = new Set();
  for (const quote of chosen) {
    const snap = snapshots.find((row) => !row.whole && row.book === quote.book && row.chapter === quote.chapter);
    if (!snap) throw new Error('no snapshot for ' + quote.book + ' ' + quote.chapter);
    needed.add(snap.file);
    if (snap.parent) needed.add(snap.parent);
  }
  for (const name of fs.readdirSync(CLASSICS)) {
    if (!needed.has(name)) fs.unlinkSync(path.join(CLASSICS, name));
  }
  const keptSnapshots = snapshots.filter((row) => needed.has(row.file));

  const manifest = {
    fetched: FETCHED,
    conversion: {
      rule: 'Longest OpenCC TSPhrases match, then TSCharacters first simplified form. 乾 stays 乾. 擧 maps to 举 because TSCharacters has no row. Wikisource refs, comments, and tags are removed; {{templates}} become a barrier and are not expanded; wiki links keep their visible label; converter markup keeps zh-hans. Commentary lines that start with : and colophon sections that start with a single = are not part of the classic. Match text then drops brackets and whitespace and maps ，： and sentence punctuation onto ，：。.',
      files: ['TSCharacters.txt', 'TSPhrases.txt'].map((name) => ({
        file: 'tests/fixtures/opencc/' + name,
        url: 'https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/' + name,
        fetched: FETCHED,
        sha256: sha256(fs.readFileSync(path.join(guard.OPENCC_DIR, name))),
      })),
    },
    snapshots: keptSnapshots,
  };
  fs.writeFileSync(path.join(guard.FIXTURES, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(guard.FIXTURES, 'quote-blocklist-allow.json'), '[]\n');
  fs.writeFileSync(path.join(ROOT, 'extension', 'quotes.json'), JSON.stringify(chosen, null, 2) + '\n');

  const modulePath = path.join(ROOT, 'extension', 'daily-quote.js');
  const source = fs.readFileSync(modulePath, 'utf8');
  const start = source.indexOf('/* CATALOG_START */');
  const end = source.indexOf('/* CATALOG_END */');
  if (start < 0 || end < 0) throw new Error('catalog markers missing');
  const embedded = '/* CATALOG_START */\n  const BUNDLED_QUOTES = ' + JSON.stringify(chosen, null, 2).replace(/\n/g, '\n  ') + ';\n  ';
  fs.writeFileSync(modulePath, source.slice(0, start) + embedded + source.slice(end));

  const byBook = {};
  chosen.forEach((quote) => { byBook[quote.book] = (byBook[quote.book] || 0) + 1; });
  const longest = chosen.reduce((best, quote) => (guard.bodyLength(quote.text) > guard.bodyLength(best.text) ? quote : best));
  const longestSrc = chosen.reduce((best, quote) => (guard.sourceLine(quote).length > guard.sourceLine(best).length ? quote : best));
  process.stdout.write(JSON.stringify({
    count: chosen.length,
    byBook,
    longest: longest.text,
    longestN: guard.bodyLength(longest.text),
    longestSrc: guard.sourceLine(longestSrc),
  }, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
