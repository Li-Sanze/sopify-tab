(() => {
  'use strict';

  const DESK_KEYS = ['sites', 'todos', 'notes', 'name'];
  const WORKSET_CAP = 5;
  const WORKSET_STORE_CAP = 5;
  const WORKSET_TAB_CAP = 50;
  const WORKSET_TITLE_MAX = 200;

  const state = {
    view: 'desk',
    name: '',
    sites: [],
    todos: [],
    notes: '',
    tabs: [],
    filter: '',
    worksetFilter: '',
    worksets: [],
  };

  const desk3dSubs = [];
  let deskLoadBroken = false;
  let noteWriteMeta = null;
  const domainUnread = {
    todos: false,
    sites: false,
    notes: false,
    name: false,
    worksets: false,
  };
  function markDeskUnread() {
    domainUnread.todos = true;
    domainUnread.sites = true;
    domainUnread.notes = true;
    domainUnread.name = true;
  }
  function clearDeskUnread() {
    domainUnread.todos = false;
    domainUnread.sites = false;
    domainUnread.notes = false;
    domainUnread.name = false;
  }
  let todosSeen = 0;
  let sitesSeen = 0;
  let worksetsSeen = 0;
  function collectionRev(n) {
    const v = typeof n === 'string' && String(n).trim() ? Number(n) : n;
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  }

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  const hue = (s) => {
    let h = 0;
    for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  };
  const mono = (s) => {
    const t = String(s).trim();
    const m = t.match(/[A-Za-z0-9\u4e00-\u9fff]/);
    return (m ? m[0] : t.slice(0, 1) || '?').toUpperCase();
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `t-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  let todoAddRecord = null;
  let dialogTodoAdd = null;
  let siteAddRecord = null;
  let todoRemoveRecord = null;
  let siteRemoveRecord = null;
  let siteEdit = null;
  let siteEditRecord = null;
  let siteEditRemoveRecord = null;
  let siteEditBusy = false;
  let clearDoneRecord = null;
  let worksetSaveRecord = null;
  let worksetRemoveRecord = null;

  function formOps() {
    return window.SopifyFormOps;
  }

  const hasStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  const hasTabs = typeof chrome !== 'undefined' && chrome.tabs;

  function normalizeSiteUrl(raw) {
    let s = String(raw || '').trim();
    if (!s) throw new Error('empty');
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) s = `https://${s}`;
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('scheme');
    return u.href;
  }

  function domainOf(url) {
    try {
      const u = new URL(url);
      const host = u.hostname;
      if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return 'localhost';
      if (u.protocol === 'http:' || u.protocol === 'https:') return host || u.protocol.replace(':', '');
      if (u.protocol === 'chrome:') return `chrome://${u.host || 'newtab'}`;
      if (u.protocol === 'chrome-extension:') return 'chrome-extension';
      if (u.protocol === 'file:') return 'file';
      if (u.protocol === 'about:') return 'about';
      return (u.protocol || 'other').replace(':', '') || 'other';
    } catch {
      return 'other';
    }
  }

  // Desk 「这个窗口」 / workset: http: and https: only, including loopback.
  function isDeskSummaryUrl(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function portLabel(url) {
    try {
      const u = new URL(url);
      if (domainOf(url) === 'localhost' && u.port) return `:${u.port}`;
    } catch { /* ignore */ }
    return '';
  }

  function urlLine(url) {
    try {
      const u = new URL(url);
      if (domainOf(url) === 'localhost') return u.pathname + u.search;
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return u.hostname + u.pathname + u.search;
      }
      return url;
    } catch {
      return url || '';
    }
  }

  function groupTabs(list) {
    const m = new Map();
    for (const t of list) {
      const host = domainOf(t.url || '');
      if (!m.has(host)) m.set(host, []);
      m.get(host).push(t);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }

  function filterTabs(list, q) {
    const needle = String(q || '').trim().toLowerCase();
    if (!needle) return list;
    return list.filter((t) => {
      const title = (t.title || '').toLowerCase();
      const url = (t.url || '').toLowerCase();
      return title.includes(needle) || url.includes(needle);
    });
  }

  function tabsToCloseForHost(list, filter, host) {
    const seen = new Set();
    const out = [];
    const matched = filterTabs(list || [], filter).filter((t) => domainOf((t && t.url) || '') === host);
    for (const t of matched) {
      if (!t || t.id == null || seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
    return out;
  }

  function closeHostButtonLabel(count) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    return '关闭这 ' + n + ' 个标签';
  }

  function noteConflictView(local, remote) {
    function parts(text) {
      const raw = String(text == null ? '' : text);
      const trimmed = raw.replace(/^\s+|\s+$/g, '');
      if (!trimmed) return { full: '还没写', preview: '还没写', long: false };
      const flat = trimmed.replace(/\s+/g, ' ');
      const chars = [...flat];
      const long = chars.length > 72;
      return {
        full: trimmed,
        preview: long ? chars.slice(0, 72).join('') + '…' : flat,
        long: long,
      };
    }
    const left = parts(local);
    const right = parts(remote);
    return {
      local: left.preview,
      remote: right.preview,
      localFull: left.full,
      remoteFull: right.full,
      localLong: left.long,
      remoteLong: right.long,
    };
  }

  function domainWriteAllowed(unread, key) {
    if (!unread || typeof unread !== 'object') return true;
    return unread[key] !== true;
  }

  function refuseUnreadWrite(unread, key) {
    if (domainWriteAllowed(unread, key)) return null;
    return { ok: false, blocked: true };
  }

  function confirmDeskWrite(saveResult, readback) {
    if (!saveResult || saveResult.ok !== true) {
      return {
        ok: false,
        skipped: !!(saveResult && saveResult.skipped),
        error: true,
      };
    }
    if (saveResult.empty) return { ok: true, empty: true };
    if (!readback || readback.ok !== true) return { ok: false, error: true };
    const out = { ok: true };
    if (saveResult && saveResult.items) out.items = saveResult.items;
    if (saveResult && saveResult.rev != null) out.rev = saveResult.rev;
    if (saveResult && saveResult.idempotent) out.idempotent = true;
    return out;
  }

  function beginRestore(queryOk, openTabs) {
    if (queryOk !== true) return { abort: true, open: [] };
    return { abort: false, open: Array.isArray(openTabs) ? openTabs : [] };
  }

  function noteDraftIsDirty(local, acked, pending) {
    if (pending) return true;
    return String(local == null ? '' : local) !== String(acked == null ? '' : acked);
  }

  function noteOneLiner(notes) {
    const line = String(notes || '').split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    return line || '';
  }

  function worksetTabs(list) {
    return (list || []).filter((t) => isDeskSummaryUrl(t.url || ''));
  }

  function pickResume(todos) {
    const todo = (todos || []).find((t) => t && !t.done && String(t.text || '').trim());
    if (todo) {
      return {
        kind: 'todo',
        title: todo.text.trim(),
        meta: '待办',
        action: '完成',
        todoId: todo.id,
      };
    }
    return {
      kind: 'empty',
      title: '还没有下一件事',
      meta: '',
      action: '写一条',
    };
  }

  function snapshotWorksetTabs(list) {
    const seen = new Set();
    const out = [];
    for (const t of list || []) {
      const raw = t && t.url != null ? String(t.url).trim() : '';
      if (!isDeskSummaryUrl(raw)) continue;
      let href = '';
      try { href = new URL(raw).href; } catch { continue; }
      if (!href || seen.has(href)) continue;
      seen.add(href);
      let title = String((t && t.title) || '').trim() || href;
      if (title.length > WORKSET_TITLE_MAX) title = title.slice(0, WORKSET_TITLE_MAX);
      out.push({ title: title, url: href });
    }
    return out;
  }

  function clipSavedWorksetTabs(list) {
    const all = snapshotWorksetTabs(list);
    return {
      tabs: all.slice(0, WORKSET_TAB_CAP),
      total: all.length,
      overflow: all.length > WORKSET_TAB_CAP,
    };
  }

  function defaultWorksetName(now) {
    const d = now instanceof Date ? now : new Date();
    const p2 = function (n) { return String(n).padStart(2, '0'); };
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }

  function normalizeWorkset(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : '';
    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : '';
    let savedAt = NaN;
    if (typeof raw.savedAt === 'number' && Number.isFinite(raw.savedAt)) savedAt = raw.savedAt;
    else if (typeof raw.savedAt === 'string' && raw.savedAt) savedAt = Date.parse(raw.savedAt);
    if (!id || !name || !Number.isFinite(savedAt)) return null;
    const tabs = snapshotWorksetTabs(Array.isArray(raw.tabs) ? raw.tabs : []).slice(0, WORKSET_TAB_CAP);
    if (!tabs.length) return null;
    return { id: id, name: name, savedAt: savedAt, tabs: tabs };
  }

  function normalizeWorksets(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    const seen = new Set();
    for (const item of raw) {
      const w = normalizeWorkset(item);
      if (!w || seen.has(w.id)) continue;
      seen.add(w.id);
      out.push(w);
    }
    out.sort(function (a, b) { return b.savedAt - a.savedAt; });
    return out.slice(0, 5);
  }

  function oldestWorkset(list) {
    const items = Array.isArray(list) ? list : [];
    if (!items.length) return null;
    return items.reduce(function (a, b) { return a.savedAt <= b.savedAt ? a : b; });
  }

  function proposeSaveWorkset(existing, tabs, opts) {
    const options = opts || {};
    const cap = options.cap == null ? 5 : options.cap;
    const clipped = clipSavedWorksetTabs(tabs);
    if (!clipped.total) return { ok: false, reason: 'empty', overflow: false, totalTabs: 0 };
    const list = normalizeWorksets(existing);
    const savedAt = typeof options.savedAt === 'number' && Number.isFinite(options.savedAt)
      ? options.savedAt
      : Date.now();
    const incoming = {
      id: typeof options.id === 'string' && options.id.trim() ? options.id.trim() : ('w-' + savedAt),
      name: typeof options.name === 'string' && options.name.trim() ? options.name.trim() : defaultWorksetName(new Date(savedAt)),
      savedAt: savedAt,
      tabs: clipped.tabs,
    };
    const extra = { incoming: incoming, overflow: clipped.overflow, totalTabs: clipped.total };
    if (list.length < cap) {
      const worksets = list.concat([incoming]);
      worksets.sort(function (a, b) { return b.savedAt - a.savedAt; });
      return Object.assign({ ok: true, worksets: worksets }, extra);
    }
    return Object.assign({
      ok: false,
      reason: 'full',
      oldest: oldestWorkset(list),
      worksets: list,
    }, extra);
  }

  function overwriteOldestWorkset(existing, incoming) {
    const list = normalizeWorksets(existing);
    const oldest = oldestWorkset(list);
    const next = oldest ? list.filter(function (w) { return w.id !== oldest.id; }) : list.slice();
    const item = normalizeWorkset(incoming);
    if (!item) return { ok: false, reason: 'empty', worksets: list };
    next.push(item);
    next.sort(function (a, b) { return b.savedAt - a.savedAt; });
    return { ok: true, overwritten: oldest, worksets: next };
  }

  function removeWorksetById(existing, id) {
    return normalizeWorksets(existing).filter(function (w) { return w.id !== id; });
  }

  function planRestore(savedTabs, openTabs) {
    const byUrl = new Map();
    for (const t of openTabs || []) {
      let href = '';
      try { href = new URL((t && t.url) || '').href; } catch { href = ''; }
      if (href && !byUrl.has(href)) byUrl.set(href, t);
    }
    const activate = [];
    const create = [];
    for (const tab of snapshotWorksetTabs(savedTabs)) {
      const existing = byUrl.get(tab.url);
      if (existing && existing.id != null) activate.push({ id: existing.id, url: tab.url });
      else create.push(tab.url);
    }
    return {
      activate: activate,
      create: create,
      skip: activate.map(function (t) { return { id: t.id, url: t.url }; }),
    };
  }

  async function executeRestore(plan, api) {
    const creates = (plan && plan.create) || [];
    const activates = (plan && plan.activate) || [];
    if (!api || typeof api.create !== 'function') {
      return {
        opened: 0,
        skipped: 0,
        failed: creates.length + activates.length,
        focusOk: false,
        unopened: creates.slice(),
      };
    }
    let opened = 0;
    let failed = 0;
    const openedIds = [];
    const unopened = [];
    for (let i = 0; i < creates.length; i += 1) {
      try {
        const tab = await api.create({ url: creates[i], active: false });
        if (tab && tab.id != null) {
          opened += 1;
          openedIds.push(tab.id);
        } else {
          failed += 1;
          unopened.push(creates[i]);
        }
      } catch {
        failed += 1;
        unopened.push(creates[i]);
      }
    }
    const skipped = activates.length;
    const focusId = (activates[0] && activates[0].id != null) ? activates[0].id : openedIds[0];
    let focusOk = true;
    if (focusId != null) {
      if (typeof api.activate !== 'function') focusOk = false;
      else {
        try { await api.activate(focusId); } catch { focusOk = false; }
      }
    }
    return { opened: opened, skipped: skipped, failed: failed, focusOk: focusOk, unopened: unopened };
  }

  function summarizeRestore(plan, exec) {
    const opened = exec && Number.isFinite(exec.opened) ? exec.opened : 0;
    const skipped = exec && Number.isFinite(exec.skipped) ? exec.skipped : 0;
    const failed = exec && Number.isFinite(exec.failed) ? exec.failed : 0;
    const planned = ((plan && plan.activate) ? plan.activate.length : 0) + ((plan && plan.create) ? plan.create.length : 0);
    const focusOk = !exec || exec.focusOk !== false;
    const complete = failed === 0 && focusOk && opened + skipped === planned && planned > 0;
    let tone = 'fail';
    if (complete) tone = 'ok';
    else if (opened + skipped > 0) tone = 'partial';
    return {
      opened: opened,
      skipped: skipped,
      failed: failed,
      planned: planned,
      focusOk: focusOk,
      complete: complete,
      tone: tone,
    };
  }

  function restoreToast(name, summary) {
    const label = '「' + name + '」';
    const s = summary || {};
    if (!s.focusOk && s.failed === 0 && (s.opened || 0) + (s.skipped || 0) > 0) {
      return label + '的网页在，没能切过去';
    }
    if (s.complete && s.opened && s.skipped) {
      return '已恢复' + label + '，新开 ' + s.opened + '，已有 ' + s.skipped;
    }
    if (s.complete && s.skipped && !s.opened) return label + '里的网页都还开着';
    if (s.complete) return '已恢复' + label;
    if ((s.opened || 0) + (s.skipped || 0) === 0) return '没能恢复' + label;
    return label + '新开 ' + (s.opened || 0) + '，已有 ' + (s.skipped || 0) + '，没打开 ' + (s.failed || 0);
  }

  function shouldApplyLoad(gen, latest) {
    return gen === latest;
  }

  async function readDeskStorage(getFn) {
    try {
      const data = await getFn({
        sites: [], todos: [], notes: '', name: '', notesRev: 0, notesStamp: '',
        todosRev: 0, sitesRev: 0,
      });
      const src = data && typeof data === 'object' ? data : {};
      return {
        ok: true,
        sites: src.sites,
        todos: src.todos,
        notes: src.notes,
        name: src.name,
        notesRev: src.notesRev,
        notesStamp: src.notesStamp,
        todosRev: src.todosRev,
        sitesRev: src.sitesRev,
        loadError: false,
      };
    } catch {
      return { ok: false, loadError: true };
    }
  }

  function formatWorksetWhen(savedAt) {
    const d = new Date(savedAt);
    if (Number.isNaN(d.getTime())) return '';
    const n = new Date();
    const p2 = function (n0) { return String(n0).padStart(2, '0'); };
    const hm = p2(d.getHours()) + ':' + p2(d.getMinutes());
    if (n.getTime() >= d.getTime() && n.getTime() - d.getTime() < 60000) return '刚刚';
    const day = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
    const diff = Math.round((day(n) - day(d)) / 86400000);
    if (diff <= 0) return '今天 ' + hm;
    if (diff === 1) return '昨天 ' + hm;
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function savedWindowTitle(tabs, now) {
    const savable = (tabs || []).filter(function (t) { return t && isDeskSummaryUrl(t.url || ''); });
    let best = null;
    for (let i = 0; i < savable.length; i += 1) {
      const t = savable[i];
      if (typeof t.lastAccessed !== 'number' || !Number.isFinite(t.lastAccessed)) continue;
      if (!best || t.lastAccessed > best.lastAccessed) best = t;
    }
    if (!best) return defaultWorksetName(now instanceof Date ? now : new Date());
    const title = String(best.title || '').trim();
    if (!title) return defaultWorksetName(now instanceof Date ? now : new Date());
    const chars = [...title];
    if (chars.length > 30) return chars.slice(0, 30).join('') + '…';
    return title;
  }

  async function loadDesk() {
    if (!hasStorage) {
      return { ok: true, sites: [], todos: [], notes: '', name: '', notesRev: 0, notesStamp: '', todosRev: 0, sitesRev: 0, loadError: false };
    }
    return readDeskStorage((defaults) => chrome.storage.local.get(defaults));
  }

  async function saveDesk(partial) {
    const payload = {};
    for (const k of Object.keys(partial)) {
      if (DESK_KEYS.includes(k)) payload[k] = partial[k];
    }
    if (noteWriteMeta && Object.prototype.hasOwnProperty.call(payload, 'notes')) {
      payload.notesRev = noteWriteMeta.rev;
      payload.notesStamp = noteWriteMeta.stamp;
    }
    if (!Object.keys(payload).length) return { ok: true, empty: true };
    if (!hasStorage) return { ok: false, skipped: true };
    await chrome.storage.local.set(payload);
    return { ok: true };
  }

  async function commitDesk(partial) {
    const keys = Object.keys(partial || {}).filter((k) => DESK_KEYS.includes(k));
    for (let i = 0; i < keys.length; i += 1) {
      const refused = refuseUnreadWrite(domainUnread, keys[i]);
      if (refused) return refused;
    }
    if (partial && Object.prototype.hasOwnProperty.call(partial, 'todos')) return commitTodoIntent(partial.todos);
    if (partial && Object.prototype.hasOwnProperty.call(partial, 'sites')) return commitSiteIntent(partial.sites);
    let result;
    try {
      result = await saveDesk(partial);
    } catch {
      return confirmDeskWrite(null, null);
    }
    if (!result || result.ok !== true || result.empty) return confirmDeskWrite(result, null);
    try {
      const defaults = {};
      keys.forEach((k) => { defaults[k] = null; });
      const got = await chrome.storage.local.get(defaults);
      const match = keys.every((k) => JSON.stringify(got[k]) === JSON.stringify(partial[k]));
      return confirmDeskWrite(result, { ok: match });
    } catch {
      return confirmDeskWrite(result, { ok: false });
    }
  }

  function adoptCollection(domain, saved) {
    if (!saved || saved.ok !== true || !saved.items) return;
    const rev = saved.rev == null ? null : collectionRev(saved.rev);
    if (domain === 'todos') {
      if (rev == null || rev >= todosSeen) {
        state.todos = saved.items;
        if (rev != null) todosSeen = rev;
      }
      return;
    }
    if (domain === 'sites') {
      if (rev == null || rev >= sitesSeen) {
        state.sites = saved.items;
        if (rev != null) sitesSeen = rev;
      }
    }
  }

  async function commitTodoIntent(next) {
    if (!window.SopifyCollection) return confirmDeskWrite(null, null);
    const ops = window.SopifyCollection.diffTodos(state.todos, next);
    let committed;
    try { committed = await requestCollectionCommit({ domain: 'todos', ops: ops }); } catch { committed = null; }
    if (!committed || committed.ok !== true) {
      if (committed && committed.blocked) return committed;
      return confirmDeskWrite(committed, null);
    }
    return confirmDeskWrite(
      { ok: true, items: committed.items, rev: committed.rev, idempotent: committed.idempotent },
      { ok: committed.readback !== false },
    );
  }

  async function moveTodoToFront(id) {
    let committed;
    try {
      committed = await requestCollectionCommit({
        domain: 'todos',
        ops: [{ op: 'move', id: id, to: 'front' }],
      });
    } catch {
      committed = null;
    }
    if (committed && committed.blocked) {
      showWriteError('todo-dialog-save-error', '待办暂时没能读取');
      showTodoLoadError();
      return committed;
    }
    if (committed && committed.missing) {
      showWriteError('todo-dialog-save-error', '这条已在另一页删掉了');
      const loaded = await loadDesk();
      if (loaded && loaded.ok === true) applyDesk(loaded, { notes: false });
      return committed;
    }
    const saved = (!committed || committed.ok !== true)
      ? confirmDeskWrite(committed, null)
      : confirmDeskWrite(
        { ok: true, items: committed.items, rev: committed.rev, idempotent: committed.idempotent },
        { ok: committed.readback !== false },
      );
    if (!saved || saved.ok !== true) {
      showWriteError('todo-dialog-save-error', writeFailMessage(saved, '待办暂时没能读取', '没存上，再点一次'));
      if (saved && saved.blocked) showTodoLoadError();
      return saved;
    }
    hideWriteError('todo-save-error');
    hideWriteError('todo-dialog-save-error');
    adoptCollection('todos', saved);
    renderTodos();
    toast('已设为下一件');
    return saved;
  }

  async function commitSiteIntent(next) {
    if (!window.SopifyCollection) return confirmDeskWrite(null, null);
    const ops = window.SopifyCollection.diffSites(state.sites, next);
    if (ops.length === 2) {
      const added = ops.find((op) => op.op === 'add');
      const removed = ops.find((op) => op.op === 'remove');
      if (added && removed) added.replaces = removed.id;
    }
    let committed;
    try { committed = await requestCollectionCommit({ domain: 'sites', ops: ops }); } catch { committed = null; }
    if (!committed || committed.ok !== true) {
      if (committed && committed.blocked) return committed;
      return confirmDeskWrite(committed, null);
    }
    return confirmDeskWrite(
      { ok: true, items: committed.items, rev: committed.rev, idempotent: committed.idempotent },
      { ok: committed.readback !== false },
    );
  }

  async function replaceTodos(next, errorId, message) {
    const saved = await commitDesk({ todos: next });
    if (!saved || saved.ok !== true) {
      showWriteError(errorId, writeFailMessage(saved, '待办暂时没能读取', message));
      if (saved && saved.blocked) showTodoLoadError();
      renderTodos();
      return false;
    }
    hideWriteError('todo-save-error');
    hideWriteError('todo-dialog-save-error');
    adoptCollection('todos', saved);
    renderTodos();
    return true;
  }

  let spaceViewOn = false;

  function publishSpaceView() {
    document.dispatchEvent(new CustomEvent('sopify-spaceview', { detail: spaceViewOn === true }));
  }

  async function loadSpaceView() {
    spaceViewOn = false;
    if (!hasStorage) return false;
    try {
      const data = await chrome.storage.local.get({ spaceView: false });
      spaceViewOn = data.spaceView === true;
    } catch {
      spaceViewOn = false;
    }
    return spaceViewOn;
  }

  async function saveSpaceView(on) {
    spaceViewOn = on === true;
    if (hasStorage) await chrome.storage.local.set({ spaceView: spaceViewOn });
    publishSpaceView();
  }

  async function loadWorksets() {
    if (!hasStorage) return [];
    try {
      const data = await chrome.storage.local.get({ worksets: [], worksetsRev: 0 });
      const rev = collectionRev(data && data.worksetsRev);
      if (rev >= worksetsSeen) worksetsSeen = rev;
      return normalizeWorksets(data.worksets);
    } catch {
      return null;
    }
  }

  async function persistWorksets(list) {
    const worksets = normalizeWorksets(list);
    if (!domainWriteAllowed(domainUnread, 'worksets')) return { ok: false, blocked: true };
    if (!hasStorage) return confirmDeskWrite({ ok: false, skipped: true }, null);
    if (!window.SopifyCollection) return confirmDeskWrite(null, null);
    const ops = window.SopifyCollection.diffWorksets(state.worksets, worksets);
    let committed;
    try {
      committed = await requestCollectionCommit({ domain: 'worksets', ops: ops });
    } catch {
      committed = null;
    }
    if (!committed || committed.ok !== true) {
      if (committed && committed.blocked) return committed;
      return confirmDeskWrite(committed, null);
    }
    const saved = confirmDeskWrite(
      { ok: true, items: committed.items, rev: committed.rev, idempotent: committed.idempotent },
      { ok: committed.readback !== false },
    );
    if (!saved.ok) return saved;
    const storedRev = committed.rev == null ? null : collectionRev(committed.rev);
    if (storedRev == null || storedRev >= worksetsSeen) {
      state.worksets = normalizeWorksets(committed.items);
      if (storedRev != null) worksetsSeen = storedRev;
    }
    renderSavedWorksets();
    notifyDesk3d();
    return saved;
  }

  async function queryWindowTabs() {
    if (!hasTabs) return [];
    return chrome.tabs.query({ currentWindow: true });
  }

  const greetingOf = (h) => (
    h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 17 ? '下午好' : h < 20 ? '傍晚好' : '晚上好'
  );

  function tick() {
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    const greet = $('#greet-word');
    const date = $('#date-line');
    const clock = $('#clock-hm');
    if (greet) greet.textContent = greetingOf(d.getHours()) + (state.name.trim() ? `，${state.name.trim()}` : '');
    if (date) date.textContent = `${d.getMonth() + 1}月${d.getDate()}日 星期${wd}`;
    if (clock) clock.textContent = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  }

  function siteTilesHtml(list) {
    return list.map((s) => {
      const i = state.sites.indexOf(s);
      return `
      <div class="tilewrap">
        <a class="tile" href="${esc(s.url)}" title="${esc(s.name)} · ${esc(s.url)}" style="--h:${hue(s.url)}">
          <span class="glyph" aria-hidden="true">${esc(mono(s.name))}</span>
          <span class="lbl" title="${esc(s.name)}">${esc(s.name)}</span>
        </a>
        <button type="button" class="iconbtn tile-remove" data-remove-site="${i}" aria-label="移除 ${esc(s.name)}">
          <svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>`;
    }).join('');
  }

  function captureSiteEditFields() {
    const held = { name: false, url: false };
    if (!siteEdit) return held;
    const form = document.querySelector('#sites-all [data-site-edit]');
    if (!form || form.getAttribute('data-original-url') !== siteEdit.originalUrl) return held;
    const name = form.querySelector('[name="edit-name"]');
    const url = form.querySelector('[name="edit-url"]');
    const active = document.activeElement;
    if (name) {
      siteEdit.name = name.value;
      if (active === name) {
        held.name = true;
        siteEdit.caret = { field: 'name', start: name.selectionStart, end: name.selectionEnd };
      }
    }
    if (url) {
      siteEdit.url = url.value;
      if (active === url) {
        held.url = true;
        siteEdit.caret = { field: 'url', start: url.selectionStart, end: url.selectionEnd };
      }
    }
    return held;
  }

  function restoreSiteEditFocus(held) {
    if (!siteEdit) return;
    const name = document.querySelector('#sites-all [name="edit-name"]');
    const url = document.querySelector('#sites-all [name="edit-url"]');
    let input = null;
    if (siteEdit.focus && name) input = name;
    else if (held && held.url && url) input = url;
    else if (held && held.name && name) input = name;
    if (!input) return;
    input.focus();
    if (siteEdit.focus) input.select();
    else if (siteEdit.caret && typeof input.setSelectionRange === 'function') {
      const start = siteEdit.caret.start;
      const end = siteEdit.caret.end;
      if (typeof start === 'number' && typeof end === 'number') input.setSelectionRange(start, end);
    }
    siteEdit.focus = false;
  }

  function siteManageHtml(list) {
    return list.map((s) => {
      const i = state.sites.indexOf(s);
      if (siteEdit && siteEdit.originalUrl === s.url) {
        const err = siteEdit.error || '';
        return `
        <form class="siterow siterow-editing" data-site-edit="${i}" data-original-url="${esc(s.url)}">
          <label class="sr-only" for="site-edit-name">名称</label>
          <input class="field" id="site-edit-name" name="edit-name" value="${esc(siteEdit.name)}" required autocomplete="off">
          <label class="sr-only" for="site-edit-url">网址</label>
          <input class="field" id="site-edit-url" name="edit-url" type="text" inputmode="url" value="${esc(siteEdit.url)}" required autocomplete="off" spellcheck="false">
          <button type="submit" class="btn">保存</button>
          <button type="button" class="btn ghost" data-edit-cancel>取消</button>
          <p class="desk-write-error" data-edit-error role="alert" ${err ? '' : 'hidden'}>${esc(err)}</p>
        </form>`;
      }
      return `
      <div class="siterow">
        <a class="tile" href="${esc(s.url)}" title="${esc(s.name)} · ${esc(s.url)}" style="--h:${hue(s.url)}">
          <span class="glyph" aria-hidden="true">${esc(mono(s.name))}</span>
          <span class="siterow-text">
            <span class="lbl">${esc(s.name)}</span>
            <span class="url">${esc(s.url)}</span>
          </span>
        </a>
        <button type="button" class="btn ghost" data-edit-site="${i}" data-site-url="${esc(s.url)}">修改</button>
        <button type="button" class="iconbtn" data-remove-site="${i}" aria-label="移除 ${esc(s.name)}">
          <svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>`;
    }).join('');
  }

  function renderSites() {
    const held = captureSiteEditFields();
    if (domainUnread.sites) {
      siteEdit = null;
      $('#sites').innerHTML = '';
      const more = $('#sites-more');
      if (more) more.hidden = true;
      const all = $('#sites-all');
      if (all) all.innerHTML = '';
      $('#c-sites').textContent = '0';
      return;
    }
    if (siteEdit && !siteEditBusy && !state.sites.some((s) => s.url === siteEdit.originalUrl)) {
      siteEdit = null;
      siteEditRecord = null;
      siteEditRemoveRecord = null;
    }
    const home = state.sites.slice(0, 8);
    $('#sites').innerHTML = siteTilesHtml(home);
    const more = $('#sites-more');
    if (more) {
      const showMore = state.sites.length > 8;
      more.hidden = !showMore;
      if (showMore) more.textContent = `全部 ${state.sites.length} 个`;
    }
    const all = $('#sites-all');
    const preserveEdit = siteEditBusy && document.querySelector('#sites-all [data-site-edit]');
    if (all && !preserveEdit) {
      all.innerHTML = state.sites.length ? siteManageHtml(state.sites) : '<p class="empty">还没有常用站。</p>';
    }
    $('#c-sites').textContent = String(state.sites.length);
    $('#c-sites').setAttribute('aria-label', `${state.sites.length} 个常用站`);
    if (!preserveEdit) restoreSiteEditFocus(held);
  }

  function showSiteEditError(message) {
    if (siteEdit) siteEdit.error = message;
    const el = document.querySelector('#sites-all [data-edit-error]');
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
  }

  function beginSiteEdit(index) {
    if (siteEditBusy) return;
    const site = state.sites[index];
    if (!site) return;
    if (siteEdit && siteEdit.originalUrl === site.url) return;
    siteEdit = {
      originalUrl: site.url,
      name: site.name,
      url: site.url,
      error: '',
      focus: true,
    };
    renderSites();
  }

  function cancelSiteEdit() {
    if (siteEditBusy) return;
    const url = siteEdit && siteEdit.originalUrl;
    siteEdit = null;
    siteEditRecord = null;
    siteEditRemoveRecord = null;
    renderSites();
    if (!url) return;
    const again = [...document.querySelectorAll('#sites-all [data-edit-site]')].find((btn) => btn.dataset.siteUrl === url);
    if (again) again.focus();
  }

  async function commitSiteEdit(form) {
    if (siteEditBusy || !siteEdit || !form) return;
    const nameInput = form.querySelector('[name="edit-name"]');
    const urlInput = form.querySelector('[name="edit-url"]');
    if (!nameInput || !urlInput) return;
    const name = nameInput.value.trim();
    if (!name) return;
    let url;
    try { url = normalizeSiteUrl(urlInput.value); } catch {
      showSiteEditError('网址需要是 http(s)');
      urlInput.focus();
      return;
    }
    const originalUrl = siteEdit.originalUrl;
    if (state.sites.some((site) => site.url === url && site.url !== originalUrl)) {
      showSiteEditError('这个网址已经有了');
      urlInput.focus();
      return;
    }
    const current = state.sites.find((site) => site.url === originalUrl);
    if (!current) {
      siteEdit = null;
      renderSites();
      return;
    }
    if (current.name === name && current.url === url) {
      siteEdit = null;
      siteEditRecord = null;
      siteEditRemoveRecord = null;
      renderSites();
      return;
    }
    siteEdit.name = nameInput.value;
    siteEdit.url = urlInput.value;
    siteEdit.error = '';
    siteEditBusy = true;
    const planned = formOps().planSiteAdd(siteEditRecord, name, url, uid);
    siteEditRecord = planned.record;
    if (url !== originalUrl) {
      const removal = formOps().planRemove(siteEditRemoveRecord, originalUrl, uid);
      siteEditRemoveRecord = removal.record;
    }
    const next = state.sites.map((site) => (
      site.url === originalUrl ? { name: planned.name, url: planned.url } : site
    ));
    const saved = await commitDesk({ sites: next });
    const live = document.querySelector('#sites-all [data-site-edit]');
    const liveName = live ? live.querySelector('[name="edit-name"]') : nameInput;
    const liveUrl = live ? live.querySelector('[name="edit-url"]') : urlInput;
    let currentUrl = '';
    try { currentUrl = normalizeSiteUrl(liveUrl ? liveUrl.value : urlInput.value); } catch {
      currentUrl = (liveUrl ? liveUrl.value : urlInput.value).trim();
    }
    const settled = formOps().settleSiteSubmit(
      planned.record,
      (liveName ? liveName.value : nameInput.value).trim(),
      currentUrl,
      !!(saved && saved.ok === true),
    );
    siteEditRecord = settled.record;
    siteEditBusy = false;
    if (!saved || saved.ok !== true) {
      showSiteEditError(writeFailMessage(saved, '常用站暂时没能读取', '没存上，再点一次'));
      return;
    }
    siteEditRemoveRecord = null;
    adoptCollection('sites', saved);
    if (!settled.clearInput && siteEdit) {
      siteEdit.originalUrl = planned.url;
      siteEdit.name = liveName ? liveName.value : nameInput.value;
      siteEdit.url = liveUrl ? liveUrl.value : urlInput.value;
      siteEdit.error = '';
      siteEdit.focus = false;
      renderSites();
      return;
    }
    siteEdit = null;
    renderSites();
    toast('已改名');
  }

  function toggleSiteForm(force) {
    const dialog = $('#ops-sites-dialog');
    const t = $('#site-add-toggle');
    if (!dialog || !t) return;
    const open = force ?? !dialog.open;
    if (open) {
      if (!dialog.open) dialog.showModal();
      t.setAttribute('aria-expanded', 'true');
      const name = $('#site-name');
      if (name) name.focus();
    } else {
      if (dialog.open) dialog.close();
      t.setAttribute('aria-expanded', 'false');
    }
  }

  function renderTodos() {
    const ul = $('#todos');
    if (domainUnread.todos) {
      if (ul) ul.innerHTML = '';
      renderResume();
      return;
    }
    ul.innerHTML = state.todos.length ? state.todos.map((t) => `
      <li class="todo ${t.done ? 'done' : ''}">
        <label>
          <input type="checkbox" data-todo-id="${esc(t.id)}" ${t.done ? 'checked' : ''}>
          <span>${esc(t.text)}</span>
        </label>
        <button type="button" class="iconbtn" data-del-todo="${esc(t.id)}" aria-label="删除待办：${esc(t.text)}">
          <svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </li>`).join('') : `<li class="empty">还没有待办。</li>`;
    const left = state.todos.filter((t) => !t.done).length;
    const done = state.todos.filter((t) => t.done).length;
    $('#c-todo').textContent = String(left);
    $('#c-todo').setAttribute('aria-label', `${left} 项未完成`);
    $('#todo-done').textContent = done ? `已完成 ${done}` : '';
    $('#todo-clear').disabled = !done;
    renderResume();
  }

  function renderNotes() {
    const ta = $('#notes');
    if (ta && ta !== document.activeElement) ta.value = state.notes;
    const n = [...state.notes.replace(/\s/g, '')].length;
    $('#c-notes').textContent = String(n);
    $('#c-notes').setAttribute('aria-label', `${n} 字`);
    renderResume();
  }

  function titleSize(text) {
    const n = [...String(text || '')].length;
    if (n <= 22) return 's';
    if (n <= 44) return 'm';
    return 'l';
  }

  function renderResume() {
    const next = pickResume(state.todos);
    const root = $('#resume');
    const title = $('#resume-title');
    const act = $('#resume-act');
    if (!root || !title || !act) return;
    if (domainUnread.todos) {
      root.dataset.has = 'unread';
      root.classList.add('is-empty');
      title.textContent = '';
      title.removeAttribute('title');
      delete title.dataset.size;
      act.dataset.kind = 'unread';
      delete act.dataset.todoId;
      const hint = $('#todo-hint');
      if (hint) hint.hidden = true;
      showTodoLoadError();
      return;
    }
    const hintShown = $('#todo-hint');
    if (hintShown) hintShown.hidden = false;
    const done = state.todos.filter((t) => t && t.done).length;
    const has = next.kind === 'todo';
    root.dataset.has = has ? '1' : '0';
    root.classList.toggle('is-empty', !has);
    if (has) {
      title.textContent = next.title;
      title.title = next.title;
      title.dataset.size = titleSize(next.title);
      act.dataset.kind = 'todo';
      act.dataset.todoId = next.todoId;
    } else {
      title.textContent = '';
      title.removeAttribute('title');
      delete title.dataset.size;
      act.dataset.kind = 'empty';
      delete act.dataset.todoId;
    }
    const open = $('#todos-open');
    if (open) {
      const openCount = state.todos.filter((t) => t && !t.done && String(t.text || '').trim()).length;
      if (openCount === 1 && done === 0) open.textContent = '全部待办';
      else if (openCount > 1) open.textContent = `全部待办 · 还有 ${openCount - 1} 条`;
      else if (done > 0) open.textContent = `全部待办 · 已完成 ${done} 件`;
      else open.textContent = '全部待办';
    }
    const input = $('#todo-input');
    const hint = $('#todo-hint');
    const history = $('#todos-done-history');
    if (!has) {
      if (input) input.placeholder = done > 0 ? '都做完了，还有什么？' : '今天先做什么？';
      if (hint) {
        hint.innerHTML = done > 0
          ? '想到下一件就写下来，按 <kbd>回车</kbd>'
          : '写一句，按 <kbd>回车</kbd>，它就是下一件事';
      }
    }
    if (history) {
      history.hidden = !(done > 0);
      history.textContent = `查看已完成 ${done} 件`;
    }
  }

  function renderSavedWorksets() {
    const list = Array.isArray(state.worksets) ? state.worksets : [];
    const recentBtn = $('#workset-restore-recent');
    if (recentBtn) {
      recentBtn.hidden = list.length === 0;
      if (list[0]) recentBtn.title = list[0].name;
      else recentBtn.removeAttribute('title');
    }
    const countEl = $('#c-worksets');
    if (countEl) {
      countEl.textContent = String(list.length);
      countEl.setAttribute('aria-label', `${list.length} 个窗口`);
    }
    const clearBtn = $('#worksets-clear');
    if (clearBtn) clearBtn.disabled = !list.length;
    const entryHtml = list.length ? list.map((w) => `
      <div class="savedset">
        <div class="t">
          <span>${esc(w.name)}</span>
          <span class="url">${w.tabs.length} 个网页 · ${esc(formatWorksetWhen(w.savedAt))}</span>
        </div>
        <button type="button" class="linkbtn" data-restore-workset="${esc(w.id)}">恢复</button>
        <button type="button" class="iconbtn" data-del-workset="${esc(w.id)}" aria-label="删除窗口：${esc(w.name)}">
          <svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>`).join('') : `<p class="empty">还没有存下的窗口。</p>`;
    const box = $('#saved-worksets');
    if (box) box.innerHTML = entryHtml;
    renderLastSaved();
  }

  function ensureLastNameButton() {
    let btn = $('#last-name');
    if (btn) return btn;
    const col = $('#last-col');
    if (!col) return null;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'col-lead rename';
    btn.id = 'last-name';
    btn.innerHTML = '<span id="last-name-text"></span><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"/></svg>';
    const input = col.querySelector('.rename-input');
    const favs = $('#last-favs');
    if (input) input.replaceWith(btn);
    else if (favs) col.insertBefore(btn, favs);
    else col.append(btn);
    return btn;
  }

  function renderLastSaved() {
    const list = Array.isArray(state.worksets) ? state.worksets : [];
    const ws = list[0];
    const empty = $('#last-empty');
    const favs = $('#last-favs');
    const meta = $('#last-meta');
    const actions = $('#last-actions');
    const restore = $('#workset-restore-recent');
    const all = $('#last-all');
    if (domainUnread.worksets) {
      if (empty) empty.hidden = true;
      const nameBtn = $('#last-name');
      if (nameBtn) nameBtn.hidden = true;
      if (favs) favs.hidden = true;
      if (meta) meta.hidden = true;
      if (actions) actions.hidden = true;
      if (restore) restore.hidden = true;
      if (all) all.hidden = true;
      showWorksetLoadError();
      return;
    }
    hideWorksetLoadError();
    if (!ws) {
      const stray = $('#last-col') && $('#last-col').querySelector('.rename-input');
      if (stray) ensureLastNameButton();
      const nameBtn = $('#last-name');
      if (empty) empty.hidden = false;
      if (nameBtn) nameBtn.hidden = true;
      if (favs) favs.hidden = true;
      if (meta) meta.hidden = true;
      if (actions) actions.hidden = true;
      if (restore) restore.hidden = true;
      if (all) all.hidden = true;
      return;
    }
    const nameBtn = ensureLastNameButton();
    const nameText = $('#last-name-text');
    if (empty) empty.hidden = true;
    if (nameBtn) {
      nameBtn.hidden = false;
      nameBtn.setAttribute('aria-label', `改名：${ws.name}`);
    }
    if (nameText) nameText.textContent = ws.name;
    if (favs) {
      const hosts = [];
      const seen = new Set();
      for (const t of ws.tabs || []) {
        let host = '';
        try { host = new URL(t.url).hostname; } catch { host = ''; }
        if (!host || seen.has(host)) continue;
        seen.add(host);
        hosts.push(host);
      }
      const shown = hosts.slice(0, 6);
      favs.hidden = false;
      favs.innerHTML = shown.map((host) => `<span class="fav" style="--h:${hue(host)}">${esc(mono(host))}</span>`).join('')
        + (hosts.length > 6 ? `<span class="fav more">+${hosts.length - 6}</span>` : '');
    }
    if (meta) {
      meta.hidden = false;
      meta.textContent = `${(ws.tabs || []).length} 个网页 · ${formatWorksetWhen(ws.savedAt)}`;
    }
    if (actions) actions.hidden = false;
    if (restore) {
      restore.hidden = false;
      restore.textContent = `恢复这 ${(ws.tabs || []).length} 个网页`;
      restore.title = ws.name;
    }
    if (all) {
      all.hidden = list.length <= 1;
      all.textContent = `全部 ${list.length} 个`;
    }
  }

  function openAllSaved() {
    setView('settings');
    const head = $('#s-worksets');
    if (!head) return;
    head.scrollIntoView({ block: 'start' });
    head.focus();
  }

  function revealDeskWorksets() {
    openAllSaved();
  }

  function startRename(id) {
    const ws = (state.worksets || []).find((w) => w.id === id);
    const btn = $('#last-name');
    if (!ws || !btn) return;
    const input = document.createElement('input');
    input.className = 'col-lead rename-input';
    input.value = ws.name;
    input.maxLength = 40;
    input.setAttribute('aria-label', '新名字');
    btn.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (commit, refocus) => {
      if (done) return;
      done = true;
      const next = input.value.trim();
      const write = commit && next && next !== ws.name;
      if (!write) {
        renderLastSaved();
        if (refocus) {
          const again = $('#last-name');
          if (again) again.focus();
        }
        return;
      }
      const list = (state.worksets || []).map((w) => (
        w.id === id ? { id: w.id, name: next, savedAt: w.savedAt, tabs: w.tabs } : w
      ));
      persistWorksets(list).then((saved) => {
        if (!saved || saved.ok !== true) {
          done = false;
          showWriteError('last-save-error', writeFailMessage(saved, '存下的窗口暂时没能读取', '名字没存上，再按一次回车'));
          if (saved && saved.blocked) showWorksetLoadError();
          if (input.isConnected) input.focus();
          return;
        }
        hideWriteError('last-save-error');
        toast('已改名');
        if (refocus) {
          const again = $('#last-name');
          if (again) again.focus();
        }
      });
    };
    const renameIme = createImeGuard();
    input.addEventListener('compositionstart', () => renameIme.onCompositionStart());
    input.addEventListener('compositionend', () => renameIme.onCompositionEnd());
    input.addEventListener('keydown', (e) => {
      if (e.isComposing || e.key === 'Process' || renameIme.blocks(e)) return;
      if (e.key !== 'Enter' && e.key !== 'Escape') return;
      e.preventDefault();
      finish(e.key === 'Enter', true);
    });
    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (input.isConnected && document.activeElement !== input) finish(true, false);
      }, 0);
    });
  }

  function onSavedWorksetClick(e) {
    const restore = e.target.closest('[data-restore-workset]');
    const del = e.target.closest('[data-del-workset]');
    if (restore) restoreWorksetById(restore.dataset.restoreWorkset);
    else if (del) deleteWorksetById(del.dataset.delWorkset);
  }

  function faviconOf(tabs) {
    for (const t of tabs) {
      const u = t && t.favIconUrl;
      if (typeof u === 'string' && u.trim()) return u.trim();
    }
    return '';
  }

  function bindFaviconFallback(root) {
    $$('img.fav', root).forEach((img) => {
      const ok = () => img.classList.add('ok');
      const fail = () => img.remove();
      img.addEventListener('load', ok);
      img.addEventListener('error', fail);
      if (img.complete) {
        if (img.naturalWidth) ok();
        else fail();
      }
    });
  }

  function renderWorkset() {
    const eligible = worksetTabs(state.tabs);
    const filtered = filterTabs(eligible, state.worksetFilter);
    const shown = filtered.slice(0, WORKSET_CAP);
    const box = $('#workset');
    if (!box) return;
    const q = String(state.worksetFilter || '').trim();
    box.innerHTML = shown.length ? shown.map((t) => {
      const host = domainOf(t.url || '');
      const icon = faviconOf([t]);
      const letter = esc(mono(host));
      const mark = icon
        ? `<img class="fav" src="${esc(icon)}" alt=""><span class="fav-letter">${letter}</span>`
        : `<span class="fav-letter">${letter}</span>`;
      const title = t.title || t.url || '无标题';
      const port = portLabel(t.url || '');
      return `
      <button type="button" class="workrow" data-activate-tab="${t.id}" style="--h:${hue(host)}" title="${esc(title)}">
        <span class="favicon" aria-hidden="true">${mark}</span>
        <span class="t">
          <span>${esc(title)}${port ? `<span class="port">${esc(port)}</span>` : ''}</span>
          <span class="url">${esc(urlLine(t.url || ''))}</span>
        </span>
      </button>`;
    }).join('') : `<p class="empty">${q ? '没有匹配的标签。' : '这个窗口还没有网页。'}</p>`;
    bindFaviconFallback(box);
    const allCount = (state.tabs || []).length;
    const savable = eligible.length;
    const tabCount = $('#c-tabs');
    if (tabCount) {
      tabCount.textContent = String(savable);
      tabCount.setAttribute('aria-label', `可保存网页 ${savable}`);
    }
    const lead = $('#window-lead');
    if (lead) lead.innerHTML = `<b>${allCount}</b> 个标签`;
    const favs = $('#window-favs');
    if (favs) {
      const shownFavs = eligible.slice(0, 6);
      const extra = eligible.length - shownFavs.length;
      favs.innerHTML = shownFavs.map((t) => {
        const host = domainOf(t.url || '');
        const icon = faviconOf([t]);
        const letter = esc(mono(host));
        const img = icon ? `<img class="fav" src="${esc(icon)}" alt="">` : '';
        return `<span class="fav" style="--h:${hue(host)}">${img}<span class="fav-letter">${letter}</span></span>`;
      }).join('') + (extra > 0 ? `<span class="fav more">+${extra}</span>` : '');
      bindFaviconFallback(favs);
    }
    const sub = $('#window-sub');
    const saveBtn = $('#workset-save');
    if (savable === 0) {
      if (lead) lead.textContent = '只有这一页';
      if (sub) sub.textContent = '打开几个网页后，可以在这里存下来';
      if (saveBtn) {
        saveBtn.hidden = true;
        saveBtn.disabled = false;
      }
    } else {
      if (lead) lead.innerHTML = `<b>${allCount}</b> 个标签`;
      if (sub) sub.textContent = `${savable} 个网页可以存下，回头一键恢复`;
      if (saveBtn) {
        saveBtn.hidden = false;
        saveBtn.disabled = false;
      }
    }
    $('#c-tabs-sub').textContent = filtered.length > WORKSET_CAP
      ? `前 ${WORKSET_CAP} / ${filtered.length}`
      : (filtered.length ? `${filtered.length} 个网页` : '');
    renderResume();
  }

  function renderGroups() {
    const q = state.filter;
    const list = filterTabs(state.tabs, q);
    const groups = groupTabs(list);
    const allGroups = groupTabs(state.tabs);
    const savable = worksetTabs(state.tabs).length;
    let tabsLine = `${state.tabs.length} 个标签，来自 ${allGroups.length} 个网站`;
    if (savable !== state.tabs.length) tabsLine += `，其中 ${savable} 个可以存下`;
    $('#tabs-sub').textContent = tabsLine;
    const filterOn = String(q || '').trim().length > 0;
    const closeTitle = filterOn ? '只关闭筛选里显示的这组' : '关闭这个域名下的标签';
    $('#groups').innerHTML = groups.length ? groups.map(([host, tabs]) => `
      <section class="card group" aria-label="${esc(host)}" style="--h:${hue(host)}">
        <div class="grouphead">
          <span class="favicon" aria-hidden="true">${esc(mono(host))}</span>
          <b>${esc(host)}</b><span class="count" aria-label="${tabs.length} 个">${tabs.length}</span>
          <button type="button" class="linkbtn act" data-close-host="${esc(host)}" title="${esc(closeTitle)}">${esc(closeHostButtonLabel(tabsToCloseForHost(state.tabs, q, host).length))}</button>
        </div>
        ${tabs.map((t) => {
          const port = portLabel(t.url || '');
          const title = t.title || t.url || '无标题';
          return `
          <div class="tabrow">
            <div class="t">
              <span>${esc(title)}${port ? `<span class="port">${esc(port)}</span>` : ''}</span>
              <span class="url">${esc(urlLine(t.url || ''))}</span>
            </div>
            <button type="button" class="iconbtn" data-close-tab="${t.id}" aria-label="关闭标签：${esc(title)}">
              <svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
            </button>
          </div>`;
        }).join('')}
      </section>`).join('') : `<section class="card" style="grid-column: 1 / -1"><p class="empty">${q.trim() ? '没有匹配的标签。' : '这个窗口还没有标签。'}</p></section>`;
  }

  function renderTheme() {
    const preset = window.SopifyTheme ? window.SopifyTheme.getPreset() : 'system';
    $$('input[name="themePreset"]').forEach((el) => {
      el.checked = el.value === preset;
    });
    const box = $('#space-view-toggle');
    if (box && box !== document.activeElement) box.checked = spaceViewOn === true;
  }

  function setView(v, opts) {
    if (v !== 'desk' && v !== 'tabs' && v !== 'settings') return;
    state.view = v;
    $$('.view').forEach((el) => {
      const on = el.dataset.view === v;
      el.classList.toggle('active', on);
      el.hidden = !on;
      if (on) el.style.removeProperty('display');
      else el.style.setProperty('display', 'none', 'important');
    });
    const main = $('#main');
    if (main) main.scrollTop = 0;
    window.scrollTo(0, 0);
    $$('.studio-navbtn').forEach((b) => {
      if (b.dataset.view === v) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    document.body.classList.toggle('studio-home', v === 'desk');
    if (v === 'tabs') renderGroups();
    if (v === 'settings') {
      renderTheme();
      renderSavedWorksets();
    }
    const focusNav = opts && opts.focusNav;
    const nav = focusNav ? $(`.studio-navbtn[data-view="${v}"]`) : null;
    if (v === 'desk' && !focusNav) {
      focusDeskPrimary();
      return;
    }
    (nav || $('#main')).focus({ preventScroll: true });
  }

  let toastT = null;
  let toastGen = 0;
  let toastLeft = 0;
  let toastMark = 0;
  let toastPaused = false;

  function toastActionHeld() {
    const btn = $('#toast-action');
    if (!btn || btn.hidden) return false;
    return btn.matches(':hover') || document.activeElement === btn;
  }

  function clearToastAction() {
    const btn = $('#toast-action');
    if (!btn) return;
    btn.hidden = true;
    btn.textContent = '';
    btn.onclick = null;
    btn.onmouseenter = null;
    btn.onmouseleave = null;
    btn.onfocus = null;
    btn.onblur = null;
  }

  function hideToast() {
    toastGen += 1;
    toastPaused = false;
    clearTimeout(toastT);
    toastT = null;
    const t = $('#toast');
    if (t) t.classList.remove('show');
    clearToastAction();
  }

  function expireToast(gen) {
    if (gen !== toastGen) return;
    toastT = null;
    if (toastActionHeld()) {
      toastPaused = true;
      toastLeft = 0;
      return;
    }
    hideToast();
  }

  function armToast(ms) {
    toastLeft = ms;
    toastPaused = false;
    toastMark = Date.now();
    clearTimeout(toastT);
    const gen = toastGen;
    toastT = setTimeout(() => expireToast(gen), ms);
  }

  function pauseToast() {
    if (toastPaused || !toastT) return;
    toastLeft = Math.max(0, toastLeft - (Date.now() - toastMark));
    toastPaused = true;
    clearTimeout(toastT);
    toastT = null;
  }

  function resumeToast() {
    if (!toastPaused) return;
    if (toastActionHeld()) return;
    if (toastLeft <= 0) {
      hideToast();
      return;
    }
    toastPaused = false;
    toastMark = Date.now();
    const gen = toastGen;
    clearTimeout(toastT);
    toastT = setTimeout(() => expireToast(gen), toastLeft);
  }

  function placeToastAction() {
    const t = $('#toast');
    const btn = $('#toast-action');
    if (!t || !btn || btn.hidden) return;
    const rect = t.getBoundingClientRect();
    const width = btn.offsetWidth || 0;
    const height = btn.offsetHeight || 0;
    const left = Math.min(rect.right + 8, Math.max(8, window.innerWidth - width - 8));
    const top = rect.top + (rect.height - height) / 2;
    btn.style.left = `${Math.round(left)}px`;
    btn.style.top = `${Math.round(Math.max(8, top))}px`;
  }

  function toast(msg, opts) {
    const t = $('#toast');
    if (!t) return;
    toastGen += 1;
    toastPaused = false;
    clearTimeout(toastT);
    toastT = null;
    t.textContent = msg == null ? '' : String(msg);
    t.classList.add('show');
    const btn = $('#toast-action');
    const action = opts && opts.action;
    const hasAction = !!(action && action.label && typeof action.onClick === 'function');
    if (btn) {
      btn.onclick = null;
      btn.onmouseenter = null;
      btn.onmouseleave = null;
      btn.onfocus = null;
      btn.onblur = null;
      if (hasAction) {
        btn.hidden = false;
        btn.textContent = String(action.label);
        btn.onclick = (e) => {
          e.preventDefault();
          action.onClick();
        };
        btn.onmouseenter = () => pauseToast();
        btn.onmouseleave = () => resumeToast();
        btn.onfocus = () => pauseToast();
        btn.onblur = () => resumeToast();
        placeToastAction();
      } else {
        btn.hidden = true;
        btn.textContent = '';
      }
    }
    armToast(hasAction ? 6000 : 2400);
  }

  function applyDesk(data, opts) {
    const src = data || {};
    state.sites = Array.isArray(src.sites)
      ? src.sites.filter((s) => s && typeof s.name === 'string' && typeof s.url === 'string')
      : [];
    state.todos = Array.isArray(src.todos)
      ? src.todos.filter((t) => t && typeof t.text === 'string').map((t) => ({
        id: typeof t.id === 'string' && t.id ? t.id : uid(),
        text: t.text,
        done: Boolean(t.done),
      }))
      : [];
    if (!opts || opts.notes !== false) {
      const absorbed = noteKeeper.absorbBoot(src);
      if (absorbed.action === 'apply') state.notes = absorbed.text;
    }
    state.name = typeof src.name === 'string' ? src.name : '';
    if (src.todosRev != null) {
      const n = collectionRev(src.todosRev);
      if (n >= todosSeen) todosSeen = n;
    }
    if (src.sitesRev != null) {
      const n = collectionRev(src.sitesRev);
      if (n >= sitesSeen) sitesSeen = n;
    }
    $('#name').value = state.name;
    renderSites();
    renderTodos();
    renderNotes();
    renderResume();
    tick();
    notifyDesk3d();
  }

  async function refreshTabs() {
    try {
      state.tabs = await queryWindowTabs();
    } catch {
      state.tabs = [];
    }
    renderWorkset();
    if (state.view === 'tabs') renderGroups();
  }

  async function activateTab(id, opts) {
    const n = Number(id);
    if (!hasTabs || !Number.isFinite(n)) return;
    try {
      await chrome.tabs.update(n, { active: true });
    } catch (err) {
      if (opts && opts.rethrow) throw err;
      toast('标签已经关掉');
      refreshTabs();
    }
  }

  function flashLastSaved() {
    const col = $('#last-col');
    if (!col) return;
    col.classList.remove('flash');
    void col.offsetWidth;
    col.classList.add('flash');
  }

  function confirmInPage(opts) {
    const dialog = $('#ops-confirm-dialog');
    const title = $('#ops-confirm-title');
    const body = $('#ops-confirm-body');
    const ok = $('#ops-confirm-ok');
    const cancel = $('#ops-confirm-cancel');
    const closeX = $('#ops-confirm-x');
    if (!dialog || !title || !body || !ok || !cancel) return Promise.resolve(false);
    const spec = opts || {};
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    title.textContent = spec.title || '';
    body.textContent = spec.body || '';
    ok.textContent = spec.confirmLabel || '确认';
    ok.classList.toggle('danger', spec.danger === true);
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        dialog.removeEventListener('close', onClose);
        dialog.removeEventListener('cancel', onCancel);
        dialog.removeEventListener('click', onBackdrop);
        ok.removeEventListener('click', onOk);
        cancel.removeEventListener('click', onNo);
        if (closeX) closeX.removeEventListener('click', onNo);
        if (dialog.open) dialog.close();
        resolve(!!value);
        const viewTitle = document.querySelector('.view.active h1') || $('#resume-kicker') || $('#main');
        const back = trigger && trigger.isConnected && !dialog.contains(trigger) ? trigger : viewTitle;
        if (back && typeof back.focus === 'function') back.focus();
      };
      const onOk = () => finish(true);
      const onNo = () => finish(false);
      const onClose = () => finish(false);
      const onCancel = (event) => {
        event.preventDefault();
        finish(false);
      };
      const onBackdrop = (event) => {
        if (event.target === dialog) finish(false);
      };
      ok.addEventListener('click', onOk);
      cancel.addEventListener('click', onNo);
      if (closeX) closeX.addEventListener('click', onNo);
      dialog.addEventListener('close', onClose);
      dialog.addEventListener('cancel', onCancel);
      dialog.addEventListener('click', onBackdrop);
      try {
        if (!dialog.open) dialog.showModal();
      } catch (err) {
        dialog.dataset.confirmError = err && err.message ? err.message : String(err);
        finish(false);
        return;
      }
      delete dialog.dataset.confirmError;
      (spec.focusConfirm === true ? ok : cancel).focus();
    });
  }

  async function saveThisWindow() {
    const planned = formOps().planWorksetSave(worksetSaveRecord, uid, Date.now());
    worksetSaveRecord = planned.record;
    const proposal = proposeSaveWorkset(state.worksets, state.tabs, {
      id: planned.itemId,
      name: savedWindowTitle(state.tabs, new Date(planned.savedAt)),
      savedAt: planned.savedAt,
    });
    if (proposal.reason === 'empty') {
      toast('这个窗口没有可保存的网页');
      return;
    }
    if (proposal.overflow) {
      const n = proposal.totalTabs;
      const okTabs = await confirmInPage({
        title: '这个窗口有 ' + n + ' 个网页',
        body: '只能存前 ' + WORKSET_TAB_CAP + ' 个。',
        confirmLabel: '存前 ' + WORKSET_TAB_CAP + ' 个',
        danger: false,
        focusConfirm: true,
      });
      if (!okTabs) {
        toast('未保存');
        return;
      }
    }
    if (proposal.reason === 'full') {
      const oldest = proposal.oldest;
      const label = oldest && oldest.name ? oldest.name : '最早的一条';
      const ok = await confirmInPage({
        title: '已经存了 ' + WORKSET_STORE_CAP + ' 个窗口',
        body: '存这一份会替换最早的『' + label + '』。',
        confirmLabel: '替换',
        danger: false,
      });
      if (!ok) {
        toast('未保存');
        return;
      }
      const next = overwriteOldestWorkset(state.worksets, proposal.incoming);
      if (!next.ok) {
        toast('未保存');
        return;
      }
      const overwritten = await persistWorksets(next.worksets);
      if (!overwritten || overwritten.ok !== true) {
        showWriteError('workset-save-error', writeFailMessage(overwritten, '存下的窗口暂时没能读取', '窗口没存上，再点一次保存'));
        if (overwritten && overwritten.blocked) showWorksetLoadError();
        return;
      }
      worksetSaveRecord = null;
      hideWriteError('workset-save-error');
      flashLastSaved();
      toast(`已覆盖『${label}』`);
      return;
    }
    const savedWindow = await persistWorksets(proposal.worksets);
    if (!savedWindow || savedWindow.ok !== true) {
      showWriteError('workset-save-error', writeFailMessage(savedWindow, '存下的窗口暂时没能读取', '窗口没存上，再点一次保存'));
      if (savedWindow && savedWindow.blocked) showWorksetLoadError();
      return;
    }
    worksetSaveRecord = null;
    hideWriteError('workset-save-error');
    flashLastSaved();
    toast('已存下这个窗口');
  }

  async function restoreWorksetById(id) {
    const list = state.worksets || [];
    const w = id ? list.find((x) => x.id === id) : list[0];
    if (!w) {
      toast('没有可恢复的窗口');
      return { opened: 0, skipped: 0, failed: 0, complete: false, tone: 'fail' };
    }
    let queried = { ok: false, tabs: [] };
    try {
      queried = { ok: true, tabs: await queryWindowTabs() };
    } catch {
      queried = { ok: false, tabs: [] };
    }
    const started = beginRestore(queried.ok, queried.tabs);
    if (started.abort) {
      toast('没看清当前窗口，没有恢复「' + w.name + '」');
      return { opened: 0, skipped: 0, failed: 0, complete: false, tone: 'fail', aborted: true };
    }
    const plan = planRestore(w.tabs, started.open);
    const exec = await executeRestore(plan, hasTabs ? {
      create: (tabOpts) => chrome.tabs.create(tabOpts),
      activate: (tabId) => activateTab(tabId, { rethrow: true }),
    } : null);
    const summary = summarizeRestore(plan, exec);
    toast(restoreToast(w.name, summary));
    setRestoreRetry(w, exec.unopened || []);
    return Object.assign({ name: w.name }, summary);
  }

  let restoreRetry = null;
  function setRestoreRetry(workset, urls) {
    const list = (urls || []).filter((url) => typeof url === 'string' && url);
    restoreRetry = workset && list.length ? { id: workset.id, name: workset.name, urls: list.slice() } : null;
    const btn = $('#workset-retry-unopened');
    if (btn) btn.hidden = !restoreRetry;
  }
  async function retryUnopened() {
    const pending = restoreRetry;
    if (!pending || !pending.urls.length) return;
    let queried = { ok: false, tabs: [] };
    try {
      queried = { ok: true, tabs: await queryWindowTabs() };
    } catch {
      queried = { ok: false, tabs: [] };
    }
    const started = beginRestore(queried.ok, queried.tabs);
    if (started.abort) {
      toast('没看清当前窗口，没有恢复「' + pending.name + '」');
      return;
    }
    const plan = planRestore(pending.urls.map((url) => ({ title: url, url: url })), started.open);
    const exec = await executeRestore(plan, hasTabs ? {
      create: (tabOpts) => chrome.tabs.create(tabOpts),
      activate: (tabId) => activateTab(tabId, { rethrow: true }),
    } : null);
    const summary = summarizeRestore(plan, exec);
    toast(restoreToast(pending.name, summary));
    setRestoreRetry(pending, exec.unopened || []);
    return Object.assign({ name: pending.name }, summary);
  }

  async function deleteWorksetById(id) {
    if (!id) return;
    const planned = formOps().planRemove(worksetRemoveRecord, id, uid);
    worksetRemoveRecord = planned.record;
    const current = (state.worksets || []).find((w) => w.id === planned.itemId);
    const saved = await persistWorksets(removeWorksetById(state.worksets, planned.itemId));
    if (!saved || saved.ok !== true) {
      showWriteError('worksets-save-error', writeFailMessage(saved, '存下的窗口暂时没能读取', '没删掉，再点一次'));
      return;
    }
    worksetRemoveRecord = null;
    hideWriteError('worksets-save-error');
    toast(current ? `已删除『${current.name}』` : '已删除');
  }

  async function clearAllWorksets() {
    if (!(state.worksets || []).length) return;
    const ok = await confirmInPage({
      title: '清空全部存下的窗口？',
      body: '只影响这台电脑，清空后找不回来。',
      confirmLabel: '清空',
      danger: true,
    });
    if (!ok) return;
    const saved = await persistWorksets([]);
    if (!saved || saved.ok !== true) {
      showWriteError('worksets-save-error', writeFailMessage(saved, '存下的窗口暂时没能读取', '没清空，再点一次'));
      return;
    }
    hideWriteError('worksets-save-error');
    toast('已清空');
  }

  function focusDeskPrimary() {
    const next = pickResume(state.todos);
    const act = next.kind === 'todo' ? $('#resume-act') : $('#todo-input');
    if (act) act.focus({ preventScroll: true });
  }

  let undoBusy = false;
  async function undoCompletedTodo(id) {
    if (undoBusy || !id) return;
    const item = state.todos.find((t) => t && t.id === id);
    if (!item) {
      toast('这条已经删掉了');
      return;
    }
    const next = state.todos.map((t) => (
      t.id === id ? { id: t.id, text: t.text, done: false } : t
    ));
    undoBusy = true;
    try {
      if (!window.SopifyCollection) {
        const saved = await replaceTodos(next, 'todo-save-error', '没存上，再点一次');
        if (saved) hideToast();
        return;
      }
      const ops = window.SopifyCollection.diffTodos(state.todos, next);
      let committed;
      try {
        committed = await requestCollectionCommit({ domain: 'todos', ops: ops });
      } catch {
        committed = null;
      }
      if (committed && committed.blocked) {
        showWriteError('todo-save-error', '待办暂时没能读取');
        showTodoLoadError();
        return;
      }
      if (committed && committed.missing) {
        toast('这条已经删掉了');
        const loaded = await loadDesk();
        if (loaded && loaded.ok === true) applyDesk(loaded, { notes: false });
        return;
      }
      const saved = (!committed || committed.ok !== true)
        ? confirmDeskWrite(committed, null)
        : confirmDeskWrite(
          { ok: true, items: committed.items, rev: committed.rev, idempotent: committed.idempotent },
          { ok: committed.readback !== false },
        );
      if (!saved || saved.ok !== true) {
        showWriteError('todo-save-error', writeFailMessage(saved, '待办暂时没能读取', '没存上，再点一次'));
        if (saved && saved.blocked) showTodoLoadError();
        renderTodos();
        return;
      }
      hideWriteError('todo-save-error');
      hideWriteError('todo-dialog-save-error');
      adoptCollection('todos', saved);
      renderTodos();
      hideToast();
    } finally {
      undoBusy = false;
    }
  }

  let completingId = null;
  function runResumeAction() {
    if (completingId) return;
    const act = $('#resume-act');
    if (!act || act.dataset.kind !== 'todo' || !act.dataset.todoId) return;
    const id = act.dataset.todoId;
    const item = state.todos.find((t) => t.id === id && !t.done);
    if (!item) return;
    completingId = id;
    const title = $('#resume-title');
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finish = async () => {
      if (completingId !== id) return;
      completingId = null;
      if (title) title.classList.remove('leaving');
      const target = state.todos.find((t) => t.id === id);
      if (!target || target.done) {
        renderResume();
        return;
      }
      const openBefore = state.todos.filter((t) => t && !t.done && String(t.text || '').trim()).length;
      const next = state.todos.map((t) => (t.id === id ? { id: t.id, text: t.text, done: true } : t));
      const savedDone = await replaceTodos(next, 'todo-save-error', '没存上，再点一次完成');
      if (!savedDone) {
        renderResume();
        return;
      }
      const clip = [...String(target.text || '').trim()].slice(0, 20).join('');
      toast(`已完成「${clip}」`, {
        action: { label: '撤销', onClick: () => { undoCompletedTodo(id); } },
      });
      if (openBefore <= 1) {
        const input = $('#todo-input');
        if (input) input.focus();
      } else if (title) {
        title.classList.remove('entering');
        void title.offsetWidth;
        title.classList.add('entering');
      }
    };
    if (reduced || !title) {
      finish();
      return;
    }
    title.classList.add('leaving');
    setTimeout(finish, 320);
  }

  function openWindowDialog() {
    const dialog = $('#ops-window-dialog');
    const body = $('#ops-window-dialog-body');
    const source = $('#workset');
    if (!dialog || !body || !source) return;
    body.innerHTML = source.innerHTML || '<p class="empty">这个窗口还没有网页。</p>';
    body.querySelectorAll('[data-activate-tab]').forEach((row) => {
      row.addEventListener('click', () => activateTab(row.dataset.activateTab));
    });
    bindFaviconFallback(body);
    if (!dialog.open) dialog.showModal();
  }

  function cssEscape(value) {
    const s = String(value);
    if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(s);
    return s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function openTodosDialog() {
    const dialog = $('#ops-todos-dialog');
    const body = $('#ops-todos-dialog-body');
    if (!dialog || !body) return;
    const firstOpen = !dialog.open;
    const previous = document.activeElement;
    const previousId = previous && previous.dataset
      ? (previous.dataset.todoId || previous.dataset.delTodo || '')
      : '';
    const previousWasInput = !!(previous && previous.id === 'todo-input-dialog');
    const left = state.todos.filter((t) => !t.done).length;
    const done = state.todos.filter((t) => t.done).length;
    const nextTodo = state.todos.find((t) => t && !t.done && String(t.text || '').trim());
    const nextTodoId = nextTodo ? nextTodo.id : '';
    const todoRows = domainUnread.todos
      ? '<li class="empty">待办暂时没能读取</li>'
      : (state.todos.length ? state.todos.map((t) => {
          const promote = (!t.done && t.id !== nextTodoId)
            ? `<button type="button" class="todo-next" data-todo-next="${esc(t.id)}">设为下一件</button>`
            : '';
          return `
          <li class="todo ${t.done ? 'done' : ''}">
            <label>
              <input type="checkbox" data-todo-id="${esc(t.id)}" ${t.done ? 'checked' : ''}>
              <button type="button" class="todo-text" data-todo-text="${esc(t.id)}">${esc(t.text)}</button>
            </label>
            ${promote}
            <button type="button" class="iconbtn" data-del-todo="${esc(t.id)}" aria-label="删除待办：${esc(t.text)}">
              <svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
            </button>
          </li>`;
        }).join('') : '<li class="empty">还没有待办。</li>');
    body.innerHTML = `
      <ul class="todos" id="todos-dialog-list">
        ${todoRows}
      </ul>
      <div class="todoadd" id="todo-add-dialog">
        <label class="sr-only" for="todo-input-dialog">新待办</label>
        <input class="field" id="todo-input-dialog" placeholder="待办内容，回车添加" autocomplete="off">
        <button type="button" class="btn" id="todo-add-btn">添加待办</button>
      </div>
      <p class="muted">${done ? `已完成 ${done}` : ''}${left ? ` · ${left} 项未完成` : ''}</p>
    `;
    body.onclick = async (e) => {
      const textBtn = e.target.closest('[data-todo-text]');
      if (textBtn) {
        e.preventDefault();
        e.stopPropagation();
        beginTodoTextEdit(textBtn.dataset.todoText);
        return;
      }
      const nextBtn = e.target.closest('[data-todo-next]');
      if (nextBtn) {
        const id = nextBtn.dataset.todoNext;
        const saved = await moveTodoToFront(id);
        if (saved && saved.missing) {
          if (dialog.open) openTodosDialog();
          return;
        }
        if (!saved || saved.ok !== true) return;
        if (dialog.open) openTodosDialog();
        const box = body.querySelector(`input[type="checkbox"][data-todo-id="${cssEscape(id)}"]`);
        if (box) box.focus();
        return;
      }
      const del = e.target.closest('[data-del-todo]');
      if (!del) return;
      const planned = formOps().planRemove(todoRemoveRecord, del.dataset.delTodo, uid);
      todoRemoveRecord = planned.record;
      const next = state.todos.filter((t) => t.id !== planned.itemId);
      const removed = await replaceTodos(next, 'todo-dialog-save-error', '没删掉，再点一次');
      if (removed) todoRemoveRecord = null;
      if (dialog.open) openTodosDialog();
      if (!removed) return;
    };
    body.onchange = async (e) => {
      const cb = e.target.closest('input[type="checkbox"][data-todo-id]');
      if (!cb) return;
      const item = state.todos.find((t) => t.id === cb.dataset.todoId);
      if (!item) return;
      const next = state.todos.map((t) => (
        t.id === cb.dataset.todoId ? { id: t.id, text: t.text, done: cb.checked } : t
      ));
      await replaceTodos(next, 'todo-dialog-save-error', '没存上，再点一次');
      if (dialog.open) openTodosDialog();
    };
    if (firstOpen) dialog.showModal();
    const focusInput = body.querySelector('#todo-input-dialog');
    if (firstOpen || previousWasInput) {
      if (focusInput) focusInput.focus();
      return;
    }
    if (previousId) {
      const again = body.querySelector(
        `[data-todo-id="${cssEscape(previousId)}"], [data-del-todo="${cssEscape(previousId)}"]`
      );
      if (again) {
        again.focus();
        return;
      }
    }
    const nextBox = body.querySelector('input[type="checkbox"][data-todo-id]');
    if (nextBox) nextBox.focus();
    else if (focusInput) focusInput.focus();
  }

  function beginTodoTextEdit(id) {
    const dialog = $('#ops-todos-dialog');
    const body = $('#ops-todos-dialog-body');
    if (!dialog || !body || body.querySelector('.todo-edit')) return;
    const item = state.todos.find((t) => t && t.id === id);
    if (!item) return;
    const textBtn = body.querySelector(`[data-todo-text="${cssEscape(id)}"]`);
    if (!textBtn) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'field todo-edit';
    input.value = item.text;
    input.setAttribute('aria-label', '修改待办');
    input.autocomplete = 'off';
    textBtn.replaceWith(input);
    let settled = false;
    const focusText = () => {
      const again = body.querySelector(`[data-todo-text="${cssEscape(id)}"]`);
      if (again) again.focus();
    };
    const finish = async (commit) => {
      if (settled) return;
      settled = true;
      const nextText = input.value.trim();
      if (!commit || !nextText || nextText === String(item.text || '').trim()) {
        if (dialog.open) openTodosDialog();
        focusText();
        return;
      }
      const next = state.todos.map((t) => (
        t.id === id ? { id: t.id, text: nextText, done: t.done } : t
      ));
      const saved = await replaceTodos(next, 'todo-dialog-save-error', '没存上，再点一次');
      if (dialog.open) openTodosDialog();
      focusText();
      if (!saved) return;
    };
    const editIme = createImeGuard();
    input.addEventListener('compositionstart', () => editIme.onCompositionStart());
    input.addEventListener('compositionend', () => editIme.onCompositionEnd());
    input.addEventListener('keydown', (e) => {
      if (e.isComposing || e.key === 'Process' || editIme.blocks(e)) {
        if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Process') {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (e.key !== 'Enter' && e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      finish(e.key === 'Enter');
    });
    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (input.isConnected && document.activeElement !== input) finish(true);
      }, 0);
    });
    input.focus();
    input.select();
  }

  async function closeTab(id) {
    const n = Number(id);
    if (!hasTabs || !Number.isFinite(n)) return;
    try { await chrome.tabs.remove(n); } catch { /* already gone */ }
  }

  async function closeHost(host) {
    const visible = tabsToCloseForHost(state.tabs, state.filter, host);
    const ids = visible.map((t) => t.id);
    if (!ids.length || !hasTabs) return;
    let closed = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await chrome.tabs.remove(id);
        closed += 1;
      } catch {
        failed += 1;
      }
    }
    const all = state.tabs.filter((t) => domainOf(t.url || '') === host).length;
    const hiddenLeft = String(state.filter || '').trim() && all > ids.length;
    const tail = hiddenLeft ? '，筛选外的还在' : '';
    if (closed === 0) {
      toast(`没关掉 ${host}${tail}`);
      return;
    }
    if (failed > 0) {
      toast(`关掉了 ${closed} 个 ${host}，还有 ${failed} 个没关掉${tail}`);
      return;
    }
    if (hiddenLeft) toast(`已关闭 ${closed} 个 ${host}，筛选外的还在`);
    else toast(`已关闭 ${host}`);
  }

  let noteSaveActive = false;
  let notePending = null;
  function createImeGuard() {
    const api = typeof window !== 'undefined' ? window.SopifyNoteSync : null;
    if (api && typeof api.createImeGuard === 'function') return api.createImeGuard();
    return {
      onCompositionStart() {},
      onCompositionEnd() {},
      blocks(e) { return !!(e && (e.isComposing || e.key === 'Process' || e.keyCode === 229)); },
    };
  }
  function setNotesSavedStatus(text) {
    const saved = $('#notes-saved');
    if (saved) saved.textContent = text;
    const desk = $('#desk3d-note-status');
    if (desk) {
      desk.textContent = text || '输入即保存到书桌便签。';
      desk.classList.toggle('is-saved', text === '已存在本机');
    }
  }
  function writeFailMessage(saved, blockedText, fallback) {
    if (saved && saved.blocked) return blockedText;
    return fallback;
  }
  function showWriteError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
  }
  function hideWriteError(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = true;
    el.textContent = '';
  }
  const noteConflictExpanded = { local: false, remote: false };
  function paintConflictSide(which, preview, full, long) {
    const body = which === 'local' ? $('#note-local-preview') : $('#note-remote-preview');
    const btn = which === 'local' ? $('#note-local-expand') : $('#note-remote-expand');
    const open = noteConflictExpanded[which] === true;
    if (body) body.textContent = (!long || open) ? full : preview;
    if (btn) {
      btn.hidden = !long;
      btn.textContent = open ? '收起' : '展开全文';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  }
  function showConflictNotice(status) {
    const openBtn = $('#note-show-conflict');
    if (openBtn) openBtn.hidden = false;
    const again = $('#note-conflict-again');
    if (again) again.hidden = status !== '另一页又有更新，请重新确认。';
    const box = $('#note-conflict');
    if (box && !box.hidden) showNoteConflict(true);
  }
  function showNoteConflict(on) {
    const box = $('#note-conflict');
    if (box) box.hidden = !on;
    if (!on) {
      noteConflictExpanded.local = false;
      noteConflictExpanded.remote = false;
      return;
    }
    const snap = noteKeeper.snapshot();
    const remote = snap.conflict ? snap.conflict.remoteText : '';
    const ta = $('#notes');
    const local = ta ? ta.value : (snap.text || '');
    const view = noteConflictView(local, remote);
    paintConflictSide('local', view.local, view.localFull, view.localLong);
    paintConflictSide('remote', view.remote, view.remoteFull, view.remoteLong);
    const again = $('#note-conflict-again');
    if (again) again.hidden = snap.status !== '另一页又有更新，请重新确认。';
  }
  function showTodoLoadError() {
    const el = $('#todo-load-error');
    if (el) el.hidden = false;
  }
  function hideTodoLoadError() {
    const el = $('#todo-load-error');
    if (el) el.hidden = true;
  }
  function showWorksetLoadError() {
    const el = $('#workset-load-error');
    if (el) el.hidden = false;
  }
  function hideWorksetLoadError() {
    const el = $('#workset-load-error');
    if (el) el.hidden = true;
  }
  function showDeskLoadError() {
    showTodoLoadError();
  }
  function hideDeskLoadError() {
    hideTodoLoadError();
  }
  let noteComposing = false;
  function noteFieldEditing() {
    if (noteComposing) return true;
    if (noteSaveActive || notePending !== null) return true;
    const snap = noteKeeper.snapshot();
    const ta = $('#notes');
    if (ta && noteDraftIsDirty(ta.value, snap.acked, false)) return true;
    const editor = $('#desk3d-note-editor');
    if (editor && noteDraftIsDirty(editor.value, snap.acked, false)) return true;
    return false;
  }
  if (typeof window !== 'undefined' && window.SopifyNoteSync && hasStorage && typeof window.__sopifyNoteCommit !== 'function') {
    const pageQueue = window.SopifyNoteSync.createNoteCoordinator({
      get: (defaults) => chrome.storage.local.get(defaults),
      set: (partial) => chrome.storage.local.set(partial),
    });
    window.__sopifyNoteCommit = (req) => pageQueue.commit(req);
  }
  if (typeof window !== 'undefined' && window.SopifyCollection && hasStorage && typeof window.__sopifyCollectionCommit !== 'function') {
    const pageCollections = window.SopifyCollection.createCollectionCoordinator({
      get: (defaults) => chrome.storage.local.get(defaults),
      set: (partial) => chrome.storage.local.set(partial),
    });
    window.__sopifyCollectionCommit = (req) => pageCollections.commit(req);
  }
  function requestCollectionCommit(req) {
    const domain = req && req.domain;
    if (!domainWriteAllowed(domainUnread, domain)) return Promise.resolve({ ok: false, blocked: true });
    if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
      return new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage({ type: 'sopify-collection-commit', req: req }, (res) => {
            const failed = chrome.runtime.lastError;
            if (failed) {
              resolve({ ok: false, error: true });
              return;
            }
            resolve(res && typeof res === 'object' ? res : { ok: false, error: true });
          });
        } catch {
          resolve({ ok: false, error: true });
        }
      });
    }
    if (typeof window !== 'undefined' && typeof window.__sopifyCollectionCommit === 'function') {
      return window.__sopifyCollectionCommit(req);
    }
    return Promise.resolve({ ok: false, error: true });
  }
  function requestNoteCommit(req) {
    if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
      return new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage({ type: 'sopify-note-commit', req: req }, (res) => {
            const failed = chrome.runtime.lastError;
            if (failed) {
              resolve({ ok: false, error: true });
              return;
            }
            resolve(res && typeof res === 'object' ? res : { ok: false, error: true });
          });
        } catch {
          resolve({ ok: false, error: true });
        }
      });
    }
    if (typeof window !== 'undefined' && typeof window.__sopifyNoteCommit === 'function') {
      return window.__sopifyNoteCommit(req);
    }
    return Promise.resolve({ ok: false, skipped: true });
  }
  const noteKeeper = (typeof window !== 'undefined' && window.SopifyNoteSync
    ? window.SopifyNoteSync.createNoteKeeper({
      pageId: 'nt-' + Math.random().toString(16).slice(2),
      storage: hasStorage ? { get: (defaults) => chrome.storage.local.get(defaults) } : null,
      coordinator: { commit: requestNoteCommit },
      isEditing: noteFieldEditing,
      onStatus(text) {
        if (text === '便签在另一页更新了' || text === '另一页又有更新，请重新确认。') {
          setNotesSavedStatus(text);
          showConflictNotice(text);
          return;
        }
        if (text === '') {
          const cur = $('#notes-saved');
          if (cur && (cur.textContent === '已存在本机' || cur.textContent === '便签在另一页更新了' || cur.textContent === '另一页又有更新，请重新确认。')) {
            setNotesSavedStatus('');
          }
          const openBtn = $('#note-show-conflict');
          if (openBtn) openBtn.hidden = true;
          showNoteConflict(false);
        }
      },
    })
    : {
      absorbBoot(data) {
        return { action: 'apply', text: data && typeof data.notes === 'string' ? data.notes : '' };
      },
      remember() {},
      hasConflict() { return false; },
      peekForce() { return false; },
      armForce() {},
      acceptRemote() { return null; },
      handleRemote() { return { action: 'sync' }; },
      commit: async (_payload, saveFn) => {
        const saved = await saveFn(_payload, null);
        return saved && saved.ok ? { ok: true } : { ok: false, skipped: !!(saved && saved.skipped) };
      },
      snapshot() { return { text: '', rev: 0, stamp: '' }; },
    });
  function applyRemoteNote(outcome) {
    if (!outcome) return;
    if (outcome.action === 'apply') {
      state.notes = outcome.text;
      const ta = $('#notes');
      if (ta) ta.value = state.notes;
      const editor = $('#desk3d-note-editor');
      if (editor) editor.value = state.notes;
      renderNotes();
      return;
    }
    if (outcome.action === 'conflict') {
      const status = outcome.status || '便签在另一页更新了';
      setNotesSavedStatus(status);
      showConflictNotice(status);
    }
  }
  function pumpNoteSave() {
    if (noteSaveActive) return;
    noteSaveActive = true;
    (async () => {
      try {
        while (notePending !== null) {
          const payload = notePending;
          notePending = null;
          state.notes = payload;
          try {
            const outcome = await noteKeeper.commit(payload, async (text, meta) => {
              noteWriteMeta = meta;
              state.notes = text;
              try {
                return await saveDesk({ notes: state.notes });
              } finally {
                noteWriteMeta = null;
              }
            });
            if (notePending !== null) continue;
            const snap = noteKeeper.snapshot();
            const markSaved = window.SopifyNoteSync
              ? window.SopifyNoteSync.shouldMarkNoteSaved(outcome, snap)
              : false;
            if (markSaved) {
              setNotesSavedStatus('已存在本机');
              const openBtn = $('#note-show-conflict');
              if (openBtn) openBtn.hidden = true;
              showNoteConflict(false);
            } else if ((outcome && outcome.conflict) || noteKeeper.hasConflict()) {
              const status = (noteKeeper.snapshot().status) || '便签在另一页更新了';
              setNotesSavedStatus(status);
              showConflictNotice(status);
            } else if (outcome && outcome.ok && snap.dirty) {
              notePending = snap.text;
              setNotesSavedStatus('保存中…');
            } else {
              setNotesSavedStatus('没存上');
            }
          } catch {
            if (notePending !== null) continue;
            setNotesSavedStatus('没存上');
          }
        }
      } finally {
        noteSaveActive = false;
        if (notePending !== null) pumpNoteSave();
      }
    })();
  }
  function queueNoteSave() {
    noteKeeper.remember(state.notes);
    if (!domainWriteAllowed(domainUnread, 'notes')) {
      setNotesSavedStatus('暂未保存');
      return;
    }
    if (noteKeeper.hasConflict() && !noteKeeper.peekForce()) {
      const status = noteKeeper.snapshot().status || '便签在另一页更新了';
      setNotesSavedStatus(status);
      showConflictNotice(status);
      return;
    }
    notePending = state.notes;
    setNotesSavedStatus('保存中…');
    pumpNoteSave();
  }
  function clearSiteUrlError() {
    const input = $('#site-url');
    const err = $('#site-url-error');
    if (err) {
      err.hidden = true;
      err.textContent = '';
    }
    if (input) input.removeAttribute('aria-invalid');
  }
  function showSiteUrlError(message) {
    const input = $('#site-url');
    const err = $('#site-url-error');
    if (err) {
      err.hidden = false;
      err.textContent = message;
    }
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', 'site-url-error');
      input.focus();
    }
  }
  function bind() {
    $$('.studio-navbtn').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    const studioBrand = $('#studio-brand');
    if (studioBrand) {
      studioBrand.addEventListener('click', (e) => {
        e.preventDefault();
        setView('desk');
      });
    }
    document.addEventListener('click', (e) => {
      const g = e.target.closest('[data-goto]');
      if (g) setView(g.dataset.goto, { focusNav: true });
    });
    window.addEventListener('hashchange', () => {
      if (location.hash === '#settings') setView('settings');
    });
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === 'setView') setView(msg.view);
      });
    }

    $('#name').addEventListener('input', (e) => {
      state.name = e.target.value;
      tick();
      if (!domainWriteAllowed(domainUnread, 'name')) {
        showWriteError('name-save-error', '称呼暂时没能读取');
        return;
      }
      hideWriteError('name-save-error');
      saveDesk({ name: state.name });
    });

    $('#site-add-toggle').addEventListener('click', () => toggleSiteForm());
    const sitesMore = $('#sites-more');
    if (sitesMore) sitesMore.addEventListener('click', () => toggleSiteForm(true));
    const siteUrl = $('#site-url');
    if (siteUrl) siteUrl.addEventListener('input', () => clearSiteUrlError());
    const sitesDialog = $('#ops-sites-dialog');
    if (sitesDialog) {
      sitesDialog.addEventListener('close', () => {
        const t = $('#site-add-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }
    $('#site-cancel').addEventListener('click', () => {
      toggleSiteForm(false);
      $('#site-add-toggle').focus();
    });
    const siteIme = createImeGuard();
    const siteForm = $('#site-form');
    if (siteForm) {
      siteForm.addEventListener('compositionstart', () => siteIme.onCompositionStart());
      siteForm.addEventListener('compositionend', () => siteIme.onCompositionEnd());
      siteForm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && siteIme.blocks(e)) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }
    let siteAddBusy = false;
    $('#site-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (siteAddBusy) return;
      const nameInput = $('#site-name');
      const urlInput = $('#site-url');
      const name = nameInput.value.trim();
      let url;
      try { url = normalizeSiteUrl(urlInput.value); } catch {
        showSiteUrlError('网址需要是 http(s)');
        return;
      }
      if (!name) return;
      clearSiteUrlError();
      siteAddBusy = true;
      const planned = formOps().planSiteAdd(siteAddRecord, name, url, uid);
      siteAddRecord = planned.record;
      const next = state.sites.concat([{ name: planned.name, url: planned.url }]);
      const saved = await commitDesk({ sites: next });
      let currentUrl = '';
      try { currentUrl = normalizeSiteUrl(urlInput.value); } catch { currentUrl = urlInput.value.trim(); }
      const settled = formOps().settleSiteSubmit(siteAddRecord, nameInput.value.trim(), currentUrl, !!(saved && saved.ok === true));
      siteAddRecord = settled.record;
      siteAddBusy = false;
      if (!saved || saved.ok !== true) {
        showWriteError('site-save-error', writeFailMessage(saved, '常用站暂时没能读取', '没加上，再点一次加入'));
        return;
      }
      hideWriteError('site-save-error');
      hideWriteError('sites-save-error');
      adoptCollection('sites', saved);
      renderSites();
      if (!settled.clearInput) return;
      nameInput.value = '';
      urlInput.value = '';
      toggleSiteForm(false);
      $('#site-add-toggle').focus();
      toast(`已加入 ${planned.name}`);
    });
    const onSiteRemoveClick = async (e) => {
      const b = e.target.closest('[data-remove-site]');
      if (!b) return;
      e.preventDefault();
      const i = Number(b.dataset.removeSite);
      if (!Number.isInteger(i) || i < 0 || i >= state.sites.length) return;
      const target = state.sites[i];
      const planned = formOps().planRemove(siteRemoveRecord, target.url, uid);
      siteRemoveRecord = planned.record;
      const next = state.sites.filter((site) => site.url !== planned.itemId);
      const removed = state.sites.find((site) => site.url === planned.itemId) || target;
      const saved = await commitDesk({ sites: next });
      if (!saved || saved.ok !== true) {
        showWriteError('sites-save-error', writeFailMessage(saved, '常用站暂时没能读取', '没去掉，再点一次'));
        showWriteError('site-save-error', writeFailMessage(saved, '常用站暂时没能读取', '没去掉，再点一次'));
        return;
      }
      siteRemoveRecord = null;
      hideWriteError('sites-save-error');
      hideWriteError('site-save-error');
      adoptCollection('sites', saved);
      renderSites();
      if (removed) toast(`已移除 ${removed.name}`);
    };
    $('#sites').addEventListener('click', onSiteRemoveClick);
    const sitesAll = $('#sites-all');
    if (sitesAll) {
      sitesAll.addEventListener('click', onSiteRemoveClick);
      sitesAll.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-edit-site]');
        if (editBtn) {
          e.preventDefault();
          beginSiteEdit(Number(editBtn.dataset.editSite));
          return;
        }
        if (e.target.closest('[data-edit-cancel]')) {
          e.preventDefault();
          cancelSiteEdit();
        }
      });
      sitesAll.addEventListener('submit', (e) => {
        const form = e.target.closest('[data-site-edit]');
        if (!form) return;
        e.preventDefault();
        commitSiteEdit(form);
      });
      const siteEditIme = createImeGuard();
      sitesAll.addEventListener('compositionstart', (e) => {
        if (e.target.closest('[data-site-edit]')) siteEditIme.onCompositionStart();
      });
      sitesAll.addEventListener('compositionend', (e) => {
        if (e.target.closest('[data-site-edit]')) siteEditIme.onCompositionEnd();
      });
      sitesAll.addEventListener('keydown', (e) => {
        if (!e.target.closest('[data-site-edit]')) return;
        if (e.key === 'Enter' && siteEditIme.blocks(e)) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
      sitesAll.addEventListener('input', (e) => {
        if (!e.target.closest('[data-site-edit]') || !siteEdit) return;
        siteEdit.error = '';
        const err = document.querySelector('#sites-all [data-edit-error]');
        if (!err) return;
        err.hidden = true;
        err.textContent = '';
      });
    }

    const todoIme = createImeGuard();
    const todoInput = $('#todo-input');
    if (todoInput) {
      todoInput.addEventListener('compositionstart', () => todoIme.onCompositionStart());
      todoInput.addEventListener('compositionend', () => todoIme.onCompositionEnd());
      todoInput.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === 'Process') && todoIme.blocks(e)) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }
    let todoAddBusy = false;
    $('#todo-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (todoAddBusy) return;
      const input = $('#todo-input');
      const text = input.value.trim();
      if (!text) return;
      todoAddBusy = true;
      const planned = formOps().planTodoAdd(todoAddRecord, text, uid);
      todoAddRecord = planned.record;
      const next = state.todos.concat([{ id: planned.itemId, text: planned.snapshot, done: false }]);
      const saved = await replaceTodos(next, 'todo-save-error', '待办没存上，再按一次回车');
      const settled = formOps().settleFormSubmit(todoAddRecord, input.value.trim(), saved === true);
      todoAddRecord = settled.record;
      todoAddBusy = false;
      if (!saved) {
        input.focus();
        return;
      }
      if (!settled.clearInput) return;
      input.value = '';
      const act = $('#resume-act');
      if (act) act.focus();
    });
    $('#todos').addEventListener('change', async (e) => {
      const id = e.target.dataset.todoId;
      if (id == null) return;
      const item = state.todos.find((t) => t.id === id);
      if (!item) return;
      const next = state.todos.map((t) => (
        t.id === id ? { id: t.id, text: t.text, done: e.target.checked } : t
      ));
      await replaceTodos(next, 'todo-save-error', '没存上，再点一次');
    });
    $('#todos').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-del-todo]');
      if (!b) return;
      const planned = formOps().planRemove(todoRemoveRecord, b.dataset.delTodo, uid);
      todoRemoveRecord = planned.record;
      const next = state.todos.filter((t) => t.id !== planned.itemId);
      const saved = await replaceTodos(next, 'todo-save-error', '没删掉，再点一次');
      if (!saved) return;
      todoRemoveRecord = null;
      $('#todo-input').focus();
    });
    $('#todo-clear').addEventListener('click', async () => {
      const doneIds = state.todos.filter((t) => t.done).map((t) => t.id);
      const planned = formOps().planClearDone(clearDoneRecord, doneIds, uid);
      clearDoneRecord = planned.record;
      const drop = new Set(planned.ids);
      const next = state.todos.filter((t) => !drop.has(t.id));
      const saved = await replaceTodos(next, 'todo-save-error', '没清掉，再点一次');
      if (!saved) return;
      clearDoneRecord = null;
      toast('已清除完成项');
    });

    $('#notes').addEventListener('input', (e) => {
      state.notes = e.target.value;
      const n = [...state.notes.replace(/\s/g, '')].length;
      $('#c-notes').textContent = String(n);
      $('#c-notes').setAttribute('aria-label', `${n} 字`);
      renderResume();
      queueNoteSave();
    });
    const notesField = $('#notes');
    if (notesField) {
      notesField.addEventListener('compositionstart', () => { noteComposing = true; });
      notesField.addEventListener('compositionend', () => { noteComposing = false; });
    }
    document.addEventListener('compositionstart', (e) => {
      const id = e.target && e.target.id;
      if (id === 'notes' || id === 'desk3d-note-editor') noteComposing = true;
    });
    document.addEventListener('compositionend', (e) => {
      const id = e.target && e.target.id;
      if (id === 'notes' || id === 'desk3d-note-editor') noteComposing = false;
    });
    const showConflictBtn = $('#note-show-conflict');
    if (showConflictBtn) {
      showConflictBtn.addEventListener('click', () => { showNoteConflict(true); });
    }
    const dismissConflict = $('#note-dismiss-conflict');
    if (dismissConflict) {
      dismissConflict.addEventListener('click', () => {
        showNoteConflict(false);
        setNotesSavedStatus('暂未保存');
      });
    }
    const useRemote = $('#note-use-remote');
    if (useRemote) {
      useRemote.addEventListener('click', () => {
        const shown = noteKeeper.snapshot();
        const expectedRev = shown.conflict ? shown.conflict.remoteRev : null;
        const text = noteKeeper.acceptRemote(expectedRev);
        if (typeof text !== 'string') {
          showNoteConflict(true);
          return;
        }
        state.notes = text;
        const ta = $('#notes');
        if (ta) ta.value = text;
        const editor = $('#desk3d-note-editor');
        if (editor && editor !== document.activeElement) editor.value = text;
        renderNotes();
        showNoteConflict(false);
        setNotesSavedStatus('');
      });
    }
    const keepLocal = $('#note-keep-local');
    if (keepLocal) {
      keepLocal.addEventListener('click', () => {
        const ta = $('#notes');
        if (ta) state.notes = ta.value;
        noteKeeper.armForce();
        noteKeeper.remember(state.notes);
        queueNoteSave();
      });
    }
    const localExpand = $('#note-local-expand');
    if (localExpand) {
      localExpand.addEventListener('click', () => {
        noteConflictExpanded.local = !noteConflictExpanded.local;
        showNoteConflict(true);
      });
    }
    const remoteExpand = $('#note-remote-expand');
    if (remoteExpand) {
      remoteExpand.addEventListener('click', () => {
        noteConflictExpanded.remote = !noteConflictExpanded.remote;
        showNoteConflict(true);
      });
    }
    const loadRetry = $('#todo-load-retry');
    if (loadRetry) loadRetry.addEventListener('click', () => { retryDeskLoad(); });
    const worksetLoadRetry = $('#workset-load-retry');
    if (worksetLoadRetry) worksetLoadRetry.addEventListener('click', () => { retryDeskLoad(); });

    $('#resume-act').addEventListener('click', () => runResumeAction());
    const todosOpen = $('#todos-open');
    if (todosOpen) todosOpen.addEventListener('click', () => openTodosDialog());
    const doneHistory = $('#todos-done-history');
    if (doneHistory) doneHistory.addEventListener('click', () => openTodosDialog());
    const lastCol = $('#last-col');
    if (lastCol) {
      lastCol.addEventListener('click', (e) => {
        if (!e.target.closest('#last-name')) return;
        const current = (state.worksets || [])[0];
        if (current) startRename(current.id);
      });
    }
    const lastAll = $('#last-all');
    if (lastAll) lastAll.addEventListener('click', () => openAllSaved());
    const spaceToggle = $('#space-view-toggle');
    if (spaceToggle) {
      spaceToggle.addEventListener('change', () => {
        saveSpaceView(spaceToggle.checked === true);
      });
    }
    $$('[data-dialog-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dialog = btn.closest('dialog');
        if (dialog) dialog.close();
      });
    });
    const todosDialog = $('#ops-todos-dialog');
    if (todosDialog) {
      todosDialog.addEventListener('close', () => {
        focusDeskPrimary();
        setTimeout(focusDeskPrimary, 0);
      });
      todosDialog.addEventListener('click', (e) => {
        if (e.target === todosDialog) todosDialog.close();
      });
      const dialogIme = createImeGuard();
      todosDialog.addEventListener('compositionstart', () => dialogIme.onCompositionStart());
      todosDialog.addEventListener('compositionend', () => dialogIme.onCompositionEnd());
      todosDialog.addEventListener('keydown', (e) => {
        if (dialogIme.blocks(e)) return;
        if (e.key !== 'Enter') return;
        const input = todosDialog.querySelector('#todo-input-dialog');
        if (!input || e.target !== input) return;
        e.preventDefault();
        e.stopPropagation();
        commitTodoFromDialog(input);
      });
      todosDialog.addEventListener('click', (e) => {
        if (!e.target.closest('#todo-add-btn')) return;
        e.preventDefault();
        const input = todosDialog.querySelector('#todo-input-dialog');
        if (input) commitTodoFromDialog(input);
      });
    }
    $('#workset-filter').addEventListener('input', (e) => {
      state.worksetFilter = e.target.value;
      renderWorkset();
    });
    $('#workset').addEventListener('click', (e) => {
      const row = e.target.closest('[data-activate-tab]');
      if (row) activateTab(row.dataset.activateTab);
    });
    $('#workset-save').addEventListener('click', () => { saveThisWindow(); });
    $('#workset-restore-recent').addEventListener('click', () => { restoreWorksetById(); });
    const retryUnopenedBtn = $('#workset-retry-unopened');
    if (retryUnopenedBtn) retryUnopenedBtn.addEventListener('click', () => { retryUnopened(); });
    window.addEventListener('resize', () => {
      const btn = $('#toast-action');
      if (btn && !btn.hidden) placeToastAction();
    });
    $('#saved-worksets').addEventListener('click', onSavedWorksetClick);
    $('#worksets-clear').addEventListener('click', () => { clearAllWorksets(); });

    $('#tab-filter').addEventListener('input', (e) => {
      state.filter = e.target.value;
      renderGroups();
    });
    $('#groups').addEventListener('click', (e) => {
      const hostBtn = e.target.closest('[data-close-host]');
      const tabBtn = e.target.closest('[data-close-tab]');
      if (hostBtn) closeHost(hostBtn.dataset.closeHost);
      else if (tabBtn) closeTab(tabBtn.dataset.closeTab);
    });

    if (hasStorage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if ('themePreset' in changes) renderTheme();
        if ('spaceView' in changes) {
          spaceViewOn = changes.spaceView.newValue === true;
          const box = $('#space-view-toggle');
          if (box) box.checked = spaceViewOn;
          publishSpaceView();
        }
        if ('worksets' in changes || 'worksetsRev' in changes) {
          const incomingRev = 'worksetsRev' in changes ? collectionRev(changes.worksetsRev.newValue) : null;
          if (incomingRev != null && incomingRev < worksetsSeen) {
            /* an older snapshot must not roll the desk backward */
          } else {
            if ('worksets' in changes) state.worksets = normalizeWorksets(changes.worksets.newValue);
            if (incomingRev != null) worksetsSeen = incomingRev;
            renderSavedWorksets();
            notifyDesk3d();
          }
        }
        const todoRev = 'todosRev' in changes ? collectionRev(changes.todosRev.newValue) : null;
        const siteRev = 'sitesRev' in changes ? collectionRev(changes.sitesRev.newValue) : null;
        const skipTodos = todoRev != null && todoRev < todosSeen;
        const skipSites = siteRev != null && siteRev < sitesSeen;
        if ('sites' in changes || 'todos' in changes || 'name' in changes || 'todosRev' in changes || 'sitesRev' in changes) {
          applyDesk({
            sites: skipSites ? state.sites : (changes.sites ? changes.sites.newValue : state.sites),
            todos: skipTodos ? state.todos : (changes.todos ? changes.todos.newValue : state.todos),
            notes: state.notes,
            name: changes.name ? changes.name.newValue : state.name,
            todosRev: skipTodos ? todosSeen : todoRev,
            sitesRev: skipSites ? sitesSeen : siteRev,
          }, { notes: false });
        }
        if ('notes' in changes || 'notesRev' in changes || 'notesStamp' in changes) {
          const snap = noteKeeper.snapshot();
          applyRemoteNote(noteKeeper.handleRemote({
            notes: changes.notes ? changes.notes.newValue : snap.text,
            notesRev: changes.notesRev ? changes.notesRev.newValue : snap.rev,
            notesStamp: changes.notesStamp ? changes.notesStamp.newValue : snap.stamp,
          }));
        }
      });
    }

    $$('input[name="themePreset"]').forEach((el) => {
      el.addEventListener('change', () => {
        if (!el.checked) return;
        if (window.SopifyTheme) window.SopifyTheme.setPreset(el.value);
      });
    });
    document.documentElement.addEventListener('sopify-theme', renderTheme);

    if (hasTabs) {
      const bump = () => { refreshTabs(); };
      chrome.tabs.onCreated.addListener(bump);
      chrome.tabs.onRemoved.addListener(bump);
      chrome.tabs.onUpdated.addListener(bump);
      chrome.tabs.onMoved.addListener(bump);
      chrome.tabs.onAttached.addListener(bump);
      chrome.tabs.onDetached.addListener(bump);
      if (chrome.tabs.onReplaced) chrome.tabs.onReplaced.addListener(bump);
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        tick();
        refreshTabs();
      }
    });
  }

  let loadGen = 0;
  async function retryDeskLoad() {
    const gen = ++loadGen;
    deskLoadBroken = false;
    let data;
    try { data = await loadDesk(); } catch { data = { ok: false, loadError: true }; }
    if (!shouldApplyLoad(gen, loadGen)) return;
    if (!data || data.ok === false || data.loadError) {
      deskLoadBroken = true;
      markDeskUnread();
      showTodoLoadError();
      renderResume();
      return;
    }
    clearDeskUnread();
    applyDesk(data);
    hideTodoLoadError();
    const loadedSets = await loadWorksets();
    if (!shouldApplyLoad(gen, loadGen)) return;
    if (loadedSets == null) {
      domainUnread.worksets = true;
      deskLoadBroken = true;
      showWorksetLoadError();
      renderSavedWorksets();
      return;
    }
    domainUnread.worksets = false;
    state.worksets = loadedSets;
    hideWorksetLoadError();
    hideDeskLoadError();
    ['todo-save-error', 'todo-dialog-save-error', 'site-save-error', 'sites-save-error', 'workset-save-error', 'last-save-error', 'worksets-save-error', 'name-save-error'].forEach(hideWriteError);
    renderWorkset();
    renderSavedWorksets();
    renderTheme();
  }

  async function boot() {
    const gen = ++loadGen;
    try {
      const data = await loadDesk();
      if (!shouldApplyLoad(gen, loadGen)) {
        /* a newer retry owns the snapshot */
      } else if (!data || data.ok === false || data.loadError) {
        deskLoadBroken = true;
        markDeskUnread();
      } else {
        clearDeskUnread();
        applyDesk(data);
      }
      const loadedSets = await loadWorksets();
      if (shouldApplyLoad(gen, loadGen)) {
        if (loadedSets == null) {
          domainUnread.worksets = true;
          deskLoadBroken = true;
        } else {
          domainUnread.worksets = false;
          state.worksets = loadedSets;
        }
      }
    } catch {
      if (shouldApplyLoad(gen, loadGen)) {
        deskLoadBroken = true;
        markDeskUnread();
      }
    }
    renderWorkset();
    renderSavedWorksets();
    renderResume();
    renderTheme();
    bind();
    if (domainUnread.todos) showTodoLoadError();
    if (domainUnread.worksets) showWorksetLoadError();
    notifyDesk3d();
    tick();
    setInterval(tick, 1000);
    if (location.hash === '#settings') setView('settings');
    else {
      document.body.classList.add('studio-home');
      const clearBootFocus = () => {
        document.documentElement.removeAttribute('data-boot-focus');
        document.removeEventListener('keydown', clearBootFocus);
        document.removeEventListener('pointerdown', clearBootFocus);
      };
      document.addEventListener('keydown', clearBootFocus);
      document.addEventListener('pointerdown', clearBootFocus);
      document.documentElement.setAttribute('data-boot-focus', '');
      focusDeskPrimary();
    }
    await refreshTabs();
    await loadSpaceView();
    const spaceBox = $('#space-view-toggle');
    if (spaceBox) spaceBox.checked = spaceViewOn === true;
    if (spaceViewOn) publishSpaceView();
  }

  function notifyDesk3d() {
    for (let i = 0; i < desk3dSubs.length; i += 1) {
      try { desk3dSubs[i](); } catch { /* ignore */ }
    }
  }

  function cloneDesk3dWorksets() {
    return (state.worksets || []).map((w) => ({
      id: w.id,
      name: w.name,
      savedAt: w.savedAt,
      tabs: (w.tabs || []).map((t) => ({ title: t.title, url: t.url })),
    }));
  }

  function saveDeskNoteFrom3d(text) {
    state.notes = typeof text === 'string' ? text : '';
    const ta = $('#notes');
    if (ta && ta !== document.activeElement) ta.value = state.notes;
    renderNotes();
    queueNoteSave();
  }
  async function commitTodoFromDialog(input) {
    const text = input.value.trim();
    if (!text || input.dataset.busy === '1') return;
    input.dataset.busy = '1';
    const planned = formOps().planTodoAdd(dialogTodoAdd, text, uid);
    dialogTodoAdd = planned.record;
    const next = state.todos.concat([{ id: planned.itemId, text: planned.snapshot, done: false }]);
    const saved = await replaceTodos(next, 'todo-dialog-save-error', '待办没存上，再按一次回车');
    const typed = input.value;
    const settled = formOps().settleFormSubmit(dialogTodoAdd, typed.trim(), saved === true);
    dialogTodoAdd = settled.record;
    input.dataset.busy = '';
    if (!saved) {
      input.focus();
      return;
    }
    openTodosDialog();
    if (!settled.clearInput) {
      const again = $('#todo-input-dialog');
      if (again) {
        again.value = typed;
        again.focus();
      }
    }
  }

  const desk3dHost = {
    defaultWant3d: true,
    getSpaceView: function () { return spaceViewOn === true; },
    openAllSaved: function () { openAllSaved(); },
    getWorksets: function () { return cloneDesk3dWorksets(); },
    getNote: function () { return typeof state.notes === 'string' ? state.notes : ''; },
    saveNote: function (text) { saveDeskNoteFrom3d(text); },
    restoreWorkset: function (id) { return restoreWorksetById(id); },
    subscribe: function (fn) {
      if (typeof fn !== 'function') return function () {};
      desk3dSubs.push(fn);
      return function () {
        const i = desk3dSubs.indexOf(fn);
        if (i >= 0) desk3dSubs.splice(i, 1);
      };
    },
  };
  if (typeof window !== 'undefined') window.SopifyDesk3d = desk3dHost;

  boot();
})();

