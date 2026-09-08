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
const nightBlock = themeCss.slice(themeCss.indexOf('html[data-sky="night"]'), themeCss.indexOf('html {'));

for (const name of ['--sky-top', '--sky-mid', '--sky-low', '--sky-veil', '--sky-wash', '--glow', '--mist', '--glass-hi']) {
  assert.ok(dayBlock.includes(`${name}:`), `day table must define ${name}`);
  assert.ok(nightBlock.includes(`${name}:`), `night table must define ${name}`);
}

assert.ok(themeCss.includes('var(--sky-veil)'), 'sky base must stack the veil layer');
assert.ok(themeCss.includes('var(--sky-wash)'), 'sky must paint the wash layer');
assert.ok(themeCss.includes('.sky::before'), 'wash lives on a CSS layer, not extra chrome');
assert.ok(themeCss.includes('@keyframes sky-calm'), 'calm motion is a named CSS keyframe');
assert.ok(/html\[data-sky-motion="calm"\]/.test(themeCss), 'motion is opt-in via data-sky-motion=calm');
assert.ok(/--sky-calm:\s*240s/.test(themeCss), 'calm drift must stay very slow');
assert.ok(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)[\s\S]*\.sky::before[\s\S]*animation:\s*none/.test(themeCss),
  'theme.css must disable sky motion under prefers-reduced-motion');

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

assert.ok(newtabCss.includes('inset 0 1px 0 var(--glass-hi)'), 'desk glass uses the shared hairline token');
assert.ok(panelCss.includes('inset 0 1px 0 var(--glass-hi)'), 'side panel uses the same glass hairline token');
assert.ok(!/backdrop-filter:[^;]*saturate/.test(newtabCss + panelCss), 'do not restore saturate glass');

assert.deepStrictEqual(sky.PRESETS, ['system', 'day', 'night']);
assert.ok(!/hostUpstream|--force|cursor-agent/.test(themeCss), 'sky files must not touch Host/Claude contracts');

console.log('test-sky-layers: ok');
