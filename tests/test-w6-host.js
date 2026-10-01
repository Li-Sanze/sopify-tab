'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..');
const EXT = path.join(REPO, 'extension');
const html = fs.readFileSync(path.join(EXT, 'newtab.html'), 'utf8');
const js = fs.readFileSync(path.join(EXT, 'newtab.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));

assert.ok(!fs.existsSync(path.join(REPO, 'host', 'host.js')));
assert.ok(!fs.existsSync(path.join(REPO, 'host', 'install-host.sh')));
assert.ok(!html.includes('name="hostUpstream"'), 'upstream selector is already offline');
assert.ok(!html.includes('id="open-chat"'));
assert.ok(!html.includes('class="rail"'));
assert.ok(!js.includes('chrome.storage.local.set({ hostUpstream: next })'));
assert.ok(!/connectNative|sendNativeMessage|\bsidePanel\b|nativeMessaging/.test(js));
assert.deepStrictEqual(manifest.permissions, ['storage', 'tabs']);
assert.ok(!('optional_permissions' in manifest));
assert.strictEqual(manifest.action.default_title, 'Sopify Tab');

console.log('test-w6-host: offline ok');
