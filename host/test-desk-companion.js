'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..');
const EXT = path.join(REPO, 'extension');

function read(name) {
  return fs.readFileSync(path.join(EXT, name), 'utf8');
}

const html = read('newtab.html');
const css = read('newtab.css');
const newtabJs = read('newtab.js');
const readme = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
const deskReadme = fs.readFileSync(path.join(EXT, 'desk-3d', 'README.md'), 'utf8');
const banned = ['desk-companion', 'deskCompanion', 'desk-fog', '显示桌面软团', '重置软团位置'];

assert.ok(!fs.existsSync(path.join(EXT, 'desk-companion.js')), 'companion module is removed from the extension');
for (const token of banned) {
  assert.ok(!html.includes(token), `newtab.html still has ${token}`);
  assert.ok(!css.includes(token), `newtab.css still has ${token}`);
  assert.ok(!newtabJs.includes(token), `newtab.js still has ${token}`);
  assert.ok(!readme.includes(token), `README still has ${token}`);
  assert.ok(!deskReadme.includes(token), `desk-3d README still has ${token}`);
}
assert.ok(!html.includes('软团') && !readme.includes('软团') && !deskReadme.includes('软团'));
assert.ok(!/宠物/.test(html) && !/宠物/.test(readme));

console.log('test-desk-companion: removed');
