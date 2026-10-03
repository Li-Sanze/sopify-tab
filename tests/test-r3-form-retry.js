'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const collection = require('../extension/collection-sync.js');
const forms = require('../extension/form-ops.js');

function memory(initial) {
  const store = {
    todos: [],
    todosRev: 0,
    sites: [],
    sitesRev: 0,
    worksets: [],
    worksetsRev: 0,
  };
  Object.assign(store, initial || {});
  let failSets = 0;
  let loseAck = 0;
  return {
    store,
    sets: 0,
    failNext(n) { failSets = n; },
    loseNextAck(n) { loseAck = n; },
    async get(defaults) {
      const out = {};
      Object.keys(defaults || {}).forEach((key) => {
        out[key] = Object.prototype.hasOwnProperty.call(store, key) ? structuredClone(store[key]) : defaults[key];
      });
      return out;
    },
    async set(partial) {
      if (failSets > 0) {
        failSets -= 1;
        throw new Error('storage failed');
      }
      this.sets += 1;
      Object.assign(store, structuredClone(partial));
      if (loseAck > 0) {
        loseAck -= 1;
        throw new Error('ack lost');
      }
    },
  };
}

function mintFactory() {
  let n = 0;
  return function mint() {
    n += 1;
    return 'id-' + n;
  };
}

async function main() {
  const js = fs.readFileSync(path.join(__dirname, '../extension/newtab.js'), 'utf8');
  const form = js.slice(js.indexOf("$('#todo-form').addEventListener('submit'"), js.indexOf("$('#todos').addEventListener('change'"));
  const dialog = js.slice(js.indexOf('async function commitTodoFromDialog'), js.indexOf('const desk3dHost'));
  const siteForm = js.slice(js.indexOf("$('#site-form').addEventListener('submit'"), js.indexOf('const onSiteRemoveClick'));
  const saveWindow = js.slice(js.indexOf('async function saveThisWindow'), js.indexOf('async function restoreWorksetById'));
  assert.ok(!form.includes('id: uid()'), 'home form must not mint a todo id on every submit');
  assert.ok(form.includes('planTodoAdd'), 'home form pins the add');
  assert.ok(form.includes('settleFormSubmit'), 'home form settles against the current input');
  assert.ok(form.indexOf('await replaceTodos') < form.indexOf('input.value = \'\''));
  assert.ok(!dialog.includes('id: uid()'), 'dialog add must not mint a todo id on every submit');
  assert.ok(dialog.includes('planTodoAdd'));
  assert.ok(dialog.includes('settleFormSubmit'));
  assert.ok(siteForm.includes('planSiteAdd'));
  assert.ok(siteForm.includes('settleSiteSubmit'));
  assert.ok(saveWindow.includes('planWorksetSave'));
  assert.ok(!saveWindow.includes('id: uid()'));
  assert.ok(js.includes('planRemove'));
  assert.ok(js.includes('planClearDone'));

  const mint = mintFactory();
  const failedStore = memory({ todos: [{ id: 'old', text: 'old', done: false }] });
  const failedCoord = collection.createCollectionCoordinator(failedStore);
  failedStore.failNext(1);
  let record = null;
  let pageTodos = structuredClone(failedStore.store.todos);
  function submitTodo(text) {
    const planned = forms.planTodoAdd(record, text, mint);
    record = planned.record;
    const next = pageTodos.concat([{ id: planned.itemId, text: planned.snapshot, done: false }]);
    return { planned, ops: collection.diffTodos(pageTodos, next) };
  }
  const first = submitTodo('牛奶');
  const failed = await failedCoord.commit({ domain: 'todos', ops: first.ops });
  assert.strictEqual(failed.ok, false);
  const settledFail = forms.settleFormSubmit(record, '牛奶', false);
  record = settledFail.record;
  assert.strictEqual(settledFail.clearInput, false);
  assert.strictEqual(settledFail.input, '牛奶');
  const retry = submitTodo('牛奶');
  assert.strictEqual(retry.planned.reuse, true, 'A retries the same item');
  assert.strictEqual(retry.planned.itemId, first.planned.itemId);
  assert.strictEqual(retry.planned.opId, first.planned.opId);
  const saved = await failedCoord.commit({ domain: 'todos', ops: retry.ops });
  assert.strictEqual(saved.ok, true);
  const milk = failedStore.store.todos.filter((item) => item.text === '牛奶');
  assert.strictEqual(milk.length, 1, 'A stores one row');
  assert.strictEqual(milk[0].id, first.planned.itemId);

  record = forms.settleFormSubmit(record, '牛奶', true).record;
  pageTodos = structuredClone(failedStore.store.todos);
  const twin = submitTodo('牛奶');
  assert.strictEqual(twin.planned.reuse, false);
  assert.notStrictEqual(twin.planned.itemId, first.planned.itemId, 'B mints a new id for a second identical line');
  const twinSaved = await failedCoord.commit({ domain: 'todos', ops: twin.ops });
  assert.strictEqual(twinSaved.ok, true);
  assert.strictEqual(failedStore.store.todos.filter((item) => item.text === '牛奶').length, 2, 'B keeps both rows');

  const typing = mintFactory();
  let typingRecord = null;
  const started = forms.planTodoAdd(typingRecord, '买牛奶', typing);
  typingRecord = started.record;
  const inflightId = started.itemId;
  const inflightText = started.snapshot;
  const typedLater = '买牛奶和面包';
  const failedSettle = forms.settleFormSubmit(typingRecord, typedLater, false);
  assert.strictEqual(failedSettle.clearInput, false, 'C failure does not clear the newer input');
  assert.strictEqual(failedSettle.input, typedLater);
  assert.notStrictEqual(failedSettle.input, inflightText);
  typingRecord = failedSettle.record;
  const continued = forms.planTodoAdd(typingRecord, typedLater, typing);
  assert.notStrictEqual(continued.itemId, inflightId, 'C a new draft is not the in-flight item');
  assert.strictEqual(continued.snapshot, typedLater);
  const explicit = forms.planTodoAdd(failedSettle.record, inflightText, typing);
  assert.strictEqual(explicit.itemId, inflightId, 'C an explicit retry of that draft reuses the id');
  assert.strictEqual(explicit.snapshot, inflightText);
  const successSettle = forms.settleFormSubmit(started.record, typedLater, true);
  assert.strictEqual(successSettle.clearInput, false, 'C success does not wipe later edits');
  assert.strictEqual(successSettle.input, typedLater);
  assert.strictEqual(successSettle.record, null);

  const siteMint = mintFactory();
  const siteStore = memory({ sites: [] });
  const siteCoord = collection.createCollectionCoordinator(siteStore);
  siteStore.failNext(1);
  let siteRecord = null;
  let pageSites = [];
  function submitSite(name, url) {
    const planned = forms.planSiteAdd(siteRecord, name, url, siteMint);
    siteRecord = planned.record;
    const next = pageSites.concat([{ name: planned.name, url: planned.url }]);
    return { planned, ops: collection.diffSites(pageSites, next) };
  }
  const siteFirst = submitSite('甲', 'https://a.example/');
  const siteFailed = await siteCoord.commit({ domain: 'sites', ops: siteFirst.ops });
  assert.strictEqual(siteFailed.ok, false);
  const siteRetry = submitSite('甲', 'https://a.example/');
  assert.strictEqual(siteRetry.planned.reuse, true);
  assert.strictEqual(siteRetry.planned.url, siteFirst.planned.url);
  const siteSaved = await siteCoord.commit({ domain: 'sites', ops: siteRetry.ops });
  assert.strictEqual(siteSaved.ok, true);
  assert.strictEqual(siteStore.store.sites.length, 1, 'D same url retries into one row');
  siteRecord = forms.settleSiteSubmit(siteRecord, '甲', 'https://a.example/', true).record;
  pageSites = structuredClone(siteStore.store.sites);
  const other = submitSite('乙', 'https://b.example/');
  assert.strictEqual(other.planned.reuse, false);
  const otherSaved = await siteCoord.commit({ domain: 'sites', ops: other.ops });
  assert.strictEqual(otherSaved.ok, true);
  assert.deepStrictEqual(siteStore.store.sites.map((item) => item.url), ['https://a.example/', 'https://b.example/'], 'D different urls each get a row');
  const editedName = forms.settleSiteSubmit(siteRetry.planned.record, '甲改了', 'https://a.example/', false);
  assert.strictEqual(editedName.clearInput, false);
  assert.strictEqual(editedName.name, '甲改了');
  assert.strictEqual(editedName.url, 'https://a.example/');

  const lost = memory({ todos: [] });
  const lostCoord = collection.createCollectionCoordinator(lost);
  lost.loseNextAck(1);
  const lostMint = mintFactory();
  let lostRecord = null;
  const lostPage = [];
  const lostFirst = forms.planTodoAdd(lostRecord, '牛奶', lostMint);
  lostRecord = lostFirst.record;
  let lostResult;
  try {
    lostResult = await lostCoord.commit({
      domain: 'todos',
      ops: collection.diffTodos(lostPage, [{ id: lostFirst.itemId, text: lostFirst.snapshot, done: false }]),
    });
  } catch (err) {
    lostResult = { ok: false, error: err };
  }
  assert.strictEqual(lostResult.ok, false);
  assert.strictEqual(lost.store.todos.length, 1, 'E the first write did land');
  const lostRetry = forms.planTodoAdd(lostRecord, '牛奶', lostMint);
  assert.strictEqual(lostRetry.itemId, lostFirst.itemId);
  const lostAgain = await lostCoord.commit({
    domain: 'todos',
    ops: collection.diffTodos(lostPage, [{ id: lostRetry.itemId, text: lostRetry.snapshot, done: false }]),
  });
  assert.strictEqual(lostAgain.ok, true);
  assert.strictEqual(lostAgain.idempotent, true);
  assert.strictEqual(lost.store.todos.length, 1, 'E retry after a lost ack stays one row');
  assert.strictEqual(lost.store.todos[0].id, lostFirst.itemId);

  const removeMint = mintFactory();
  let removeRecord = null;
  const removeA = forms.planRemove(removeRecord, 'todo-a', removeMint);
  removeRecord = removeA.record;
  const removeRetry = forms.planRemove(removeRecord, 'todo-a', removeMint);
  assert.strictEqual(removeRetry.reuse, true);
  assert.strictEqual(removeRetry.itemId, 'todo-a', 'F delete retry keeps the same item');
  const removeB = forms.planRemove(removeRecord, 'todo-b', removeMint);
  assert.strictEqual(removeB.itemId, 'todo-b');
  assert.notStrictEqual(removeB.itemId, 'todo-a', 'F a different delete does not reuse the first target');
  const todos = [
    { id: 'todo-a', text: '甲', done: false },
    { id: 'todo-b', text: '乙', done: false },
  ];
  const removeStore = memory({ todos: todos });
  const removeCoord = collection.createCollectionCoordinator(removeStore);
  removeStore.failNext(1);
  const removeOps = collection.diffTodos(todos, todos.filter((item) => item.id !== removeRetry.itemId));
  const removeFailed = await removeCoord.commit({ domain: 'todos', ops: removeOps });
  assert.strictEqual(removeFailed.ok, false);
  assert.deepStrictEqual(removeStore.store.todos.map((item) => item.id), ['todo-a', 'todo-b']);
  const removeSaved = await removeCoord.commit({ domain: 'todos', ops: removeOps });
  assert.strictEqual(removeSaved.ok, true);
  assert.deepStrictEqual(removeStore.store.todos.map((item) => item.id), ['todo-b'], 'F retry removes only the pinned item');

  const clearMint = mintFactory();
  const doneIds = ['d1', 'd2'];
  let clearRecord = null;
  const clearFirst = forms.planClearDone(clearRecord, doneIds, clearMint);
  clearRecord = clearFirst.record;
  const clearRetry = forms.planClearDone(clearRecord, doneIds, clearMint);
  assert.strictEqual(clearRetry.reuse, true);
  assert.deepStrictEqual(clearRetry.ids, doneIds);
  const clearShifted = forms.planClearDone(clearRecord, ['d1', 'd2', 'd3'], clearMint);
  assert.strictEqual(clearShifted.reuse, false);
  assert.ok(!clearFirst.ids.includes('d3'));

  const windowMint = mintFactory();
  let windowRecord = null;
  const windowFirst = forms.planWorksetSave(windowRecord, windowMint, 1000);
  windowRecord = windowFirst.record;
  const windowRetry = forms.planWorksetSave(windowRecord, windowMint, 9000);
  assert.strictEqual(windowRetry.reuse, true);
  assert.strictEqual(windowRetry.itemId, windowFirst.itemId, 'F window retry reuses the workset id');
  assert.strictEqual(windowRetry.savedAt, 1000);
  const windowItem = {
    id: windowFirst.itemId,
    name: '这个窗口',
    savedAt: windowFirst.savedAt,
    tabs: [{ title: '甲', url: 'https://a.example/' }],
  };
  const windowStore = memory({ worksets: [] });
  const windowCoord = collection.createCollectionCoordinator(windowStore);
  windowStore.loseNextAck(1);
  let windowResult;
  try {
    windowResult = await windowCoord.commit({
      domain: 'worksets',
      ops: collection.diffWorksets([], [windowItem]),
    });
  } catch (err) {
    windowResult = { ok: false, error: err };
  }
  assert.strictEqual(windowResult.ok, false);
  assert.strictEqual(windowStore.store.worksets.length, 1);
  const windowAgain = await windowCoord.commit({
    domain: 'worksets',
    ops: collection.diffWorksets([], [windowItem]),
  });
  assert.strictEqual(windowAgain.ok, true);
  assert.strictEqual(windowAgain.idempotent, true);
  assert.strictEqual(windowStore.store.worksets.length, 1);
  assert.strictEqual(windowStore.store.worksets[0].id, windowFirst.itemId);

  console.log('test-r3-form-retry: ok');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
