'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..');
const EXT = path.join(REPO, 'extension');
const fog = require(path.join(EXT, 'desk-companion.js'));

function read(name) {
  return fs.readFileSync(path.join(EXT, name), 'utf8');
}

const html = read('newtab.html');
const css = read('newtab.css');
const js = read('desk-companion.js');
const newtabJs = read('newtab.js');
const manifest = JSON.parse(read('manifest.json'));
const readme = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
const desk = html.slice(html.indexOf('aria-labelledby="greet-h"'), html.indexOf('aria-labelledby="tabs-h"'));
const settings = html.slice(html.indexOf('aria-labelledby="settings-h"'));

assert.strictEqual(fog.STORAGE_KEY, 'deskCompanion');
assert.deepStrictEqual(fog.DEFAULT_COMPANION, { enabled: true, x: 1, y: 1, motion: 'full' });
assert.ok(fog.SIZE >= 56 && fog.SIZE <= 72, 'blob size stays in 56–72px');
assert.strictEqual(fog.DRAG_THRESHOLD, 4);
assert.ok(fog.STRETCH_MAX <= 1.18);
assert.ok(fog.REBOUND_MS <= 280);

assert.deepStrictEqual(fog.normalizeDeskCompanion(null), fog.DEFAULT_COMPANION);
assert.deepStrictEqual(fog.normalizeDeskCompanion(undefined), fog.DEFAULT_COMPANION);
assert.deepStrictEqual(fog.normalizeDeskCompanion('full'), fog.DEFAULT_COMPANION);
assert.deepStrictEqual(fog.normalizeDeskCompanion([]), fog.DEFAULT_COMPANION);
assert.strictEqual(fog.normalizeDeskCompanion({ enabled: false }).enabled, false);
assert.strictEqual(fog.normalizeDeskCompanion({ enabled: 'no' }).enabled, true);
assert.strictEqual(fog.clamp01(1.4, 0), 1);
assert.strictEqual(fog.clamp01(-0.2, 1), 0);
assert.strictEqual(fog.clamp01('x', 0.5), 0.5);
assert.deepStrictEqual(fog.normalizeDeskCompanion({ x: 2, y: -1, motion: 'bounce' }), {
  enabled: true, x: 1, y: 0, motion: 'full',
});
const stripped = fog.normalizeDeskCompanion({
  enabled: false, x: 0.25, y: 0.5, motion: 'reduced',
  history: [{ t: 1 }], xp: 9, feed: true, path: [],
});
assert.deepStrictEqual(stripped, { enabled: false, x: 0.25, y: 0.5, motion: 'reduced' });
assert.ok(!('history' in stripped) && !('xp' in stripped) && !('feed' in stripped));

assert.strictEqual(fog.resolveCompanionMotion('full', false), 'full');
assert.strictEqual(fog.resolveCompanionMotion('reduced', false), 'reduced');
assert.strictEqual(fog.resolveCompanionMotion('full', true), 'reduced', 'OS reduce wins over motion=full');
assert.strictEqual(fog.resolveCompanionMotion('reduced', true), 'reduced');
assert.strictEqual(fog.resolveCompanionMotion('bounce', false), 'full');

const rail = { x: 0, y: 0, w: 84, h: 800 };
const bounds = fog.moveBounds({ width: 1280, height: 800 }, 64, 12, rail);
assert.ok(bounds.minX >= 84, 'park box stays off the rail');
assert.strictEqual(bounds.maxX, 1280 - 64 - 12);
assert.strictEqual(bounds.maxY, 800 - 64 - 12);

const defaultPos = fog.parkPixel({ x: 1, y: 1 }, bounds, 64, [], []);
assert.strictEqual(defaultPos.x, bounds.maxX);
assert.strictEqual(defaultPos.y, bounds.maxY);

const footer = { x: 96, y: 720, w: 1100, h: 48 };
assert.ok(fog.overlapPad({ x: defaultPos.x, y: defaultPos.y, w: 64, h: 64 }, footer, 10),
  'unclamped bottom-right would cover a live W12 footer');
const safe = fog.parkPixel({ x: 1, y: 1 }, bounds, 64, [footer], []);
assert.ok(!fog.overlapPad({ x: safe.x, y: safe.y, w: 64, h: 64 }, footer, 10),
  'default park must clear the W12 workset footer');
assert.ok(safe.y + 64 <= footer.y, 'wide footer pushes the blob up, not through the cardfoot');
assert.ok(safe.x + 64 <= 1280);

const resume = { x: 120, y: 80, w: 900, h: 120 };
const overResume = fog.parkPixel(
  { x: fog.normFromPixel(200, bounds.minX, bounds.maxX), y: fog.normFromPixel(100, bounds.minY, bounds.maxY) },
  bounds, 64, [resume], [],
);
assert.ok(!fog.overlapPad({ x: overResume.x, y: overResume.y, w: 64, h: 64 }, resume, 10),
  'must not sit on #resume / 下一件事');

const pull = fog.stretchFromDelta(80, 0);
assert.ok(pull.sx <= 1.18);
assert.ok(fog.stretchFromDelta(4000, 0).sx <= 1.18);

const topRail = fog.moveBounds({ width: 400, height: 700 }, 64, 12, { x: 0, y: 0, w: 400, h: 56 });
assert.ok(topRail.minY >= 56, 'narrow rail-on-top keeps a top inset');

assert.ok(html.includes('id="desk-fog"'), 'newtab mounts the fog blob');
assert.ok(html.includes('src="desk-companion.js"'));
assert.ok(html.indexOf('src="sky.js"') < html.indexOf('src="desk-companion.js"'));
assert.ok(html.indexOf('src="newtab.js"') < html.indexOf('src="desk-companion.js"'));
assert.ok(settings.includes('显示桌面软团'));
assert.ok(settings.includes('重置软团位置'));
assert.ok(settings.includes('id="desk-fog-enabled"'));
assert.ok(settings.includes('id="desk-fog-reset"'));
assert.ok(!desk.includes('显示桌面软团'), 'hide/restore copy stays in settings');
assert.ok(!desk.includes('id="desk-fog"'), 'blob is not a desk card');
assert.ok(!/id="desk-fog-overlay"|desk-fog-catcher|inset:\s*0/.test(html), 'no full-page overlay');

assert.ok(!/eye|pupil|mouth|face|beak|duck/i.test(html.slice(html.indexOf('id="desk-fog"'))));
assert.ok(html.includes('class="fog-halo"') && html.includes('class="fog-body"'));
assert.ok(!/<canvas|<video|WebGL|webgl|THREE\b/i.test(html));
assert.ok(!/requestAnimationFrame/.test(js), 'no idle or drag rAF; pointer + WAAPI only');
assert.ok(!/setInterval\s*\(/.test(js));
assert.ok(js.includes('setPointerCapture'));
assert.ok(js.includes('animate('));
assert.ok(js.includes('anim.cancel') || js.includes('run.cancel'));
assert.ok(js.includes("e.key === 'Delete'") || js.includes('Backspace'));
assert.ok(!/ArrowLeft|ArrowRight|ArrowUp|ArrowDown/.test(js), 'no arrow-key move in MVP');
assert.ok(!/chrome\.permissions/.test(js));
assert.ok(!/storage\.sync/.test(js));
assert.ok(js.includes("chrome.storage.local.set({ deskCompanion:"));
assert.ok(!/Audio|Notification\.|webkitNotifications/.test(js));
assert.ok(!/fetch\(|XMLHttpRequest|WebSocket|nativeMessaging/.test(js));
assert.ok(!/\bXP\b|shop|inventory|feed|roam|pet/i.test(js));
assert.ok(!/Matter\.|planck|cannon-es|Box2D|velocityVerlet/i.test(js));

assert.ok(/\.desk-fog\s*\{/.test(css));
assert.ok(/z-index:\s*6/.test(css));
assert.ok(/#resume[\s\S]*z-index:\s*12/.test(css) || /\.resume\s*\{[^}]*z-index:\s*12/.test(css));
assert.ok(/\.rail\s*\{[^}]*z-index:\s*20/.test(css));
assert.ok(/\.c-workset \.cardfoot[\s\S]*z-index:\s*12/.test(css));
assert.ok(fog.MUST_AVOID_SELECTORS.includes('#resume'));
assert.ok(fog.MUST_AVOID_SELECTORS.includes('#resume-act'));
assert.ok(fog.MUST_AVOID_SELECTORS.includes('.rail'));
assert.ok(fog.MUST_AVOID_SELECTORS.includes('.c-workset .cardfoot'));

assert.ok(newtabJs.includes('const WORKSET_STORE_CAP = 5'));
assert.ok(newtabJs.includes('function pickResume'));
assert.ok(!/deskCompanion/.test(newtabJs), 'W11/W12 newtab.js stays off the companion key');

assert.deepStrictEqual(manifest.permissions, ['storage', 'tabs', 'sidePanel']);
assert.deepStrictEqual(manifest.optional_permissions, ['nativeMessaging']);
assert.ok(!manifest.host_permissions);

const extFiles = fs.readdirSync(EXT).filter((f) => /\.(js|html|css|json)$/.test(f));
for (const f of extFiles) {
  const src = read(f);
  assert.ok(!/storage\.sync/.test(src), `${f} must not use chrome.storage.sync`);
  assert.ok(!/chrome\.proxy/.test(src), `${f} must not use chrome.proxy`);
  assert.ok(!/\bgetContext\s*\(\s*['"](?:webgl|experimental-webgl|2d)['"]/i.test(src),
    `${f} must not open a canvas/WebGL context`);
}

assert.ok(/deskCompanion/.test(readme));
assert.ok(/显示桌面软团/.test(readme));
assert.ok(/可选/.test(readme) && /软团|雾/.test(readme));
assert.ok(/enabled=false/.test(readme) || /仍隐藏/.test(readme));
assert.ok(!/storage\.sync/.test(readme) || /不用 `storage\.sync`/.test(readme));

console.log('test-desk-companion: ok');
