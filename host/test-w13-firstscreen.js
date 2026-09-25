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

const SANS_FALLBACK = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif';
const SONG_STACK = `"Songti SC", "Songti TC", "STSong", "Source Han Serif SC", "Noto Serif CJK SC", "Noto Serif SC", "Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "MS PMincho", ${SANS_FALLBACK}`;
const titleInput = ruleBlock(css, '.studio-desk .next-title, .studio-desk .next-input');
assert.ok(titleInput.includes(`font-family: ${SONG_STACK}`), 'next title and input use the Songti stack');
assert.ok(titleInput.includes('font-weight: 700'), 'next title and input are weight 700');
assert.ok(titleInput.includes('letter-spacing: -0.01em'), 'default tracking is -0.01em');
assert.ok(titleInput.includes('.next-title') && titleInput.includes('.next-input'));
const family = (titleInput.split('font-family:')[1] || '').split(';')[0];
assert.ok(family.includes(SANS_FALLBACK), 'Songti stack falls back to the system sans');
assert.ok(!/SimSun|宋体/.test(family), 'Songti stack must not name SimSun or 宋体');
assert.ok(!/(^|,)\s*serif\s*(,|$)/i.test(family), 'Songti stack must not use bare serif');
assert.ok(/letter-spacing:\s*-0\.02em/.test(ruleBlock(css, '.next-title[data-size="l"]')), 'long titles keep their own tracking');
assert.ok(day.includes('--studio-field: rgba(38, 42, 51, 0.04);'));
assert.ok(day.includes('--studio-field-hi: rgba(38, 42, 51, 0.07);'));
assert.ok(night.includes('--studio-field: rgba(255, 255, 255, 0.04);'));
assert.ok(night.includes('--studio-field-hi: rgba(255, 255, 255, 0.07);'));
assert.ok(css.includes('.studio-desk .shelf textarea.note:placeholder-shown { background: var(--studio-field); }'));
assert.ok(css.includes('.studio-desk .shelf textarea.note:placeholder-shown:hover { background: var(--studio-field-hi); }'));

// Follow-up after #44. Seven assertions for the warm-paper views and the side panel.
const panelCss = read('sidepanel.css');

function innermostRules(src) {
  const rules = [];
  for (const chunk of src.split('}')) {
    const parts = chunk.split('{');
    if (parts.length < 2) continue;
    rules.push({
      selector: parts[parts.length - 2],
      body: parts[parts.length - 1],
    });
  }
  return rules;
}

// 1. Each view's .sky is not visible.
for (const sel of [
  'body:has(.studio-desk.active) .sky',
  'body:not(.sidepanel):has(.view[data-view="tabs"].active) .sky',
  'body:not(.sidepanel):has(.view[data-view="settings"].active) .sky',
]) {
  const block = ruleBlock(css, sel);
  assert.ok(/opacity:\s*0/.test(block), `${sel} hides .sky`);
  assert.ok(/visibility:\s*hidden/.test(block), `${sel} hides .sky`);
}

// 2. Settings / current-tabs rules do not apply a backdrop blur.
//    `none` is required so it beats the shared .card blur.
const viewRules = innermostRules(css).filter((rule) => /data-view="(?:tabs|settings)"/.test(rule.selector));
assert.ok(viewRules.length > 0, 'tabs and settings rules exist');
for (const rule of viewRules) {
  const filters = [...rule.body.matchAll(/((?:-webkit-)?backdrop-filter)\s*:\s*([^;]+)/g)];
  for (const found of filters) {
    assert.strictEqual(found[2].trim(), 'none', `${found[1]} on ${rule.selector.slice(0, 60)}`);
  }
}
const viewCards = ruleBlock(css, '.view[data-view="tabs"] .card');
assert.ok(viewCards.includes('backdrop-filter: none') && viewCards.includes('-webkit-backdrop-filter: none'),
  'tabs/settings cards cancel backdrop-filter');

// 3. #name is visible and focusable in settings.
const nameInput = settings.match(/<input\b[^>]*\bid="name"[^>]*>/);
assert.ok(nameInput, '#name lives in settings');
assert.ok(!/\shidden\b/.test(nameInput[0]), '#name is not hidden');
assert.ok(!/\sdisabled\b/.test(nameInput[0]), '#name is not disabled');
assert.ok(!/tabindex\s*=\s*["']-1["']/.test(nameInput[0]), '#name is focusable');
assert.ok(/type="text"/.test(nameInput[0]), '#name is a text field');
assert.ok(settings.includes('<label for="name">'), 'settings labels #name');
const nameRegion = settings.slice(settings.indexOf('class="settings-name"'), settings.indexOf('class="settings"'));
assert.ok(nameRegion.includes('id="name"'), '#name sits in .settings-name');
assert.ok(!nameRegion.includes('sr-only'), '#name is not screen-reader only');
assert.ok(!/#name\s*\{[^}]*(?:display\s*:\s*none|visibility\s*:\s*hidden)/.test(css));
assert.ok(!/\.settings-name\s*\{[^}]*(?:display\s*:\s*none|visibility\s*:\s*hidden)/.test(css));

// 4. #tabs-sub avoids the copy already banned on the desk and in settings.
const tabsSub = html.match(/<p id="tabs-sub">([^<]*)<\/p>/);
assert.ok(tabsSub, '#tabs-sub copy');
const bannedCopy = ['我的工作台', '工作集', '工作集〔'];
for (const phrase of bannedCopy) {
  assert.ok(!tabsSub[1].includes(phrase), `#tabs-sub must not include ${phrase}`);
}

// 5. --studio-danger meets the same 4.5:1 text threshold as --studio-muted, on paper.
const dayDanger = hexToken(day, '--studio-danger');
const nightDanger = hexToken(night, '--studio-danger');
const daySolid = hexToken(day, '--studio-solid');
const nightSolid = hexToken(night, '--studio-solid');
assert.ok(contrast(dayDanger, dayPaper) >= 4.5, 'day --studio-danger vs paper');
assert.ok(contrast(nightDanger, nightPaper) >= 4.5, 'night --studio-danger vs paper');
assert.ok(contrast(dayDanger, daySolid) >= 4.5, 'day --studio-danger vs card solid');
assert.ok(contrast(nightDanger, nightSolid) >= 4.5, 'night --studio-danger vs card solid');
assert.ok(/\.view\[data-view="settings"\] \.linkbtn\.danger\s*\{[^}]*color:\s*var\(--studio-danger\)/.test(css),
  'settings danger control uses --studio-danger');

// 6. Settings / current-tabs h1 use the desk Songti stack.
const viewH1 = ruleBlock(css, '.view[data-view="tabs"] .viewhead h1');
assert.ok(viewH1.includes('.view[data-view="settings"] .viewhead h1'), 'one h1 rule covers both views');
assert.ok(viewH1.includes(`font-family: ${SONG_STACK}`), 'view h1 uses the Songti stack');

// 7. sidepanel.css: no backdrop-filter; user bubbles do not reference accent; no shared-var assignments.
assert.ok(!/backdrop-filter/.test(panelCss), 'sidepanel.css has no backdrop-filter');
const userBubbles = innermostRules(panelCss).filter((rule) => /\.msg\.user\b/.test(rule.selector) && /\.bubble\b/.test(rule.selector));
assert.ok(userBubbles.length > 0, 'user bubble rules exist');
for (const rule of userBubbles) {
  assert.ok(!/--accent/.test(rule.selector + rule.body), 'user bubbles must not reference accent');
}
const sharedAssigned = [
  '--sky-top', '--sky-mid', '--sky-low',
  '--sky-veil', '--sky-wash', '--sky-planes', '--sky-stars', '--sky-ring',
  '--ink', '--ink-2', '--ink-3',
  '--sky-ink', '--sky-ink-2', '--sky-ink-3',
  '--accent', '--accent-ink', '--accent-soft',
  '--link', '--ok', '--warn', '--danger',
  '--glass', '--glass-edge', '--glass-hi', '--struct', '--struct-edge',
  '--tile-bg', '--tile-bg-hi', '--field-bg', '--field-bg-hi',
  '--line', '--line-2', '--well', '--well-2',
  '--shadow-1', '--shadow-2', '--glow', '--mist',
];
for (const name of sharedAssigned) {
  const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`, 'g');
  assert.strictEqual((panelCss.match(re) || []).length, 0, `sidepanel.css must not assign ${name}`);
}

// Top bar shares the desk column. Not one of the seven; keeps the width fix from regressing.
assert.ok(!/width:\s*min\(\s*1240px\s*,\s*100%\s*\)/.test(css), 'no separate 1240px tabs/settings width');
const tabsMain = ruleBlock(css, 'body:not(.sidepanel):has(.view[data-view="tabs"].active) .main');
assert.ok(tabsMain.includes('data-view="settings"'), 'settings main shares the tabs column rule');
assert.ok(tabsMain.includes('max-width: calc(1040px + 64px)'));
assert.ok(tabsMain.includes('padding-left: 32px') && tabsMain.includes('padding-right: 32px'));
const narrowMain = ruleBlock(css, '@media (max-width: 600.98px)');
assert.ok(narrowMain.includes('data-view="tabs"') && narrowMain.includes('data-view="settings"'));
assert.ok(narrowMain.includes('padding-left: 20px') && narrowMain.includes('padding-right: 20px'));
assert.ok(/\.groups\s*\{[^}]*repeat\(\s*auto-fill\s*,\s*minmax\(\s*300px\s*,\s*1fr\s*\)\s*\)/.test(css),
  'grouping grid is auto-fill minmax(300px, 1fr)');

console.log('test-w13-firstscreen: ok');
