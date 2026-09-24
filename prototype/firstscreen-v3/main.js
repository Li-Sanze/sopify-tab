const $ = (s) => document.querySelector(s);
const root = document.documentElement;
const params = new URLSearchParams(location.search);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const WORKSET_MAX = 5;

const T = (title, host, l, c, internal, seen) => ({ title, host, l, c, internal: !!internal, seen: seen || 0 });
const TABS = [
  T('Draft 4 first-screen polish · Pull Request #39', 'github.com', 'G', '#24292f'),
  T('Sopify Tab 首屏 v3', 'figma.com', 'F', '#a259ff', false, 9),
  T('chrome.tabs API', 'developer.chrome.com', 'C', '#1a73e8'),
  T('W13 首屏评审纪要', 'feishu.cn', '飞', '#3370ff'),
  T('text-wrap: balance', 'developer.mozilla.org', 'M', '#15141a'),
  T('desk-3d 原型', 'localhost:8765', 'L', '#5f6b7a'),
  T('Issues · Li-Sanze/sopify-tab', 'github.com', 'G', '#24292f'),
  T('Sopify 看板', 'linear.app', 'L', '#5e6ad2'),
  T('Contrast (Minimum) · WCAG 2.2', 'w3.org', 'W', '#005a9c'),
  T('Refactoring UI', 'refactoringui.com', 'R', '#d9480f'),
  T('lo-fi beats', 'youtube.com', 'Y', '#e62117'),
  T('新标签页', 'chrome://newtab', 'N', '#80868b', true),
];
const W12_TABS = [
  T('W12 验收清单', 'feishu.cn', '飞', '#3370ff'),
  T('PR #29 · workset persist', 'github.com', 'G', '#24292f'),
  T('chrome.storage.local', 'developer.chrome.com', 'C', '#1a73e8'),
  ...Array.from({ length: 11 }, (_, i) => T(`W12 回归用例 ${i + 1}`, 'localhost:5173', 'L', '#5f6b7a')),
];
const SITES = [
  { name: 'GitHub', l: 'G', c: '#24292f' },
  { name: 'Figma', l: 'F', c: '#a259ff' },
  { name: '飞书', l: '飞', c: '#3370ff' },
  { name: 'MDN', l: 'M', c: '#15141a' },
  { name: 'Linear', l: 'L', c: '#5e6ad2' },
];

function now() {
  const d = new Date();
  const at = params.get('at');
  if (at && /^\d{1,2}:\d{2}$/.test(at)) {
    const [h, m] = at.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}
const daysAgo = (n, h, m) => {
  const d = now();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d;
};

const DATASETS = {
  filled: () => ({
    name: 'Brainbird',
    todos: ['把首屏改版方案发给 Sanze 过一遍', '补齐「接着上次」的空状态文案', '回复 Rick 的验收问题', '整理首屏的字号与按钮清单'],
    tabs: TABS,
    worksets: [
      { id: 'w1', name: '首屏改版', savedAt: daysAgo(1, 18, 20), tabs: TABS.slice(0, 8) },
      { id: 'w2', name: 'W12 验收清单', savedAt: daysAgo(2, 10, 5), tabs: W12_TABS },
    ],
    note: '周五前把 W13 验收清单发给 Rick。\n首屏只留一个主操作。',
    sites: SITES,
  }),
  empty: () => ({
    name: '',
    todos: [],
    tabs: [...TABS.slice(0, 5), TABS[11]],
    worksets: [],
    note: '',
    sites: [],
  }),
  bare: () => ({ ...DATASETS.filled(), tabs: [TABS[11]] }),
};

let data = DATASETS.filled();
let doneCount = 0;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const p2 = (n) => String(n).padStart(2, '0');
const hm = (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
const greetingOf = (h) => (
  h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 17 ? '下午好' : h < 20 ? '傍晚好' : '晚上好'
);
const hue = (s) => [...String(s)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 7);
const savableOf = (tabs) => tabs.filter((t) => !t.internal);

function relTime(d) {
  const n = now();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(n) - day(d)) / 86400000);
  if (n - d < 60000) return '刚刚';
  if (diff === 0) return `今天 ${hm(d)}`;
  if (diff === 1) return `昨天 ${hm(d)}`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function tick() {
  const d = now();
  $('#greet').textContent = greetingOf(d.getHours()) + (data.name ? `，${data.name}` : '');
  $('#date').textContent = `${d.getMonth() + 1}月${d.getDate()}日 星期${'日一二三四五六'[d.getDay()]}`;
  $('#clock').textContent = hm(d);
}

/* ---------- toast (optionally with actions) ---------- */

let toastTimer = 0;
function toast(msg, actions) {
  const el = $('#toast');
  $('#toast-text').textContent = msg;
  const box = $('#toast-actions');
  box.innerHTML = '';
  for (const a of actions || []) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = a.label;
    b.addEventListener('click', () => {
      el.classList.remove('show');
      if (a.run) a.run();
    });
    box.append(b);
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), actions ? 8000 : 2400);
  if (actions) box.querySelector('button')?.focus();
}

/* ---------- render ---------- */

const favsHtml = (tabs, n) => {
  const list = tabs.slice(0, n).map((t) => `<span class="fav" style="background:${t.c}">${esc(t.l)}</span>`);
  if (tabs.length > n) list.push(`<span class="fav more">+${tabs.length - n}</span>`);
  return list.join('');
};

function renderHero() {
  const next = $('#next');
  const has = data.todos.length > 0;
  next.dataset.has = has ? '1' : '0';
  if (has) {
    const title = $('#next-title');
    const len = [...data.todos[0]].length;
    title.textContent = data.todos[0];
    title.title = data.todos[0];
    title.dataset.size = len <= 22 ? 's' : len <= 44 ? 'm' : 'l';
    const rest = data.todos.length - 1;
    const parts = [rest ? `之后还有 ${rest} 条` : '这是最后一条'];
    if (doneCount) parts.push(`已完成 ${doneCount} 件`);
    $('#next-all').textContent = parts.join(' · ');
  } else {
    const input = $('#compose-input');
    input.placeholder = doneCount ? '都做完了，还有什么？' : '今天先做什么？';
    $('#compose-hint').innerHTML = doneCount
      ? `刚完成了 ${doneCount} 件。想到下一件就写下来，按 <kbd>回车</kbd>`
      : '写一句，按 <kbd>回车</kbd>，它就是下一件事';
    const history = $('#done-history');
    history.hidden = !doneCount;
    history.textContent = `查看已完成 ${doneCount} 件`;
  }
}

function renderWindow() {
  const savable = savableOf(data.tabs);
  $('#win-lead').innerHTML = `<b>${data.tabs.length}</b> 个标签`;
  $('#win-favs').innerHTML = favsHtml(savable, 6);
  $('#win-sub').textContent = savable.length
    ? `${savable.length} 个网页可以存下，回头一键恢复`
    : '还没有可以保存的网页';
  document.querySelectorAll('[data-save]').forEach((b) => { b.disabled = !savable.length; });
}

function renderLast() {
  const ws = data.worksets[0];
  const box = $('#last');
  if (!ws) {
    box.innerHTML = `
      <p class="col-lead">还没有保存过</p>
      <p class="col-sub">存下的窗口会放在这里，一键恢复</p>`;
    return;
  }
  box.innerHTML = `
    <button type="button" class="col-lead rename" data-rename="${esc(ws.id)}" aria-label="改名：${esc(ws.name)}">
      <span>${esc(ws.name)}</span>
      <svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"/></svg>
    </button>
    <div class="favs" aria-hidden="true">${favsHtml(uniqueHosts(ws.tabs), 6)}</div>
    <p class="col-sub">${ws.tabs.length} 个网页 · ${relTime(ws.savedAt)}</p>
    <div class="col-actions">
      <button type="button" class="btn secondary" data-restore="${esc(ws.id)}">恢复这 ${ws.tabs.length} 个网页</button>
      ${data.worksets.length > 1 ? `<button type="button" class="btn text" data-all>全部 ${data.worksets.length} 个</button>` : ''}
    </div>`;
}

function uniqueHosts(tabs) {
  const seen = new Set();
  return tabs.filter((t) => !seen.has(t.host) && seen.add(t.host));
}

function startRename(id) {
  const ws = data.worksets.find((w) => w.id === id);
  const btn = document.querySelector(`[data-rename="${CSS.escape(id)}"]`);
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
  // refocus only for Enter/Esc; on blur the user already chose a new target.
  const finish = (commit, refocus) => {
    if (done) return;
    done = true;
    const next = input.value.trim();
    if (commit && next && next !== ws.name) {
      ws.name = next;
      toast('已改名');
    }
    renderLast();
    renderWall();
    if (refocus) setTimeout(() => document.querySelector(`[data-rename="${CSS.escape(id)}"]`)?.focus(), 0);
  };
  input.addEventListener('keydown', (e) => {
    if (e.isComposing || (e.key !== 'Enter' && e.key !== 'Escape')) return;
    // Enter would otherwise activate the name button that replaces this input.
    e.preventDefault();
    finish(e.key === 'Enter', true);
  });
  input.addEventListener('blur', () => setTimeout(() => {
    if (input.isConnected && document.activeElement !== input) finish(true, false);
  }, 0));
}

function renderNote() {
  const note = $('#note');
  if (document.activeElement !== note) note.value = data.note;
}

function snapCover(ws) {
  const bar = ws.tabs.slice(0, 4).map((t) => `<i style="background:${t.c}"></i>`).join('');
  const rows = ws.tabs.slice(0, 3).map((t) => `<div class="mini-row"><i style="background:${t.c}"></i><span>${esc(t.title)}</span></div>`).join('');
  return `<div class="snap-cover" style="--h:${hue(ws.tabs[0]?.host || ws.name)}" aria-hidden="true"><div class="mini"><div class="mini-bar">${bar}</div>${rows}</div></div>`;
}

function renderWall() {
  const savable = savableOf(data.tabs);
  const cards = [`
    <div class="snap live">
      <div class="snap-cover">
        <div class="favs" aria-hidden="true">${favsHtml(savable, 4)}</div>
        <button type="button" class="btn secondary" data-save ${savable.length ? '' : 'disabled'}>保存这个窗口</button>
      </div>
      <div class="snap-body">
        <p class="snap-name">这个窗口 · ${data.tabs.length} 个标签</p>
        <p class="snap-meta">${savable.length ? `${savable.length} 个网页可以存下` : '没有可保存的网页'}</p>
      </div>
    </div>`];
  for (const ws of data.worksets) {
    cards.push(`
      <button type="button" class="snap" data-restore="${esc(ws.id)}" aria-label="恢复「${esc(ws.name)}」，${ws.tabs.length} 个网页">
        ${snapCover(ws)}
        <div class="snap-body">
          <p class="snap-name">${esc(ws.name)}</p>
          <p class="snap-meta">${ws.tabs.length} 个网页 · ${relTime(ws.savedAt)}</p>
        </div>
      </button>`);
  }
  if (!data.worksets.length) cards.push('<div class="snap ghost">保存后，这个窗口会挂在这里，下次一键回来。</div>');
  cards.push(`
    <button type="button" class="snap note-card" data-note-open>
      <h3 class="col-h">随手记</h3>
      <p>${data.note ? esc(data.note).replace(/\n/g, '<br>') : '还没写，点这里记一句。'}</p>
    </button>`);
  $('#wall-grid').innerHTML = cards.join('');
}

function renderSites() {
  const row = data.sites.map((s) => `<button type="button" class="site"><i style="background:${s.c}" aria-hidden="true">${esc(s.l)}</i>${esc(s.name)}</button>`);
  row.push(`<button type="button" class="btn text">+ ${data.sites.length ? '添加' : '添加常用站'}</button>`);
  $('#sites-row').innerHTML = row.join('');
}

function render() {
  tick();
  renderHero();
  renderWindow();
  renderLast();
  renderNote();
  renderWall();
  renderSites();
}

/* ---------- actions ---------- */

$('#compose').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#compose-input');
  const text = input.value.trim();
  if (!text) return;
  data.todos.push(text);
  input.value = '';
  renderHero();
  const title = $('#next-title');
  title.classList.remove('entering');
  void title.offsetWidth;
  title.classList.add('entering');
  $('#next-done').focus();
});

let completing = false;
$('#next-done').addEventListener('click', () => {
  if (completing || !data.todos.length) return;
  completing = true;
  const target = data.todos[0];
  const title = $('#next-title');
  const finish = () => {
    const i = data.todos.indexOf(target);
    if (i >= 0) data.todos.splice(i, 1);
    doneCount += 1;
    completing = false;
    title.classList.remove('leaving');
    renderHero();
    if (data.todos.length) {
      title.classList.remove('entering');
      void title.offsetWidth;
      title.classList.add('entering');
    } else {
      $('#compose-input').focus();
    }
  };
  if (reducedMotion) return finish();
  title.classList.add('leaving');
  setTimeout(finish, 320);
});

$('#next-all').addEventListener('click', () => toast('原型：打开「全部待办」'));
$('#done-history').addEventListener('click', () => toast('原型：打开「全部待办」，已完成的可以勾回'));

function defaultName(tabs) {
  const last = tabs.reduce((a, b) => (b.seen > a.seen ? b : a), tabs[0]);
  const title = (last && last.title.trim()) || '';
  if (title) return [...title].length > 30 ? `${[...title].slice(0, 30).join('')}…` : title;
  const d = now();
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm(d)}`;
}

function doSave() {
  const tabs = savableOf(data.tabs);
  data.worksets.unshift({ id: `w${Date.now()}`, name: defaultName(tabs), savedAt: new Date(), tabs });
  data.worksets = data.worksets.slice(0, WORKSET_MAX);
  renderLast();
  renderWall();
  const target = root.dataset.layout === 'wall' ? document.querySelector('.wall-grid .snap:nth-child(2)') : $('#last').closest('.col');
  target?.classList.remove('flash');
  void target?.offsetWidth;
  target?.classList.add('flash');
  toast('已存下这个窗口');
}

function onSave() {
  if (!savableOf(data.tabs).length) return;
  if (data.worksets.length >= WORKSET_MAX) {
    const oldest = data.worksets[data.worksets.length - 1];
    toast(`已存了 ${WORKSET_MAX} 个窗口，覆盖最早的「${oldest.name}」？`, [
      { label: '覆盖', run: doSave },
      { label: '取消' },
    ]);
    return;
  }
  doSave();
}

document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('[data-save]')) return onSave();
  const r = t.closest('[data-restore]');
  if (r) {
    const ws = data.worksets.find((w) => w.id === r.dataset.restore);
    if (ws) toast(`原型：打开「${ws.name}」的 ${ws.tabs.length} 个网页；已开着的切过去，不关其它标签`);
    return;
  }
  const rn = t.closest('[data-rename]');
  if (rn) return startRename(rn.dataset.rename);
  if (t.closest('[data-all]')) return toast('原型：打开全部存下的窗口');
  if (t.closest('[data-note-open]')) return toast('原型：打开随手记');
});

let noteTimer = 0;
$('#note').addEventListener('input', (e) => {
  data.note = e.target.value;
  clearTimeout(noteTimer);
  const status = $('#note-status');
  status.textContent = '';
  noteTimer = setTimeout(() => {
    status.textContent = '已存在本机';
    renderWall();
    noteTimer = setTimeout(() => { status.textContent = ''; }, 1600);
  }, 500);
});

/* ---------- prototype controls ---------- */

function syncSeg() {
  document.querySelectorAll('.seg').forEach((seg) => {
    const cur = root.dataset[seg.dataset.seg === 'sky' ? 'sky' : seg.dataset.seg];
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.val === cur)));
  });
}

function setState(state) {
  root.dataset.state = state;
  data = DATASETS[state]();
  doneCount = 0;
  render();
  syncSeg();
}

document.querySelectorAll('.seg').forEach((seg) => {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (seg.dataset.seg === 'state') return setState(b.dataset.val);
    root.dataset[seg.dataset.seg] = b.dataset.val;
    syncSeg();
  });
});

/* ---------- boot ---------- */

if (params.has('clean')) root.dataset.clean = '';
root.dataset.sky = params.get('sky') === 'night' ? 'night' : 'day';
root.dataset.layout = params.get('layout') === 'wall' ? 'wall' : 'content';
root.dataset.stars = params.get('stars') === 'off' ? 'off' : 'on';
setState(DATASETS[params.get('state')] ? params.get('state') : 'filled');
setInterval(tick, 15000);
