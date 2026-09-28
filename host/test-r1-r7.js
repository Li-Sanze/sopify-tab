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
const js = read('newtab.js');
const side = read('sidepanel.js');
const html = read('newtab.html');
const start = js.indexOf('function domainOf');
const end = js.indexOf('async function loadDesk');
assert.ok(start !== -1 && end > start);
const helpers = new Function(
  'const WORKSET_TAB_CAP = 50; const WORKSET_TITLE_MAX = 200; ' +
  js.slice(start, end) +
  '; return { tabsToCloseForHost, planRestore, executeRestore, summarizeRestore, restoreToast, readDeskStorage };'
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
assert.ok(js.includes('只关闭筛选里显示的这组'));
assert.ok(js.includes('>关闭这组</button>') || js.includes('关闭这组</button>'));

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

const loaded = await helpers.readDeskStorage(async () => ({
  sites: [{ name: '站', url: 'https://example.com' }],
  todos: [],
  notes: '原便签',
  name: '',
  notesRev: 2,
  notesStamp: 'old',
}));
assert.strictEqual(loaded.loadError, false);
assert.strictEqual(loaded.notes, '原便签');
assert.strictEqual(loaded.notesRev, 2);
const failedRead = await helpers.readDeskStorage(async () => { throw new Error('disk'); });
assert.strictEqual(failedRead.loadError, true);
assert.deepStrictEqual(failedRead.sites, []);
assert.strictEqual(failedRead.notes, '');
assert.ok(braceBlock(js, 'async function loadDesk(').includes('readDeskStorage'));
assert.ok(braceBlock(js, 'async function loadWorksets(').includes('catch'));
assert.ok(braceBlock(js, 'async function loadCwd(').includes('catch'));
assert.ok(braceBlock(js, 'async function loadUpstream(').includes('catch'));
assert.ok(html.includes('id="desk-load-error"') && html.includes('再试一次'));
assert.ok(js.includes('showDeskLoadError'));

const pump = braceBlock(js, 'function pumpNoteSave()');
assert.ok(pump.includes('saveDesk({ notes: state.notes })'));
assert.ok(pump.includes("setNotesSavedStatus('已存在本机')"));
assert.ok(pump.includes("setNotesSavedStatus('没存上')"));
const saveBody = braceBlock(js, 'async function saveDesk(');
assert.ok(saveBody.includes('skipped: true'));
assert.ok(saveBody.includes('notesRev'));
assert.ok(html.includes('id="note-conflict"') && html.includes('用那边的') && html.includes('仍保存这边'));

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

function page(storage, id) {
  const box = { status: '' };
  const keeper = noteSync.createNoteKeeper({
    pageId: id,
    storage,
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
  else if (result && result.conflict) box.status = box.status || '另一页改过，没覆盖';
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

const overlapStore = createSharedStorage({ notes: '', notesRev: 0, delay: 30 });
const left = page(overlapStore, 'L');
const right = page(overlapStore, 'R');
wire(overlapStore, [left.keeper, right.keeper]);
left.keeper.remember('left text');
right.keeper.remember('right text');
const pair = await Promise.all([
  left.keeper.commit('left text', saver(overlapStore)),
  right.keeper.commit('right text', saver(overlapStore)),
]);
await settleStatus(left.box, pair[0]);
await settleStatus(right.box, pair[1]);
const stored = overlapStore.store.notes;
assert.ok(stored === 'left text' || stored === 'right text', stored);
[left, right].forEach((p, i) => {
  const snap = p.keeper.snapshot();
  if (pair[i].ok && snap.text !== stored && !snap.conflict) {
    assert.fail(`${p === left ? 'left' : 'right'} reported success for text that is not stored`);
  }
  if (p.box.status === '已存在本机') assert.strictEqual(snap.text, stored);
});
assert.ok(pair.filter((r) => r.ok).length >= 1, 'one writer can still land');
assert.ok(overlapStore.events.filter((e) => e === 'change').length >= 1);

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
assert.strictEqual(editing.box.status, '另一页改过，没覆盖');

console.log('test-r1-r7: ok');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
