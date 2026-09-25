'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const EXT = path.join(__dirname, '..', 'extension');

function read(name) {
  return fs.readFileSync(path.join(EXT, name), 'utf8');
}

function relChannel(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = relChannel((n >> 16) & 255);
  const g = relChannel((n >> 8) & 255);
  const b = relChannel(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const L1 = luminance(a);
  const L2 = luminance(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

function ruleBlock(css, start) {
  const i = css.indexOf(start);
  assert.ok(i !== -1, `missing ${start}`);
  const j = css.indexOf('}', i);
  return css.slice(i, j);
}

function hexToken(block, name) {
  const m = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `${name} missing in ${block.slice(0, 40)}`);
  return m[1].toLowerCase();
}

const html = read('newtab.html');
const css = read('newtab.css');
const js = read('newtab.js');
const boot = read('desk-3d/boot.js');
const desk = html.slice(html.indexOf('data-view="desk"'), html.indexOf('data-view="tabs"'));
const settings = html.slice(html.indexOf('data-view="settings"'));

assert.ok(!html.includes('我的工作台'));
assert.ok(!html.includes('studio-theme-toggle'));
assert.ok(!desk.includes('工作集') && !settings.includes('工作集'));
assert.ok(html.includes('接着上次') && html.includes('保存这个窗口') && html.includes('存下的窗口'));

const whitelist = new Set(['todo-input-dialog']);
const ids = [...js.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]);
for (const id of new Set(ids)) {
  if (whitelist.has(id) || id.startsWith('desk3d-')) continue;
  assert.ok(html.includes(`id="${id}"`), `ungarded $('#${id}') must exist in newtab.html`);
}

assert.ok(boot.includes('import('));
assert.ok(!/import\s+[^;]*from\s+['"]\.\/embed\.js['"]/.test(boot));

assert.ok(/let spaceViewOn = false/.test(js));
assert.ok(js.includes('data.spaceView === true'));
assert.ok(!/localStorage/.test(js));
assert.ok(!/DESK_KEYS = \[[^\]]*spaceView/.test(js));

const day = ruleBlock(css, 'html[data-sky="day"]');
const night = ruleBlock(css, 'html[data-sky="night"]');
const dayPaper = hexToken(day, '--studio-paper');
const dayMuted = hexToken(day, '--studio-muted');
const dayFaint = hexToken(day, '--studio-faint');
const nightPaper = hexToken(night, '--studio-paper');
const nightMuted = hexToken(night, '--studio-muted');
const nightFaint = hexToken(night, '--studio-faint');
assert.ok(contrast(dayMuted, dayPaper) >= 4.5, 'day secondary text contrast');
assert.ok(contrast(dayFaint, dayPaper) >= 3, 'day placeholder contrast');
assert.ok(contrast(nightMuted, nightPaper) >= 4.5, 'night secondary text contrast');
assert.ok(contrast(nightFaint, nightPaper) >= 3, 'night placeholder contrast');

const shared = ['--ink', '--ink-2', '--accent', '--line', '--line-2'];
for (const name of shared) {
  const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`, 'g');
  assert.strictEqual((css.match(re) || []).length, 0, `newtab.css must not assign ${name}`);
}

assert.ok(/id="resume"[^>]*data-has="pending"/.test(html), 'resume starts pending');
assert.ok(css.includes('.next[data-has="pending"] .next-compose { display: none; }'));
assert.ok(css.includes('.next[data-has="pending"] .next-filled { visibility: hidden; }'));
assert.ok(css.includes('.next[data-has="pending"] .next-title { min-height: 1.2em; }'));
assert.ok(/root\.dataset\.has = has \? '1' : '0'/.test(js), 'renderResume writes 0 or 1');
assert.ok(css.includes('.studio-desk .shelf textarea.note'));
assert.ok(!/\.studio-desk \.note \{/.test(css), 'note field styles must not match the 3D label');

const firstScreen = css.slice(css.indexOf('v3 first screen'));
assert.ok(firstScreen.includes('18% 40%'));
assert.ok(!firstScreen.includes('42% 42%'), 'first screen chips must not use 42% 42%');
assert.ok(firstScreen.includes('max-width: calc(1040px + 64px)'));
assert.ok(/body\.studio-home:not\(\.sidepanel\) \.main/.test(firstScreen));

const starsAt = css.indexOf('.stars-layer {');
assert.ok(starsAt !== -1);
const starsRule = css.slice(starsAt, css.indexOf('}', starsAt));
assert.ok(!/animation\s*:/.test(starsRule));
assert.ok(/html\[data-sky="night"\][^{]*\.stars-layer\s*\{[^}]*opacity:\s*1/.test(css));
assert.ok(!/<canvas/i.test(html));
assert.ok(!/getContext\s*\(\s*['"](?:webgl|experimental-webgl)['"]/i.test(html + js + css));

const SONG_STACK = '"Songti SC", "Songti TC", "STSong", "Source Han Serif SC", "Noto Serif CJK SC", "Noto Serif SC", "Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "MS PMincho"';
const titleInput = ruleBlock(css, '.next-title, .next-input');
assert.ok(titleInput.includes(`font-family: ${SONG_STACK}`), 'next title and input use the Songti stack');
assert.ok(titleInput.includes('.next-title') && titleInput.includes('.next-input'));
const family = (titleInput.split('font-family:')[1] || '').split(';')[0];
assert.ok(!/SimSun|宋体/.test(family), 'Songti stack must not name SimSun or 宋体');
assert.ok(!/(^|,)\s*serif\s*(,|$)/i.test(family), 'Songti stack must not end on bare serif');
assert.ok(day.includes('--studio-field: rgba(38, 42, 51, 0.04);'));
assert.ok(day.includes('--studio-field-hi: rgba(38, 42, 51, 0.07);'));
assert.ok(night.includes('--studio-field: rgba(255, 255, 255, 0.04);'));
assert.ok(night.includes('--studio-field-hi: rgba(255, 255, 255, 0.07);'));
assert.ok(css.includes('.studio-desk .shelf textarea.note:placeholder-shown { background: var(--studio-field); }'));
assert.ok(css.includes('.studio-desk .shelf textarea.note:placeholder-shown:hover { background: var(--studio-field-hi); }'));

console.log('test-w13-firstscreen: ok');
