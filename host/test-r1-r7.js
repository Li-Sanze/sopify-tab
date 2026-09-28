'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..');
const EXT = path.join(REPO, 'extension');
const noteSync = require(path.join(EXT, 'note-sync.js'));

function read(name) {
  return fs.readFileSync(path.join(EXT, name), 'utf8');
}

function braceBlock(src, start) {
  const i = src.indexOf(start);
  assert.ok(i !== -1, `missing ${start}`);
  const open = src.indexOf('{', i);
  let depth = 0;
  for (let p = open; p < src.length; p += 1) {
    if (src[p] === '{') depth += 1;
    else if (src[p] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(i, p + 1);
    }
  }
  throw new Error(`unclosed ${start}`);
}

async function main() {
const artifactDir = process.env.SOPIFY_ARTIFACT_DIR || '/opt/cursor/artifacts/r1-r7';
try { fs.rmSync(path.join(artifactDir, 'static-ok'), { force: true }); } catch { /* fresh run */ }
const js = read('newtab.js');
const side = read('sidepanel.js');
const html = read('newtab.html');
const start = js.indexOf('function domainOf');
const end = js.indexOf('async function loadDesk');
assert.ok(start !== -1 && end > start);
const helpers = new Function(
  'const WORKSET_TAB_CAP = 50; const WORKSET_TITLE_MAX = 200; ' +
  js.slice(start, end) +
  '; return { tabsToCloseForHost, closeHostButtonLabel, noteConflictView, domainWriteAllowed, refuseUnreadWrite, shouldApplyLoad, confirmDeskWrite, beginRestore, noteDraftIsDirty, planRestore, executeRestore, summarizeRestore, restoreToast, readDeskStorage };'
)();

const tabs = [
  { id: 1, title: 'alpha issue', url: 'https://github.com/a' },
  { id: 2, title: 'other page', url: 'https://github.com/b' },
  { id: 3, title: 'alpha docs', url: 'https://example.com/alpha' },
];
const filtered = helpers.tabsToCloseForHost(tabs, 'alpha', 'github.com').map((t) => t.id);
assert.deepStrictEqual(filtered, [1], 'R1 closes only the filtered host rows');
const all = helpers.tabsToCloseForHost(tabs, '', 'github.com').map((t) => t.id);
assert.deepStrictEqual(all, [1, 2], 'R1 without a filter still closes the whole host');
assert.deepStrictEqual(helpers.tabsToCloseForHost(tabs, 'alpha', 'example.com').map((t) => t.id), [3]);

const closeBody = braceBlock(js, 'async function closeHost(');
assert.ok(closeBody.includes('tabsToCloseForHost(state.tabs, state.filter, host)'));
assert.ok(closeBody.includes('筛选外的还在'));
assert.ok(closeBody.includes('没关掉'));
assert.ok(closeBody.includes('还有'));
assert.ok(closeBody.indexOf('if (failed > 0)') < closeBody.indexOf('已关闭'));
assert.ok(!/catch \{[^}]*已关闭/.test(closeBody));
assert.ok(js.includes('只关闭筛选里显示的这组'));
assert.strictEqual(helpers.closeHostButtonLabel(filtered.length), '关闭这 1 个标签');
assert.strictEqual(helpers.closeHostButtonLabel(all.length), '关闭这 2 个标签');
assert.ok(js.includes('closeHostButtonLabel(tabsToCloseForHost(state.tabs, q, host).length)'));
assert.ok(!js.includes('>关闭这组</button>'));

const plan = helpers.planRestore(
  [
    { title: 'X', url: 'https://x.com/' },
    { title: 'New', url: 'https://new.example/' },
    { title: 'Bad', url: 'https://fail.example/' },
  ],
  [{ id: 9, url: 'https://x.com/' }],
);
assert.deepStrictEqual(plan.activate, [{ id: 9, url: 'https://x.com/' }]);
assert.deepStrictEqual(plan.create, ['https://new.example/', 'https://fail.example/']);
assert.deepStrictEqual(plan.skip, [{ id: 9, url: 'https://x.com/' }]);

const partial = await helpers.executeRestore(plan, {
  async create(opts) {
    if (String(opts.url).includes('fail')) throw new Error('blocked');
    return { id: 21 };
  },
  async activate() { return true; },
});
assert.deepStrictEqual(
  { opened: partial.opened, skipped: partial.skipped, failed: partial.failed, focusOk: partial.focusOk },
  { opened: 1, skipped: 1, failed: 1, focusOk: true },
);
const partialSummary = helpers.summarizeRestore(plan, partial);
assert.strictEqual(partialSummary.complete, false);
assert.strictEqual(partialSummary.tone, 'partial');
const partialToast = helpers.restoreToast('上午', partialSummary);
assert.ok(partialToast.includes('没打开'), partialToast);
assert.ok(!partialToast.includes('已恢复'), partialToast);
assert.deepStrictEqual(partial.unopened, ['https://fail.example/']);
const retryPlan = helpers.planRestore(
  partial.unopened.map((url) => ({ title: url, url: url })),
  [{ id: 9, url: 'https://x.com/' }, { id: 21, url: 'https://new.example/' }],
);
assert.deepStrictEqual(retryPlan.create, ['https://fail.example/']);
assert.deepStrictEqual(retryPlan.activate, []);
const already = helpers.planRestore(
  [{ title: 'bad', url: 'https://fail.example/' }],
  [{ id: 4, url: 'https://fail.example/' }],
);
assert.deepStrictEqual(already.create, []);
assert.ok(html.includes('id="workset-retry-unopened"') && html.includes('重试未打开'));
assert.ok(braceBlock(js, 'async function executeRestore').includes('unopened'));
assert.ok(braceBlock(js, 'async function retryUnopened').includes('planRestore(pending.urls.map'));

const noTabs = await helpers.executeRestore(plan, null);
assert.strictEqual(noTabs.opened, 0);
assert.ok(noTabs.failed >= 3);
assert.strictEqual(helpers.summarizeRestore(plan, noTabs).complete, false);
assert.ok(helpers.restoreToast('上午', helpers.summarizeRestore(plan, noTabs)).includes('没能恢复'));

const focusFail = await helpers.executeRestore(
  { activate: [{ id: 9, url: 'https://x.com/' }], create: [] },
  { async create() { return { id: 1 }; }, async activate() { throw new Error('gone'); } },
);
const focusSummary = helpers.summarizeRestore(
  { activate: [{ id: 9, url: 'https://x.com/' }], create: [] },
  focusFail,
);
assert.strictEqual(focusSummary.complete, false);
assert.ok(helpers.restoreToast('上午', focusSummary).includes('没能切过去'));

const full = await helpers.executeRestore(
  { activate: [], create: ['https://new.example/'] },
  { async create() { return { id: 4 }; }, async activate() {} },
);
const fullSummary = helpers.summarizeRestore({ activate: [], create: ['https://new.example/'] }, full);
assert.strictEqual(fullSummary.complete, true);
assert.strictEqual(helpers.restoreToast('上午', fullSummary), '已恢复「上午」');
assert.strictEqual(helpers.beginRestore(false, [{ id: 1 }]).abort, true);
assert.deepStrictEqual(helpers.beginRestore(false, [{ id: 1 }]).open, []);
assert.strictEqual(helpers.beginRestore(true, [{ id: 3 }]).abort, false);
assert.deepStrictEqual(helpers.beginRestore(true, [{ id: 3 }]).open, [{ id: 3 }]);
const restoreFn = braceBlock(js, 'async function restoreWorksetById');
assert.ok(restoreFn.includes('beginRestore'));
assert.ok(restoreFn.includes('没有恢复'));
assert.ok(!restoreFn.includes('catch { open = [] }'));
assert.ok(restoreFn.indexOf('started.abort') < restoreFn.indexOf('planRestore'));
assert.strictEqual(helpers.noteDraftIsDirty('这边', '这边', false), false);
assert.strictEqual(helpers.noteDraftIsDirty('这边草稿', '这边', false), true);
assert.strictEqual(helpers.noteDraftIsDirty('这边', '这边', true), true);
const fieldFn = braceBlock(js, 'function noteFieldEditing()');
assert.ok(fieldFn.includes('noteDraftIsDirty'));
assert.ok(fieldFn.includes('notePending'));
assert.ok(!fieldFn.includes('activeElement'));

const loaded = await helpers.readDeskStorage(async () => ({
  sites: [{ name: '站', url: 'https://example.com' }],
  todos: [],
  notes: '原便签',
  name: '',
  notesRev: 2,
  notesStamp: 'old',
}));
assert.strictEqual(loaded.ok, true);
assert.strictEqual(loaded.loadError, false);
assert.strictEqual(loaded.notes, '原便签');
assert.strictEqual(loaded.notesRev, 2);
const failedRead = await helpers.readDeskStorage(async () => { throw new Error('disk'); });
assert.strictEqual(failedRead.ok, false);
assert.strictEqual(failedRead.loadError, true);
assert.strictEqual(failedRead.sites, undefined);
assert.strictEqual(failedRead.todos, undefined);
assert.strictEqual(failedRead.notes, undefined);
assert.ok(braceBlock(js, 'async function loadDesk(').includes('readDeskStorage'));
assert.ok(braceBlock(js, 'async function loadWorksets(').includes('return null'));
assert.ok(!braceBlock(js, 'async function loadCwd(').includes('deskLoadBroken'));
assert.ok(!braceBlock(js, 'async function loadUpstream(').includes('deskLoadBroken'));
assert.ok(!braceBlock(js, 'async function boot()').includes('saveUpstream'));
assert.ok(html.includes('id="todo-load-error"') && html.includes('待办暂时没能读取') && html.includes('>重试<'));
assert.ok(html.includes('id="workset-load-error"') && html.includes('存下的窗口暂时没能读取'));
assert.strictEqual(helpers.shouldApplyLoad(1, 2), false);
assert.strictEqual(helpers.shouldApplyLoad(2, 2), true);
assert.ok(js.includes('shouldApplyLoad'));

const pump = braceBlock(js, 'function pumpNoteSave()');
assert.ok(pump.includes('saveDesk({ notes: state.notes })'));
assert.ok(pump.includes("setNotesSavedStatus('已存在本机')"));
assert.ok(pump.includes("setNotesSavedStatus('没存上')"));
const saveBody = braceBlock(js, 'async function saveDesk(');
assert.ok(saveBody.includes('skipped: true'));
assert.ok(saveBody.includes('notesRev'));
assert.ok(html.includes('id="note-conflict"') && html.includes('使用另一页内容') && html.includes('保存我的内容'));
assert.ok(html.includes('id="note-show-conflict"') && html.includes('查看更新'));
assert.ok(html.includes('id="note-dismiss-conflict"') && html.includes('先不选'));
assert.ok(html.includes('我的输入') && html.includes('另一页内容'));
assert.ok(html.includes('另一页又有更新，请重新确认。'));
assert.ok(html.includes('id="note-local-preview"') && html.includes('id="note-remote-preview"'));
const both = helpers.noteConflictView('这边还在写', '另一页已经改好');
assert.strictEqual(both.local, '这边还在写');
assert.strictEqual(both.remote, '另一页已经改好');
assert.strictEqual(both.localFull, '这边还在写');
assert.strictEqual(both.remoteFull, '另一页已经改好');
assert.strictEqual(both.localLong, false);
assert.notStrictEqual(both.local, both.remote);
assert.strictEqual(helpers.noteConflictView('', '  ').local, '还没写');
const longLocal = '本'.repeat(80);
const longRemote = '页'.repeat(90);
const longView = helpers.noteConflictView(longLocal, longRemote);
assert.strictEqual(longView.localFull, longLocal);
assert.strictEqual(longView.remoteFull, longRemote);
assert.strictEqual(longView.localLong, true);
assert.ok(longView.local.endsWith('…') && [...longView.local].length === 73);
assert.notStrictEqual(longView.local, longView.localFull);
assert.ok(braceBlock(js, 'function showNoteConflict').includes('noteConflictView'));
assert.ok(braceBlock(js, 'function showNoteConflict').includes('paintConflictSide'));
assert.ok(braceBlock(js, 'function paintConflictSide').includes('note-local-preview'));
assert.ok(braceBlock(js, 'function paintConflictSide').includes('note-remote-preview'));
assert.ok(braceBlock(js, 'function showNoteConflict').includes('localFull'));
assert.ok(html.includes('id="note-local-expand"') && html.includes('id="note-remote-expand"'));
assert.ok(html.includes('展开全文'));

const guard = noteSync.createImeGuard(() => 1000);
let now = 1000;
const clocked = noteSync.createImeGuard(() => now);
assert.strictEqual(clocked.blocks({ key: 'Enter' }), false);
clocked.onCompositionStart();
assert.strictEqual(clocked.blocks({ key: 'Enter' }), true);
clocked.onCompositionEnd();
assert.strictEqual(clocked.blocks({ key: 'Enter' }), true);
now = 1041;
assert.strictEqual(clocked.blocks({ key: 'Enter' }), false);
assert.strictEqual(noteSync.imeBlocksSubmit({ key: 'Enter', isComposing: true }), true);
assert.strictEqual(noteSync.imeBlocksSubmit({ key: 'Process' }), true);
assert.strictEqual(noteSync.imeBlocksSubmit({ key: 'a', keyCode: 229 }), true);
assert.strictEqual(guard.blocks({ key: 'a' }), false);
assert.ok(side.includes("e.isComposing || e.key === 'Process' || composeIme.blocks(e)"));
assert.ok(side.includes("addEventListener('compositionstart'"));
assert.ok(side.includes('!e.shiftKey'));
assert.ok(js.includes("e.isComposing || e.key === 'Process' || renameIme.blocks(e)"));
assert.ok(js.includes('dialogIme.blocks(e)'));
assert.ok(js.includes('todoIme.blocks(e)'));
assert.ok(js.includes('siteIme.blocks(e)'));

function createSharedStorage(opt) {
  const options = opt || {};
  const store = {
    notes: typeof options.notes === 'string' ? options.notes : '',
    notesRev: options.notesRev || 0,
    notesStamp: options.notesStamp || '',
  };
  const listeners = [];
  let fail = 0;
  const delay = options.delay || 0;
  let chain = Promise.resolve();
  const events = [];
  return {
    store,
    events,
    listen(fn) { listeners.push(fn); },
    failNext(n) { fail = n; },
    get(defaults) {
      events.push('get');
      const out = {};
      Object.keys(defaults || {}).forEach((k) => {
        out[k] = Object.prototype.hasOwnProperty.call(store, k) ? store[k] : defaults[k];
      });
      return Promise.resolve(out);
    },
    set(partial) {
      const run = chain.then(async () => {
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        if (fail > 0) {
          fail -= 1;
          events.push('reject');
          throw new Error('storage failed');
        }
        const changes = {};
        Object.keys(partial || {}).forEach((k) => {
          changes[k] = { oldValue: store[k], newValue: partial[k] };
          store[k] = partial[k];
        });
        events.push('change');
        listeners.forEach((fn) => fn(changes));
        events.push('ack');
      });
      chain = run.then(() => {}, () => {});
      return run;
    },
  };
}

function wire(storage, keepers) {
  storage.listen((changes) => {
    const payload = {
      notes: changes.notes ? changes.notes.newValue : storage.store.notes,
      notesRev: changes.notesRev ? changes.notesRev.newValue : storage.store.notesRev,
      notesStamp: changes.notesStamp ? changes.notesStamp.newValue : storage.store.notesStamp,
    };
    keepers.forEach((keeper) => keeper.handleRemote(payload));
  });
}

function saver(storage) {
  return async function save(text, meta) {
    await storage.set({ notes: text, notesRev: meta.rev, notesStamp: meta.stamp });
    return { ok: true };
  };
}

function page(storage, id, coordinator) {
  const box = { status: '' };
  const keeper = noteSync.createNoteKeeper({
    pageId: id,
    storage,
    coordinator: coordinator || null,
    onStatus(text) { box.status = text; },
  });
  keeper.absorbBoot({
    notes: storage.store.notes,
    notesRev: storage.store.notesRev,
    notesStamp: storage.store.notesStamp,
  });
  return { keeper, box };
}

async function settleStatus(box, result) {
  if (result && result.ok) box.status = '已存在本机';
  else if (result && result.conflict) box.status = box.status || '便签在另一页更新了';
  else box.status = '没存上';
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const shared = createSharedStorage({ notes: 'base', notesRev: 1, notesStamp: 'seed' });
const pageA = page(shared, 'A');
const pageB = page(shared, 'B');
const idle = page(shared, 'idle');
wire(shared, [pageA.keeper, pageB.keeper, idle.keeper]);
pageB.keeper.remember('from B');
pageA.keeper.remember('from A');
const savedA = await pageA.keeper.commit('from A', saver(shared));
await settleStatus(pageA.box, savedA);
assert.strictEqual(savedA.ok, true);
assert.strictEqual(shared.store.notes, 'from A');
assert.strictEqual(idle.keeper.snapshot().text, 'from A', 'idle page applies the other write');
assert.strictEqual(idle.keeper.snapshot().conflict, null);
assert.strictEqual(pageB.keeper.snapshot().text, 'from B');
assert.ok(pageB.keeper.snapshot().conflict, 'editing page keeps its draft');
assert.ok(shared.events.indexOf('change') < shared.events.indexOf('ack'), 'change is delivered before ack');

const savedB = await pageB.keeper.commit('from B', saver(shared));
await settleStatus(pageB.box, savedB);
assert.strictEqual(savedB.ok, false);
assert.strictEqual(savedB.conflict, true);
assert.strictEqual(shared.store.notes, 'from A', 'stale page must not clobber');
assert.notStrictEqual(pageB.box.status, '已存在本机');
assert.strictEqual(pageB.keeper.snapshot().text, 'from B');
const accepted = pageB.keeper.acceptRemote();
assert.strictEqual(accepted, 'from A');
assert.strictEqual(pageB.keeper.hasConflict(), false);
assert.strictEqual(pageB.keeper.snapshot().rev, pageA.keeper.snapshot().rev);

pageB.keeper.remember('local B');
pageA.keeper.remember('from A2');
const savedA2 = await pageA.keeper.commit('from A2', saver(shared));
assert.strictEqual(savedA2.ok, true);
assert.strictEqual(shared.store.notes, 'from A2');
assert.strictEqual(pageB.keeper.snapshot().text, 'local B');
const blocked = await pageB.keeper.commit('local B', saver(shared));
assert.strictEqual(blocked.ok, false);
assert.strictEqual(blocked.conflict, true);
assert.strictEqual(shared.store.notes, 'from A2');
pageB.keeper.armForce();
const forced = await pageB.keeper.commit('local B', saver(shared));
await settleStatus(pageB.box, forced);
assert.strictEqual(forced.ok, true);
assert.strictEqual(shared.store.notes, 'local B');
assert.strictEqual(idle.keeper.snapshot().text, 'local B');

const reviewStore = createSharedStorage({ notes: 'v1', notesRev: 1, notesStamp: 's1' });
const reviewCoord = noteSync.createNoteCoordinator(reviewStore);
const reviewer = page(reviewStore, 'rev', reviewCoord);
const mover = page(reviewStore, 'mov', reviewCoord);
wire(reviewStore, [reviewer.keeper, mover.keeper]);
reviewer.keeper.remember('my draft');
mover.keeper.remember('v2');
const wroteV2 = await mover.keeper.commit('v2');
assert.strictEqual(wroteV2.ok, true);
assert.strictEqual(reviewer.keeper.snapshot().conflict.remoteText, 'v2');
reviewer.keeper.armForce();
mover.keeper.remember('v3');
const wroteV3 = await mover.keeper.commit('v3');
assert.strictEqual(wroteV3.ok, true);
const lateForce = await reviewer.keeper.commit('my draft');
assert.strictEqual(lateForce.ok, false);
assert.strictEqual(lateForce.conflict, true);
assert.strictEqual(reviewStore.store.notes, 'v3');
assert.notStrictEqual(reviewStore.store.notes, 'my draft');
assert.strictEqual(reviewer.keeper.snapshot().text, 'my draft');

function createBarrier(n) {
  let arrived = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  return {
    wait() {
      arrived += 1;
      if (arrived >= n) release();
      return gate;
    },
  };
}

const originalA = 'left text';
const originalB = 'right text';
const overlapStore = createSharedStorage({ notes: '', notesRev: 0, delay: 30 });
const overlapCoord = noteSync.createNoteCoordinator(overlapStore);
assert.strictEqual(typeof noteSync.createNoteCoordinator, 'function');
const left = page(overlapStore, 'L', overlapCoord);
const right = page(overlapStore, 'R', overlapCoord);
wire(overlapStore, [left.keeper, right.keeper]);
left.keeper.remember(originalA);
right.keeper.remember(originalB);
const barrier = createBarrier(2);
async function startSide(side, text) {
  await barrier.wait();
  return side.keeper.commit(text);
}
const pair = await Promise.all([
  startSide(left, originalA),
  startSide(right, originalB),
]);
await settleStatus(left.box, pair[0]);
await settleStatus(right.box, pair[1]);
assert.strictEqual(pair[0].ok, true);
assert.strictEqual(pair[1].ok, false);
assert.strictEqual(pair[1].conflict, true);
assert.strictEqual(overlapStore.store.notes, originalA);
assert.notStrictEqual(overlapStore.store.notes, originalB);
assert.strictEqual(left.keeper.snapshot().text, originalA);
assert.strictEqual(right.keeper.snapshot().text, originalB);
assert.strictEqual(overlapStore.events.filter((e) => e === 'change').length, 1);
const bg = read('background.js');
assert.ok(bg.includes("importScripts('note-sync.js', 'collection-sync.js')"));
assert.ok(bg.includes('sopify-note-commit'));
assert.ok(bg.includes('createNoteCoordinator'));

const rejectStore = createSharedStorage({ notes: 'safe', notesRev: 3, notesStamp: 's' });
const rejectPage = page(rejectStore, 'E');
rejectStore.failNext(1);
rejectPage.keeper.remember('nope');
const rejected = await rejectPage.keeper.commit('nope', saver(rejectStore));
await settleStatus(rejectPage.box, rejected);
assert.strictEqual(rejected.ok, false);
assert.strictEqual(rejectStore.store.notes, 'safe');
assert.notStrictEqual(rejectPage.box.status, '已存在本机');

const skipKeeper = noteSync.createNoteKeeper({ pageId: 'skip', storage: null });
skipKeeper.absorbBoot({ notes: '', notesRev: 0, notesStamp: '' });
let skipSaves = 0;
const skipped = await skipKeeper.commit('ghost', async () => { skipSaves += 1; return { ok: true }; });
assert.strictEqual(skipped.ok, false);
assert.strictEqual(skipped.skipped, true);
assert.strictEqual(skipSaves, 0);

const lieStore = createSharedStorage({ notes: '', notesRev: 0 });
const liePage = page(lieStore, 'lie');
const lied = await liePage.keeper.commit('claimed', async () => ({ ok: true }));
await settleStatus(liePage.box, lied);
assert.strictEqual(lied.ok, false);
assert.notStrictEqual(liePage.box.status, '已存在本机');
assert.strictEqual(lieStore.store.notes, '');

const dirtyStore = createSharedStorage({ notes: 'old', notesRev: 1, notesStamp: 's0' });
const editing = page(dirtyStore, 'edit');
const remote = page(dirtyStore, 'remote');
wire(dirtyStore, [editing.keeper, remote.keeper]);
editing.keeper.remember('still typing');
remote.keeper.remember('remote saved');
const remoteSaved = await remote.keeper.commit('remote saved', saver(dirtyStore));
assert.strictEqual(remoteSaved.ok, true);
assert.strictEqual(editing.keeper.snapshot().text, 'still typing');
assert.ok(editing.keeper.snapshot().conflict, 'in-progress edit is not overwritten');
assert.strictEqual(editing.keeper.snapshot().conflict.remoteText, 'remote saved');
assert.notStrictEqual(editing.keeper.snapshot().text, editing.keeper.snapshot().conflict.remoteText);
assert.strictEqual(editing.box.status, '便签在另一页更新了');
assert.strictEqual(pageA.keeper.snapshot().conflict, null, 'own save echo does not open a conflict');

assert.deepStrictEqual(helpers.confirmDeskWrite({ ok: true }, { ok: true }), { ok: true });
assert.strictEqual(helpers.confirmDeskWrite({ ok: false, skipped: true }, null).ok, false);
assert.strictEqual(helpers.confirmDeskWrite({ ok: false, skipped: true }, null).skipped, true);
assert.strictEqual(helpers.confirmDeskWrite({ ok: true }, { ok: false }).ok, false);
assert.strictEqual(helpers.confirmDeskWrite(null, null).ok, false);

function memoryStorage(initial) {
  const store = Object.assign({}, initial || {});
  return {
    store,
    fail: false,
    lie: false,
    async get(defaults) {
      const out = {};
      Object.keys(defaults || {}).forEach((k) => {
        out[k] = Object.prototype.hasOwnProperty.call(store, k) ? store[k] : defaults[k];
      });
      return out;
    },
    async set(partial) {
      if (this.fail) throw new Error('storage failed');
      if (this.lie) return;
      Object.assign(store, partial || {});
    },
  };
}

async function commitKey(storage, key, value) {
  if (!storage) return helpers.confirmDeskWrite({ ok: false, skipped: true }, null);
  try {
    await storage.set({ [key]: value });
  } catch {
    return helpers.confirmDeskWrite(null, null);
  }
  const got = await storage.get({ [key]: null });
  const match = JSON.stringify(got[key]) === JSON.stringify(value);
  return helpers.confirmDeskWrite({ ok: true }, { ok: match });
}

function formAfter(outcome, storage, key, draft, previous) {
  if (outcome.ok) return { value: '', toast: 'ok', error: '', stored: storage.store[key] };
  return {
    value: draft,
    toast: '',
    error: '没存上',
    stored: storage ? storage.store[key] : previous,
  };
}

for (const key of ['todos', 'sites', 'worksets']) {
  const previous = key === 'notes' ? '' : [];
  const draft = [{ id: '1', text: key }];
  const okStore = memoryStorage({ [key]: previous });
  const landed = await commitKey(okStore, key, draft);
  const okUi = formAfter(landed, okStore, key, draft, previous);
  assert.strictEqual(landed.ok, true, key);
  assert.strictEqual(okUi.toast, 'ok');
  assert.strictEqual(okUi.value, '');
  assert.deepStrictEqual(okUi.stored, draft);

  const bad = memoryStorage({ [key]: previous });
  bad.fail = true;
  const rejected = await commitKey(bad, key, draft);
  const badUi = formAfter(rejected, bad, key, draft, previous);
  assert.strictEqual(rejected.ok, false, key);
  assert.strictEqual(badUi.toast, '');
  assert.deepStrictEqual(badUi.value, draft);
  assert.deepStrictEqual(badUi.stored, previous);

  const liar = memoryStorage({ [key]: previous });
  liar.lie = true;
  const liedKey = await commitKey(liar, key, draft);
  const lieUi = formAfter(liedKey, liar, key, draft, previous);
  assert.strictEqual(liedKey.ok, false, key);
  assert.strictEqual(lieUi.toast, '');
  assert.deepStrictEqual(lieUi.stored, previous);
}

const skippedWrite = await commitKey(null, 'todos', [{ id: 'x' }]);
assert.strictEqual(skippedWrite.ok, false);
assert.strictEqual(skippedWrite.skipped, true);
const skippedUi = formAfter(skippedWrite, null, 'todos', [{ id: 'x' }], []);
assert.strictEqual(skippedUi.toast, '');
assert.deepStrictEqual(skippedUi.value, [{ id: 'x' }]);

function between(src, a, b) {
  const i = src.indexOf(a);
  const j = src.indexOf(b, i + a.length);
  assert.ok(i !== -1 && j > i, a);
  return src.slice(i, j);
}
const todoForm = between(js, "$('#todo-form').addEventListener('submit'", "$('#todos').addEventListener('change'");
assert.ok(todoForm.includes('await replaceTodos('));
assert.ok(todoForm.indexOf('await replaceTodos') < todoForm.indexOf("input.value = ''"));
assert.ok(!todoForm.includes('saveDesk({ todos'));
const siteForm = between(js, "$('#site-form').addEventListener('submit'", 'const onSiteRemoveClick');
assert.ok(siteForm.includes('await commitDesk({ sites:'));
assert.ok(siteForm.indexOf('await commitDesk') < siteForm.indexOf("nameInput.value = ''"));
assert.ok(siteForm.indexOf('await commitDesk') < siteForm.indexOf('已加入'));
const saveWin = braceBlock(js, 'async function saveThisWindow');
assert.ok(saveWin.includes('await persistWorksets(proposal.worksets)'));
assert.ok(saveWin.indexOf('await persistWorksets(proposal.worksets)') < saveWin.indexOf('已存下这个窗口'));
assert.ok(saveWin.includes('savedWindow.ok !== true'));
const persistBody = braceBlock(js, 'async function persistWorksets');
assert.ok(persistBody.includes('confirmDeskWrite'));
assert.ok(persistBody.includes('requestCollectionCommit'));
assert.ok(persistBody.indexOf('requestCollectionCommit') < persistBody.indexOf('state.worksets ='));
assert.ok(braceBlock(js, 'async function commitDesk').includes('confirmDeskWrite'));
assert.ok(braceBlock(js, 'async function commitDesk').includes('refuseUnreadWrite'));
assert.ok(braceBlock(js, 'async function persistWorksets').includes("domainWriteAllowed(domainUnread, 'worksets')"));
assert.ok(braceBlock(js, 'function queueNoteSave()').includes("domainWriteAllowed(domainUnread, 'notes')"));
assert.ok(braceBlock(js, 'async function loadWorksets(').includes('return null'));
const bootFn = braceBlock(js, 'async function boot()');
assert.ok(bootFn.includes('markDeskUnread'));
assert.ok(!bootFn.slice(bootFn.lastIndexOf('catch')).includes('applyDesk'));
for (const key of ['todos', 'sites', 'notes', 'worksets']) {
  assert.strictEqual(helpers.domainWriteAllowed({ [key]: true }, key), false, key);
  assert.deepStrictEqual(helpers.refuseUnreadWrite({ [key]: true }, key), { ok: false, blocked: true });
  assert.strictEqual(helpers.domainWriteAllowed({ [key]: false }, key), true, key);
}
const originalTodos = [{ id: 'keep', text: '原来的待办', done: false }];
const todoStore = { todos: originalTodos.map((t) => ({ id: t.id, text: t.text, done: t.done })) };
let todoSets = 0;
async function addTodoAfterFailedRead(text) {
  const refused = helpers.refuseUnreadWrite({ todos: true }, 'todos');
  if (refused) return Object.assign({ stored: todoStore.todos.map((t) => ({ ...t })) }, refused);
  todoSets += 1;
  todoStore.todos = todoStore.todos.concat([{ id: 'new', text: text, done: false }]);
  return { ok: true, stored: todoStore.todos.map((t) => ({ ...t })) };
}
const blockedAdd = await addTodoAfterFailedRead('不该盖掉');
assert.strictEqual(blockedAdd.ok, false);
assert.strictEqual(blockedAdd.blocked, true);
assert.strictEqual(todoSets, 0);
assert.strictEqual(blockedAdd.stored.length, 1);
assert.strictEqual(blockedAdd.stored[0].text, '原来的待办');
assert.ok(!blockedAdd.stored.some((t) => t.text === '不该盖掉'));
assert.ok(braceBlock(js, 'async function commitTodoFromDialog').includes('await replaceTodos'));
assert.ok(html.includes('id="todo-save-error"') && html.includes('id="site-save-error"') && html.includes('id="workset-save-error"'));

const keptTodos = [{ id: 'old', text: '必须保留的原待办', done: false }];
const todoDisk = { todos: keptTodos.map((t) => ({ ...t })), sites: [{ name: '旧站', url: 'https://old.example' }], worksets: [{ id: 'w', name: '上午' }] };
let todoWrites = 0;
async function tryDeskWrite(key, next) {
  const refused = helpers.refuseUnreadWrite({ [key]: true }, key);
  if (refused) return refused;
  todoWrites += 1;
  todoDisk[key] = next;
  return { ok: true };
}
const added = await tryDeskWrite('todos', todoDisk.todos.concat([{ id: 'new', text: '读取失败后新增', done: false }]));
assert.strictEqual(added.blocked, true);
assert.strictEqual(todoWrites, 0);
assert.deepStrictEqual(todoDisk.todos, keptTodos);
const removed = await tryDeskWrite('todos', []);
assert.strictEqual(removed.blocked, true);
assert.deepStrictEqual(todoDisk.todos, keptTodos);
const siteWrite = await tryDeskWrite('sites', []);
assert.strictEqual(siteWrite.blocked, true);
assert.strictEqual(todoDisk.sites.length, 1);
const setWrite = await tryDeskWrite('worksets', []);
assert.strictEqual(setWrite.blocked, true);
assert.strictEqual(todoDisk.worksets.length, 1);

const raceStore = { notes: 'base', notesRev: 0, notesStamp: 'seed' };
const raceStorage = { get: async () => structuredClone(raceStore) };
const raceA = noteSync.createNoteKeeper({ pageId: 'A', storage: raceStorage });
const raceB = noteSync.createNoteKeeper({ pageId: 'B', storage: raceStorage });
raceA.absorbBoot(raceStore);
raceB.absorbBoot(raceStore);
const sanzeA = 'A 新内容';
const sanzeB = 'B 新内容';
raceA.remember(sanzeA);
raceB.remember(sanzeB);
function raceSave(text, meta) {
  Object.assign(raceStore, { notes: text, notesRev: meta.rev, notesStamp: meta.stamp });
  raceA.handleRemote(structuredClone(raceStore));
  raceB.handleRemote(structuredClone(raceStore));
  return Promise.resolve({ ok: true });
}
let releaseRace;
const aAck = new Promise((resolve) => { releaseRace = resolve; });
const raceResults = await Promise.all([
  raceA.commit(sanzeA, raceSave).then((result) => { releaseRace(); return result; }),
  raceB.commit(sanzeB, async (text, meta) => { await aAck; return raceSave(text, meta); }),
]);
assert.strictEqual(raceResults[0].ok, true);
assert.strictEqual(raceResults[1].ok, false);
assert.strictEqual(raceResults[1].conflict, true);
assert.strictEqual(raceStore.notes, sanzeA);
assert.notStrictEqual(raceStore.notes, sanzeB);
assert.strictEqual(raceA.snapshot().text, sanzeA);
assert.strictEqual(raceA.snapshot().conflict, null);
assert.strictEqual(raceB.snapshot().text, sanzeB);
assert.ok(raceB.snapshot().conflict);
assert.strictEqual(raceB.snapshot().conflict.remoteText, sanzeA);

const typingStore = createSharedStorage({ notes: 'base', notesRev: 0, notesStamp: 'seed' });
const typing = page(typingStore, 'type');
let releaseSave;
const saveGate = new Promise((resolve) => { releaseSave = resolve; });
typing.keeper.remember('A1');
const typingPromise = typing.keeper.commit('A1', async (text, meta) => {
  await saveGate;
  await typingStore.set({ notes: text, notesRev: meta.rev, notesStamp: meta.stamp });
  return { ok: true };
});
typing.keeper.remember('A2');
releaseSave();
const typed = await typingPromise;
assert.strictEqual(typed.ok, true);
assert.strictEqual(typing.keeper.snapshot().text, 'A2');
assert.strictEqual(typing.keeper.snapshot().acked, 'A1');
assert.notStrictEqual(typing.keeper.snapshot().text, typingStore.store.notes);

const sharedPrefix = '相同的开头'.repeat(16);
const fullA = sharedPrefix + '这边后文不同';
const fullB = sharedPrefix + '另一页后文不同';
const longDiff = helpers.noteConflictView(fullA, fullB);
assert.strictEqual(longDiff.localFull, fullA);
assert.strictEqual(longDiff.remoteFull, fullB);
assert.notStrictEqual(longDiff.localFull, longDiff.remoteFull);
assert.ok(longDiff.localLong && longDiff.remoteLong);

let restartWrites = 0;
const restartStore = createSharedStorage({ notes: 'base', notesRev: 0, notesStamp: 'seed' });
const wrapped = {
  get: (defaults) => restartStore.get(defaults),
  set: async (partial) => { restartWrites += 1; return restartStore.set(partial); },
};
const firstCoord = noteSync.createNoteCoordinator(wrapped);
const req = {
  text: '落地了',
  baselineNotes: 'base',
  baselineRev: 0,
  baselineStamp: 'seed',
  stamp: 'req-same',
};
const firstWrite = await firstCoord.commit(req);
assert.strictEqual(firstWrite.ok, true);
assert.strictEqual(restartWrites, 1);
const restarted = noteSync.createNoteCoordinator(wrapped);
const replay = await restarted.commit(req);
assert.strictEqual(replay.ok, true);
assert.strictEqual(replay.idempotent, true);
assert.strictEqual(restartWrites, 1);
assert.strictEqual(restartStore.store.notes, '落地了');

let fallbackSaves = 0;
const failedKeeper = noteSync.createNoteKeeper({
  pageId: 'down',
  storage: restartStore,
  coordinator: { commit: async () => { throw new Error('worker gone'); } },
});
failedKeeper.absorbBoot({ notes: 'base', notesRev: 0, notesStamp: 'seed' });
failedKeeper.remember('别直接写');
const failedSend = await failedKeeper.commit('别直接写', async () => { fallbackSaves += 1; return { ok: true }; });
assert.strictEqual(failedSend.ok, false);
assert.strictEqual(fallbackSaves, 0);

try {
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, 'static-ok'), 'pass\n');
} catch (err) {
  console.log(`static marker skipped: ${err && err.code ? err.code : err}`);
}
console.log('test-r1-r7: ok');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
