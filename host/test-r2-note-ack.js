'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function realm(filename) {
  const sandbox = {
    console,
    structuredClone,
    Date,
    Math,
    Promise,
    setTimeout,
    clearTimeout,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
  return sandbox.SopifyNoteSync;
}

const file = path.join(__dirname, '../extension/note-sync.js');

function deferred() {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  return { gate, release };
}

async function main() {
  const background = realm(file);
  const pageA = realm(file);
  const pageB = realm(file);
  assert.notStrictEqual(pageA.createNoteKeeper, pageB.createNoteKeeper);

  const store = { notes: 'base', notesRev: 0, notesStamp: 'seed' };
  const subscribers = [];
  const storage = {
    async get() { return structuredClone(store); },
    async set(partial) {
      Object.assign(store, structuredClone(partial));
      subscribers.forEach((fn) => fn(structuredClone(store)));
    },
  };
  const coordinator = background.createNoteCoordinator(storage);
  let aWaiting = false;
  const saved = deferred();
  const ack = deferred();
  const a = pageA.createNoteKeeper({
    pageId: 'A',
    storage,
    isEditing: () => aWaiting,
    coordinator: {
      async commit(request) {
        const result = await coordinator.commit(request);
        saved.release();
        await ack.gate;
        return result;
      },
    },
  });
  const b = pageB.createNoteKeeper({ pageId: 'B', storage, coordinator });
  a.absorbBoot(store);
  b.absorbBoot(store);
  subscribers.push((data) => a.handleRemote(data));
  subscribers.push((data) => b.handleRemote(data));

  aWaiting = true;
  a.remember('A 先保存的内容');
  const pendingA = a.commit('A 先保存的内容');
  await saved.gate;
  b.remember('B 后来保存的新内容');
  const savedB = await b.commit('B 后来保存的新内容');
  assert.strictEqual(savedB.ok, true);
  assert.strictEqual(store.notes, 'B 后来保存的新内容');
  assert.strictEqual(store.notesRev, 2);

  const foreign = a.considerAck({ ok: true, stamp: 'other-request', rev: 9, notes: '不该采纳' });
  assert.strictEqual(foreign.ignored, true, 'N2');
  assert.strictEqual(a.snapshot().text, 'A 先保存的内容');
  assert.notStrictEqual(a.snapshot().rev, 9);

  const readback = a.considerAck({
    ok: true,
    stamp: a.snapshot().inflight,
    rev: 1,
    notes: 'A 先保存的内容',
  });
  assert.strictEqual(readback.stale, true, 'N6');
  assert.ok(a.snapshot().conflict, 'N6 keeps the newer conflict');
  assert.strictEqual(a.snapshot().conflict.remoteRev, 2);

  ack.release();
  const resultA = await pendingA;
  aWaiting = false;
  const snap = a.snapshot();
  assert.strictEqual(resultA.stale, true, 'N1');
  assert.strictEqual(resultA.applied, false);
  assert.ok(snap.conflict, 'N1 old ack must not clear the newer conflict');
  assert.strictEqual(snap.conflict.remoteText, 'B 后来保存的新内容');
  assert.strictEqual(snap.conflict.remoteRev, 2);
  assert.ok(snap.seenRev >= 2, 'N5 observed rev stays at the newer write');
  assert.strictEqual(snap.text, 'A 先保存的内容');
  assert.notStrictEqual(snap.conflict, null);
  assert.strictEqual(store.notes, 'B 后来保存的新内容');
  assert.strictEqual(store.notesRev, 2);
  assert.strictEqual(background.shouldMarkNoteSaved(resultA, snap), false, 'N4 late ok does not count as saved');
  assert.notStrictEqual(snap.status, '');

  const typingSync = realm(file);
  const typedStore = { notes: 'base', notesRev: 0, notesStamp: 'seed' };
  const typedStorage = {
    async get() { return structuredClone(typedStore); },
    async set(partial) { Object.assign(typedStore, structuredClone(partial)); },
  };
  const typedCoord = typingSync.createNoteCoordinator(typedStorage);
  const releaseType = deferred();
  const typer = typingSync.createNoteKeeper({
    pageId: 'type',
    storage: typedStorage,
    coordinator: {
      async commit(request) {
        if (request.text === 'A1') await releaseType.gate;
        return typedCoord.commit(request);
      },
    },
  });
  typer.absorbBoot(typedStore);
  typer.remember('A1');
  const typing = typer.commit('A1');
  typer.remember('A2');
  releaseType.release();
  const typed = await typing;
  assert.strictEqual(typed.ok, true);
  assert.strictEqual(typed.current, false, 'N3');
  assert.strictEqual(typer.snapshot().text, 'A2');
  assert.strictEqual(typer.snapshot().acked, 'A1');
  assert.strictEqual(typingSync.shouldMarkNoteSaved(typed, typer.snapshot()), false);

  const pipeSync = realm(file);
  const pipeStore = { notes: 'base', notesRev: 0, notesStamp: 'seed' };
  const pipeStorage = {
    async get() { return structuredClone(pipeStore); },
    async set(partial) { Object.assign(pipeStore, structuredClone(partial)); },
  };
  const pipeCoord = pipeSync.createNoteCoordinator(pipeStorage);
  let firstStamp = '';
  const piper = pipeSync.createNoteKeeper({
    pageId: 'pipe',
    storage: pipeStorage,
    coordinator: {
      async commit(request) {
        if (request.text === 'first') firstStamp = request.stamp;
        if (request.text === 'second') {
          const ignored = piper.considerAck({ ok: true, stamp: firstStamp, rev: 1, notes: 'first' });
          assert.strictEqual(ignored.ignored, true, 'N7');
          assert.strictEqual(piper.snapshot().text, 'second');
        }
        return pipeCoord.commit(request);
      },
    },
  });
  piper.absorbBoot(pipeStore);
  piper.remember('first');
  const firstResult = await piper.commit('first');
  piper.remember('second');
  const secondResult = await piper.commit('second');
  assert.strictEqual(firstResult.ok, true);
  assert.strictEqual(secondResult.ok, true);
  assert.strictEqual(piper.snapshot().text, 'second');
  assert.strictEqual(piper.snapshot().acked, 'second');
  assert.strictEqual(pipeStore.notes, 'second');
  assert.ok(pipeStore.notesRev >= 2);

  const js = fs.readFileSync(path.join(__dirname, '../extension/newtab.js'), 'utf8');
  const pump = js.slice(js.indexOf('function pumpNoteSave()'), js.indexOf('function queueNoteSave()'));
  assert.ok(pump.includes('shouldMarkNoteSaved'));
  assert.ok(pump.includes("setNotesSavedStatus('已存在本机')"));
  assert.ok(pump.indexOf('shouldMarkNoteSaved') < pump.indexOf("setNotesSavedStatus('已存在本机')"));
  assert.ok(pump.includes('hasConflict'));
  const save3d = js.slice(js.indexOf('function saveDeskNoteFrom3d'), js.indexOf('async function commitTodoFromDialog'));
  assert.ok(save3d.includes('queueNoteSave()'), 'N8 3D uses the same note save path');
  console.log('N8 3D runtime: 未测');
  console.log('test-r2-note-ack: ok');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
