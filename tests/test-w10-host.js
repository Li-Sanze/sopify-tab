'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..');
const EXT = path.join(REPO, 'extension');
const html = fs.readFileSync(path.join(EXT, 'newtab.html'), 'utf8');
const deskEnd = html.indexOf('data-view="tabs"');
const desk = html.slice(html.indexOf('data-view="desk"'), deskEnd);

assert.ok(!fs.existsSync(path.join(EXT, 'sidepanel.html')));
assert.ok(!fs.existsSync(path.join(EXT, 'sidepanel.js')));
assert.ok(!fs.existsSync(path.join(EXT, 'sidepanel.css')));
assert.ok(!desk.includes('hostUpstream'));
assert.ok(!/class="rail"/.test(html));
assert.ok(!/name="hostUpstream"/.test(html));
assert.ok(!fs.existsSync(path.join(REPO, 'host', 'host.js')));
assert.ok(!fs.existsSync(path.join(REPO, 'host', 'install-host.sh')));

console.log('test-w10-host: offline ok');
