'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..');
const EXT = path.join(REPO, 'extension');
const KNOWN_STORAGE_KEYS = [
  'sites', 'todos', 'notes', 'name', 'cwd', 'hostUpstream', 'themePreset',
  'worksets', 'worksetsRev', 'todosRev', 'sitesRev', 'spaceView',
];

function read(name) {
  return fs.readFileSync(path.join(EXT, name), 'utf8');
}

const html = read('newtab.html');
const css = read('newtab.css');
const js = read('newtab.js');
const collection = read('collection-sync.js');
const manifest = JSON.parse(read('manifest.json'));
const desk = html.slice(html.indexOf('id="resume"'), html.indexOf('id="tabs-h"'));
const settings = html.slice(html.indexOf('aria-labelledby="settings-h"'));

assert.ok(desk.includes('id="workset-save"') && desk.includes('保存这个窗口'), 'desk save entry');
assert.ok(desk.includes('id="workset-restore-recent"') && desk.includes('恢复这'), 'desk keeps one recent restore');
assert.ok(desk.includes('接着上次'), 'saved windows live under 接着上次');
assert.ok(!desk.includes('id="saved-worksets"'), 'settings list id stays in settings');
assert.ok(!desk.includes('清空全部'), 'clear-all stays in settings');
assert.ok(html.includes('>工作台<') && html.includes('id="studio-nav-tabs">当前标签<'), 'nav is 工作台 / 当前标签 / 设置');
assert.ok(!html.includes('工作集〔'), 'do not call 工作台 工作集');
assert.ok(!desk.includes('工作集') && !settings.includes('工作集'), 'visible copy drops 工作集');
assert.ok(!/Host|CLI|--force|cursor-agent/.test(desk), 'desk still silent on Host');
assert.ok(settings.includes('id="saved-worksets"'), 'settings lists saved windows');
assert.ok(settings.includes('id="worksets-clear"') && settings.includes('清空全部存下的窗口'));
assert.ok(settings.includes('id="s-worksets"') && settings.includes('存下的窗口'));
assert.ok(html.includes('id="resume"') && html.includes('下一件事'), 'resume strip stays first');

assert.ok(js.includes('const WORKSET_STORE_CAP = 5'));
assert.ok(js.includes('const WORKSET_TAB_CAP = 50'));
assert.ok(js.includes('const WORKSET_TITLE_MAX = 200'));
assert.ok(js.includes('slice(0, WORKSET_TAB_CAP)'), 'clip/normalize use WORKSET_TAB_CAP');
assert.ok(js.includes('slice(0, WORKSET_TITLE_MAX)'), 'title clip uses WORKSET_TITLE_MAX');
assert.ok(js.includes('function snapshotWorksetTabs'));
assert.ok(js.includes('function clipSavedWorksetTabs'));
assert.ok(js.includes('function proposeSaveWorkset'));
assert.ok(js.includes('function overwriteOldestWorkset'));
assert.ok(js.includes('function planRestore'));
assert.ok(js.includes('async function persistWorksets'));
assert.ok(collection.includes('createCollectionCoordinator'));
assert.ok(js.includes("domain: 'worksets'"));
assert.ok(!/storage\.local\.set\(\s*\{\s*worksets\s*,\s*(sites|todos|notes)/.test(collection), 'workset writes stay on the workset domain');
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
assert.strictEqual(persistCalls.length, 6, 'define + save + overwrite + delete + clear + rename');
assert.ok(js.includes('function startRename'), 'inline rename');
assert.ok(/w\.id === id \? \{ id: w\.id, name: next, savedAt: w\.savedAt, tabs: w\.tabs \}/.test(js),
  'rename writes only the name field');
assert.ok(js.includes('function saveThisWindow') && js.includes('function confirmInPage'));
assert.ok(!/window\.confirm\s*\(/.test(js) && !/window\.alert\s*\(/.test(js), 'confirms stay in the page');
assert.ok(html.includes('id="ops-confirm-dialog"'));
assert.ok(js.includes('存这一份会替换最早的') && js.includes("confirmLabel: '替换'"), 'full cap prompts replace, no silent drop');
const fullConfirm = js.slice(js.indexOf("title: '已经存了 '"), js.indexOf("title: '清空全部存下的窗口？'"));
assert.ok(fullConfirm.includes('danger: false') && !fullConfirm.includes('focusConfirm'), 'replace confirm is not danger and keeps cancel focused');
assert.ok(js.includes('只能存前 ') && js.includes('存前 ') && js.includes('WORKSET_TAB_CAP') && js.includes('focusConfirm: true'), '>50 tabs prompts and focuses confirm');
assert.ok(/\(spec\.focusConfirm === true \? ok : cancel\)\.focus\(\)/.test(js), 'default focus follows the scenario');
const restoreFn = js.slice(js.indexOf('async function restoreWorksetById'), js.indexOf('async function deleteWorksetById'));
assert.ok(restoreFn.includes('chrome.tabs.create') && restoreFn.includes('activateTab'));
assert.ok(!/tabs\.remove/.test(restoreFn), 'restore must not close other tabs');
assert.ok(js.includes("title: '清空全部存下的窗口？'"));
assert.ok(js.includes('只影响这台电脑，清空后找不回来。'));

const setKeys = [...js.matchAll(/storage\.local\.set\(\s*\{([^}]+)\}/g)].map((m) => m[1]);
for (const chunk of setKeys) {
  for (const key of chunk.match(/(\w+)\s*:/g) || []) {
    const name = key.replace(/\s*:/, '');
    assert.ok(KNOWN_STORAGE_KEYS.includes(name) || name === 'payload' || name === 'cwd' || name === 'hostUpstream',
      `unexpected storage key in set(): ${name}`);
  }
}

assert.deepStrictEqual(manifest.permissions, ['storage', 'tabs']);
assert.ok(!('optional_permissions' in manifest));
assert.ok(!('side_panel' in manifest));
assert.ok(!/connectNative|sendNativeMessage|\bsidePanel\b|nativeMessaging|id="open-chat"|class="rail"/.test(js + html),
  'workset sources are already offline for Host and Side Panel');

assert.ok(/\.savedset\s*\{/.test(css), 'saved workset rows are styled');
assert.ok(/\.cardfoot-acts/.test(css));

assert.ok(html.includes('空间视图'), 'space view stays a desk surface');
assert.ok(/let spaceViewOn = false/.test(js), 'space view defaults off');
assert.ok(/chrome\.storage\.local|storage\.local/.test(js), 'desk persists with storage.local');
assert.ok(!/kind:\s*'tab'|kind:\s*'note'/.test(js), 'resume does not fill from tabs or notes');
assert.ok(!/智能聚类|AI 聚类|自动整理/.test(html + js), 'no unreleased clustering in the desk');
assert.ok(!/chrome\.proxy/.test(js + html), 'workset path does not touch proxy');

const start = js.indexOf('function domainOf');
const end = js.indexOf('async function loadDesk');
assert.ok(start !== -1 && end > start, 'can extract workset helpers');
const helpers = new Function(
  'const WORKSET_TAB_CAP = 50; const WORKSET_TITLE_MAX = 200; ' +
  js.slice(start, end) +
  '; return { snapshotWorksetTabs, clipSavedWorksetTabs, defaultWorksetName, normalizeWorkset, normalizeWorksets, oldestWorkset, proposeSaveWorkset, overwriteOldestWorkset, removeWorksetById, planRestore, isDeskSummaryUrl, tabsToCloseForHost, closeHostButtonLabel };'
)();

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
assert.ok(helpers.isDeskSummaryUrl('http://localhost:5173/'));
assert.ok(helpers.isDeskSummaryUrl('https://[::1]/'));
assert.ok(!helpers.isDeskSummaryUrl('chrome://newtab'));
assert.ok(!helpers.isDeskSummaryUrl('ftp://localhost/'));
assert.ok(!helpers.isDeskSummaryUrl('ws://127.0.0.1:8080/'));
assert.ok(!helpers.isDeskSummaryUrl('wss://[::1]/'));
assert.ok(!helpers.isDeskSummaryUrl('file://localhost/tmp'));
assert.deepStrictEqual(
  helpers.snapshotWorksetTabs([
    { title: 'ftp', url: 'ftp://localhost/pub' },
    { title: 'ws', url: 'ws://127.0.0.1:9' },
    { title: 'ok', url: 'http://localhost:5173/' },
  ]).map((t) => t.url),
  ['http://localhost:5173/'],
);

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

const collectionApi = require(path.join(EXT, 'collection-sync.js'));
const failures = [];
function check(name, fn) {
  try { fn(); } catch (err) { failures.push(name + ': ' + (err && err.message ? err.message : err)); }
}

function ws(id, savedAt, urls, name) {
  return {
    id: id,
    name: name || id,
    savedAt: savedAt,
    tabs: urls.map((url, i) => ({ title: 'T' + i, url: url })),
  };
}

const pair = [ws('w1', 10, ['https://a.example/x', 'https://b.example/y'], '一')];
const saveOpts = { id: 'new', name: '新名字', savedAt: 80 };

check('identical urls are one record', () => {
  const saved = helpers.proposeSaveWorkset(pair, [
    { title: '甲', url: 'https://a.example/x' },
    { title: '乙', url: 'https://b.example/y' },
  ], saveOpts);
  assert.strictEqual(saved.ok, true);
  assert.strictEqual(saved.reason, 'duplicate');
  assert.strictEqual(saved.worksets.length, 1);
  assert.strictEqual(saved.worksets[0].id, 'w1');
  assert.strictEqual(saved.worksets[0].name, '一');
  assert.strictEqual(saved.worksets[0].savedAt, 80);
  assert.deepStrictEqual(saved.worksets[0].tabs, pair[0].tabs);
});

check('same urls in another order are a duplicate', () => {
  const saved = helpers.proposeSaveWorkset(pair, [
    { title: '乙', url: 'https://b.example/y' },
    { title: '甲', url: 'https://a.example/x' },
  ], saveOpts);
  assert.strictEqual(saved.reason, 'duplicate');
  assert.strictEqual(saved.worksets.length, 1);
  assert.strictEqual(saved.worksets[0].id, 'w1');
  assert.strictEqual(saved.worksets[0].savedAt, 80);
});

check('urls that differ only by fragment are a duplicate', () => {
  const stored = [ws('w1', 10, ['https://a.example/doc#one', 'https://b.example/y'], '一')];
  const saved = helpers.proposeSaveWorkset(stored, [
    { title: '乙', url: 'https://b.example/y#zzz' },
    { title: '甲', url: 'https://a.example/doc' },
  ], saveOpts);
  assert.strictEqual(saved.reason, 'duplicate');
  assert.strictEqual(saved.worksets.length, 1);
  assert.strictEqual(saved.worksets[0].id, 'w1');
  assert.strictEqual(saved.worksets[0].savedAt, 80);
  assert.deepStrictEqual(saved.worksets[0].tabs, stored[0].tabs);
});

check('partial overlap is not a duplicate', () => {
  const saved = helpers.proposeSaveWorkset(pair, [
    { title: '甲', url: 'https://a.example/x' },
    { title: '丙', url: 'https://c.example/z' },
  ], saveOpts);
  assert.strictEqual(saved.reason, undefined);
  assert.strictEqual(saved.ok, true);
  assert.strictEqual(saved.worksets.length, 2);
  assert.strictEqual(saved.worksets[0].id, 'new');
});

check('a query string change is not a duplicate', () => {
  const stored = [ws('w1', 10, ['https://a.example/?q=1'], '一')];
  const saved = helpers.proposeSaveWorkset(stored, [
    { title: '甲', url: 'https://a.example/?q=2' },
  ], saveOpts);
  assert.strictEqual(saved.reason, undefined);
  assert.strictEqual(saved.worksets.length, 2);
});

check('a full store updates the matching window and does not ask to replace', () => {
  const stored = [1, 2, 3, 4, 5].map((n) => ws('w' + n, n * 10, ['https://h' + n + '.example/']));
  const saved = helpers.proposeSaveWorkset(stored, [
    { title: 'nope', url: 'https://h2.example/#section' },
  ], { id: 'w9', name: '新', savedAt: 1000 });
  assert.strictEqual(saved.ok, true);
  assert.strictEqual(saved.reason, 'duplicate');
  assert.notStrictEqual(saved.reason, 'full');
  assert.strictEqual(saved.worksets.length, 5);
  assert.deepStrictEqual(saved.worksets.map((w) => w.id), ['w2', 'w5', 'w4', 'w3', 'w1']);
  assert.strictEqual(saved.worksets[0].savedAt, 1000);
  assert.strictEqual(saved.worksets[0].name, 'w2');
  assert.deepStrictEqual(saved.worksets[0].tabs, stored[1].tabs);
  assert.deepStrictEqual(saved.worksets.slice(1), [stored[4], stored[3], stored[2], stored[0]]);
});

check('a new window at the cap still goes through replace', () => {
  const stored = [1, 2, 3, 4, 5].map((n) => ws('w' + n, n * 10, ['https://h' + n + '.example/']));
  const saved = helpers.proposeSaveWorkset(stored, [
    { title: 'New', url: 'https://brand-new.example/' },
  ], { id: 'w9', name: '九', savedAt: 1000 });
  assert.strictEqual(saved.ok, false);
  assert.strictEqual(saved.reason, 'full');
  assert.strictEqual(saved.worksets.length, 5);
  assert.ok(!saved.worksets.some((w) => w.id === 'w9'));
  assert.strictEqual(saved.oldest.id, 'w1');
});

check('saving the same window twice only moves that record', () => {
  const trio = [
    ws('a', 30, ['https://a.example/'], '甲'),
    ws('b', 20, ['https://b.example/'], '乙'),
    ws('c', 10, ['https://c.example/'], '丙'),
  ];
  const once = helpers.proposeSaveWorkset(trio, [
    { title: 'B', url: 'https://b.example/#1' },
  ], { id: 'x', name: 'X', savedAt: 100 });
  assert.strictEqual(once.reason, 'duplicate');
  assert.deepStrictEqual(once.worksets.map((w) => w.id), ['b', 'a', 'c']);
  assert.strictEqual(once.worksets[0].savedAt, 100);
  const twice = helpers.proposeSaveWorkset(once.worksets, [
    { title: 'B2', url: 'https://b.example/#2' },
  ], { id: 'y', name: 'Y', savedAt: 200 });
  assert.strictEqual(twice.reason, 'duplicate');
  assert.deepStrictEqual(twice.worksets.map((w) => w.id), ['b', 'a', 'c']);
  assert.strictEqual(twice.worksets[0].savedAt, 200);
  assert.deepStrictEqual(twice.worksets[1], trio[0]);
  assert.deepStrictEqual(twice.worksets[2], trio[2]);
});

check('duplicate notice is the inline toast and it is reached before the replace dialog', () => {
  const saveFn = js.slice(js.indexOf('async function saveThisWindow'), js.indexOf('async function restoreWorksetById'));
  const dup = saveFn.indexOf("proposal.reason === 'duplicate'");
  const full = saveFn.indexOf("proposal.reason === 'full'");
  const toast = saveFn.indexOf('这个窗口已经保存过，已更新时间');
  assert.ok(dup !== -1 && full !== -1 && toast !== -1);
  assert.ok(dup < full);
  assert.ok(!/window\.alert|showModal\(\)/.test(saveFn.slice(dup, full)));
});

const pageTabs = [
  { id: 1, title: 'A', url: 'https://a.example/' },
  { id: 2, title: 'B', url: 'https://b.example/p' },
  { id: 3, title: 'B2', url: 'https://b.example/q' },
  { id: 4, title: 'C', url: 'https://c.example/' },
  { id: 5, title: 'D', url: 'https://d.example/' },
  { id: 6, title: 'Sopify', url: 'chrome-extension://abc/newtab.html' },
  { id: 7, title: 'NTP', url: 'chrome://newtab/' },
];

check('close counts ignore chrome pages and the extension new tab', () => {
  delete global.chrome;
  assert.deepStrictEqual(helpers.tabsToCloseForHost(pageTabs, '', 'chrome://newtab').map((t) => t.id), []);
  assert.deepStrictEqual(helpers.tabsToCloseForHost(pageTabs, '', 'chrome-extension').map((t) => t.id), []);
  const visible = helpers.tabsToCloseForHost(pageTabs, '', 'b.example');
  assert.deepStrictEqual(visible.map((t) => t.id), [2, 3]);
  assert.strictEqual(helpers.closeHostButtonLabel(visible.length), '关闭这 2 个标签');
  const mixed = pageTabs.concat([{ id: 8, title: 'Panel', url: 'chrome-extension://abc/panel.html' }]);
  assert.deepStrictEqual(helpers.tabsToCloseForHost(mixed, '', 'chrome-extension').map((t) => t.id), [8]);
});

check('another extension new tab stays listed when this extension id is known', () => {
  global.chrome = {
    runtime: { getURL(file) { return 'chrome-extension://selfid/' + file; } },
  };
  try {
    const rows = [
      { id: 1, title: 'Self', url: 'chrome-extension://selfid/newtab.html' },
      { id: 2, title: 'Other', url: 'chrome-extension://other/newtab.html' },
      { id: 3, title: 'Page', url: 'https://a.example/' },
    ];
    assert.deepStrictEqual(helpers.tabsToCloseForHost(rows, '', 'chrome-extension').map((t) => t.id), [2]);
  } finally {
    delete global.chrome;
  }
});

let copy = null;
let copyErr = null;
try {
  copy = new Function(
    'const WORKSET_TAB_CAP = 50; const WORKSET_TITLE_MAX = 200; ' +
    js.slice(start, end) +
    '; return { listedWindowTabs, describeWindowPages, homeWindowText, tabsHeaderLine };'
  )();
} catch (err) {
  copyErr = err;
}

check('home and current-tab counts agree after dropping our page and chrome pages', () => {
  assert.ok(copy, copyErr && copyErr.message);
  const home = copy.homeWindowText(pageTabs);
  const header = copy.tabsHeaderLine(pageTabs);
  assert.strictEqual(home.lead, '5 个网页');
  assert.strictEqual(home.sub, '可以一键存下，回头恢复');
  assert.strictEqual(home.saveHidden, false);
  assert.strictEqual(header, '5 个网页，来自 4 个网站');
  assert.ok(!home.lead.includes('标签') && !home.sub.includes('标签') && !header.includes('标签'));
  assert.deepStrictEqual(copy.listedWindowTabs(pageTabs).map((t) => t.id), [1, 2, 3, 4, 5]);
  const withFile = pageTabs.concat([{ id: 9, title: 'File', url: 'file:///tmp/a.html' }]);
  const homeFile = copy.homeWindowText(withFile);
  const headerFile = copy.tabsHeaderLine(withFile);
  assert.strictEqual(homeFile.lead, '6 个网页');
  assert.strictEqual(homeFile.sub, '其中 5 个可以存下');
  assert.strictEqual(headerFile, '6 个网页，来自 5 个网站，其中 5 个可以存下');
  assert.strictEqual(homeFile.pages, 6);
  assert.strictEqual(homeFile.savable, 5);
  const onlySelf = [
    { id: 6, title: 'Sopify', url: 'chrome-extension://abc/newtab.html' },
    { id: 7, title: 'NTP', url: 'chrome://newtab/' },
  ];
  const empty = copy.homeWindowText(onlySelf);
  assert.strictEqual(empty.lead, '只有这一页');
  assert.strictEqual(empty.sub, '打开几个网页后，可以在这里存下来');
  assert.strictEqual(empty.saveHidden, true);
  assert.strictEqual(copy.tabsHeaderLine(onlySelf), '0 个网页，来自 0 个网站');
});

check('the views use that census and the placeholder matches', () => {
  const renderWorksetFn = js.slice(js.indexOf('function renderWorkset'), js.indexOf('function renderGroups'));
  const renderGroupsFn = js.slice(js.indexOf('function renderGroups'), js.indexOf('function renderTheme'));
  assert.ok(!renderWorksetFn.includes('个标签'));
  assert.ok(!renderWorksetFn.includes('个网页可以存下'));
  assert.ok(renderWorksetFn.includes('homeWindowText'));
  assert.ok(!renderGroupsFn.includes('groupTabs(state.tabs)'));
  assert.ok(!renderGroupsFn.includes('filterTabs(state.tabs'));
  assert.ok(renderGroupsFn.includes('tabsHeaderLine'));
  assert.ok(html.includes('0 个网页，来自 0 个网站'));
  assert.ok(!html.includes('0 个标签，来自 0 个网站'));
});

function memory(initial) {
  const store = { worksets: [], worksetsRev: 0 };
  Object.assign(store, initial || {});
  return {
    store,
    async get(defaults) {
      const out = {};
      Object.keys(defaults || {}).forEach((key) => {
        out[key] = Object.prototype.hasOwnProperty.call(store, key) ? structuredClone(store[key]) : defaults[key];
      });
      return out;
    },
    async set(partial) {
      Object.assign(store, structuredClone(partial));
    },
  };
}

(async () => {
  try {
    const stored = [1, 2, 3, 4, 5].map((n) => ws('w' + n, n * 10, ['https://h' + n + '.example/']));
    const proposal = helpers.proposeSaveWorkset(stored, [
      { title: 'nope', url: 'https://h2.example/#section' },
    ], { id: 'w9', name: '新', savedAt: 1000 });
    assert.strictEqual(proposal.reason, 'duplicate');
    const mem = memory({ worksets: stored, worksetsRev: 3 });
    const coord = collectionApi.createCollectionCoordinator(mem);
    const saved = await coord.commit({
      domain: 'worksets',
      ops: collectionApi.diffWorksets(stored, proposal.worksets),
    });
    assert.strictEqual(saved.ok, true);
    assert.notStrictEqual(saved.idempotent, true);
    assert.strictEqual(saved.rev, 4);
    assert.strictEqual(mem.store.worksetsRev, 4);
    assert.strictEqual(mem.store.worksets.length, 5);
    assert.strictEqual(mem.store.worksets[0].id, 'w2');
    assert.strictEqual(mem.store.worksets[0].savedAt, 1000);
    assert.deepStrictEqual(mem.store.worksets.map((w) => w.id), ['w2', 'w5', 'w4', 'w3', 'w1']);
    const retry = await coord.commit({
      domain: 'worksets',
      ops: collectionApi.diffWorksets(mem.store.worksets, proposal.worksets),
    });
    assert.strictEqual(retry.ok, true);
    assert.strictEqual(retry.idempotent, true);
    assert.strictEqual(retry.rev, 4);
    assert.strictEqual(mem.store.worksetsRev, 4);
    assert.strictEqual(mem.store.worksets.length, 5);
  } catch (err) {
    failures.push('worksetsRev on duplicate: ' + (err && err.message ? err.message : err));
  }
  if (failures.length) {
    console.error('test-w12-workset failures:\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('test-w12-workset: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
