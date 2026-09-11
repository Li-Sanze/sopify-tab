'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const EXT = path.join(__dirname, '..', 'extension');
const KNOWN_STORAGE_KEYS = [
  'sites', 'todos', 'notes', 'name', 'cwd', 'hostUpstream', 'themePreset',
];

function read(name) {
  return fs.readFileSync(path.join(EXT, name), 'utf8');
}

const html = read('newtab.html');
const css = read('newtab.css');
const js = read('newtab.js');
const manifest = JSON.parse(read('manifest.json'));
const desk = html.slice(html.indexOf('aria-labelledby="greet-h"'), html.indexOf('aria-labelledby="tabs-h"'));
const settings = html.slice(html.indexOf('aria-labelledby="settings-h"'));

assert.ok(desk.includes('id="resume"'), 'desk must have the resume strip');
assert.ok(desk.includes('下一件事'), 'resume kicker is 下一件事');
assert.ok(desk.includes('id="resume-act"'), 'resume has a primary action');
assert.ok(desk.includes('id="workset"') && desk.includes('id="workset-filter"'), 'workset list + filter');
assert.ok(desk.includes('id="notes-preview"'), 'notes one-line preview on desk');
assert.ok(!/class="card dock"/.test(desk), '常用站 is no longer a full-width dock');
assert.ok(desk.includes('class="card c-sites"'), '常用站 stays usable as a demoted card');
assert.ok(desk.indexOf('id="resume"') < desk.indexOf('class="deskgrid"'), 'resume sits above desk cards');
assert.ok(desk.indexOf('c-workset') < desk.indexOf('c-sites'), 'workset is above demoted 常用站');

assert.ok(!/未检测/.test(desk), 'desk empty states must not preach Host');
assert.ok(!/Host/.test(desk), 'desk must not mention Host');
assert.ok(!/CLI|--force|cursor-agent/.test(desk), 'desk must not mention CLI');
assert.ok(!desk.includes('hostUpstream') && !desk.includes('上游'));
assert.ok(!/天气|番茄|壁纸|小组件|widget wall|taxonomy/i.test(desk));

assert.ok(settings.includes('name="hostUpstream"'), 'upstream selector stays in settings');
assert.ok(html.includes('id="open-chat"') && html.includes('hidden'), 'chat stays rail-gated');

assert.ok(js.includes("const DESK_KEYS = ['sites', 'todos', 'notes', 'name']"));
assert.ok(js.includes('const WORKSET_CAP = 5'));
assert.ok(js.includes('function pickResume'));
assert.ok(js.includes("kind: 'todo'") && js.includes("kind: 'empty'"));
assert.ok(!/kind:\s*'tab'/.test(js) && !/kind:\s*'note'/.test(js), 'resume has no tab/note fallback kinds');
assert.ok(!/接着写/.test(js) && !/action:\s*'打开'/.test(js), 'resume no longer opens a tab or note');
assert.ok(js.includes("title: '还没有下一件事'"));
assert.ok(js.includes("action: '写一条'"));
assert.ok(js.includes("$('#todo-input')"), 'empty resume focuses the todo field');
assert.ok(js.includes('chrome.tabs.update'));
assert.ok(!/permissions\.request/.test(js) || /permissions\.request\(\s*\{\s*permissions:\s*\['nativeMessaging'\]\s*\}/.test(js),
  'no new optional permissions on the desk path');
assert.ok(!/chrome\.storage\.sync/.test(js));
assert.ok(!/worksetFilter/.test(js) || !/storage\.local\.set\(\s*\{[^}]*worksetFilter/.test(js),
  'workset filter must stay in memory');

const setKeys = [...js.matchAll(/storage\.local\.set\(\s*\{([^}]+)\}/g)].map((m) => m[1]);
for (const chunk of setKeys) {
  for (const key of chunk.match(/(\w+)\s*:/g) || []) {
    const name = key.replace(/\s*:/, '');
    assert.ok(KNOWN_STORAGE_KEYS.includes(name) || name === 'payload' || name === 'cwd' || name === 'hostUpstream',
      `unexpected storage key in set(): ${name}`);
  }
}
assert.ok(!/storage\.local\.set\(\s*\{[^}]*(resume|workset|anchor|nextAction)/.test(js),
  'no new resume/workset storage keys');

assert.deepStrictEqual(manifest.permissions, ['storage', 'tabs', 'sidePanel']);
assert.deepStrictEqual(manifest.optional_permissions, ['nativeMessaging']);

assert.ok(/\.resume\s*\{/.test(css), 'resume strip is styled');
assert.ok(/\.card\.c-workset\s*\{\s*grid-column:\s*1\s*\/\s*-1/.test(css), 'workset is secondary full-row');
assert.ok(!/\.card\.dock\s*\{\s*grid-column/.test(css), 'dock full-width rule is gone');
assert.ok(/\.resume-title[\s\S]*-webkit-line-clamp:\s*2/.test(css), 'resume title clamps to 2 lines');
assert.ok(/\.notes-preview/.test(css) && /text-overflow:\s*ellipsis/.test(css), 'notes preview is one line');
assert.ok(/@container desk \(max-width: 1019px\)/.test(css));
assert.ok(/@container desk \(max-width: 619px\)/.test(css));
assert.ok(/\.resume-row \.btn\s*\{\s*width:\s*100%/.test(css) || /max-width: 619px[\s\S]*resume-row/.test(css),
  'narrow resume action stacks');

const start = js.indexOf('function domainOf');
const end = js.indexOf('async function loadDesk');
assert.ok(start !== -1 && end > start, 'can extract desk helpers');
const helpers = new Function(`${js.slice(start, end)}; return { pickResume, noteOneLiner, worksetTabs, isDeskSummaryUrl };`)();

assert.strictEqual(helpers.noteOneLiner('  \n周四把常用站收一收。\n第二行'), '周四把常用站收一收。');
assert.strictEqual(helpers.noteOneLiner(''), '');
assert.ok(helpers.isDeskSummaryUrl('https://x.com/'));
assert.ok(!helpers.isDeskSummaryUrl('chrome://newtab'));
assert.ok(!helpers.isDeskSummaryUrl('chrome-extension://abc/newtab.html'));

const todo = { id: 'a', text: '写完书桌锚', done: false };
const done = { id: 'b', text: '已完成', done: true };
const tab = { id: 9, title: 'x.com', url: 'https://x.com/' };
const extra = [
  tab,
  { id: 10, title: 'GitHub', url: 'https://github.com/Li-Sanze/sopify-tab' },
  { id: 11, title: 'Docs', url: 'https://example.com/docs' },
  { id: 12, title: 'Mail', url: 'https://mail.example.com' },
  { id: 13, title: 'Drive', url: 'https://drive.example.com' },
  { id: 14, title: 'Sixth', url: 'https://sixth.example.com' },
];

assert.deepStrictEqual(helpers.pickResume([done, todo]), {
  kind: 'todo', title: '写完书桌锚', meta: '待办', action: '完成', todoId: 'a',
});
assert.deepStrictEqual(helpers.pickResume([done], extra, '便签一行'), {
  kind: 'empty', title: '还没有下一件事', meta: '', action: '写一条',
}, 'tabs and notes must not fill an empty resume');
assert.deepStrictEqual(helpers.pickResume([]), {
  kind: 'empty', title: '还没有下一件事', meta: '', action: '写一条',
});
assert.deepStrictEqual(helpers.pickResume([{ id: 'z', text: '   ', done: false }]), {
  kind: 'empty', title: '还没有下一件事', meta: '', action: '写一条',
});

const pages = helpers.worksetTabs([
  { url: 'chrome://extensions' },
  { url: 'https://x.com/' },
  { url: 'http://localhost:5173/' },
]);
assert.strictEqual(pages.length, 2);
assert.ok(js.includes('filtered.slice(0, WORKSET_CAP)'), 'desk workset applies the cap after filter');

assert.ok(js.includes("act.focus({ preventScroll: true })"), 'keyboard focus prefers resume');
assert.ok(!/chrome\.history|chrome\.bookmarks|topSites/.test(js), 'no new tab taxonomy APIs');

console.log('test-w11-resume: ok');
