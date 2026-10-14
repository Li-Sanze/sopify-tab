'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const guard = require('../scripts/quote-guard');

const classics = path.join(__dirname, 'fixtures', 'classics');
const xueer = fs.readFileSync(path.join(classics, 'lunyu-学而.wikitext'), 'utf8');
const xueerQuotes = guard.extractLunyuLike(xueer, { book: '论语', chapter: '学而' });

const study = xueerQuotes.find((quote) => quote.text === '学而时习之，不亦说乎。');
assert.ok(study);
assert.strictEqual(study.speaker, '孔子');
assert.strictEqual(guard.sourceLine(study), '孔子·《论语·学而》');

const youzi = xueerQuotes.find((quote) => quote.text.startsWith('其为人也孝弟'));
assert.ok(youzi);
assert.strictEqual(youzi.speaker, '有子');
assert.notStrictEqual(youzi.speaker, '孔子');

const zeng = xueerQuotes.find((quote) => quote.text.startsWith('吾日三省吾身'));
assert.ok(zeng);
assert.strictEqual(zeng.speaker, '曾子');
assert.strictEqual(zeng.text, '吾日三省吾身：为人谋而不忠乎。');

const reply = guard.extractLunyuLike('子对曰：「有父兄在，如之何其闻斯行之。」\n', {
  book: '论语',
  chapter: '先进',
});
assert.strictEqual(reply[0].speaker, '孔子');
assert.notStrictEqual(reply[0].speaker, '子对');

const fish = guard.extractLunyuLike('子曰：「子钓而不纲，弋不射宿。」\n', {
  book: '论语',
  chapter: '述而',
});
assert.strictEqual(fish[0].text, '子钓而不纲，弋不射宿。');
assert.ok(!fish.some((quote) => quote.text === '钓而不纲。'));

const spliced = guard.extractLunyuLike('子曰：「君子也。若圣人与人同。」\n', {
  book: '论语',
  chapter: '述而',
});
assert.ok(!spliced.some((quote) => quote.text.includes('君子也。若圣人')));

const variant = guard.extractLunyuLike('子曰：「诗、书、{{另|艺|执}}礼，皆雅言也。」\n子曰：「学而时习之，不亦说乎。」\n', {
  book: '论语',
  chapter: '述而',
});
assert.ok(variant.some((quote) => quote.text === '诗、书、艺礼，皆雅言也。'), 'variant template keeps the displayed reading');
assert.ok(!variant.some((quote) => quote.text.includes('执')), 'variant template drops the tooltip reading');
assert.ok(variant.some((quote) => quote.text === '学而时习之，不亦说乎。'));

const variantLine = guard.plainForMatch('君子之道，{{另|譬|辟}}如行远必自迩，{{另|譬|辟}}如登高必自卑。');
assert.strictEqual(variantLine, '君子之道，譬如行远必自迩，譬如登高必自卑。', '另 displays parameter 1');
assert.deepStrictEqual(guard.invisibleHits(variantLine), [], 'resolved variant text has no invisible character');
assert.strictEqual(guard.plainForMatch('愿{{另2|车马衣裘|一作「车马衣轻裘」}}，与朋友共。'), '愿车马衣裘，与朋友共。', '另2 displays parameter 1');
assert.strictEqual(
  guard.plainForMatch('子曰：「{{另2|《[[尚书|书]]》-{云}-：『孝乎惟孝。』施于有政，|一作其他}}{{另|是亦为政|是亦为政也}}，奚其为为政。」'),
  '子曰：《书》云：孝乎惟孝。施于有政，是亦为政，奚其为为政。',
  '另2 keeps the article text inside a link and a converter mark'
);
assert.deepStrictEqual(guard.invisibleHits(guard.plainForMatch('君子\u0001道')).map((hit) => hit.kind), ['C0'], 'converted snapshot rejects a C0 control');
assert.deepStrictEqual(guard.invisibleHits('君子\u0001道').map((hit) => hit.kind), ['C0'], 'invisible char rejects a C0 control');
assert.deepStrictEqual(guard.invisibleHits('君子\u0085道').map((hit) => hit.kind), ['C1'], 'invisible char rejects a C1 control');
assert.deepStrictEqual(guard.invisibleHits('辟\u200B如').map((hit) => hit.kind), ['zero-width'], 'invisible char rejects a zero-width character');
assert.deepStrictEqual(guard.invisibleHits('君\uE000子').map((hit) => hit.kind), ['PUA'], 'invisible char rejects a private-use character');
assert.deepStrictEqual(guard.invisibleHits('君' + String.fromCharCode(0xD800) + '子').map((hit) => hit.kind), ['surrogate'], 'invisible char rejects a lone surrogate');
assert.deepStrictEqual(guard.invisibleHits('君子之道，辟如行远必自迩。'), [], 'invisible char allows ordinary text');
const extended = '君' + String.fromCodePoint(0x20000) + '子';
assert.deepStrictEqual(guard.invisibleHits(extended), [], 'a supplementary character is not an invisible-character failure');
assert.strictEqual(guard.supplementaryChars(extended)[0].cp, 0x20000, 'supplementary scan counts a character above U+FFFF');

const zang = guard.plainForMatch('子曰：「臧文仲居蔡。」');
assert.ok(zang.includes('臧文仲居蔡'));
assert.ok(!zang.includes('藏文仲'));

const colophon = guard.extractDaodejing('==一章==\n道可道，非常道。\n=跋=\n王弼老子道德经二卷，真得老子之学欤。\n');
assert.deepStrictEqual(colophon.map((quote) => quote.text), ['道可道，非常道。']);
assert.strictEqual(colophon[0].speaker, '老子');
assert.strictEqual(guard.sourceLine(colophon[0]), '老子·《道德经·第一章》');

const unnamed = { book: '礼记', chapter: '大学', text: '大学之道，在明明德，在亲民，在止于至善。' };
assert.strictEqual(guard.sourceLine(unnamed), '《礼记·大学》');
assert.strictEqual(guard.sourceFormatOk(guard.sourceLine(unnamed)), true);
assert.strictEqual(guard.sourceFormatOk('孔子·《论语》'), false);
assert.strictEqual(guard.sourceFormatOk('—老子·《道德经·第一章》'), false);

assert.strictEqual(guard.nearDuplicate('学而时习之，不亦说乎，有朋自远方来，不亦乐乎。', '有朋自远方来，不亦乐乎。'), true);
assert.strictEqual(guard.nearDuplicate('学而时习之，不亦说乎。', '道千乘之国，敬事而信。'), false);
assert.deepStrictEqual(guard.blocklistHits('死而后已，不亦远乎。'), ['死']);

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'extension', 'quotes.json'), 'utf8'));
assert.ok(catalog.length >= 366 && catalog.length <= 400);
assert.ok(!catalog.some((quote) => quote.text.includes('藏文仲') || quote.text.includes('君子也。若圣人') || quote.text === '钓而不纲。'));
assert.ok(catalog.some((quote) => quote.speaker === '有子' && quote.book === '论语'));
assert.ok(!catalog.some((quote) => quote.speaker === '子对' || quote.chapter === '本篇'));

assert.strictEqual(guard.t2s('寳駆諠飮擧'), '宝驱喧饮举');
assert.strictEqual(guard.t2s('乾'), '乾');
assert.strictEqual(guard.t2s('愼'), '慎');
assert.strictEqual(guard.t2s('茍'), '茍');
assert.deepStrictEqual(guard.residueChars('楚国无以为寳'), ['寳']);
assert.deepStrictEqual(guard.residueChars('乾道变化'), []);
const drink = guard.plainForMatch('子曰：「饭疏食，飮水，曲肱而枕之。」');
assert.ok(drink.includes('饮水'));
assert.ok(!drink.includes('飮'));
assert.strictEqual(guard.findExcerpt(drink, '饮水，曲肱而枕之。').text, '饮水，曲肱而枕之。');
assert.strictEqual(guard.findExcerpt('君子无所争，必也射乎。', '君子无所争。'), null);

const zhong = fs.readFileSync(path.join(classics, 'zhongyong.wikitext'), 'utf8');
const red = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'attribution-red-cases.json'), 'utf8'));
assert.strictEqual(red.cases.length, 19);
for (const row of red.cases) {
  assert.strictEqual(guard.attributionOk(zhong, {
    text: row.text,
    speaker: row.wrongSpeaker,
    book: row.book,
    chapter: row.chapter,
  }), false, row.id);
}
const forced = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'forced-no-speaker.json'), 'utf8'));
assert.strictEqual(forced.length, 5);
for (const row of forced) {
  const quote = catalog.find((item) => item.id === row.id);
  assert.ok(quote, row.id);
  assert.strictEqual(quote.speaker, undefined);
  assert.strictEqual(quote.text, row.text);
}
const outside = { text: '天命之谓性，率性之谓道，修道之谓教。', speaker: '孔子', book: '礼记', chapter: '中庸' };
assert.strictEqual(guard.attributionOk(zhong, outside), false);
assert.strictEqual(guard.attributionOk(zhong, { text: outside.text, book: '礼记', chapter: '中庸' }), true);

const yang = fs.readFileSync(path.join(classics, 'lunyu-阳货.wikitext'), 'utf8');
const gong = '恭则不侮，宽则得众，信则人任焉，敏则有功，惠则足以使人。';
assert.strictEqual(guard.attributionOk(yang, { text: gong, speaker: '孔子', book: '论语', chapter: '阳货' }), true);
assert.strictEqual(guard.attributionOk(xueer, { text: '学而时习之，不亦说乎。', speaker: '孔子', book: '论语', chapter: '学而' }), true);
assert.strictEqual(guard.attributionOk(xueer, { text: '学而时习之，不亦说乎。', speaker: '孟子', book: '论语', chapter: '学而' }), false);

const ddj = fs.readFileSync(path.join(classics, 'ddj-第一章.wikitext'), 'utf8');
assert.strictEqual(guard.attributionOk(ddj, { text: '道可道，非常道。', speaker: '老子', book: '道德经', chapter: '第一章' }), true);
assert.strictEqual(guard.attributionOk(ddj, { text: '道可道，非常道。', speaker: '孔子', book: '道德经', chapter: '第一章' }), false);

const ch17 = guard.plainForMatch(fs.readFileSync(path.join(classics, 'ddj-第十七章.wikitext'), 'utf8'));
const natural = guard.findExcerpt(ch17, '功成事遂，百姓皆谓我自然。');
assert.strictEqual(natural.text, '功成事遂，百姓皆谓：我自然。');
const ch67 = guard.plainForMatch(fs.readFileSync(path.join(classics, 'ddj-第六十七章.wikitext'), 'utf8'));
const jewels = guard.findExcerpt(ch67, '我有三宝，持而保之：一曰慈，二曰俭，三曰不敢为天下先。');
assert.ok(jewels);
assert.ok(jewels.text.includes('持而保之。'));
assert.ok(!jewels.text.includes('曰：「'));

assert.strictEqual(guard.edgePunctuation('（诚不以富，亦祇以异。'), '（', 'edge punctuation rejects a leading bracket');
assert.strictEqual(guard.edgePunctuation('尽信书。」'), '」', 'edge punctuation rejects a trailing quote mark');
assert.strictEqual(guard.edgePunctuation('尽信《书》，则不如无《书》。'), '', 'edge punctuation allows an interior title mark');

assert.strictEqual(guard.shiShuCitation(zhong, {
  text: '兄弟既翕，和乐且耽。',
  speaker: '孔子',
  book: '礼记',
  chapter: '中庸',
}), true, 'shi shu citation rejects 孔子 on dq-32563783 style');
assert.strictEqual(guard.shiShuCitation(zhong, {
  text: '宜尔室家，乐尔妻帑。',
  speaker: '孟子',
  book: '礼记',
  chapter: '中庸',
}), true, 'shi shu citation rejects 孟子 on dq-d04a26f8 style');
assert.strictEqual(guard.shiShuCitation(zhong, {
  text: '兄弟既翕，和乐且耽。',
  book: '礼记',
  chapter: '中庸',
}), false, 'shi shu citation allows an unsigned line');
assert.strictEqual(guard.shiShuCitation(xueer, {
  text: '学而时习之，不亦说乎。',
  speaker: '孔子',
  book: '论语',
  chapter: '学而',
}), false, 'shi shu citation allows 孔子 on 学而时习之');
assert.strictEqual(guard.shiShuCitation(zhong, {
  text: '君子素其位而行，不愿乎其外。',
  speaker: '孔子',
  book: '礼记',
  chapter: '中庸',
}), false, 'shi shu citation allows 孔子 after a closed poem quote');

assert.strictEqual(
  guard.shortBodyWarning({ id: 'dq-absent', text: '过犹不及。' }, []),
  'dq-absent 过犹不及。',
  'short line warns when the id is absent from the allowlist',
);
assert.strictEqual(
  guard.shortBodyWarning({ id: 'dq-c40ccc80', text: '上善若水。' }, [{ id: 'dq-c40ccc80', reason: 'complete saying' }]),
  '',
  'short line stays quiet when the id is allowlisted',
);

assert.strictEqual(guard.knownSnapshotError('茍得其养，无物不长。').pattern, '茍', 'known snapshot error rejects 茍');
assert.strictEqual(guard.knownSnapshotError('志于道，狎于德，依于仁。').pattern, '狎于德', 'known snapshot error rejects 狎于德');
assert.strictEqual(guard.knownSnapshotError('狎大人，侮圣人之言。'), null, 'known snapshot error allows 狎大人');

const relay = '孟子曰：「曾子谓子襄曰：『路人皆可为尧舜。』」';
assert.strictEqual(guard.attributionOk(relay, {
  text: '路人皆可为尧舜。',
  speaker: '孟子',
  book: '孟子',
  chapter: '公孙丑上',
}), false, 'a speaker inside 『』 is not the outer speaker');
console.log('GREEN nested 『 speaker rejects outer 孟子');
assert.strictEqual(guard.attributionOk('孟子曰：「路人皆可为尧舜。」', {
  text: '路人皆可为尧舜。',
  speaker: '孟子',
  book: '孟子',
  chapter: '公孙丑上',
}), true, 'outer speaker still governs a direct quotation');
const gongsun = fs.readFileSync(path.join(classics, 'mengzi-公孙丑上.wikitext'), 'utf8');
assert.strictEqual(guard.attributionOk(gongsun, {
  text: '自反而缩，虽千万人吾往矣。',
  speaker: '孟子',
  book: '孟子',
  chapter: '公孙丑上',
}), false, 'dq-e1a2473a is not the outer speaker');
console.log('GREEN dq-e1a2473a signed 孟子 fails');
assert.strictEqual(guard.attributionOk(gongsun, {
  text: '自反而缩，虽千万人吾往矣。',
  book: '孟子',
  chapter: '公孙丑上',
}), true, 'dq-e1a2473a may stay unsigned');

assert.strictEqual(
  guard.t2s('君子無終食之閒違仁，造次必於是，顛沛必於是。'),
  '君子无终食之间违仁，造次必于是，颠沛必于是。',
  '终食之閒 becomes 终食之间',
);
assert.strictEqual(guard.t2s('终食之閎'), '终食之间', '终食之閎 becomes 终食之间');
assert.strictEqual(guard.t2s('大德不踰閑，小德出入可也。'), '大德不逾闲，小德出入可也。', '大德不逾闲 stays 闲');
assert.strictEqual(guard.t2s('閎'), '闳', '閎 is not globally mapped to 间');
console.log('GREEN 终食之閒 and 终食之閎 become 终食之间');
console.log('GREEN 大德不逾闲 stays 闲');
console.log('GREEN 閎 stays 闳');

function signedCheck(id) {
  const root = path.join(__dirname, '..');
  const quotesPath = path.join(root, 'extension', 'quotes.json');
  const embedPath = path.join(root, 'extension', 'daily-quote.js');
  const comparisonPath = path.join(root, 'tests', 'fixtures', 'quote-comparison.json');
  const saved = [quotesPath, embedPath, comparisonPath].map((file) => [file, fs.readFileSync(file)]);
  try {
    const quotes = JSON.parse(fs.readFileSync(quotesPath, 'utf8'));
    quotes.find((item) => item.id === id).speaker = '孔子';
    fs.writeFileSync(quotesPath, JSON.stringify(quotes, null, 2) + '\n');
    const embed = fs.readFileSync(embedPath, 'utf8');
    const start = embed.indexOf('  const BUNDLED_QUOTES = [');
    const end = embed.indexOf('  /* CATALOG_END */');
    const json = JSON.stringify(quotes, null, 2).split('\n').map((line) => '  ' + line).join('\n');
    fs.writeFileSync(embedPath, embed.slice(0, start) + '  const BUNDLED_QUOTES = ' + json.trimStart() + ';\n' + embed.slice(end));
    const comparison = JSON.parse(fs.readFileSync(comparisonPath, 'utf8'));
    comparison.rows.find((item) => item.id === id).source = '孔子·《礼记·中庸》';
    fs.writeFileSync(comparisonPath, JSON.stringify(comparison, null, 2) + '\n');
    return spawnSync(process.execPath, ['scripts/check-quotes.js'], { cwd: root, encoding: 'utf8' });
  } finally {
    for (const [file, buf] of saved) fs.writeFileSync(file, buf);
  }
}
for (const id of ['dq-7cac66ea', 'dq-8dd45666']) {
  const result = signedCheck(id);
  const output = result.stdout + result.stderr;
  assert.notStrictEqual(result.status, 0, id + ' signed as 孔子 fails check-quotes');
  assert.ok(output.includes('forced no-speaker id has a speaker ' + id), id + ' failure is the never-attribute rule');
  console.log('GREEN ' + id + ' signed as 孔子 exits ' + result.status);
  const line = output.split('\n').find((item) => item.includes('forced no-speaker id has a speaker ' + id));
  console.log('GREEN ' + line);
}

const snapshotClasses = [
  ['C0', '\u0001', 'U+0001'],
  ['C1', '\u0085', 'U+0085'],
  ['zero-width', '\u200B', 'U+200B'],
  ['zero-width', '\u200C', 'U+200C'],
  ['zero-width', '\u200D', 'U+200D'],
  ['zero-width', '\u200E', 'U+200E'],
  ['zero-width', '\u200F', 'U+200F'],
  ['zero-width', '\u2060', 'U+2060'],
  ['zero-width', '\uFEFF', 'U+FEFF'],
  ['PUA', '\uE000', 'U+E000'],
  ['surrogate', String.fromCharCode(0xD800), 'U+D800'],
  ['FFFD', '\uFFFD', 'U+FFFD'],
];
for (const [kind, ch, label] of snapshotClasses) {
  const raw = '子曰：「学而时习之。」\n<!--' + ch + '-->\n';
  assert.strictEqual(guard.plainForMatch(raw).includes(ch), false, label + ' sits in a region plainForMatch strips');
  assert.deepStrictEqual(guard.invisibleHits(guard.plainForMatch(raw)), [], label + ' is absent from the stripped scan');
  assert.ok(guard.snapshotInvisibleHits(raw).some((hit) => hit.kind === kind), label + ' fails the raw snapshot scan');
  console.log('GREEN raw snapshot ' + label + ' ' + kind);
}
assert.deepStrictEqual(guard.invisibleHits('君子\uFFFD道'), [], 'library scan accepts U+FFFD');
console.log('GREEN library scan accepts U+FFFD');
assert.throws(
  () => guard.decodeSnapshot(Buffer.from([0x80])),
  (err) => err && err.code === 'INVALID_UTF8',
  'invalid UTF-8 fails the snapshot decode',
);
console.log('GREEN invalid UTF-8 byte 0x80 throws INVALID_UTF8');
assert.deepStrictEqual(guard.snapshotInvisibleHits('子曰：「学而时习之。」\n'), [], 'raw snapshot allows ordinary text');
assert.strictEqual(guard.decodeSnapshot(Buffer.from('子曰：「学而时习之。」\n', 'utf8')), '子曰：「学而时习之。」\n', 'strict UTF-8 decodes ordinary text');
console.log('GREEN ordinary snapshot text decodes and has no invisible hits');

console.log('quote guard ok');
