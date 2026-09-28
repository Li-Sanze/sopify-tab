/**
 * Cross-page collection writes.
 * Callers send add / update / remove intents. One coordinator per extension
 * reads the latest list, applies those intents, then writes.
 * Todos and worksets keep their id. Sites keep one row per url.
 * A retry of the same id or url does not insert another row.
 */
(function (root) {
  'use strict';

  var WORKSET_CAP = 5;

  function clone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function collectionRev(n) {
    var v = typeof n === 'string' && String(n).trim() ? Number(n) : n;
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  }

  function todoItem(raw) {
    if (!raw || typeof raw.id !== 'string' || !raw.id) return null;
    if (typeof raw.text !== 'string') return null;
    return { id: raw.id, text: raw.text, done: raw.done === true };
  }

  function siteItem(raw) {
    if (!raw || typeof raw.url !== 'string' || !raw.url) return null;
    if (typeof raw.name !== 'string') return null;
    return { name: raw.name, url: raw.url };
  }

  function worksetItem(raw) {
    if (!raw || typeof raw.id !== 'string' || !raw.id) return null;
    if (typeof raw.name !== 'string' || !raw.name) return null;
    if (typeof raw.savedAt !== 'number' || !Number.isFinite(raw.savedAt)) return null;
    var tabs = [];
    var source = Array.isArray(raw.tabs) ? raw.tabs : [];
    for (var i = 0; i < source.length; i += 1) {
      var tab = source[i];
      if (!tab || typeof tab.url !== 'string' || !tab.url) continue;
      tabs.push({ title: typeof tab.title === 'string' ? tab.title : '', url: tab.url });
    }
    if (!tabs.length) return null;
    return { id: raw.id, name: raw.name, savedAt: raw.savedAt, tabs: tabs };
  }

  function normalizeItem(raw, domain) {
    if (domain === 'sites') return siteItem(raw);
    if (domain === 'worksets') return worksetItem(raw);
    return todoItem(raw);
  }

  function itemKey(item, domain) {
    if (!item) return '';
    return domain === 'sites' ? item.url : item.id;
  }

  function listFrom(raw, domain) {
    var src = Array.isArray(raw) ? raw : [];
    var out = [];
    var seen = {};
    for (var i = 0; i < src.length; i += 1) {
      var item = normalizeItem(src[i], domain);
      var key = itemKey(item, domain);
      if (!item || !key || seen[key]) continue;
      seen[key] = true;
      out.push(item);
    }
    if (domain === 'worksets') {
      out.sort(function (a, b) { return b.savedAt - a.savedAt; });
    }
    return out;
  }

  function sameList(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function changedItem(prev, next, domain) {
    if (domain === 'sites') return prev.name !== next.name;
    if (domain === 'worksets') {
      return prev.name !== next.name || prev.savedAt !== next.savedAt || JSON.stringify(prev.tabs) !== JSON.stringify(next.tabs);
    }
    return prev.text !== next.text || prev.done !== next.done;
  }

  function diffCollection(base, next, domain) {
    var before = listFrom(base, domain);
    var after = listFrom(next, domain);
    var prevBy = {};
    var nextBy = {};
    var ops = [];
    var i;
    for (i = 0; i < before.length; i += 1) prevBy[itemKey(before[i], domain)] = before[i];
    for (i = 0; i < after.length; i += 1) {
      var item = after[i];
      var key = itemKey(item, domain);
      nextBy[key] = item;
      if (!prevBy[key]) ops.push({ op: 'add', item: item });
      else if (changedItem(prevBy[key], item, domain)) ops.push({ op: 'update', id: key, item: item });
    }
    for (i = 0; i < before.length; i += 1) {
      var oldKey = itemKey(before[i], domain);
      if (!nextBy[oldKey]) ops.push({ op: 'remove', id: oldKey });
    }
    return ops;
  }

  function applyOps(list, ops, domain) {
    var items = listFrom(list, domain);
    var steps = Array.isArray(ops) ? ops : [];
    for (var i = 0; i < steps.length; i += 1) {
      var op = steps[i] || {};
      var key = domain === 'sites'
        ? (op.id || (op.item && op.item.url) || '')
        : (op.id || (op.item && op.item.id) || '');
      var at = -1;
      var n;
      for (n = 0; n < items.length; n += 1) {
        if (itemKey(items[n], domain) === key) { at = n; break; }
      }
      if (op.op === 'add') {
        var added = normalizeItem(op.item, domain);
        if (!added) return { ok: false, error: true };
        var addKey = itemKey(added, domain);
        var exists = -1;
        for (n = 0; n < items.length; n += 1) {
          if (itemKey(items[n], domain) === addKey) { exists = n; break; }
        }
        if (exists === -1) {
          var slot = -1;
          if (op.replaces) {
            for (n = 0; n < items.length; n += 1) {
              if (itemKey(items[n], domain) === op.replaces) { slot = n; break; }
            }
          }
          if (slot === -1) items.push(added);
          else items.splice(slot, 0, added);
        }
      } else if (op.op === 'update') {
        var updated = normalizeItem(op.item, domain);
        if (!updated || itemKey(updated, domain) !== key || at === -1) return { ok: false, missing: true };
        items[at] = updated;
      } else if (op.op === 'remove') {
        if (at !== -1) items.splice(at, 1);
      } else {
        return { ok: false, error: true };
      }
    }
    if (domain === 'worksets') {
      items.sort(function (a, b) { return b.savedAt - a.savedAt; });
      if (items.length > WORKSET_CAP) return { ok: false, full: true };
    }
    return { ok: true, items: items };
  }

  function revKey(domain) {
    if (domain === 'sites') return 'sitesRev';
    if (domain === 'worksets') return 'worksetsRev';
    return 'todosRev';
  }

  function createCollectionCoordinator(storage) {
    var chains = {
      todos: Promise.resolve(),
      sites: Promise.resolve(),
      worksets: Promise.resolve(),
    };

    function read(domain) {
      if (!storage || typeof storage.get !== 'function') {
        return Promise.resolve({ ok: false, skipped: true });
      }
      var defaults = {};
      defaults[domain] = [];
      defaults[revKey(domain)] = 0;
      return Promise.resolve()
        .then(function () { return storage.get(defaults); })
        .then(function (data) {
          var src = data && typeof data === 'object' ? data : {};
          return {
            ok: true,
            items: listFrom(src[domain], domain),
            rev: collectionRev(src[revKey(domain)]),
          };
        })
        .catch(function () { return { ok: false, error: true }; });
    }

    function commitLocked(request) {
      var req = request || {};
      var domain = req.domain;
      if (domain !== 'todos' && domain !== 'sites' && domain !== 'worksets') {
        return Promise.resolve({ ok: false, error: true });
      }
      if (req.unread === true || req.replace === true) {
        return Promise.resolve({ ok: false, blocked: req.unread === true, error: req.replace === true });
      }
      var ops = clone(Array.isArray(req.ops) ? req.ops : []);
      return read(domain).then(function (remote) {
        if (!remote.ok) return { ok: false, skipped: !!remote.skipped, error: true };
        var applied = applyOps(remote.items, ops, domain);
        if (!applied.ok) return applied;
        if (sameList(remote.items, applied.items)) {
          return {
            ok: true,
            idempotent: true,
            items: applied.items,
            rev: remote.rev,
            readback: true,
            domain: domain,
          };
        }
        if (!storage || typeof storage.set !== 'function') return { ok: false, skipped: true };
        var nextRev = remote.rev + 1;
        var payload = {};
        payload[domain] = applied.items;
        payload[revKey(domain)] = nextRev;
        return Promise.resolve()
          .then(function () { return storage.set(payload); })
          .then(function () { return read(domain); })
          .then(function (again) {
            if (!again.ok) return { ok: false, error: true };
            if (again.rev === nextRev && sameList(again.items, applied.items)) {
              return {
                ok: true,
                items: again.items,
                rev: again.rev,
                readback: true,
                domain: domain,
              };
            }
            return { ok: false, error: true };
          })
          .catch(function () { return { ok: false, error: true }; });
      });
    }

    function commit(request) {
      var domain = request && request.domain;
      if (!chains[domain]) return Promise.resolve({ ok: false, error: true });
      var run = chains[domain].then(function () { return commitLocked(request); }, function () { return commitLocked(request); });
      chains[domain] = run.then(function () { return null; }, function () { return null; });
      return run;
    }

    return { commit: commit };
  }

  var api = {
    collectionRev: collectionRev,
    diffTodos: function (base, next) { return diffCollection(base, next, 'todos'); },
    diffSites: function (base, next) { return diffCollection(base, next, 'sites'); },
    diffWorksets: function (base, next) { return diffCollection(base, next, 'worksets'); },
    applyOps: applyOps,
    createCollectionCoordinator: createCollectionCoordinator,
  };
  root.SopifyCollection = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
