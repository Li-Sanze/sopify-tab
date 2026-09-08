'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const EXT = path.join(__dirname, '..', 'extension');
const sky = require(path.join(EXT, 'sky.js'));

function read(name) {
  return fs.readFileSync(path.join(EXT, name), 'utf8');
}

const themeCss = read('theme.css');
const newtabCss = read('newtab.css');
const panelCss = read('sidepanel.css');
const newtabHtml = read('newtab.html');
const panelHtml = read('sidepanel.html');
const skySrc = read('sky.js');

const dayBlock = themeCss.slice(themeCss.indexOf(':root,'), themeCss.indexOf('html[data-sky="night"]'));
const nightBlock = themeCss.slice(themeCss.indexOf('html[data-sky="night"]'), themeCss.indexOf('body {'));

for (const name of ['--sky-top', '--sky-mid', '--sky-low', '--sky-veil', '--sky-wash', '--sky-planes', '--sky-stars', '--glow', '--mist', '--glass-hi']) {
  assert.ok(dayBlock.includes(`${name}:`), `day table must define ${name}`);
  assert.ok(nightBlock.includes(`${name}:`), `night table must define ${name}`);
}

assert.ok(themeCss.includes('var(--sky-veil)'), 'sky base must stack the veil layer');
assert.ok(themeCss.includes('var(--sky-wash)'), 'sky must paint the wash layer');
assert.ok(themeCss.includes('var(--sky-planes)'), 'sky must paint abstract depth planes');
assert.ok(themeCss.includes('var(--sky-stars)'), 'sky must paint the CSS star layer');
assert.ok(/--sky-stars:\s*none/.test(dayBlock), 'day has no starfield');
assert.ok((nightBlock.match(/radial-gradient\((?:0\.\d+|1(?:\.\d+)?)px/g) || []).length >= 10,
  'night starfield is sparse CSS dots');
assert.ok(!/@keyframes\s+twinkle/.test(themeCss), 'no twinkle spam');
assert.ok(!/\.planet|\.moon-disk|\.cityscape|\.cyber-/.test(themeCss), 'no scenery props in the sky table');
assert.ok(!/--sky-ring|conic-gradient|ellipse\s+at/.test(themeCss),
  'planetary rings are pending audit — not in this push');
assert.ok(themeCss.includes('.sky::before'), 'wash lives on a CSS layer, not extra chrome');
assert.ok(themeCss.includes('@keyframes sky-calm'), 'calm motion is a named CSS keyframe');
assert.ok(/html\[data-sky-motion="calm"\]/.test(themeCss), 'motion is opt-in via data-sky-motion=calm');
assert.ok(/--sky-calm:\s*240s/.test(themeCss), 'calm drift must stay very slow');
assert.ok(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)[\s\S]*animation:\s*none/.test(themeCss),
  'theme.css must disable sky motion under prefers-reduced-motion');
assert.ok(/@keyframes sky-aurora/.test(themeCss), 'night Calm may pulse aurora slowly');
assert.ok(/html\[data-sky="night"\]\[data-sky-motion="calm"\]/.test(themeCss),
  'aurora pulse is night Calm only');

assert.strictEqual(sky.DEFAULT_MOTION, 'calm');
assert.strictEqual(sky.resolveSkyMotion(false), 'calm');
assert.strictEqual(sky.resolveSkyMotion(true), 'still');
assert.strictEqual(sky.resolveSkyMotion(undefined), 'calm');

const motionRoot = { dataset: {} };
assert.strictEqual(sky.applySkyMotion(motionRoot, false), 'calm');
assert.strictEqual(motionRoot.dataset.skyMotion, 'calm');
assert.strictEqual(sky.applySkyMotion(motionRoot, true), 'still');
assert.strictEqual(motionRoot.dataset.skyMotion, 'still');

const themeRoot = { dataset: {}, style: {} };
sky.applyToRoot(themeRoot, 'night', false);
assert.strictEqual(themeRoot.dataset.sky, 'night');
assert.strictEqual(themeRoot.dataset.skyMotion, undefined);

assert.ok(!/chrome\.storage\.local\.set\(\s*\{[^}]*skyMotion/.test(skySrc), 'skyMotion must not persist');
assert.ok(!/storage\.sync/.test(skySrc));

for (const page of [newtabHtml, panelHtml]) {
  assert.ok(page.includes('class="sky"'), 'pages must keep the shared sky stage');
  assert.ok(page.includes('class="glow"') && page.includes('class="mist"'));
  assert.ok(!/<canvas|<video|WebGL|webgl|THREE\b|wallpaper|particle/i.test(page));
}

for (const src of [themeCss, newtabCss, panelCss, skySrc]) {
  assert.ok(!/WebGL|webgl|THREE\b|<canvas|<video/i.test(src), 'CSS-only sky: no canvas/video/WebGL');
  assert.ok(!/wallpaper-store|particle-wall|requestAnimationFrame/.test(src));
}

const desk = newtabHtml.slice(newtabHtml.indexOf('data-view="desk"'), newtabHtml.indexOf('data-view="tabs"'));
assert.ok(!/skyMotion|sky-motion|壁纸|wallpaper/i.test(desk), 'desk first screen stays quiet');
assert.ok(!/name="skyMotion"/.test(newtabHtml), 'no motion control chrome');
assert.ok(!/天气|番茄|壁纸|搜索栏|focus timer|quote/i.test(desk), 'no moodboard chrome on the desk');

assert.ok(newtabCss.includes('inset 0 1px 0 var(--glass-hi)'), 'desk glass uses the shared hairline token');
assert.ok(panelCss.includes('inset 0 1px 0 var(--glass-hi)'), 'side panel uses the same glass hairline token');
assert.ok(/backdrop-filter:\s*blur\(26px\)/.test(newtabCss) && /backdrop-filter:\s*blur\(26px\)/.test(panelCss),
  'glass keeps one backdrop blur per surface');
assert.ok(!/backdrop-filter:[^;]*saturate/.test(newtabCss + panelCss), 'do not restore saturate glass');
assert.ok(/--glass:\s*rgba\(\s*253,\s*252,\s*249,\s*0\.9\s*\)/.test(dayBlock), 'day card fill stays ≥ current opacity');
assert.ok(/--glass:\s*rgba\(\s*18,\s*26,\s*40,\s*0\.8\s*\)/.test(nightBlock), 'night card fill stays ≥ current opacity');
assert.ok(dayBlock.includes('--sky-ink: #12203a') && dayBlock.includes('--ink: #182234'),
  'day desk ink tokens stay current');
assert.ok(nightBlock.includes('--sky-ink: #f3f6fb') && nightBlock.includes('--ink: #e9eef6'),
  'night desk ink tokens stay current');

assert.deepStrictEqual(sky.PRESETS, ['system', 'day', 'night']);
assert.ok(!/hostUpstream|--force|cursor-agent/.test(themeCss), 'sky files must not touch Host/Claude contracts');
assert.ok(!/html\s*\{\s*background-color/.test(themeCss),
  'do not paint html background; it hides the z-index:-1 sky');

console.log('test-sky-layers: ok');
