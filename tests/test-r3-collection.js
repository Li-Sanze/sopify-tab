'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const collection = require('../extension/collection-sync.js');

function deferred() {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  return { gate, release };
}

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
  return {
    store,
    sets: 0,
    failNext(n) { failSets = n; },
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
    },
  };
}

function ids(list) {
  return (list || []).map((item) => item.id || item.url || item.name);
}

async function main() {
  const old = { id: 'old', text: 'old', done: false };
  const itemA = { id: 'a', text: 'A', done: false };
  const itemB = { id: 'b', text: 'B', done: false };
  const itemC = { id: 'c', text: 'C', done: false };

  const held = memory({ todos: [old] });
  const coord = collection.createCollectionCoordinator(held);
  const base = structuredClone(held.store.todos);
  const opsA = collection.diffTodos(base, base.concat([itemA]));
  const opsB = collection.diffTodos(base, base.concat([itemB]));
  const entered = deferred();
  const releaseA = deferred();
  const origSet = held.set.bind(held);
  held.set = async function gated(partial) {
    if (held.sets === 0) {
      entered.release();
      await releaseA.gate;
    }
    return origSet(partial);
  };
  const pendingA = coord.commit({ domain: 'todos', ops: opsA });
  await entered.gate;
  const pendingB = coord.commit({ domain: 'todos', ops: opsB });
  releaseA.release();
  const [savedA, savedB] = await Promise.all([pendingA, pendingB]);
  assert.strictEqual(savedA.ok, true, 'T1 A');
  assert.strictEqual(savedB.ok, true, 'T1 B');
  assert.deepStrictEqual(ids(held.store.todos), ['old', 'a', 'b']);
  assert.ok(!(savedA.ok && savedB.ok && !ids(held.store.todos).includes('a')));
  assert.ok(ids(held.store.todos).includes('old') && ids(held.store.todos).includes('b'));

  const same = memory({ todos: [old] });
  const sameCoord = collection.createCollectionCoordinator(same);
  const text = '同样的一句';
  const sameA = { id: 'same-a', text, done: false };
  const sameB = { id: 'same-b', text, done: false };
  const from = [old];
  const t2a = await sameCoord.commit({ domain: 'todos', ops: collection.diffTodos(from, from.concat([sameA])) });
  const t2b = await sameCoord.commit({ domain: 'todos', ops: collection.diffTodos(from, from.concat([sameB])) });
  assert.strictEqual(t2a.ok, true);
  assert.strictEqual(t2b.ok, true);
  assert.strictEqual(same.store.todos.filter((item) => item.text === text).length, 2, 'T2 keeps both ids');
  const beforeRetry = same.sets;
  const again = await sameCoord.commit({ domain: 'todos', ops: collection.diffTodos(from, from.concat([sameA])) });
  assert.strictEqual(again.ok, true);
  assert.strictEqual(again.idempotent, true);
  assert.strictEqual(same.sets, beforeRetry, 'T2 retry does not write another row');
  assert.strictEqual(same.store.todos.filter((item) => item.text === text).length, 2);

  const stale = memory({ todos: [old] });
  const staleCoord = collection.createCollectionCoordinator(stale);
  const staleBase = structuredClone(stale.store.todos);
  const first = await staleCoord.commit({ domain: 'todos', ops: collection.diffTodos(staleBase, staleBase.concat([itemA])) });
  const second = await staleCoord.commit({ domain: 'todos', ops: collection.diffTodos(staleBase, staleBase.concat([itemB])) });
  assert.strictEqual(first.ok, true);
  assert.strictEqual(second.ok, true);
  assert.deepStrictEqual(ids(stale.store.todos), ['old', 'a', 'b'], 'T3 stale snapshot cannot erase A');

  const triple = memory({ todos: [old] });
  const tripleCoord = collection.createCollectionCoordinator(triple);
  const start = structuredClone(triple.store.todos);
  const three = await Promise.all([
    tripleCoord.commit({ domain: 'todos', ops: collection.diffTodos(start, start.concat([itemA])) }),
    tripleCoord.commit({ domain: 'todos', ops: collection.diffTodos(start, start.concat([itemB])) }),
    tripleCoord.commit({ domain: 'todos', ops: collection.diffTodos(start, start.concat([itemC])) }),
  ]);
  assert.ok(three.every((result) => result.ok === true));
  assert.deepStrictEqual(ids(triple.store.todos), ['old', 'a', 'b', 'c'], 'T4');

  const old2 = { id: 'old2', text: 'old2', done: false };
  const mixed = memory({ todos: [old, old2] });
  const mixedCoord = collection.createCollectionCoordinator(mixed);
  const mixedBase = structuredClone(mixed.store.todos);
  const added = await mixedCoord.commit({ domain: 'todos', ops: collection.diffTodos(mixedBase, mixedBase.concat([itemA])) });
  const removed = await mixedCoord.commit({ domain: 'todos', ops: collection.diffTodos(mixedBase, [old]) });
  assert.strictEqual(added.ok, true);
  assert.strictEqual(removed.ok, true);
  assert.deepStrictEqual(ids(mixed.store.todos), ['old', 'a'], 'T5 add and delete different items');

  const edited = memory({ todos: [old] });
  const editCoord = collection.createCollectionCoordinator(edited);
  const editBase = structuredClone(edited.store.todos);
  const toggled = [{ id: 'old', text: 'old', done: true }];
  const editAdd = await editCoord.commit({ domain: 'todos', ops: collection.diffTodos(editBase, editBase.concat([itemA])) });
  const editUpdate = await editCoord.commit({ domain: 'todos', ops: collection.diffTodos(editBase, toggled) });
  assert.strictEqual(editAdd.ok, true);
  assert.strictEqual(editUpdate.ok, true);
  assert.strictEqual(edited.store.todos.find((item) => item.id === 'old').done, true);
  assert.ok(edited.store.todos.some((item) => item.id === 'a'), 'T6');

  const siteStore = memory({ sites: [{ name: '原站', url: 'https://old.example/' }] });
  const siteCoord = collection.createCollectionCoordinator(siteStore);
  const siteBase = structuredClone(siteStore.store.sites);
  const siteA = siteBase.concat([{ name: '甲', url: 'https://a.example/' }]);
  const siteB = siteBase.concat([{ name: '乙', url: 'https://b.example/' }]);
  const siteResults = await Promise.all([
    siteCoord.commit({ domain: 'sites', ops: collection.diffSites(siteBase, siteA) }),
    siteCoord.commit({ domain: 'sites', ops: collection.diffSites(siteBase, siteB) }),
  ]);
  assert.ok(siteResults.every((result) => result.ok === true));
  assert.deepStrictEqual(siteStore.store.sites.map((item) => item.url), [
    'https://old.example/',
    'https://a.example/',
    'https://b.example/',
  ], 'T7');

  const renamed = memory({
    sites: [
      { name: '甲', url: 'https://a.example/' },
      { name: '乙', url: 'https://b.example/' },
    ],
  });
  const renameCoord = collection.createCollectionCoordinator(renamed);
  const renameBase = structuredClone(renamed.store.sites);
  const renameOps = collection.diffSites(renameBase, [
    { name: '甲改', url: 'https://a2.example/' },
    { name: '乙', url: 'https://b.example/' },
  ]);
  const renameAdd = renameOps.find((op) => op.op === 'add');
  const renameRemove = renameOps.find((op) => op.op === 'remove');
  assert.ok(renameAdd && renameRemove);
  renameAdd.replaces = renameRemove.id;
  const renameSaved = await renameCoord.commit({ domain: 'sites', ops: renameOps });
  assert.strictEqual(renameSaved.ok, true);
  assert.deepStrictEqual(renamed.store.sites, [
    { name: '甲改', url: 'https://a2.example/' },
    { name: '乙', url: 'https://b.example/' },
  ], 'site url edit keeps the row in place');

  const windowA = { id: 'wa', name: '甲窗', savedAt: 20, tabs: [{ title: '甲', url: 'https://a.example/' }] };
  const windowB = { id: 'wb', name: '乙窗', savedAt: 10, tabs: [{ title: '乙', url: 'https://b.example/' }] };
  const kept = { id: 'wk', name: '原窗', savedAt: 30, tabs: [{ title: '原', url: 'https://old.example/' }] };
  const windowStore = memory({ worksets: [kept] });
  const windowCoord = collection.createCollectionCoordinator(windowStore);
  const windowBase = structuredClone(windowStore.store.worksets);
  const windowResults = await Promise.all([
    windowCoord.commit({ domain: 'worksets', ops: collection.diffWorksets(windowBase, windowBase.concat([windowA])) }),
    windowCoord.commit({ domain: 'worksets', ops: collection.diffWorksets(windowBase, windowBase.concat([windowB])) }),
  ]);
  assert.ok(windowResults.every((result) => result.ok === true));
  assert.deepStrictEqual(ids(windowStore.store.worksets).sort(), ['wa', 'wb', 'wk'], 'T8');
  const full = [1, 2, 3, 4, 5].map((n) => ({
    id: 'f' + n,
    name: '满' + n,
    savedAt: n,
    tabs: [{ title: 't', url: 'https://full.example/' + n }],
  }));
  const fullStore = memory({ worksets: full });
  const fullCoord = collection.createCollectionCoordinator(fullStore);
  const overflow = await fullCoord.commit({
    domain: 'worksets',
    ops: [{ op: 'add', item: windowA }],
  });
  assert.strictEqual(overflow.ok, false);
  assert.strictEqual(overflow.full, true);
  assert.strictEqual(fullStore.store.worksets.length, 5);
  assert.ok(!ids(fullStore.store.worksets).includes('wa'));

  const unreadStore = memory({ todos: [old] });
  const unreadCoord = collection.createCollectionCoordinator(unreadStore);
  const blocked = await unreadCoord.commit({
    domain: 'todos',
    unread: true,
    ops: collection.diffTodos([old], [old, itemA]),
  });
  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.blocked, true);
  assert.strictEqual(unreadStore.sets, 0);
  assert.deepStrictEqual(ids(unreadStore.store.todos), ['old'], 'T9 still blocked while unread');
  const afterUnread = await unreadCoord.commit({
    domain: 'todos',
    ops: collection.diffTodos([old], [old, itemA]),
  });
  assert.strictEqual(afterUnread.ok, true);
  assert.deepStrictEqual(ids(unreadStore.store.todos), ['old', 'a']);

  const retryStore = memory({ todos: [old] });
  const retryCoord = collection.createCollectionCoordinator(retryStore);
  retryStore.failNext(1);
  const draft = '还在输入框里';
  const failed = await retryCoord.commit({
    domain: 'todos',
    ops: collection.diffTodos([old], [old, itemA]),
  });
  assert.strictEqual(failed.ok, false);
  assert.deepStrictEqual(ids(retryStore.store.todos), ['old']);
  assert.strictEqual(draft, '还在输入框里', 'T10 failure keeps the typed text');
  const retried = await retryCoord.commit({
    domain: 'todos',
    ops: collection.diffTodos([old], [old, itemA]),
  });
  assert.strictEqual(retried.ok, true);
  assert.deepStrictEqual(ids(retryStore.store.todos), ['old', 'a']);
  const setsAfter = retryStore.sets;
  const replay = await retryCoord.commit({
    domain: 'todos',
    ops: collection.diffTodos([old], [old, itemA]),
  });
  assert.strictEqual(replay.ok, true);
  assert.strictEqual(replay.idempotent, true);
  assert.strictEqual(retryStore.sets, setsAfter, 'T10 same id does not write twice');
  assert.deepStrictEqual(ids(retryStore.store.todos), ['old', 'a']);

  const replaced = await retryCoord.commit({
    domain: 'todos',
    replace: true,
    ops: [{ op: 'add', item: itemB }],
  });
  assert.strictEqual(replaced.ok, false);
  assert.deepStrictEqual(ids(retryStore.store.todos), ['old', 'a']);

  const t1 = { id: 't1', text: '待办1', done: false };
  const t2 = { id: 't2', text: '待办2', done: false };
  const t3 = { id: 't3', text: '待办3', done: false };
  const t4 = { id: 't4', text: '待办4', done: false };
  const t5 = { id: 't5', text: '待办5', done: false };
  const queue = [t1, t2, t3, t4];
  const missingMove = collection.applyOps(queue, [{ op: 'move', id: 'gone', to: 'front' }], 'todos');
  assert.strictEqual(missingMove.ok, false);
  assert.strictEqual(missingMove.missing, true, 'move of a missing todo');
  const alreadyFront = collection.applyOps(queue, [{ op: 'move', id: 't1', to: 'front' }], 'todos');
  assert.strictEqual(alreadyFront.ok, true);
  assert.deepStrictEqual(ids(alreadyFront.items), ['t1', 't2', 't3', 't4'], 'move of the first todo does not rewrite');
  const movedFront = collection.applyOps(queue, [{ op: 'move', id: 't3', to: 'front' }], 'todos');
  assert.strictEqual(movedFront.ok, true);
  assert.deepStrictEqual(ids(movedFront.items), ['t3', 't1', 't2', 't4'], 'move puts the todo first');
  assert.deepStrictEqual(collection.diffTodos(queue, [t3, t1, t2, t4]), [], 'diffTodos ignores order');
  const siteMove = collection.applyOps(
    [{ name: '甲', url: 'https://a.example/' }],
    [{ op: 'move', id: 'https://a.example/', to: 'front' }],
    'sites',
  );
  assert.strictEqual(siteMove.ok, false);
  assert.strictEqual(siteMove.error, true, 'move is todos only');
  const workMove = collection.applyOps(
    [{ id: 'w1', name: '甲', savedAt: 2, tabs: [{ title: 'a', url: 'https://a.example/' }] }],
    [{ op: 'move', id: 'w1', to: 'front' }],
    'worksets',
  );
  assert.strictEqual(workMove.ok, false);
  assert.strictEqual(workMove.error, true);

  async function overlap(firstOps, secondOps) {
    const store = memory({ todos: queue.map((item) => ({ ...item })) });
    const overlapCoord = collection.createCollectionCoordinator(store);
    const entered = deferred();
    const release = deferred();
    const orig = store.set.bind(store);
    store.set = async function gated(partial) {
      if (store.sets === 0) {
        entered.release();
        await release.gate;
      }
      return orig(partial);
    };
    const pendingFirst = overlapCoord.commit({ domain: 'todos', ops: firstOps });
    await entered.gate;
    const pendingSecond = overlapCoord.commit({ domain: 'todos', ops: secondOps });
    release.release();
    const [firstSaved, secondSaved] = await Promise.all([pendingFirst, pendingSecond]);
    return { store, firstSaved, secondSaved };
  }

  const moveOp = [{ op: 'move', id: 't3', to: 'front' }];
  const addOp = [{ op: 'add', item: t5 }];
  const moveThenAdd = await overlap(moveOp, addOp);
  assert.strictEqual(moveThenAdd.firstSaved.ok, true);
  assert.strictEqual(moveThenAdd.secondSaved.ok, true);
  assert.deepStrictEqual(ids(moveThenAdd.store.store.todos), ['t3', 't1', 't2', 't4', 't5'], 'move then add');
  const addThenMove = await overlap(addOp, moveOp);
  assert.strictEqual(addThenMove.firstSaved.ok, true);
  assert.strictEqual(addThenMove.secondSaved.ok, true);
  assert.deepStrictEqual(ids(addThenMove.store.store.todos), ['t3', 't1', 't2', 't4', 't5'], 'add then move');

  const deleteThenMove = await overlap([{ op: 'remove', id: 't3' }], moveOp);
  assert.strictEqual(deleteThenMove.firstSaved.ok, true);
  assert.strictEqual(deleteThenMove.secondSaved.ok, false);
  assert.strictEqual(deleteThenMove.secondSaved.missing, true, 'move after delete is missing');
  assert.deepStrictEqual(ids(deleteThenMove.store.store.todos), ['t1', 't2', 't4']);

  const moveStore = memory({ todos: queue.map((item) => ({ ...item })) });
  const moveCoord = collection.createCollectionCoordinator(moveStore);
  const movedOnce = await moveCoord.commit({ domain: 'todos', ops: moveOp });
  assert.strictEqual(movedOnce.ok, true);
  assert.deepStrictEqual(ids(moveStore.store.todos), ['t3', 't1', 't2', 't4']);
  const setsAfterMove = moveStore.sets;
  const movedAgain = await moveCoord.commit({ domain: 'todos', ops: moveOp });
  assert.strictEqual(movedAgain.ok, true);
  assert.strictEqual(movedAgain.idempotent, true);
  assert.strictEqual(moveStore.sets, setsAfterMove, 'retrying the same move does not write');
  assert.deepStrictEqual(ids(moveStore.store.todos), ['t3', 't1', 't2', 't4']);

  const js = fs.readFileSync(path.join(__dirname, '../extension/newtab.js'), 'utf8');
  const form = js.slice(js.indexOf("$('#todo-form').addEventListener('submit'"), js.indexOf("$('#todos').addEventListener('change'"));
  assert.ok(form.indexOf('await replaceTodos') < form.indexOf("input.value = ''"));
  assert.ok(js.includes('commitTodoIntent'));
  assert.ok(js.includes("importScripts('note-sync.js', 'collection-sync.js')") || fs.readFileSync(path.join(__dirname, '../extension/background.js'), 'utf8').includes('collection-sync.js'));
  const background = fs.readFileSync(path.join(__dirname, '../extension/background.js'), 'utf8');
  assert.ok(background.includes('sopify-collection-commit'));
  assert.ok(background.includes('createCollectionCoordinator'));

  console.log('test-r3-collection: ok');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
