(() => {
  'use strict';

  const DESK_KEYS = ['sites', 'todos', 'notes', 'name'];
  const HOST_ID = 'com.sopify.tab';
  const HOST_CHECKS = [
    ['installed', 'Host 已安装', '装在你自己的机器上，不随扩展一起装。'],
    ['authorized', '扩展已获授权', 'Host 的清单里允许这个扩展 ID 连接。'],
    ['bridge', 'Native Messaging 可用', 'Chrome 能拉起 Host 并收到第一条回应。'],
  ];

  const state = {
    view: 'desk',
    name: '',
    sites: [],
    todos: [],
    notes: '',
    tabs: [],
    filter: '',
    cwd: '',
    hostChecked: false,
    hostBusy: false,
    host: { installed: false, authorized: false, bridge: false },
    hostReason: '',
  };

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

  // Desk 「这个窗口」 list: http(s) + localhost only. Tabs page still uses groupTabs as-is.
  function isDeskSummaryUrl(url) {
    try {
      const u = new URL(url);
      const host = u.hostname;
      if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true;
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

  async function loadDesk() {
    if (!hasStorage) return { sites: [], todos: [], notes: '', name: '' };
    return chrome.storage.local.get({ sites: [], todos: [], notes: '', name: '' });
  }

  async function saveDesk(partial) {
    const payload = {};
    for (const k of Object.keys(partial)) {
      if (DESK_KEYS.includes(k)) payload[k] = partial[k];
    }
    if (!Object.keys(payload).length) return;
    if (hasStorage) await chrome.storage.local.set(payload);
  }

  async function loadCwd() {
    if (!hasStorage) return '';
    const data = await chrome.storage.local.get({ cwd: '' });
    return typeof data.cwd === 'string' ? data.cwd : '';
  }

  async function saveCwd(cwd) {
    if (!hasStorage) return;
    await chrome.storage.local.set({ cwd: typeof cwd === 'string' ? cwd : '' });
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
    $('#clock-hm').textContent = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
    $('#clock-sec').textContent = p2(d.getSeconds());
    const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    $('#date-line').textContent = `${d.getMonth() + 1}月${d.getDate()}日 · 星期${wd}`;
    $('#greet-word').textContent = greetingOf(d.getHours()) + (state.name.trim() ? '，' : '');
  }

  function renderSummary() {
    const left = state.todos.filter((t) => !t.done).length;
    $('#summary-line').textContent = `${left} 项待办 · 本窗口 ${state.tabs.length} 个标签`;
  }

  function renderSites() {
    const addTile = `
      <button type="button" class="tile add" id="site-add-2" aria-controls="site-form">
        <span class="glyph" aria-hidden="true"><svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span>
        <span class="lbl">添加</span>
      </button>`;
    $('#sites').innerHTML = state.sites.map((s, i) => `
      <div class="tilewrap">
        <a class="tile" href="${esc(s.url)}" title="${esc(s.name)} · ${esc(s.url)}" style="--h:${hue(s.url)}">
          <span class="glyph" aria-hidden="true">${esc(mono(s.name))}</span>
          <span class="lbl">${esc(s.name)}</span>
        </a>
        <button type="button" class="iconbtn tile-remove" data-remove-site="${i}" aria-label="移除 ${esc(s.name)}">
          <svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>`).join('') + addTile;
    $('#c-sites').textContent = String(state.sites.length);
    $('#c-sites').setAttribute('aria-label', `${state.sites.length} 个常用站`);
    $('#site-add-2').addEventListener('click', () => toggleSiteForm(true));
  }

  function toggleSiteForm(force) {
    const f = $('#site-form');
    const t = $('#site-add-toggle');
    const open = force ?? f.hidden;
    f.hidden = !open;
    t.setAttribute('aria-expanded', String(open));
    t.textContent = open ? '收起' : '添加';
    if (open) $('#site-name').focus();
  }

  function renderTodos() {
    const ul = $('#todos');
    ul.innerHTML = state.todos.length ? state.todos.map((t) => `
      <li class="todo ${t.done ? 'done' : ''}">
        <label>
          <input type="checkbox" data-todo-id="${esc(t.id)}" ${t.done ? 'checked' : ''}>
          <span>${esc(t.text)}</span>
        </label>
        <button type="button" class="iconbtn" data-del-todo="${esc(t.id)}" aria-label="删除待办：${esc(t.text)}">
          <svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </li>`).join('') : `<li class="empty">还没有待办。下面写一条。</li>`;
    const left = state.todos.filter((t) => !t.done).length;
    const done = state.todos.filter((t) => t.done).length;
    $('#c-todo').textContent = String(left);
    $('#c-todo').setAttribute('aria-label', `${left} 项未完成`);
    $('#todo-done').textContent = done ? `已完成 ${done}` : '';
    $('#todo-clear').disabled = !done;
    renderSummary();
  }

  function renderNotes() {
    if ($('#notes') !== document.activeElement) $('#notes').value = state.notes;
    const n = [...state.notes.replace(/\s/g, '')].length;
    $('#c-notes').textContent = String(n);
    $('#c-notes').setAttribute('aria-label', `${n} 字`);
  }

  function renderDomains() {
    const groups = groupTabs(state.tabs.filter((t) => isDeskSummaryUrl(t.url || '')));
    const max = Math.max(1, ...groups.map(([, tabs]) => tabs.length));
    $('#domains').innerHTML = groups.length ? groups.map(([host, tabs]) => `
      <div class="domain" style="--h:${hue(host)}">
        <span class="favicon" aria-hidden="true">${esc(mono(host))}</span>
        <div class="who"><b>${esc(host)}</b><span class="bar" aria-hidden="true"><i style="--w:${(tabs.length / max) * 100}%"></i></span></div>
        <span class="n" aria-label="${tabs.length} 个标签">${tabs.length}</span>
      </div>`).join('') : `<p class="empty">这个窗口还没有网页。</p>`;
    $('#c-tabs').textContent = String(state.tabs.length);
    $('#c-tabs').setAttribute('aria-label', `${state.tabs.length} 个标签`);
    $('#c-tabs-sub').textContent = groups.length ? `${groups.length} 域名` : '';
    renderSummary();
  }

  function renderGroups() {
    const q = state.filter;
    const list = filterTabs(state.tabs, q);
    const groups = groupTabs(list);
    const allGroups = groupTabs(state.tabs);
    $('#tabs-sub').textContent = `本窗口 ${state.tabs.length} 个标签 · ${allGroups.length} 个域名。localhost 端口只是标签。`;
    $('#groups').innerHTML = groups.length ? groups.map(([host, tabs]) => `
      <section class="card group" aria-label="${esc(host)}" style="--h:${hue(host)}">
        <div class="grouphead">
          <span class="favicon" aria-hidden="true">${esc(mono(host))}</span>
          <b>${esc(host)}</b><span class="count">${tabs.length}</span>
          <button type="button" class="linkbtn act" data-close-host="${esc(host)}">关闭这组</button>
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

  function hostConnected() {
    return state.host.installed && state.host.authorized && state.host.bridge;
  }

  function classifyHostError(message) {
    const msg = String(message || '');
    if (/not found/i.test(msg)) return 'not_found';
    if (/forbidden|access/i.test(msg)) return 'forbidden';
    if (/denied|user/i.test(msg)) return 'denied';
    return 'failed';
  }

  function sendNativeDetect() {
    return new Promise((resolve, reject) => {
      if (!chrome?.runtime?.sendNativeMessage) {
        reject(new Error('no_api'));
        return;
      }
      chrome.runtime.sendNativeMessage(HOST_ID, { type: 'detect' }, (response) => {
        const err = chrome.runtime.lastError && chrome.runtime.lastError.message;
        if (err) reject(new Error(err));
        else resolve(response);
      });
    });
  }

  async function requestNativeMessaging() {
    if (!chrome?.permissions?.request) return { granted: false, reason: 'no_api' };
    try {
      const granted = await chrome.permissions.request({ permissions: ['nativeMessaging'] });
      return { granted: Boolean(granted), reason: granted ? 'ok' : 'denied' };
    } catch (e) {
      return { granted: false, reason: classifyHostError(e && e.message) };
    }
  }

  async function revokeNativeMessaging() {
    if (!chrome?.permissions?.remove) return;
    try { await chrome.permissions.remove({ permissions: ['nativeMessaging'] }); } catch { /* ignore */ }
  }

  function renderHost() {
    const badge = $('#s-host-badge');
    const status = $('#host-status');
    const checks = $('#host-checks');
    const toggle = $('#host-toggle');
    const help = $('#host-help');
    if (!badge || !status || !checks || !toggle || !help) return;

    const probed = state.hostChecked;
    const on = hostConnected();
    $$('.host-probe').forEach((el) => { el.hidden = !probed; });
    if (probed) {
      status.innerHTML = `<span class="dot ${on ? 'on' : ''}" aria-hidden="true"></span><span>${on ? '已连接 · Native Messaging' : '没连上'}</span>`;
      badge.textContent = on ? '已连接' : '没连上';
      badge.classList.toggle('on', on);
      badge.classList.toggle('warn', !on);
      checks.innerHTML = HOST_CHECKS.map(([k, t, d]) => `
        <li class="check ${state.host[k] ? 'ok' : ''}">
          <span class="mark" aria-hidden="true"><svg class="i" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>
          <span><span class="sr-only">${state.host[k] ? '已满足：' : '未满足：'}</span>${t}<small>${d}</small></span>
        </li>`).join('');
    }
    toggle.disabled = state.hostBusy;
    toggle.textContent = on ? '断开' : '检测 Host';
    toggle.className = on ? 'btn ghost' : 'btn';
    if (state.hostBusy) help.textContent = '正在检测…';
    else if (on) help.textContent = '已连上。断开后书桌照常。';
    else if (probed && state.hostReason === 'denied') help.textContent = '没有授权 Native Messaging。书桌不受影响。';
    else if (probed && state.hostReason === 'not_found') help.textContent = '没找到本机 Host。需要时在仓库跑 ./host/install-host.sh。书桌不受影响。';
    else if (probed && state.hostReason === 'forbidden') help.textContent = 'Host 清单没有允许这个扩展。书桌不受影响。';
    else if (probed) help.textContent = '可以再检一次，或先用书桌。';
    else help.textContent = '需要时再连。没装也不影响书桌。';
  }

  async function detectHost() {
    if (state.hostBusy) return;
    state.hostBusy = true;
    renderHost();
    try {
      const perm = await requestNativeMessaging();
      if (!perm.granted) {
        state.hostChecked = true;
        state.host = { installed: false, authorized: false, bridge: false };
        state.hostReason = perm.reason || 'denied';
        return;
      }
      try {
        const response = await sendNativeDetect();
        const ok = Boolean(response && response.ok);
        state.hostChecked = true;
        state.host = { installed: true, authorized: true, bridge: ok };
        state.hostReason = ok ? 'ok' : 'failed';
        if (ok) toast('已通过 Native Messaging 连上本机 Host');
      } catch (e) {
        const reason = classifyHostError(e && e.message);
        state.hostChecked = true;
        state.host = {
          installed: reason !== 'not_found' && reason !== 'no_api' && reason !== 'denied',
          authorized: reason === 'failed',
          bridge: false,
        };
        if (reason === 'forbidden') {
          state.host.installed = true;
          state.host.authorized = false;
        }
        state.hostReason = reason;
      }
    } finally {
      state.hostBusy = false;
      renderHost();
    }
  }

  async function disconnectHost() {
    if (state.hostBusy) return;
    state.hostBusy = true;
    renderHost();
    try {
      await revokeNativeMessaging();
    } finally {
      state.hostChecked = false;
      state.host = { installed: false, authorized: false, bridge: false };
      state.hostReason = '';
      state.hostBusy = false;
      renderHost();
      toast('已断开本机 Host');
    }
  }

  async function openDialogue() {
    try {
      if (chrome?.sidePanel?.open) {
        const win = await chrome.windows.getCurrent();
        if (win && win.id != null) {
          await chrome.sidePanel.open({ windowId: win.id });
          return;
        }
      }
    } catch { /* fall through */ }
    if (!chrome?.runtime?.sendMessage) return;
    try {
      chrome.runtime.sendMessage({ type: 'openSidePanel' }, () => {
        void chrome.runtime.lastError;
      });
    } catch { /* fail-soft: desk still works */ }
  }

  function setView(v) {
    if (v !== 'desk' && v !== 'tabs' && v !== 'settings') return;
    state.view = v;
    $$('.view').forEach((el) => el.classList.toggle('active', el.dataset.view === v));
    $$('.navbtn').forEach((b) => {
      if (b.dataset.view === v) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    if (v === 'tabs') renderGroups();
    if (v === 'settings') {
      $('#cwd').value = state.cwd;
      renderHost();
    }
    $('#main').focus({ preventScroll: true });
  }

  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2400);
  }

  function applyDesk(data) {
    state.sites = Array.isArray(data.sites)
      ? data.sites.filter((s) => s && typeof s.name === 'string' && typeof s.url === 'string')
      : [];
    state.todos = Array.isArray(data.todos)
      ? data.todos.filter((t) => t && typeof t.text === 'string').map((t) => ({
        id: typeof t.id === 'string' && t.id ? t.id : uid(),
        text: t.text,
        done: Boolean(t.done),
      }))
      : [];
    state.notes = typeof data.notes === 'string' ? data.notes : '';
    state.name = typeof data.name === 'string' ? data.name : '';
    $('#name').value = state.name;
    renderSites();
    renderTodos();
    renderNotes();
    tick();
  }

  async function refreshTabs() {
    try {
      state.tabs = await queryWindowTabs();
    } catch {
      state.tabs = [];
    }
    renderDomains();
    if (state.view === 'tabs') renderGroups();
    renderSummary();
  }

  async function closeTab(id) {
    const n = Number(id);
    if (!hasTabs || !Number.isFinite(n)) return;
    try { await chrome.tabs.remove(n); } catch { /* already gone */ }
  }

  async function closeHost(host) {
    const ids = state.tabs.filter((t) => domainOf(t.url || '') === host).map((t) => t.id);
    if (!ids.length || !hasTabs) return;
    try { await chrome.tabs.remove(ids); } catch { /* ignore */ }
    toast(`已关闭 ${host}`);
  }

  let notesTimer;
  function bind() {
    $$('.navbtn').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    const chatBtn = $('#open-chat');
    if (chatBtn) chatBtn.addEventListener('click', () => { openDialogue(); });
    document.addEventListener('click', (e) => {
      const g = e.target.closest('[data-goto]');
      if (g) setView(g.dataset.goto);
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
      saveDesk({ name: state.name });
    });

    $('#site-add-toggle').addEventListener('click', () => toggleSiteForm());
    $('#site-cancel').addEventListener('click', () => {
      toggleSiteForm(false);
      $('#site-add-toggle').focus();
    });
    $('#site-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#site-name').value.trim();
      let url;
      try { url = normalizeSiteUrl($('#site-url').value); } catch {
        toast('网址需要是 http(s)');
        return;
      }
      if (!name) return;
      state.sites.push({ name, url });
      $('#site-name').value = '';
      $('#site-url').value = '';
      renderSites();
      toggleSiteForm(false);
      $('#site-add-toggle').focus();
      saveDesk({ sites: state.sites });
      toast(`已加入 ${name}`);
    });
    $('#sites').addEventListener('click', (e) => {
      const b = e.target.closest('[data-remove-site]');
      if (!b) return;
      e.preventDefault();
      const i = Number(b.dataset.removeSite);
      if (!Number.isInteger(i) || i < 0 || i >= state.sites.length) return;
      const [removed] = state.sites.splice(i, 1);
      renderSites();
      saveDesk({ sites: state.sites });
      if (removed) toast(`已移除 ${removed.name}`);
    });

    $('#todo-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = $('#todo-input').value.trim();
      if (!text) return;
      state.todos.push({ id: uid(), text, done: false });
      $('#todo-input').value = '';
      renderTodos();
      saveDesk({ todos: state.todos });
    });
    $('#todos').addEventListener('change', (e) => {
      const id = e.target.dataset.todoId;
      if (id == null) return;
      const item = state.todos.find((t) => t.id === id);
      if (!item) return;
      item.done = e.target.checked;
      renderTodos();
      saveDesk({ todos: state.todos });
    });
    $('#todos').addEventListener('click', (e) => {
      const b = e.target.closest('[data-del-todo]');
      if (!b) return;
      state.todos = state.todos.filter((t) => t.id !== b.dataset.delTodo);
      renderTodos();
      saveDesk({ todos: state.todos });
      $('#todo-input').focus();
    });
    $('#todo-clear').addEventListener('click', () => {
      state.todos = state.todos.filter((t) => !t.done);
      renderTodos();
      saveDesk({ todos: state.todos });
      toast('已清除完成项');
    });

    $('#notes').addEventListener('input', (e) => {
      state.notes = e.target.value;
      const n = [...state.notes.replace(/\s/g, '')].length;
      $('#c-notes').textContent = String(n);
      $('#c-notes').setAttribute('aria-label', `${n} 字`);
      $('#notes-saved').textContent = '保存中…';
      clearTimeout(notesTimer);
      notesTimer = setTimeout(() => {
        saveDesk({ notes: state.notes }).then(() => {
          $('#notes-saved').textContent = '已保存';
        });
      }, 400);
    });

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
        if ('cwd' in changes && typeof changes.cwd.newValue === 'string') {
          state.cwd = changes.cwd.newValue;
          const input = $('#cwd');
          if (input && input !== document.activeElement) input.value = state.cwd;
        }
        if (!DESK_KEYS.some((k) => k in changes)) return;
        applyDesk({
          sites: changes.sites ? changes.sites.newValue : state.sites,
          todos: changes.todos ? changes.todos.newValue : state.todos,
          notes: changes.notes ? changes.notes.newValue : state.notes,
          name: changes.name ? changes.name.newValue : state.name,
        });
      });
    }

    $('#host-toggle').addEventListener('click', () => {
      if (hostConnected()) disconnectHost();
      else detectHost();
    });
    let cwdTimer;
    $('#cwd').addEventListener('input', (e) => {
      state.cwd = e.target.value;
      clearTimeout(cwdTimer);
      cwdTimer = setTimeout(() => { saveCwd(state.cwd); }, 240);
    });

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

  async function boot() {
    applyDesk(await loadDesk());
    state.cwd = await loadCwd();
    $('#cwd').value = state.cwd;
    renderDomains();
    renderHost();
    bind();
    tick();
    setInterval(tick, 1000);
    await refreshTabs();
    if (state.notes) $('#notes-saved').textContent = '已保存';
    if (location.hash === '#settings') setView('settings');
  }

  boot();
})();
