'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..');
const EXT = path.join(REPO, 'extension');

function listProduct(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'vendor' || name === 'test-gates.js') continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) listProduct(full, acc);
    else if (/\.(js|html|css)$/.test(name)) acc.push(full);
  }
  return acc;
}

const sources = listProduct(EXT, []);
const banned = ['desk-companion', 'deskCompanion', 'desk-fog', '显示桌面软团', '重置软团位置', '软团', '宠物'];

assert.ok(!fs.existsSync(path.join(EXT, 'desk-companion.js')), 'companion module is removed from the extension');
assert.ok(sources.some((file) => path.basename(file) === 'newtab.html'), 'product html is part of the scan');
for (const file of sources) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(REPO, file);
  for (const token of banned) {
    assert.ok(!src.includes(token), `${rel} still has ${token}`);
  }
}

console.log('test-desk-companion: removed');
