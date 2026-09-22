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
assert.ok(data.includes('NOTE_ID'));
assert.ok(data.includes('MAX_DESK_WORKSETS'));
assert.ok(data.includes('PICK_PRIMARY'));
assert.ok(!data.includes('DEMO_WORKSETS'));
assert.ok(!/\bWORKSETS\s*=/.test(data));
assert.ok(!data.includes('DEMO_TODOS'));
assert.ok(!data.includes('DEFAULT_NOTES'));
assert.ok(!data.includes('NOTE_SESSION_KEY'));
assert.ok(!data.includes('TOGGLE_SESSION_KEY'));
assert.ok(!data.includes('sopify-desk3d-notes'));
assert.ok(!data.includes('专注工作集'));
assert.ok(!data.includes('调研工作集'));
assert.ok(!data.includes('便签 A'));
assert.ok(!data.includes('便签 B'));
assert.ok(!data.includes('sopify-spatial-demo'));
assert.ok(!/FOLDER_SLOTS\s*=\s*\[[^\]]{80,}/.test(data), 'desk shows at most two workset slots');

const html = read('extension/newtab.html');
assert.ok(html.includes('id="resume"') && html.includes('下一件事'));
assert.ok(html.includes('id="desk-3d-mount"'));
assert.ok(html.includes('href="desk-3d/desk-3d.css"'));
assert.ok(html.includes('src="desk-3d/boot.js"'));
assert.ok(html.includes('studio-desk') || html.includes('studio-body'));
assert.ok(html.includes('workset-view') && html.includes('>查看<'));
assert.ok(html.includes('workset-save') && html.includes('>保存<'));
assert.ok(html.includes('workset-restore-recent') && html.includes('>恢复<'));
assert.ok(html.indexOf('id="resume"') < html.indexOf('id="desk-3d-mount"'));
assert.ok(html.indexOf('id="desk-3d-mount"') < html.indexOf('h-sites') || html.indexOf('id="desk-3d-mount"') < html.indexOf('常用站'));
assert.ok(!/<canvas|<video|WebGL|webgl|THREE\b|wallpaper|particle/i.test(html));
assert.ok(!html.includes('soft'));
assert.ok(!html.includes('打开：'));
assert.ok(!html.includes('编辑：随手记'));

const newtabCss = read('extension/newtab.css');
assert.ok(!/WebGL|webgl|THREE\b|<canvas|<video/i.test(newtabCss));
assert.ok(/#desk-3d-mount/.test(newtabCss) || /\.desk-stage/.test(newtabCss));
assert.ok(/\.resume[\s\S]*z-index:\s*12/.test(newtabCss), '#resume stays above the 3D mount');
assert.ok(/#desk-3d-mount[\s\S]*z-index:\s*8/.test(newtabCss), '3D mount stays below #resume');

const scene = read('extension/desk-3d/scene.js');
assert.ok(scene.includes("from './vendor/three/three.module.js'"));
assert.ok(scene.includes('shadowMap.enabled = false'));
assert.ok(!/window\.addEventListener/.test(scene));
assert.ok(scene.includes('ResizeObserver'));
assert.ok(scene.includes('requestAnimationFrame'));
assert.ok(scene.includes('_setLoop') && scene.includes('desk3dLoop'));
assert.ok(scene.includes('setCatalog'));
assert.ok(scene.includes('setTheme'));
assert.ok(scene.includes('OrthographicCamera') || scene.includes('MAX_DESK_WORKSETS'));
assert.ok(!/chrome\.(storage|tabs)/.test(scene));
assert.ok(!scene.includes('专注工作集'));
assert.ok(!scene.includes('调研工作集'));
assert.ok(!scene.includes("'n1'") && !scene.includes("'n2'"));
assert.ok(!scene.includes('sopify-spatial-demo'));
assert.ok(!scene.includes('宠物'));
assert.ok(scene.includes('dispose'));

const embed = read('extension/desk-3d/embed.js');
assert.ok(embed.includes('IntersectionObserver'));
assert.ok(embed.includes('forceFail') || embed.includes("desk3d") && embed.includes('fail'));
assert.ok(embed.includes('failReason') && embed.includes('markUnavailable'));
assert.ok(embed.includes('WebGL 不可用'));
assert.ok(embed.includes('defaultWant3d'));
assert.ok(embed.includes('getWorksets'));
assert.ok(embed.includes('restoreWorkset'));
assert.ok(!/window\.addEventListener/.test(embed));
assert.ok(!/sessionStorage/.test(embed), 'no desk-3d sessionStorage paths');
assert.ok(!/chrome\.(storage|tabs)\.(local|sync|get|set|create|update|query|remove)/.test(embed));

const ui = read('extension/desk-3d/ui.js');
assert.ok(ui.includes('openFromScene'));
assert.ok(ui.includes('--next-h'));
assert.ok(ui.includes('--resume-bottom'));
assert.ok(ui.includes('restoreWorkset'));
assert.ok(ui.includes('desk3d-btn-restore'));
assert.ok(ui.includes('还没有保存的工作集'));
assert.ok(!/sessionStorage/.test(ui), 'notes must not use sessionStorage');
assert.ok(!ui.includes('simulate-restore'));
assert.ok(!ui.includes('模拟恢复'));
assert.ok(!ui.includes('已模拟恢复'));
assert.ok(!ui.includes('DEMO_TODOS'));
assert.ok(!ui.includes('NOTE_SESSION_KEY'));
assert.ok(!/chrome\.(storage|tabs)\.(local|sync|get|set|create|update|query|remove)/.test(ui));

const markup = read('extension/desk-3d/markup.js');
assert.ok(markup.includes('desk3d-btn-restore'));
assert.ok(markup.includes('>恢复<'));
assert.ok(markup.includes('desk3d-label-primary'));
assert.ok(markup.includes('desk3d-label-note'));
assert.ok(markup.includes('空间视图'));
assert.ok(!markup.includes('桌面入口'));
assert.ok(!markup.includes('打开：'));
assert.ok(!markup.includes('模拟恢复'));
assert.ok(!markup.includes('演示数据'));
assert.ok(!markup.includes('演示舞台'));
assert.ok(!markup.includes('sessionStorage'));
assert.ok(!markup.includes('专注工作集'));
assert.ok(!markup.includes('调研工作集'));
assert.ok(!markup.includes('便签 A'));
assert.ok(!markup.includes('便签 B'));
assert.ok(!markup.includes('data-desk3d-workset="focus"'));
assert.ok(!markup.includes('交互示范'));
assert.ok(!markup.includes('STUDIO / 03'));
assert.ok(!markup.includes('重置示范'));

const boot = read('extension/desk-3d/boot.js');
assert.ok(boot.includes("resumeSelector: '#resume'"));
assert.ok(boot.includes('window.SopifyDesk3d'));
assert.ok(boot.includes('defaultWant3d'));
assert.ok(boot.includes('restoreWorkset'));
assert.ok(!/chrome\.(storage|tabs)/.test(boot));
assert.ok(!/sessionStorage/.test(boot));

const newtabJs = read('extension/newtab.js');
assert.ok(newtabJs.includes('window.SopifyDesk3d'));
assert.ok(newtabJs.includes('defaultWant3d: true'));
assert.ok(newtabJs.includes('restoreWorksetById'));
assert.ok(newtabJs.includes('restoreWorkset: function (id) { return restoreWorksetById(id); }'));
assert.ok(newtabJs.includes('saveDesk({ notes: state.notes })'));
assert.ok(newtabJs.includes('cloneDesk3dWorksets'));
assert.ok(!/sopify-desk3d-notes/.test(newtabJs));

const ownJs = walk(DESK, []).filter((f) => (
  f.endsWith('.js')
  && !f.includes(`${path.sep}vendor${path.sep}`)
  && path.basename(f) !== 'test-gates.js'
));
for (const file of ownJs) {
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(!/chrome\.storage\.(local|sync)\.(get|set)/.test(src), `${file} must not write chrome.storage`);
  assert.ok(!/chrome\.tabs\.(create|update|query|remove)/.test(src), `${file} must not call chrome.tabs`);
  assert.ok(!/window\.addEventListener/.test(src), `${file} must not use window-level listeners`);
  assert.ok(!/sessionStorage/.test(src), `${file} must not use sessionStorage`);
  assert.ok(!/sopify-desk3d-notes/.test(src), `${file} must not seed demo notes`);
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
assert.ok(!proto.includes('专注工作集'));

const readme = read('README.md');
assert.ok(!readme.includes('演示工作集不恢复真实标签'));
assert.ok(!readme.includes('演示便签只进本页'));
assert.ok(readme.includes('restoreWorksetById') || readme.includes('真实工作集'));

const deskReadme = read('extension/desk-3d/README.md');
assert.ok(!deskReadme.includes('演示数据只写'));
assert.ok(deskReadme.includes('window.SopifyDesk3d') || deskReadme.includes('newtab.js'));

const manifest = JSON.parse(read('extension/manifest.json'));
assert.deepStrictEqual(manifest.permissions, ['storage', 'tabs', 'sidePanel']);
assert.deepStrictEqual(manifest.optional_permissions, ['nativeMessaging']);

console.log('test-desk-3d-gates: ok', { vendorBytes });
