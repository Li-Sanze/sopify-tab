'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..', '..');
const EXT = path.join(REPO, 'extension');
const HOST = path.join(REPO, 'host');
const DESK = path.join(EXT, 'desk-3d');
const VENDOR = path.join(DESK, 'vendor', 'three', 'three.module.js');

function read(rel) {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

const vendorBytes = fs.statSync(VENDOR).size;
assert.ok(vendorBytes > 1_000_000 && vendorBytes < 2_000_000, 'Three ESM should be ~1.25 MiB');
assert.ok(read('extension/desk-3d/vendor/three/three.module.js').includes("REVISION = '170'"));
assert.ok(read('extension/desk-3d/vendor/three/LICENSE').includes('MIT License'));

const data = read('extension/desk-3d/data.js');
assert.ok(data.includes('bytes: 1314681'));
assert.ok(data.includes("version: '0.170.0'"));

const html = read('extension/newtab.html');
assert.ok(html.includes('id="resume"') && html.includes('下一件事'));
assert.ok(html.includes('id="desk-3d-mount"'));
assert.ok(html.includes('href="desk-3d/desk-3d.css"'));
assert.ok(html.includes('src="desk-3d/boot.js"'));
assert.ok(html.indexOf('id="resume"') < html.indexOf('id="desk-3d-mount"'));
assert.ok(html.indexOf('id="desk-3d-mount"') < html.indexOf('class="deskgrid"'));
assert.ok(!/<canvas|<video|WebGL|webgl|THREE\b|wallpaper|particle/i.test(html));
assert.ok(!html.includes('soft'));

const newtabCss = read('extension/newtab.css');
assert.ok(!/WebGL|webgl|THREE\b|<canvas|<video/i.test(newtabCss));
assert.ok(/#desk-3d-mount/.test(newtabCss) || /\.desk-stage/.test(newtabCss));

const scene = read('extension/desk-3d/scene.js');
assert.ok(scene.includes("from './vendor/three/three.module.js'"));
assert.ok(scene.includes('shadowMap.enabled = false'));
assert.ok(!/window\.addEventListener/.test(scene));
assert.ok(scene.includes('ResizeObserver'));
assert.ok(scene.includes('requestAnimationFrame'));
assert.ok(!/chrome\.(storage|tabs)/.test(scene));

const embed = read('extension/desk-3d/embed.js');
assert.ok(embed.includes('IntersectionObserver'));
assert.ok(embed.includes('forceFail') || embed.includes("desk3d") && embed.includes('fail'));
assert.ok(embed.includes('failReason') && embed.includes('markUnavailable'));
assert.ok(embed.includes('WebGL 不可用'));
assert.ok(!/window\.addEventListener/.test(embed));
assert.ok(!/chrome\.(storage|tabs)\.(local|sync|get|set|create|update|query|remove)/.test(embed));

const ui = read('extension/desk-3d/ui.js');
assert.ok(ui.includes('sessionStorage'));
assert.ok(ui.includes('openFromScene'));
assert.ok(ui.includes('--next-h'));
assert.ok(ui.includes('--resume-bottom'));
assert.ok(!/chrome\.(storage|tabs)\.(local|sync|get|set|create|update|query|remove)/.test(ui));

const boot = read('extension/desk-3d/boot.js');
assert.ok(boot.includes("resumeSelector: '#resume'"));
assert.ok(!/chrome\.(storage|tabs)/.test(boot));

const ownJs = walk(DESK, []).filter((f) => f.endsWith('.js') && !f.includes(`${path.sep}vendor${path.sep}`));
for (const file of ownJs) {
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(!/chrome\.storage\.(local|sync)\.(get|set)/.test(src), `${file} must not write chrome.storage`);
  assert.ok(!/chrome\.tabs\.(create|update|query|remove)/.test(src), `${file} must not call chrome.tabs`);
  assert.ok(!/window\.addEventListener/.test(src), `${file} must not use window-level listeners`);
}

const threeFiles = [];
for (const root of [EXT, path.join(REPO, 'prototype'), HOST]) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root, [])) {
    if (/three\.module\.js$/.test(file)) threeFiles.push(path.relative(REPO, file));
  }
}
assert.deepStrictEqual(
  threeFiles,
  ['extension/desk-3d/vendor/three/three.module.js'],
  'Three vendor lives only under extension/desk-3d'
);

const hostFiles = walk(HOST, []);
for (const file of hostFiles) {
  const rel = path.relative(REPO, file);
  if (file.endsWith('three.module.js')) {
    assert.fail(`host must not vendor Three: ${rel}`);
  }
}

const topLevel = fs.readdirSync(EXT).filter((f) => /\.(js|css|html)$/.test(f));
for (const name of topLevel) {
  const src = fs.readFileSync(path.join(EXT, name), 'utf8');
  assert.ok(!/\bimport\s+[^;]*from\s+['"][^'"]*three/i.test(src), `${name} must not import Three`);
  assert.ok(!/\bgetContext\s*\(\s*['"](?:webgl|experimental-webgl)['"]/i.test(src),
    `${name} must not open a WebGL context`);
}

const proto = read('prototype/desk-3d/index.html');
assert.ok(proto.includes('id="next-thing"'));
assert.ok(proto.includes('id="desk-3d-mount"'));

console.log('test-desk-3d-gates: ok', { vendorBytes });
