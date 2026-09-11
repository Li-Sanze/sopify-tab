'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..');
const EXT = path.join(REPO, 'extension');
const KNOWN_STORAGE_KEYS = [
  'sites', 'todos', 'notes', 'name', 'cwd', 'hostUpstream', 'themePreset',
  'worksets',
];

function read(name) {
  return fs.readFileSync(path.join(EXT, name), 'utf8');
}

const html = read('newtab.html');
const css = read('newtab.css');
const js = read('newtab.js');
const manifest = JSON.parse(read('manifest.json'));
const readme = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
const desk = html.slice(html.indexOf('aria-labelledby="greet-h"'), html.indexOf('aria-labelledby="tabs-h"'));
const settings = html.slice(html.indexOf('aria-labelledby="settings-h"'));

assert.ok(desk.includes('id="workset-save"') && desk.includes('保存这个窗口'), 'desk save entry');
assert.ok(desk.includes('id="workset-restore-recent"') && desk.includes('最近一份 · 恢复'), 'desk has one restore line');
assert.ok(!desk.includes('id="saved-worksets"'), 'do not tile saved worksets on the desk');
assert.ok(!desk.includes('清空全部工作集'), 'clear-all stays in settings');
assert.ok(!/Host|CLI|--force|cursor-agent/.test(desk), 'desk still silent on Host');
assert.ok(settings.includes('id="saved-worksets"'), 'settings lists saved worksets');
assert.ok(settings.includes('id="worksets-clear"') && settings.includes('清空全部工作集'));
assert.ok(settings.includes('id="s-worksets"') && settings.includes('工作集'));
assert.ok(html.includes('id="resume"') && html.includes('下一件事'), 'resume strip stays first');

assert.ok(js.includes('const WORKSET_STORE_CAP = 5'));
assert.ok(js.includes('const WORKSET_TAB_CAP = 50'));
assert.ok(js.includes('const WORKSET_TITLE_MAX = 200'));
assert.ok(js.includes('function snapshotWorksetTabs'));
assert.ok(js.includes('function clipSavedWorksetTabs'));
assert.ok(js.includes('function proposeSaveWorkset'));
assert.ok(js.includes('function overwriteOldestWorkset'));
assert.ok(js.includes('function planRestore'));
assert.ok(js.includes('async function persistWorksets'));
assert.ok(js.includes("chrome.storage.local.set({ worksets })"), 'only worksets key is written');
assert.ok(js.includes('chrome.tabs.create'));
assert.ok(js.includes('chrome.tabs.update'));
assert.ok(!/chrome\.windows\.create/.test(js), 'restore stays in the current window');
assert.ok(!/chrome\.storage\.sync/.test(js));
assert.ok(!/chrome\.bookmarks|chrome\.history|chrome\.sessions|topSites/.test(js));
assert.ok(!/beforeunload/.test(js));
assert.ok(!/windows\.onRemoved/.test(js));
assert.ok(!/onRemoved[\s\S]{0,120}persistWorksets/.test(js), 'tab close must not persist worksets');
assert.ok(!/visibilitychange[\s\S]{0,200}persistWorksets/.test(js), 'visibility must not persist worksets');

const persistCalls = [...js.matchAll(/\bpersistWorksets\s*\(/g)];
assert.strictEqual(persistCalls.length, 5, 'define + save + overwrite + delete + clear');
assert.ok(js.includes('function saveThisWindow') && js.includes("window.confirm"));
assert.ok(js.includes('覆盖最早的'), 'full cap prompts overwrite, no silent drop');
assert.ok(js.includes('只保存前 ') && js.includes('WORKSET_TAB_CAP'), '>50 tabs prompts, no silent drop');
const restoreFn = js.slice(js.indexOf('async function restoreWorksetById'), js.indexOf('async function deleteWorksetById'));
assert.ok(restoreFn.includes('chrome.tabs.create') && restoreFn.includes('activateTab'));
assert.ok(!/tabs\.remove/.test(restoreFn), 'restore must not close other tabs');
assert.ok(js.includes('清空全部工作集？') || js.includes('清空全部工作集'));

const setKeys = [...js.matchAll(/storage\.local\.set\(\s*\{([^}]+)\}/g)].map((m) => m[1]);
for (const chunk of setKeys) {
  for (const key of chunk.match(/(\w+)\s*:/g) || []) {
    const name = key.replace(/\s*:/, '');
    assert.ok(KNOWN_STORAGE_KEYS.includes(name) || name === 'payload' || name === 'cwd' || name === 'hostUpstream',
      `unexpected storage key in set(): ${name}`);
  }
}

assert.deepStrictEqual(manifest.permissions, ['storage', 'tabs', 'sidePanel']);
assert.deepStrictEqual(manifest.optional_permissions, ['nativeMessaging']);

assert.ok(/\.savedset\s*\{/.test(css), 'saved workset rows are styled');
assert.ok(/\.cardfoot-acts/.test(css));

assert.ok(/下一件事/.test(readme) && /写一条/.test(readme), 'README documents W11 empty=write-one');
assert.ok(/不拿标签或便签凑数/.test(readme) || /不拿标签/.test(readme));
assert.ok(/保存这个窗口/.test(readme));
assert.ok(/最近一份 · 恢复/.test(readme));
assert.ok(/50 个网页/.test(readme));
assert.ok(/worksets/.test(readme) && /title, url/.test(readme));
assert.ok(/不存 favicon|不存favicon/.test(readme));
assert.ok(/最多 5/.test(readme) && /覆盖/.test(readme));
assert.ok(/关窗口不会自动存/.test(readme));
assert.ok(/chrome\.storage\.local/.test(readme));
assert.ok(!/storage\.sync/.test(readme) || /不用 `storage\.sync`/.test(readme));
assert.ok(/可选：本机对话|设置深路径/.test(readme), 'Host is demoted');
assert.ok(!/智能聚类|AI 聚类|自动整理/.test(readme), 'no unreleased AI claims');

const start = js.indexOf('function domainOf');
const end = js.indexOf('async function loadDesk');
assert.ok(start !== -1 && end > start, 'can extract workset helpers');
const helpers = new Function(js.slice(start, end) + '; return { snapshotWorksetTabs, clipSavedWorksetTabs, defaultWorksetName, normalizeWorkset, normalizeWorksets, oldestWorkset, proposeSaveWorkset, overwriteOldestWorkset, removeWorksetById, planRestore, isDeskSummaryUrl };')();

const dirty = [
  { id: 1, title: 'X', url: 'https://x.com/', favIconUrl: 'https://x.com/favicon.ico', discarded: false },
  { id: 2, title: 'Local', url: 'http://localhost:5173/app' },
  { id: 3, title: 'Ext', url: 'chrome://extensions' },
  { id: 4, title: 'Newtab', url: 'chrome-extension://abc/newtab.html' },
  { id: 5, title: 'File', url: 'file:///tmp/a.html' },
  { id: 6, title: 'X again', url: 'https://x.com/' },
];
const snap = helpers.snapshotWorksetTabs(dirty);
assert.strictEqual(snap.length, 2);
assert.deepStrictEqual(Object.keys(snap[0]).sort(), ['title', 'url']);
assert.strictEqual(snap[0].url, 'https://x.com/');
assert.strictEqual(snap[1].url, 'http://localhost:5173/app');
assert.ok(!snap.some((t) => 'favIconUrl' in t || 'id' in t || 'tabId' in t));

const longTitle = '标'.repeat(240);
const clippedTitle = helpers.snapshotWorksetTabs([{ title: longTitle, url: 'https://long.example/' }]);
assert.strictEqual(clippedTitle[0].title.length, 200);

const many = [];
for (let i = 1; i <= 51; i += 1) many.push({ title: 'T' + i, url: 'https://n' + i + '.example/' });
const clippedMany = helpers.clipSavedWorksetTabs(many);
assert.strictEqual(clippedMany.total, 51);
assert.strictEqual(clippedMany.overflow, true);
assert.strictEqual(clippedMany.tabs.length, 50);
assert.strictEqual(clippedMany.tabs[0].url, 'https://n1.example/');
assert.strictEqual(clippedMany.tabs[49].url, 'https://n50.example/');

const overflowSave = helpers.proposeSaveWorkset([], many, { id: 'w50', name: '多', savedAt: 1 });
assert.ok(overflowSave.ok);
assert.strictEqual(overflowSave.overflow, true);
assert.strictEqual(overflowSave.totalTabs, 51);
assert.strictEqual(overflowSave.incoming.tabs.length, 50);

assert.ok(helpers.isDeskSummaryUrl('https://example.com/'));
assert.ok(helpers.isDeskSummaryUrl('http://127.0.0.1:8080/'));
assert.ok(!helpers.isDeskSummaryUrl('chrome://newtab'));

assert.strictEqual(helpers.proposeSaveWorkset([], dirty).reason, undefined);
assert.strictEqual(helpers.proposeSaveWorkset([], [{ url: 'chrome://newtab' }]).reason, 'empty');

const first = helpers.proposeSaveWorkset([], dirty, { id: 'w1', name: '一', savedAt: 100 });
assert.ok(first.ok);
assert.strictEqual(first.worksets.length, 1);
assert.strictEqual(first.incoming.tabs.length, 2);
assert.deepStrictEqual(Object.keys(first.incoming).sort(), ['id', 'name', 'savedAt', 'tabs']);

function seed(n) {
  const tabs = [{ title: 'T', url: 'https://example.com/' + n }];
  return { id: 'w' + n, name: '集' + n, savedAt: n * 10, tabs: tabs };
}
const five = [1, 2, 3, 4, 5].map(seed);
const full = helpers.proposeSaveWorkset(five, [{ title: 'New', url: 'https://new.example/' }], {
  id: 'w6', name: '新的', savedAt: 999,
});
assert.strictEqual(full.ok, false);
assert.strictEqual(full.reason, 'full');
assert.strictEqual(full.oldest.id, 'w1');
assert.deepStrictEqual(full.worksets.map((w) => w.id).sort(), ['w1', 'w2', 'w3', 'w4', 'w5']);
assert.ok(!full.worksets.some((w) => w.id === 'w6'), 'full save does not drop or insert');

const overwritten = helpers.overwriteOldestWorkset(five, full.incoming);
assert.ok(overwritten.ok);
assert.strictEqual(overwritten.overwritten.id, 'w1');
assert.strictEqual(overwritten.worksets.length, 5);
assert.ok(overwritten.worksets.some((w) => w.id === 'w6'));
assert.ok(!overwritten.worksets.some((w) => w.id === 'w1'));

const removed = helpers.removeWorksetById(five, 'w3');
assert.deepStrictEqual(removed.map((w) => w.id), ['w5', 'w4', 'w2', 'w1']);

const messy = helpers.normalizeWorksets([
  { id: 'bad' },
  { id: 'ok', name: '可用', savedAt: '2026-09-11T00:00:00.000Z', tabs: [{ title: 'A', url: 'https://a.example/', favIconUrl: 'x' }] },
  { id: 'ok', name: '重复', savedAt: 1, tabs: [{ title: 'B', url: 'https://b.example/' }] },
  seed(1), seed(2), seed(3), seed(4), seed(5), seed(6),
]);
assert.ok(messy.length <= 5);
assert.ok(messy[0].savedAt >= messy[messy.length - 1].savedAt);
assert.deepStrictEqual(Object.keys(messy.find((w) => w.id === 'ok').tabs[0]).sort(), ['title', 'url']);

const plan = helpers.planRestore(
  [{ title: 'X', url: 'https://x.com/' }, { title: 'New', url: 'https://new.example/' }],
  [{ id: 9, url: 'https://x.com/' }, { id: 10, url: 'chrome://newtab' }],
);
assert.deepStrictEqual(plan.activate, [{ id: 9, url: 'https://x.com/' }]);
assert.deepStrictEqual(plan.create, ['https://new.example/']);

const named = helpers.defaultWorksetName(new Date(2026, 8, 11, 16, 7));
assert.strictEqual(named, '9月11日 16:07');

console.log('test-w12-workset: ok');
