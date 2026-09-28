/**
 * Desk-note concurrency and IME submit guards.
 * `notes` stays a string. `notesRev` / `notesStamp` are optional companions
 * so two extension pages can detect a stale write instead of clobbering.
 */
(function (root) {
  'use strict';

  function normalizeRev(n) {
    const v = typeof n === 'string' && String(n).trim() ? Number(n) : n;
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  }

  function imeBlocksSubmit(e) {
    if (!e) return false;
    if (e.isComposing) return true;
    if (e.key === 'Process') return true;
    if (e.keyCode === 229) return true;
    return false;
  }

  function createImeGuard(now) {
    const clock = typeof now === 'function' ? now : function () { return Date.now(); };
    let composing = false;
    let endAt = 0;
    return {
      onCompositionStart: function () { composing = true; },
      onCompositionEnd: function () {
        composing = false;
        endAt = clock();
      },
      blocks: function (e) {
        if (composing) return true;
        if (imeBlocksSubmit(e)) return true;
        if (e && e.key === 'Enter' && endAt && clock() - endAt < 40) return true;
        return false;
      },
    };
  }

  let noteWriteChain = Promise.resolve();

  function enqueueNoteWrite(task) {
    const run = noteWriteChain.then(task, task);
    noteWriteChain = run.then(function () { return null; }, function () { return null; });
    return run;
  }

  function baselineStillCurrent(remote, baseline) {
    if (!remote || remote.notes !== baseline.notes) return false;
    if (remote.rev !== normalizeRev(baseline.rev)) return false;
    const baseStamp = typeof baseline.stamp === 'string' ? baseline.stamp : '';
    const remoteStamp = typeof remote.stamp === 'string' ? remote.stamp : '';
    if (!baseStamp || !remoteStamp) return remote.notes === baseline.notes;
    return remoteStamp === baseStamp;
  }

  function createNoteKeeper(options) {
    const opts = options || {};
    let rev = 0;
    let seenRev = 0;
    let stamp = '';
    let acked = '';
    let text = '';
    let dirty = false;
    let conflict = null;
    let inflight = '';
    let reviewed = null;
    let status = '';

    function snapshot() {
      return {
        text: text,
        rev: rev,
        seenRev: seenRev,
        stamp: stamp,
        acked: acked,
        dirty: dirty,
        conflict: conflict ? {
          remoteText: conflict.remoteText,
          remoteRev: conflict.remoteRev,
          remoteStamp: conflict.remoteStamp,
        } : null,
        status: status,
        inflight: inflight,
      };
    }

    function emit() {
      if (typeof opts.onStatus === 'function') opts.onStatus(status, snapshot());
    }

    function setStatus(next) {
      status = next;
      emit();
    }

    function isEditing() {
      if (dirty) return true;
      if (typeof opts.isEditing === 'function' && opts.isEditing()) return true;
      return false;
    }

    function remember(next) {
      text = typeof next === 'string' ? next : '';
      dirty = text !== acked;
    }

    function absorbBoot(data) {
      if (data && data.loadError) return { action: 'keep-local', text: text };
      if (dirty || conflict) return { action: 'keep-local', text: text };
      const notes = data && typeof data.notes === 'string' ? data.notes : '';
      rev = normalizeRev(data && data.notesRev);
      seenRev = rev;
      stamp = data && typeof data.notesStamp === 'string' ? data.notesStamp : '';
      acked = notes;
      text = notes;
      dirty = false;
      conflict = null;
      return { action: 'apply', text: notes };
    }

    async function readRemote() {
      if (!opts.storage || typeof opts.storage.get !== 'function') {
        return { ok: false, skipped: true };
      }
      try {
        const data = await opts.storage.get({ notes: '', notesRev: 0, notesStamp: '' });
        const src = data && typeof data === 'object' ? data : {};
        return {
          ok: true,
          notes: typeof src.notes === 'string' ? src.notes : '',
          rev: normalizeRev(src.notesRev),
          stamp: typeof src.notesStamp === 'string' ? src.notesStamp : '',
        };
      } catch (err) {
        return { ok: false, error: err };
      }
    }

    function handleRemote(data) {
      const remoteText = data && typeof data.notes === 'string' ? data.notes : '';
      const remoteRev = normalizeRev(data && data.notesRev);
      const remoteStamp = data && typeof data.notesStamp === 'string' ? data.notesStamp : '';
      if (remoteRev < seenRev) return { action: 'stale' };
      if (remoteRev > seenRev) seenRev = remoteRev;
      if ((inflight && remoteStamp && remoteStamp === inflight) || (stamp && remoteStamp && remoteStamp === stamp)) {
        rev = remoteRev;
        stamp = remoteStamp;
        acked = remoteText;
        if (text === remoteText) dirty = false;
        return { action: 'echo' };
      }
      if (remoteText === text) {
        rev = remoteRev;
        stamp = remoteStamp;
        acked = remoteText;
        dirty = false;
        conflict = null;
        return { action: 'sync' };
      }
      if (isEditing()) {
        const again = !!(conflict && conflict.remoteText !== remoteText);
        conflict = { remoteText: remoteText, remoteRev: remoteRev, remoteStamp: remoteStamp };
        setStatus(again ? '另一页又有更新，请重新确认。' : '便签在另一页更新了');
        return { action: 'conflict', remoteText: remoteText, status: status };
      }
      text = remoteText;
      acked = remoteText;
      rev = remoteRev;
      stamp = remoteStamp;
      dirty = false;
      conflict = null;
      setStatus('');
      return { action: 'apply', text: remoteText };
    }

    function makeStamp(nextRev) {
      const id = opts.pageId || 'page';
      return id + ':' + nextRev + ':' + Date.now().toString(36) + ':' + Math.random().toString(16).slice(2);
    }

    function applyCommitResult(body, request, result) {
      const requestStamp = request && typeof request.stamp === 'string' ? request.stamp : '';
      if (result && result.ok) {
        const resultStamp = typeof result.stamp === 'string' ? result.stamp : (typeof result.requestId === 'string' ? result.requestId : '');
        if (requestStamp && resultStamp && resultStamp !== requestStamp && result.idempotent !== true) {
          return { ok: false, ignored: true };
        }
        const resultRev = normalizeRev(result.rev != null ? result.rev : rev);
        const stale = resultRev < seenRev || (conflict && conflict.remoteRev > resultRev) || resultRev < rev;
        if (stale) {
          if (inflight === requestStamp) inflight = '';
          return { ok: true, stale: true, applied: false, rev: resultRev };
        }
        if (resultRev > seenRev) seenRev = resultRev;
        rev = resultRev;
        stamp = resultStamp || stamp;
        acked = body;
        dirty = text !== acked;
        conflict = null;
        inflight = '';
        return {
          ok: true,
          idempotent: !!(result && result.idempotent),
          applied: true,
          current: text === body,
          rev: rev,
        };
      }
      inflight = '';
      if (result && result.conflict) {
        conflict = {
          remoteText: typeof result.remoteText === 'string' ? result.remoteText : '',
          remoteRev: normalizeRev(result.remoteRev),
          remoteStamp: typeof result.remoteStamp === 'string' ? result.remoteStamp : '',
        };
        const again = result.moved === true;
        setStatus(again ? '另一页又有更新，请重新确认。' : '便签在另一页更新了');
        return { ok: false, conflict: true, remoteText: conflict.remoteText, remoteRev: conflict.remoteRev };
      }
      return { ok: false, skipped: !!(result && result.skipped), error: true };
    }

    async function commit(payload, saveFn) {
      const useReviewed = reviewed;
      reviewed = null;
      const body = typeof payload === 'string' ? payload : '';
      const baseline = { notes: acked, rev: rev, stamp: stamp };
      const nextStamp = makeStamp((useReviewed ? useReviewed.rev : baseline.rev) + 1);
      const request = {
        text: body,
        baselineNotes: baseline.notes,
        baselineRev: baseline.rev,
        baselineStamp: baseline.stamp,
        stamp: nextStamp,
      };
      if (useReviewed) {
        request.expectRev = useReviewed.rev;
        request.expectNotes = useReviewed.notes;
        request.expectStamp = useReviewed.stamp;
      }
      inflight = nextStamp;
      return enqueueNoteWrite(async function () {
        try {
          if (opts.coordinator && typeof opts.coordinator.commit === 'function') {
            return applyCommitResult(body, request, await opts.coordinator.commit(request));
          }
          const remote = await readRemote();
          if (!remote.ok) return { ok: false, skipped: !!remote.skipped, error: true };
          if (remote.notes === body && remote.stamp && request.stamp && remote.stamp === request.stamp) {
            return applyCommitResult(body, request, { ok: true, rev: remote.rev, stamp: remote.stamp, idempotent: true });
          }
          if (remote.notes === body && !useReviewed) {
            return applyCommitResult(body, request, { ok: true, rev: remote.rev, stamp: remote.stamp, idempotent: true });
          }
          if (useReviewed) {
            const same = remote.rev === useReviewed.rev
              && remote.notes === useReviewed.notes
              && (!useReviewed.stamp || !remote.stamp || remote.stamp === useReviewed.stamp);
            if (!same) {
              return applyCommitResult(body, request, {
                ok: false,
                conflict: true,
                moved: true,
                remoteText: remote.notes,
                remoteRev: remote.rev,
                remoteStamp: remote.stamp,
              });
            }
          } else if (!baselineStillCurrent(remote, baseline)) {
            return applyCommitResult(body, request, {
              ok: false,
              conflict: true,
              remoteText: remote.notes,
              remoteRev: remote.rev,
              remoteStamp: remote.stamp,
            });
          }
          const meta = { rev: remote.rev + 1, stamp: nextStamp };
          inflight = meta.stamp;
          let saved;
          try {
            saved = await saveFn(body, meta);
          } catch (err) {
            inflight = '';
            return { ok: false, error: err };
          }
          if (!saved || saved.ok === false) {
            inflight = '';
            return { ok: false, skipped: !!(saved && saved.skipped) };
          }
          const again = await readRemote();
          if (again.ok && again.stamp === meta.stamp && again.notes === body) {
            return applyCommitResult(body, request, { ok: true, rev: again.rev, stamp: again.stamp });
          }
          inflight = '';
          if (!again.ok) return { ok: false, error: true };
          if (again.notes !== body) {
            return applyCommitResult(body, request, {
              ok: false,
              conflict: true,
              remoteText: again.notes,
              remoteRev: again.rev,
              remoteStamp: again.stamp,
            });
          }
          return { ok: false, error: true };
        } catch (err) {
          inflight = '';
          return { ok: false, error: err };
        }
      });
    }

    function considerAck(result) {
      const ack = result && typeof result === 'object' ? result : {};
      const ackStamp = typeof ack.stamp === 'string' ? ack.stamp : (typeof ack.requestId === 'string' ? ack.requestId : '');
      if (!inflight || !ackStamp || ackStamp !== inflight) return { ok: false, ignored: true };
      const body = typeof ack.notes === 'string' ? ack.notes : text;
      return applyCommitResult(body, { stamp: inflight }, ack);
    }

    function acceptRemote() {
      if (!conflict) return null;
      text = conflict.remoteText;
      acked = conflict.remoteText;
      rev = conflict.remoteRev;
      stamp = conflict.remoteStamp || stamp;
      dirty = false;
      conflict = null;
      setStatus('');
      return text;
    }

    return {
      snapshot: snapshot,
      remember: remember,
      absorbBoot: absorbBoot,
      handleRemote: handleRemote,
      commit: commit,
      considerAck: considerAck,
      acceptRemote: acceptRemote,
      hasConflict: function () { return !!conflict; },
      peekForce: function () { return reviewed != null; },
      armForce: function () {
        if (!conflict) {
          reviewed = null;
          return;
        }
        reviewed = {
          rev: conflict.remoteRev,
          notes: conflict.remoteText,
          stamp: conflict.remoteStamp || '',
        };
      },
      readRemote: readRemote,
    };
  }

  function shouldMarkNoteSaved(outcome, snap) {
    if (!outcome || outcome.ok !== true) return false;
    if (outcome.applied === false || outcome.stale === true || outcome.ignored === true || outcome.current === false) return false;
    if (!snap || snap.conflict || snap.dirty) return false;
    if (snap.text !== snap.acked) return false;
    return true;
  }

  function createNoteCoordinator(storage) {
    let chain = Promise.resolve();

    function read() {
      if (!storage || typeof storage.get !== 'function') {
        return Promise.resolve({ ok: false, skipped: true });
      }
      return Promise.resolve()
        .then(function () { return storage.get({ notes: '', notesRev: 0, notesStamp: '' }); })
        .then(function (data) {
          const src = data && typeof data === 'object' ? data : {};
          return {
            ok: true,
            notes: typeof src.notes === 'string' ? src.notes : '',
            rev: normalizeRev(src.notesRev),
            stamp: typeof src.notesStamp === 'string' ? src.notesStamp : '',
          };
        })
        .catch(function (err) { return { ok: false, error: err }; });
    }

    function conflictResult(remote, moved) {
      return {
        ok: false,
        conflict: true,
        moved: moved === true,
        remoteText: remote.notes,
        remoteRev: remote.rev,
        remoteStamp: remote.stamp,
      };
    }

    function commitLocked(request) {
      const req = request || {};
      const body = typeof req.text === 'string' ? req.text : '';
      const baseline = {
        notes: typeof req.baselineNotes === 'string' ? req.baselineNotes : '',
        rev: req.baselineRev,
        stamp: typeof req.baselineStamp === 'string' ? req.baselineStamp : '',
      };
      const hasExpect = typeof req.expectNotes === 'string' && req.expectRev != null;
      return read().then(function (remote) {
        if (!remote.ok) return { ok: false, skipped: !!remote.skipped, error: true };
        const stamp = typeof req.stamp === 'string' && req.stamp
          ? req.stamp
          : ('q:' + (remote.rev + 1) + ':' + Date.now().toString(36));
        if (remote.stamp && remote.stamp === stamp && remote.notes === body) {
          return { ok: true, rev: remote.rev, stamp: remote.stamp, notes: body, idempotent: true };
        }
        if (hasExpect) {
          const same = remote.rev === normalizeRev(req.expectRev)
            && remote.notes === req.expectNotes
            && (!req.expectStamp || !remote.stamp || remote.stamp === req.expectStamp);
          if (!same) return conflictResult(remote, true);
        } else if (remote.notes === body) {
          return { ok: true, rev: remote.rev, stamp: remote.stamp, notes: body, idempotent: true };
        } else if (!baselineStillCurrent(remote, baseline)) {
          return conflictResult(remote);
        }
        if (!storage || typeof storage.set !== 'function') return { ok: false, skipped: true };
        const nextRev = remote.rev + 1;
        return Promise.resolve()
          .then(function () {
            return storage.set({ notes: body, notesRev: nextRev, notesStamp: stamp });
          })
          .then(function () { return read(); })
          .then(function (again) {
            if (again.ok && again.stamp === stamp && again.notes === body) {
              return { ok: true, rev: again.rev, stamp: again.stamp, notes: body };
            }
            if (again.ok && again.notes !== body) return conflictResult(again);
            return { ok: false, error: true };
          })
          .catch(function () { return { ok: false, error: true }; });
      });
    }

    function commit(request) {
      const run = chain.then(function () { return commitLocked(request); });
      chain = run.then(function () {}, function () {});
      return run;
    }

    return { commit: commit };
  }

  const api = {
    normalizeRev: normalizeRev,
    imeBlocksSubmit: imeBlocksSubmit,
    createImeGuard: createImeGuard,
    createNoteKeeper: createNoteKeeper,
    createNoteCoordinator: createNoteCoordinator,
    shouldMarkNoteSaved: shouldMarkNoteSaved,
  };
  root.SopifyNoteSync = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
