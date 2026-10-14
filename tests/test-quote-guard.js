'use strict';

const assert = require('assert');
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
assert.ok(!variant.some((quote) => quote.text.includes('艺') || quote.text.includes('执')));
assert.ok(variant.some((quote) => quote.text === '学而时习之，不亦说乎。'));

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

console.log('quote guard ok');
