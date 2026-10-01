'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..');
const EXT = path.join(REPO, 'extension');

assert.ok(!fs.existsSync(path.join(REPO, 'host', 'host.js')), 'host runtime is already offline');
assert.ok(!fs.existsSync(path.join(REPO, 'host', 'install-host.sh')), 'host installer is already offline');
for (const name of ['sidepanel.js', 'sidepanel.html', 'sidepanel.css']) {
  assert.ok(!fs.existsSync(path.join(EXT, name)), `${name} is already offline`);
}

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'vendor' || name === 'test-gates.js') continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(js|html|css|json)$/.test(name)) acc.push(full);
  }
  return acc;
}

const banned = /connectNative|sendNativeMessage|\bsidePanel\b|side_panel|nativeMessaging|openSidePanel|openPanelOnActionClick|id="open-chat"|class="rail"/;
for (const file of walk(EXT, [])) {
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(!banned.test(src), `${path.relative(REPO, file)} still has a Host or Side Panel surface`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
assert.deepStrictEqual(manifest.permissions, ['storage', 'tabs']);
assert.ok(!('optional_permissions' in manifest));
assert.ok(!('side_panel' in manifest));
assert.ok(!manifest.permissions.includes('nativeMessaging'));

console.log('test-w3-ask: offline ok');
