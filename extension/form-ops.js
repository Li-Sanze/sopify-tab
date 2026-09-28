/**
 * Page-level submit identity.
 * The coordinator is idempotent by id or url, but a form that mints a new
 * id on every submit turns one retry into a second row. Pin opId and itemId
 * before the first send. A failed retry of the same draft reuses them.
 * Identical text with a different itemId stays a different row.
 * Sites stay one row per url.
 */
(function (root) {
  'use strict';

  function planTodoAdd(record, text, mint) {
    var snapshot = typeof text === 'string' ? text : '';
    if (record && record.kind === 'todo' && record.snapshot === snapshot && record.itemId && record.opId) {
      return {
        opId: record.opId,
        itemId: record.itemId,
        snapshot: record.snapshot,
        reuse: true,
        record: record,
      };
    }
    var next = {
      kind: 'todo',
      opId: mint(),
      itemId: mint(),
      snapshot: snapshot,
    };
    return {
      opId: next.opId,
      itemId: next.itemId,
      snapshot: snapshot,
      reuse: false,
      record: next,
    };
  }

  function planSiteAdd(record, name, url, mint) {
    if (record && record.kind === 'site' && record.url === url && record.opId) {
      var kept = {
        kind: 'site',
        opId: record.opId,
        itemId: url,
        url: url,
        snapshot: name,
      };
      return {
        opId: record.opId,
        itemId: url,
        url: url,
        name: name,
        snapshot: name,
        reuse: true,
        record: kept,
      };
    }
    var opId = mint();
    var next = { kind: 'site', opId: opId, itemId: url, url: url, snapshot: name };
    return {
      opId: opId,
      itemId: url,
      url: url,
      name: name,
      snapshot: name,
      reuse: false,
      record: next,
    };
  }

  function planRemove(record, itemId, mint) {
    if (record && record.kind === 'remove' && record.itemId === itemId && record.opId) {
      return { opId: record.opId, itemId: itemId, reuse: true, record: record };
    }
    var next = { kind: 'remove', opId: mint(), itemId: itemId, snapshot: itemId };
    return { opId: next.opId, itemId: itemId, reuse: false, record: next };
  }

  function planClearDone(record, ids, mint) {
    var list = Array.isArray(ids) ? ids.slice() : [];
    var snapshot = list.join('\n');
    if (record && record.kind === 'clear' && record.snapshot === snapshot && record.opId) {
      return { opId: record.opId, ids: record.ids.slice(), reuse: true, record: record };
    }
    var next = { kind: 'clear', opId: mint(), itemId: snapshot, snapshot: snapshot, ids: list };
    return { opId: next.opId, ids: list.slice(), reuse: false, record: next };
  }

  function planWorksetSave(record, mint, now) {
    if (record && record.kind === 'workset' && record.itemId && record.opId) {
      return {
        opId: record.opId,
        itemId: record.itemId,
        savedAt: record.savedAt,
        reuse: true,
        record: record,
      };
    }
    var savedAt = typeof now === 'number' && Number.isFinite(now) ? now : Date.now();
    var next = {
      kind: 'workset',
      opId: mint(),
      itemId: mint(),
      savedAt: savedAt,
      snapshot: '',
    };
    next.snapshot = next.itemId;
    return {
      opId: next.opId,
      itemId: next.itemId,
      savedAt: next.savedAt,
      reuse: false,
      record: next,
    };
  }

  function settleFormSubmit(record, currentInput, saved) {
    var snapshot = record && typeof record.snapshot === 'string' ? record.snapshot : '';
    var current = typeof currentInput === 'string' ? currentInput : '';
    if (saved) {
      return { clearInput: current === snapshot, input: current, record: null };
    }
    return { clearInput: false, input: current, record: record };
  }

  function settleSiteSubmit(record, name, url, saved) {
    var same = !!(record && record.url === url && record.snapshot === name);
    if (saved) return { clearInput: same, name: name, url: url, record: null };
    return { clearInput: false, name: name, url: url, record: record };
  }

  var api = {
    planTodoAdd: planTodoAdd,
    planSiteAdd: planSiteAdd,
    planRemove: planRemove,
    planClearDone: planClearDone,
    planWorksetSave: planWorksetSave,
    settleFormSubmit: settleFormSubmit,
    settleSiteSubmit: settleSiteSubmit,
  };
  root.SopifyFormOps = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
