'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const EXT = path.join(__dirname, '..', 'extension');
const sky = require(path.join(EXT, 'sky.js'));

const SHARED_VARS = [
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

function read(name) {
  return fs.readFileSync(path.join(EXT, name), 'utf8');
}

function assignments(css, name) {
  const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`, 'g');
  return css.match(re) || [];
}

// --- resolve ---
assert.strictEqual(sky.normalizePreset('day'), 'day');
assert.strictEqual(sky.normalizePreset('night'), 'night');
assert.strictEqual(sky.normalizePreset('system'), 'system');
assert.strictEqual(sky.normalizePreset('soft'), 'system');
assert.strictEqual(sky.normalizePreset(''), 'system');
assert.strictEqual(sky.normalizePreset(undefined), 'system');
assert.deepStrictEqual(sky.PRESETS, ['system', 'day', 'night']);
assert.strictEqual(sky.STORAGE_KEY, 'themePreset');

assert.strictEqual(sky.resolveSky('day', true), 'day');
assert.strictEqual(sky.resolveSky('day', false), 'day');
assert.strictEqual(sky.resolveSky('night', true), 'night');
assert.strictEqual(sky.resolveSky('night', false), 'night');
assert.strictEqual(sky.resolveSky('system', true), 'night');
assert.strictEqual(sky.resolveSky('system', false), 'day');
assert.strictEqual(sky.resolveSky('soft', true), 'night');

const fake = { dataset: {}, style: {} };
assert.deepStrictEqual(sky.applyToRoot(fake, 'night', false), { preset: 'night', sky: 'night' });
assert.strictEqual(fake.dataset.theme, 'night');
assert.strictEqual(fake.dataset.sky, 'night');
assert.strictEqual(fake.style.colorScheme, 'dark');
sky.applyToRoot(fake, 'day', true);
assert.strictEqual(fake.dataset.theme, 'day');
assert.strictEqual(fake.dataset.sky, 'day');
assert.strictEqual(fake.style.colorScheme, 'light');
sky.applyToRoot(fake, 'system', true);
assert.strictEqual(fake.dataset.theme, 'system');
assert.strictEqual(fake.dataset.sky, 'night');

// --- shared table lives only in theme.css ---
const themeCss = read('theme.css');
const newtabCss = read('newtab.css');
for (const name of SHARED_VARS) {
  assert.ok(themeCss.includes(`${name}:`), `theme.css must define ${name}`);
  assert.strictEqual(assignments(newtabCss, name).length, 0, `newtab.css must not assign ${name}`);
}
assert.ok(!/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/.test(themeCss + newtabCss),
  'OS media query must not set skin tokens (manual day/night must not fight OS)');
for (const gone of ['sidepanel.css', 'sidepanel.html', 'sidepanel.js']) {
  assert.ok(!fs.existsSync(path.join(EXT, gone)), `${gone} is already offline`);
}

// --- head order + early sky.js ---
for (const page of ['newtab.html']) {
  const html = read(page);
  const skyAt = html.indexOf('src="sky.js"');
  const themeAt = html.indexOf('href="theme.css"');
  const cssAt = html.indexOf('href="newtab.css"');
  assert.ok(skyAt !== -1 && themeAt !== -1 && cssAt !== -1, `${page} must load sky.js + theme.css + newtab.css`);
  assert.ok(skyAt < themeAt && themeAt < cssAt, `${page} must load sky.js then theme.css then newtab.css`);
  const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
  const firstScript = head.match(/<script\b[^>]*>/);
  assert.ok(firstScript && /src="sky\.js"/.test(firstScript[0]), `${page} first script must be sky.js`);
}

// --- settings 外观; no desk theme wall ---
const newtabHtml = read('newtab.html');
const desk = newtabHtml.slice(newtabHtml.indexOf('data-view="desk"'), newtabHtml.indexOf('data-view="tabs"'));
const settings = newtabHtml.slice(newtabHtml.indexOf('data-view="settings"'));
assert.ok(settings.includes('外观'), 'settings must have 外观');
assert.ok(settings.includes('name="themePreset"'), 'settings must have themePreset radios');
assert.ok(settings.includes('value="system"') && settings.includes('value="day"') && settings.includes('value="night"'));
assert.ok(!desk.includes('themePreset'), 'desk first screen must not have theme radios');
assert.ok(!desk.includes('外观'), 'desk first screen must not have 外观');
assert.ok(!newtabHtml.includes('soft'), 'soft preset is out of scope');
assert.ok(!/thumbnail|preview-wall|theme-store|wallpaper/i.test(newtabHtml));

// --- desk-only permissions; no proxy; Host and Side Panel already offline ---
const manifest = JSON.parse(read('manifest.json'));
assert.deepStrictEqual(manifest.permissions, ['storage', 'tabs']);
assert.ok(!('optional_permissions' in manifest));
assert.ok(!('side_panel' in manifest));
assert.strictEqual(manifest.action.default_title, 'Sopify Tab');
assert.ok(!('proxy' in (manifest.host_permissions || {})));
assert.ok(!manifest.permissions.includes('proxy'));
const extFiles = fs.readdirSync(EXT).filter((f) => /\.(js|html|css|json)$/.test(f));
const offline = /connectNative|sendNativeMessage|\bsidePanel\b|side_panel|nativeMessaging|openSidePanel|openPanelOnActionClick|id="open-chat"|class="rail"/;
for (const f of extFiles) {
  const src = read(f);
  assert.ok(!/chrome\.proxy|browser\.proxy/.test(src), `${f} must not use chrome.proxy`);
  assert.ok(!/storage\.sync/.test(src), `${f} must not use chrome.storage.sync`);
  assert.ok(!offline.test(src), `${f} still has a Host or Side Panel surface`);
}

const bg = read('background.js');
assert.ok(bg.includes('chrome.action.onClicked'), 'toolbar opens the desk');
assert.ok(bg.includes('tabs.create'));
assert.ok(!offline.test(bg));

// --- B leftovers still intact (not redesigned) ---
const newtabJs = read('newtab.js');
assert.ok(newtabJs.includes('const WORKSET_CAP = 5'));
assert.ok(newtabJs.includes('bindFaviconFallback'));
assert.ok(newtabJs.includes('月') && newtabJs.includes('星期'));
assert.ok(!/date-line[\s\S]{0,80}待办/.test(newtabJs));

console.log('test-w4-theme: ok');
