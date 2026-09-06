(() => {
  'use strict';

  const DESK_KEYS = ['sites', 'todos', 'notes', 'name'];

  const state = {
    view: 'desk',
    name: '',
    sites: [],
    todos: [],
    notes: '',
    tabs: [],
    filter: '',
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
    const groups = groupTabs(state.tabs);
    const max = Math.max(1, ...groups.map(([, tabs]) => tabs.length));
    $('#domains').innerHTML = groups.length ? groups.map(([host, tabs]) => `
      <div class="domain" style="--h:${hue(host)}">
        <span class="favicon" aria-hidden="true">${esc(mono(host))}</span>
        <div class="who"><b>${esc(host)}</b><span class="bar" aria-hidden="true"><i style="--w:${(tabs.length / max) * 100}%"></i></span></div>
        <span class="n" aria-label="${tabs.length} 个标签">${tabs.length}</span>
      </div>`).join('') : `<p class="empty">这个窗口还没有标签。</p>`;
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

  function setView(v) {
    if (v !== 'desk' && v !== 'tabs') return;
    state.view = v;
    $$('.view').forEach((el) => el.classList.toggle('active', el.dataset.view === v));
    $$('.navbtn').forEach((b) => {
      if (b.dataset.view === v) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    if (v === 'tabs') renderGroups();
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
    document.addEventListener('click', (e) => {
      const g = e.target.closest('[data-goto]');
      if (g) setView(g.dataset.goto);
    });

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
        const next = {
          sites: changes.sites ? changes.sites.newValue : state.sites,
          todos: changes.todos ? changes.todos.newValue : state.todos,
          notes: changes.notes ? changes.notes.newValue : state.notes,
          name: changes.name ? changes.name.newValue : state.name,
        };
        if (!DESK_KEYS.some((k) => k in changes)) return;
        applyDesk(next);
      });
    }

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
    renderDomains();
    bind();
    tick();
    setInterval(tick, 1000);
    await refreshTabs();
    if (state.notes) $('#notes-saved').textContent = '已保存';
  }

  boot();
})();
