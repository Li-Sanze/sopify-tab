'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const EXT = path.join(__dirname, '..', 'extension');

function read(name) {
  return fs.readFileSync(path.join(EXT, name), 'utf8');
}

function relChannel(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = relChannel((n >> 16) & 255);
  const g = relChannel((n >> 8) & 255);
  const b = relChannel(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const L1 = luminance(a);
  const L2 = luminance(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

function ruleBlock(css, start) {
  const i = css.indexOf(start);
  assert.ok(i !== -1, `missing ${start}`);
  const j = css.indexOf('}', i);
  return css.slice(i, j);
}

function hexToken(block, name) {
  const m = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `${name} missing in ${block.slice(0, 40)}`);
  return m[1].toLowerCase();
}

const html = read('newtab.html');
const css = read('newtab.css');
const theme = read('theme.css');
const js = read('newtab.js');
const boot = read('desk-3d/boot.js');
const desk = html.slice(html.indexOf('data-view="desk"'), html.indexOf('data-view="tabs"'));
const settings = html.slice(html.indexOf('data-view="settings"'));

assert.ok(!html.includes('我的工作台'));
assert.ok(!html.includes('studio-theme-toggle'));
assert.ok(!desk.includes('工作集') && !settings.includes('工作集'));
assert.ok(html.includes('接着上次') && html.includes('保存这个窗口') && html.includes('存下的窗口'));

const whitelist = new Set(['todo-input-dialog']);
const ids = [...js.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]);
for (const id of new Set(ids)) {
  if (whitelist.has(id) || id.startsWith('desk3d-')) continue;
  assert.ok(html.includes(`id="${id}"`), `ungarded $('#${id}') must exist in newtab.html`);
}

assert.ok(boot.includes('import('));
assert.ok(!/import\s+[^;]*from\s+['"]\.\/embed\.js['"]/.test(boot));

assert.ok(/let spaceViewOn = false/.test(js));
assert.ok(js.includes('data.spaceView === true'));
assert.ok(!/localStorage/.test(js));
assert.ok(!/DESK_KEYS = \[[^\]]*spaceView/.test(js));

const day = ruleBlock(theme, 'html[data-theme="day"]');
const night = ruleBlock(theme, 'html[data-theme="night"]');
const dayPaper = hexToken(day, '--studio-paper');
const dayMuted = hexToken(day, '--studio-muted');
const dayFaint = hexToken(day, '--studio-faint');
const nightPaper = hexToken(night, '--studio-paper');
const nightMuted = hexToken(night, '--studio-muted');
const nightFaint = hexToken(night, '--studio-faint');
assert.ok(contrast(dayMuted, dayPaper) >= 4.5, 'day secondary text contrast');
assert.ok(contrast(dayFaint, dayPaper) >= 3, 'day placeholder contrast');
assert.ok(contrast(nightMuted, nightPaper) >= 4.5, 'night secondary text contrast');
assert.ok(contrast(nightFaint, nightPaper) >= 3, 'night placeholder contrast');

const shared = ['--ink', '--ink-2', '--accent', '--line', '--line-2'];
for (const name of shared) {
  const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`, 'g');
  assert.strictEqual((css.match(re) || []).length, 0, `newtab.css must not assign ${name}`);
}

assert.ok(/id="resume"[^>]*data-has="pending"/.test(html), 'resume starts pending');
assert.ok(css.includes('.next[data-has="pending"] .next-compose { display: none; }'));
assert.ok(css.includes('.next[data-has="pending"] .next-filled { visibility: hidden; }'));
assert.ok(css.includes('.next[data-has="pending"] .next-title { min-height: 1.2em; }'));
assert.ok(/root\.dataset\.has = has \? '1' : '0'/.test(js), 'renderResume writes 0 or 1');
assert.ok(css.includes('.studio-desk .shelf textarea.note'));
assert.ok(!/\.studio-desk \.note \{/.test(css), 'note field styles must not match the 3D label');

const firstScreen = css.slice(css.indexOf('v3 first screen'));
assert.ok(firstScreen.includes('18% 40%'));
assert.ok(!firstScreen.includes('42% 42%'), 'first screen chips must not use 42% 42%');
assert.ok(firstScreen.includes('max-width: calc(1040px + 64px)'));
assert.ok(/body\.studio-home \.main/.test(firstScreen));

const starsAt = css.indexOf('.stars-layer {');
assert.ok(starsAt !== -1);
const starsRule = css.slice(starsAt, css.indexOf('}', starsAt));
assert.ok(!/animation\s*:/.test(starsRule));
assert.ok(/html\[data-sky="night"\][^{]*\.stars-layer\s*\{[^}]*opacity:\s*1/.test(css));
assert.ok(!/<canvas/i.test(html));
assert.ok(!/getContext\s*\(\s*['"](?:webgl|experimental-webgl)['"]/i.test(html + js + css));

const SANS_FALLBACK = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif';
const SONG_STACK = `"Songti SC", "Songti TC", "STSong", "Source Han Serif SC", "Noto Serif CJK SC", "Noto Serif SC", "Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "MS PMincho", ${SANS_FALLBACK}`;
const titleInput = ruleBlock(css, '.studio-desk .next-title, .studio-desk .next-input');
assert.ok(titleInput.includes(`font-family: ${SONG_STACK}`), 'next title and input use the Songti stack');
assert.ok(titleInput.includes('font-weight: 700'), 'next title and input are weight 700');
assert.ok(titleInput.includes('letter-spacing: -0.01em'), 'default tracking is -0.01em');
assert.ok(titleInput.includes('.next-title') && titleInput.includes('.next-input'));
const family = (titleInput.split('font-family:')[1] || '').split(';')[0];
assert.ok(family.includes(SANS_FALLBACK), 'Songti stack falls back to the system sans');
assert.ok(!/SimSun|宋体/.test(family), 'Songti stack must not name SimSun or 宋体');
assert.ok(!/(^|,)\s*serif\s*(,|$)/i.test(family), 'Songti stack must not use bare serif');
assert.ok(/letter-spacing:\s*-0\.02em/.test(ruleBlock(css, '.next-title[data-size="l"]')), 'long titles keep their own tracking');
assert.ok(day.includes('--studio-field: rgba(38, 42, 51, 0.04);'));
assert.ok(day.includes('--studio-field-hi: rgba(38, 42, 51, 0.07);'));
assert.ok(night.includes('--studio-field: rgba(255, 255, 255, 0.04);'));
assert.ok(night.includes('--studio-field-hi: rgba(255, 255, 255, 0.07);'));
assert.ok(css.includes('.studio-desk .shelf textarea.note:placeholder-shown { background: var(--studio-field); }'));
assert.ok(css.includes('.studio-desk .shelf textarea.note:placeholder-shown:hover { background: var(--studio-field-hi); }'));

function braceBlock(src, start) {
  const i = src.indexOf(start);
  assert.ok(i !== -1, `missing ${start}`);
  const open = src.indexOf('{', i);
  let depth = 0;
  for (let p = open; p < src.length; p += 1) {
    if (src[p] === '{') depth += 1;
    else if (src[p] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(i, p + 1);
    }
  }
  throw new Error(`unclosed ${start}`);
}

assert.ok(!/height:\s*calc\(\s*100dvh\s*-\s*64px\s*\)/.test(css), 'studio-screen height lock is gone');
const screenRule = braceBlock(css, '.studio-screen {');
assert.ok(!/(?:^|[^-])height\s*:/.test(screenRule), 'studio-screen rule does not set a height');
assert.ok(!/overflow\s*:/.test(screenRule), 'studio-screen rule does not clip overflow');

const shortQ = braceBlock(css, '@media (max-height: 760px)');
assert.ok(shortQ.includes('.hero') && shortQ.includes('.next-actions') && shortQ.includes('.shelf') && shortQ.includes('.sites'));
assert.ok(!/overflow\s*:/.test(shortQ), 'short viewport query does not clip overflow');
assert.ok(!/font-size\s*:/.test(shortQ), 'short viewport query does not shrink type');
assert.ok(css.includes('.studio-desk .sites .tile .lbl { font-size: 13px; max-width: 6em; color: inherit; }'));
assert.ok(css.includes('html[data-boot-focus] #resume-act:focus-visible { outline: none; }'));
assert.ok(css.includes('html[data-boot-focus] .next-input:focus-visible { outline: none; }'));
assert.ok(/(^|\n)\.next-input:focus-visible \{ outline: none; \}/.test(css), 'next-input keeps underline and no ring after boot');
assert.ok(css.includes('.next-input:focus { border-bottom-color: var(--studio-accent); }'));
assert.ok(!css.includes('.next-input[data-boot-focus]'), 'boot mark is on html, not the input');
const studioFocusVis = css.indexOf('.studio-desk :focus-visible');
const permanentInputFocus = css.indexOf('\n.next-input:focus-visible { outline: none; }');
const nextInputFocusVis = css.indexOf('html[data-boot-focus] .next-input:focus-visible { outline: none; }');
assert.ok(studioFocusVis !== -1 && permanentInputFocus > studioFocusVis, 'permanent input rule follows the studio ring');
assert.ok(nextInputFocusVis > studioFocusVis, 'boot input rule follows the studio ring');
assert.ok(css.includes('.studio-desk .shelf textarea.note:focus-visible'));
assert.ok(theme.includes('--studio-danger:'));
assert.ok(!/window\.confirm\s*\(|window\.alert\s*\(/.test(js));
assert.ok(html.includes('id="ops-confirm-dialog"') && js.includes('function confirmInPage'));
assert.ok(html.includes('只有这一页') && html.includes('打开几个网页后，可以在这里存下来') && html.includes('都存在这台电脑上。'));
assert.ok(js.includes('打开几个网页后，可以在这里存下来') && !js.includes('新标签页本身不会写进存下的窗口。'));
assert.ok(html.includes('跟随系统时，随电脑的白天和夜晚切换。'));
assert.ok(html.includes('>实验</h2>') && html.includes('在常用站下面放一张 3D 书桌。默认关闭。'));
const themeAt = html.indexOf('id="s-theme"');
const workAt = html.indexOf('id="s-worksets"');
const expAt = html.indexOf('id="s-experiment"');
assert.ok(themeAt > 0 && themeAt < expAt && expAt < workAt, 'settings columns are 外观 then 实验, beside 存下的窗口');
assert.ok(html.includes('class="settings-stack"'));
assert.ok(css.includes('.settings-stack { display: flex; flex-direction: column; gap: 20px; min-width: 0; }'));
assert.ok(js.includes('想到下一件就写下来，按 <kbd>回车</kbd>') && !js.includes('刚完成了'));
const moveBody = fnBody(js, 'async function moveTodoToFront(id)');
assert.ok(moveBody.includes('requestCollectionCommit'));
assert.ok(moveBody.includes("op: 'move'") && moveBody.includes("to: 'front'"));
assert.ok(moveBody.includes('confirmDeskWrite') && moveBody.includes("adoptCollection('todos'"));
assert.ok(moveBody.includes('这条已在另一页删掉了') && moveBody.includes('没存上，再点一次') && moveBody.includes("toast('已设为下一件')"));
const todosDialogBody = fnBody(js, 'function openTodosDialog(');
assert.ok(todosDialogBody.includes('设为下一件') && todosDialogBody.includes('data-todo-next'));
const editBody = fnBody(js, 'function beginTodoTextEdit(id)');
assert.ok(editBody.includes('createImeGuard()') && editBody.includes('replaceTodos('));
assert.ok(editBody.includes("e.key === 'Enter'") && editBody.includes('editIme.blocks(e)'));
assert.ok(todosDialogBody.includes('data-todo-text') && todosDialogBody.includes('beginTodoTextEdit'));
const toastBody = fnBody(js, 'function toast(msg, opts)');
assert.ok(toastBody.includes("$('#toast-action')") && toastBody.includes('6000') && toastBody.includes('2400'));
assert.ok(toastBody.includes('onmouseenter') && toastBody.includes('onmouseleave') && toastBody.includes('onfocus') && toastBody.includes('onblur'));
assert.ok(!toastBody.includes('workset-retry-unopened') && !toastBody.includes('.focus('));
assert.ok(html.includes('id="toast-action"') && html.includes('id="workset-retry-unopened"'));
assert.ok(html.indexOf('id="toast"') < html.indexOf('id="toast-action"') && html.indexOf('id="toast-action"') < html.indexOf('id="workset-retry-unopened"'));
const resumeActBody = fnBody(js, 'function runResumeAction()');
assert.ok(resumeActBody.includes('已完成「') && resumeActBody.includes("label: '撤销'") && resumeActBody.includes('undoCompletedTodo'));
const undoBody = fnBody(js, 'async function undoCompletedTodo(id)');
assert.ok(undoBody.includes('done: false') && undoBody.includes('这条已经删掉了') && undoBody.includes('diffTodos'));
assert.ok(!todosDialogBody.includes('undoCompletedTodo') && !todosDialogBody.includes('已完成「'));
assert.ok(!js.includes('draggable'), '3b.2 does not add drag sorting');
assert.ok(css.includes('.todo:hover > .todo-next') && css.includes('.todo:focus-within > .todo-next'));
assert.ok(/@media \(max-width: 600px\) \{[\s\S]*\.todo-next \{ opacity: 1; pointer-events: auto; \}/.test(css));
assert.ok(js.includes('查看已完成 ${done} 件'));
assert.ok(!html.includes('localhost 端口只是标签'));
assert.ok(/\.groups\s*\{[^}]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/.test(css));
assert.ok(/@media \(max-width: 1000px\) \{\s*\.groups \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/.test(css));
assert.ok(/@media \(max-width: 600px\) \{\s*\.groups \{ grid-template-columns: 1fr; \}/.test(css));
assert.ok(css.includes('#main:focus, #main:focus-visible { outline: none; }'));
assert.ok(/\.ops-dialog input:focus-visible \{[^}]*outline: none;/.test(css));
assert.ok(/#main dialog\.ops-dialog input:focus-visible \{[^}]*outline: none;/.test(css));
const inkHeadings = css.slice(css.indexOf('.view[data-view="settings"] .cardhead h2,'), css.indexOf('.view[data-view="tabs"] .grouphead .count {'));
assert.ok(inkHeadings.includes('.view[data-view="tabs"] .grouphead b,') && inkHeadings.includes('color: var(--studio-ink)') && !inkHeadings.includes('font-size: 12px'), 'card and group titles stay on the ink rule');
const countOnly = css.slice(css.indexOf('.view[data-view="tabs"] .grouphead .count {'), css.indexOf('.view[data-view="settings"] .cardhead h2 svg.i'));
assert.ok(countOnly.includes('flex: none') && countOnly.includes('color: var(--studio-muted)') && !countOnly.includes('cardhead'));
assert.ok(!/body \.shell\s*\{[^}]*!important/.test(css));
assert.ok(/z-index:\s*70/.test(braceBlock(css, '.toast')), 'toast z-index stays 70');

assert.ok(html.includes('id="todos-open">全部待办'));
assert.ok(html.includes('id="site-url-error"'));
assert.ok(html.includes('id="sites-more"'));
assert.ok(html.includes('aria-describedby="site-url-error"'));

function fnBody(src, signature) {
  return braceBlock(src, signature);
}
const queueBody = fnBody(js, 'function queueNoteSave()');
assert.ok(!/setTimeout/.test(queueBody), 'queueNoteSave has no debounce timer');
assert.ok(!/\b400\b/.test(queueBody));
const pumpBody = fnBody(js, 'function pumpNoteSave()');
assert.ok(pumpBody.includes('saveDesk({ notes: state.notes })'));
assert.ok(pumpBody.includes("setNotesSavedStatus('已存在本机')"));
assert.ok(pumpBody.includes("setNotesSavedStatus('没存上')"));
assert.ok(queueBody.includes("setNotesSavedStatus('保存中…')"));
assert.ok(!js.includes('没存上，稍后再试'));
assert.ok(fnBody(js, 'function saveDeskNoteFrom3d(').includes('queueNoteSave()'));
assert.ok(js.includes('state.sites.slice(0, 8)'));
assert.ok(js.includes('more.textContent = `全部 ${state.sites.length} 个`'));
assert.ok(js.includes('showSiteUrlError('));
assert.ok(!/toast\('网址需要是 http\(s\)'\)/.test(js));
assert.ok(!js.includes('这是最后一条'), 'button copy never says 这是最后一条');
assert.ok(!js.includes('之后还有'), 'button copy does not use 之后还有');
const resumeBody = fnBody(js, 'function renderResume()');
assert.ok(resumeBody.includes('全部待办 · 还有 '));
assert.ok(resumeBody.includes('全部待办 · 已完成 '));
assert.ok(resumeBody.includes("open.textContent = '全部待办'"));
assert.ok(!resumeBody.includes('这是最后一条'));
const bootBody = fnBody(js, 'async function boot()');
const bootMark = bootBody.indexOf("document.documentElement.setAttribute('data-boot-focus', '')");
const bootFocus = bootBody.indexOf('focusDeskPrimary()');
assert.ok(bootMark !== -1 && bootFocus !== -1 && bootMark < bootFocus, 'boot marks html before focusDeskPrimary');
assert.ok(bootBody.includes("addEventListener('keydown', clearBootFocus)"));
assert.ok(bootBody.includes("addEventListener('pointerdown', clearBootFocus)"));
assert.ok(bootBody.includes("document.documentElement.removeAttribute('data-boot-focus')"));
const setViewBody = fnBody(js, 'function setView(v, opts)');
assert.ok(setViewBody.includes('focusDeskPrimary()'));
assert.ok(!setViewBody.includes('data-boot-focus'), 'only boot() sets data-boot-focus');
const closeAt = js.indexOf("todosDialog.addEventListener('close'");
const closeNext = js.indexOf("todosDialog.addEventListener('keydown'", closeAt);
assert.ok(closeAt !== -1 && closeNext > closeAt);
assert.ok(js.slice(closeAt, closeNext).includes('focusDeskPrimary()'), 'todos dialog close returns focus via focusDeskPrimary');
assert.ok(fnBody(js, 'function focusDeskPrimary()').includes("$('#resume-act')"));
assert.ok(fnBody(js, 'function focusDeskPrimary()').includes("$('#todo-input')"));

const ui = read('desk-3d/ui.js');
assert.ok(ui.includes('this.host.saveNote(this.noteEditor.value)'), '3D note editor uses the host save path');
assert.ok(!/chrome\.storage/.test(ui));

console.log('test-w13-firstscreen static: ok');

const http = require('http');
const os = require('os');
const net = require('net');
const { spawn, spawnSync } = require('child_process');

const FOUR_LINE_TITLE = `${'把首屏长标题排满'.repeat(24)}第四行`;
const LONG_SITE = '超级长的常用站名称用来考验省略号不会把第一屏撑高';
const SIZES = [
  [1440, 900],
  [1512, 823],
  [1280, 720],
  [1366, 650],
];
const TODO_KINDS = ['empty', '1', '5', 'long'];
const SITE_COUNTS = [0, 6, 16, 40];

function todoItems(kind) {
  if (kind === 'empty') return [];
  if (kind === '1') return [{ id: 't1', text: '回一封邮件', done: false }];
  if (kind === '5') return [1, 2, 3, 4, 5].map((n) => ({ id: `t${n}`, text: `待办${n}`, done: false }));
  return [{ id: 'long', text: FOUR_LINE_TITLE, done: false }];
}

function siteItems(count, longNames) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      name: longNames ? `${LONG_SITE}${i + 1}` : `站${i + 1}`,
      url: `https://example.com/${longNames ? 'long' : 's'}/${i + 1}`,
    });
  }
  return out;
}

function stubSource(seed) {
  return `(() => {
    const seed = ${JSON.stringify(seed)};
    try { localStorage.setItem('themePreset', 'day'); } catch (e) {}
    const store = {
      sites: seed.sites || [],
      todos: seed.todos || [],
      notes: typeof seed.notes === 'string' ? seed.notes : '',
      name: seed.name || '',
      worksets: seed.worksets || [],
      spaceView: false,
      cwd: '',
      hostUpstream: 'cursor',
      themePreset: 'day',
    };
    let noteWrites = 0;
    let failTodos = !!seed.failTodos;
    const delay = seed.storageDelay || 0;
    window.__sopifySetFailTodos = (on) => { failTodos = !!on; };
    window.__sopifyStore = store;
    window.__sopifyNoteWrites = () => noteWrites;
    window.chrome = {
      storage: {
        local: {
          get(defaults) {
            const out = {};
            const src = defaults && typeof defaults === 'object' ? defaults : {};
            Object.keys(src).forEach((k) => {
              out[k] = Object.prototype.hasOwnProperty.call(store, k) ? store[k] : src[k];
            });
            return Promise.resolve(out);
          },
          set(partial) {
            return new Promise((resolve, reject) => {
              const run = () => {
                if (seed.failNotes && partial && Object.prototype.hasOwnProperty.call(partial, 'notes')) {
                  reject(new Error('storage failed'));
                  return;
                }
                if (failTodos && partial && Object.prototype.hasOwnProperty.call(partial, 'todos')) {
                  reject(new Error('storage failed'));
                  return;
                }
                if (partial && Object.prototype.hasOwnProperty.call(partial, 'notes')) noteWrites += 1;
                Object.assign(store, partial || {});
                resolve();
              };
              if (delay) setTimeout(run, delay);
              else run();
            });
          },
        },
        onChanged: { addListener() {} },
      },
      runtime: {
        onMessage: { addListener() {} },
        sendMessage(msg, cb) {
          const done = (res) => { if (typeof cb === 'function') cb(res); };
          if (msg && msg.type === 'sopify-collection-commit') {
            const run = window.__sopifyCollectionCommit;
            if (typeof run !== 'function') {
              done({ ok: false, error: true });
              return;
            }
            Promise.resolve(run(msg.req)).then(done, () => done({ ok: false, error: true }));
            return;
          }
          if (!msg || msg.type !== 'sopify-note-commit') {
            done({ ok: true });
            return;
          }
          const run = window.__sopifyNoteCommit;
          if (typeof run !== 'function') {
            done({ ok: false, error: true });
            return;
          }
          Promise.resolve(run(msg.req)).then(done, () => done({ ok: false, error: true }));
        },
        getURL(p) { return String(p || ''); },
        lastError: null,
      },
      tabs: {
        query() { return Promise.resolve(seed.tabs || []); },
        onCreated: { addListener() {} },
        onRemoved: { addListener() {} },
        onUpdated: { addListener() {} },
        onMoved: { addListener() {} },
        onAttached: { addListener() {} },
        onDetached: { addListener() {} },
      },
    };
  })();`;
}

function chromeBin() {
  if (process.env.CHROME_BIN) {
    if (fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
    console.log(`SKIP browser: CHROME_BIN does not exist (${process.env.CHROME_BIN})`);
    process.exit(2);
  }
  const list = [
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const bin of list) {
    if (fs.existsSync(bin)) return bin;
  }
  console.log('SKIP browser: no Chrome/Chromium binary found. Set CHROME_BIN.');
  process.exit(2);
}

function writableDir(candidates) {
  let last = null;
  for (const dir of candidates) {
    if (!dir) continue;
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, '.write-probe');
      fs.writeFileSync(probe, 'ok');
      fs.unlinkSync(probe);
      return dir;
    } catch (err) {
      last = err;
      console.log(`screenshot dir unavailable: ${dir} (${err && err.code ? err.code : err})`);
    }
  }
  console.log(`screenshots skipped: ${last && last.message ? last.message : last}`);
  return null;
}

function serve(root) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = urlPath === '/' ? '/newtab.html' : urlPath;
    const file = path.normalize(path.join(root, rel));
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      const ext = path.extname(file);
      const type = ext === '.html' ? 'text/html; charset=utf-8'
        : ext === '.css' ? 'text/css; charset=utf-8'
        : ext === '.js' ? 'text/javascript; charset=utf-8'
        : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function waitJson(port) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/json/version' }, (res) => {
        let buf = '';
        res.on('data', (d) => { buf += d; });
        res.on('end', () => {
          try { resolve(JSON.parse(buf)); } catch (err) { reject(err); }
        });
      });
      req.on('error', () => {
        if (Date.now() - start > 10000) reject(new Error('chrome devtools did not open'));
        else setTimeout(tick, 80);
      });
    };
    tick();
  });
}

function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let seq = 0;
    const pending = new Map();
    const waits = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const item = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) item.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else item.resolve(msg.result || {});
        return;
      }
      if (msg.method) {
        for (let i = waits.length - 1; i >= 0; i -= 1) {
          if (waits[i].method === msg.method) {
            const w = waits.splice(i, 1)[0];
            w.resolve(msg.params || {});
          }
        }
      }
    });
    ws.addEventListener('error', () => reject(new Error('cdp websocket failed')));
    ws.addEventListener('open', () => {
      resolve({
        send(method, params) {
          const id = ++seq;
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              pending.delete(id);
              rej(new Error(`CDP timeout ${method} after 10000ms`));
            }, 10000);
            pending.set(id, {
              resolve: (value) => {
                clearTimeout(timer);
                res(value);
              },
              reject: (err) => {
                clearTimeout(timer);
                rej(err);
              },
            });
            ws.send(JSON.stringify({ id, method, params: params || {} }));
          });
        },
        waitEvent(method, timeout = 8000) {
          return new Promise((res, rej) => {
            const timer = setTimeout(() => rej(new Error(`timeout ${method}`)), timeout);
            waits.push({
              method,
              resolve: (payload) => {
                clearTimeout(timer);
                res(payload);
              },
            });
          });
        },
        close() { ws.close(); },
      });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const chromeChildren = [];
const profileDirs = [];

function trackChrome(child) {
  chromeChildren.push(child);
  return child;
}

function trackProfile(dir) {
  profileDirs.push(dir);
  return dir;
}

function killChrome(child) {
  if (!child || child.pid == null) return;
  try { process.kill(-child.pid, 'SIGKILL'); } catch {
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  }
}

function cleanupBrowser() {
  for (const child of chromeChildren) killChrome(child);
  for (const dir of profileDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* already gone */ }
  }
}

function armWatchdog() {
  const timer = setTimeout(() => {
    console.error('FAIL watchdog: browser test exceeded 240s');
    cleanupBrowser();
    process.exit(1);
  }, 240000);
  const onSignal = () => {
    console.error('FAIL watchdog: browser test exceeded 240s');
    cleanupBrowser();
    process.exit(1);
  };
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);
  process.on('exit', cleanupBrowser);
  return () => clearTimeout(timer);
}

async function waitUntil(read, ok, timeout = 3000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await read();
    if (ok(last)) return last;
    await sleep(16);
  }
  return last;
}

async function main() {
  const chromePath = chromeBin();
  const stopWatchdog = armWatchdog();
  if (typeof WebSocket !== 'function') {
    console.error('FAIL browser: global WebSocket is missing. Browser checks need Node 22 or newer.');
    process.exit(1);
  }
  const server = await serve(EXT);
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  let chromeLog = '';
  function runTemp() {
    const root = process.env.SOPIFY_RUN_ROOT;
    if (root) {
      fs.mkdirSync(root, { recursive: true });
      return root;
    }
    return os.tmpdir();
  }
  function freePort() {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        server.close(() => resolve(port));
      });
    });
  }
  function commandLine(pid) {
    if (process.platform === 'linux') {
      try { return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').join(' '); } catch { return ''; }
    }
    const out = spawnSync('ps', ['-p', String(pid), '-o', 'args='], { encoding: 'utf8' });
    return out.stdout || '';
  }
  function portAnswers(port) {
    return new Promise((resolve) => {
      const req = http.get({ host: '127.0.0.1', port, path: '/json/version', timeout: 400 }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
  }
  function listenerPid(port) {
    if (process.platform === 'linux') {
      const hex = Number(port).toString(16).toUpperCase().padStart(4, '0');
      const tcp = fs.readFileSync('/proc/net/tcp', 'utf8');
      let inode = '';
      for (const line of tcp.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (!parts[1] || !parts[1].toUpperCase().endsWith(':' + hex)) continue;
        if (parts[3] !== '0A') continue;
        inode = parts[9];
        break;
      }
      if (!inode) return null;
      const needle = `socket:[${inode}]`;
      for (const pid of fs.readdirSync('/proc')) {
        if (!/^\d+$/.test(pid)) continue;
        let fds;
        try { fds = fs.readdirSync(`/proc/${pid}/fd`); } catch { continue; }
        for (const fd of fds) {
          try {
            if (fs.readlinkSync(`/proc/${pid}/fd/${fd}`) === needle) return Number(pid);
          } catch { /* fd disappeared */ }
        }
      }
      return null;
    }
    const out = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
    const pid = Number(String(out.stdout || '').trim().split('\n')[0]);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  }
  function processGroup(pid) {
    if (process.platform === 'linux') {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      return Number(rest[2]);
    }
    const out = spawnSync('ps', ['-o', 'pgid=', '-p', String(pid)], { encoding: 'utf8' });
    const group = Number(String(out.stdout || '').trim());
    return Number.isFinite(group) ? group : null;
  }
  async function assertThisProcess(port, child, profile) {
    const portFile = path.join(profile, 'DevToolsActivePort');
    if (fs.existsSync(portFile)) {
      const listed = String(fs.readFileSync(portFile, 'utf8').split('\n')[0] || '').trim();
      assert.strictEqual(listed, String(port), `DevToolsActivePort ${listed || '(empty)'} is not this launch`);
    }
    const args = commandLine(child.pid);
    assert.ok(args.includes(`--remote-debugging-port=${port}`), `cmdline missing this port: ${args.slice(0, 240)}`);
    assert.ok(args.includes(profile), 'cmdline missing this profile');
    assert.strictEqual(child.exitCode, null, 'chrome exited before the check');
    const owner = listenerPid(port);
    assert.ok(owner, `nothing is listening on ${port}`);
    assert.strictEqual(processGroup(owner), processGroup(child.pid), `port ${port} is pid ${owner}, not this chrome ${child.pid}`);
  }
  async function openChrome(fixedPort) {
    const port = fixedPort || await freePort();
    if (await portAnswers(port)) throw new Error(`occupied debug port ${port}`);
    const profile = trackProfile(fs.mkdtempSync(path.join(runTemp(), 'sopify-firstscreen-')));
    const child = trackChrome(spawn(chromePath, [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-sync',
      '--disable-extensions',
      'about:blank',
    ], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] }));
    child.stdout.on('data', (d) => { chromeLog += d; });
    child.stderr.on('data', (d) => { chromeLog += d; });
    const versionInfo = await waitJson(port);
    const listRes = await new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: '/json/list' }, (res) => {
        let buf = '';
        res.on('data', (d) => { buf += d; });
        res.on('end', () => {
          try { resolve(JSON.parse(buf)); } catch (err) { reject(err); }
        });
      }).on('error', reject);
    });
    const page = listRes.find((t) => t.type === 'page') || listRes[0];
    assert.ok(page && page.webSocketDebuggerUrl, 'chrome page target');
    const conn = await connectCdp(page.webSocketDebuggerUrl);
    await conn.send('Page.enable');
    await conn.send('Runtime.enable');
    await conn.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await conn.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    });
    await assertThisProcess(port, child, profile);
    return { child, conn, versionInfo, port, profile };
  }
  const shotDir = writableDir([
    process.env.SOPIFY_ARTIFACT_DIR
      ? path.join(process.env.SOPIFY_ARTIFACT_DIR, 'firstscreen-reliability')
      : '/opt/cursor/artifacts/firstscreen-reliability',
    path.join(os.tmpdir(), 'sopify-firstscreen-reliability'),
  ]);
  let chrome;
  let cdp;
  let version;
  try {
    const decoy = http.createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ Browser: 'decoy' }));
    });
    await new Promise((resolve) => decoy.listen(0, '127.0.0.1', resolve));
    let occupied = '';
    try {
      await openChrome(decoy.address().port);
      occupied = 'attached';
    } catch (err) {
      occupied = String(err && err.message ? err.message : err);
    }
    decoy.close();
    assert.ok(occupied.includes('occupied'), occupied);
    const first = await openChrome();
    console.log(`w13 chrome pid ${first.child.pid} port ${first.port}`);
    chrome = first.child;
    cdp = first.conn;
    version = first.versionInfo;
    let scriptId = null;
    let caseNo = 0;

    async function evalJson(expression) {
      const out = await cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (out.exceptionDetails) {
        throw new Error(out.exceptionDetails.text || JSON.stringify(out.exceptionDetails));
      }
      return out.result ? out.result.value : undefined;
    }

    async function evalNow(expression) {
      const out = await cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: false,
      });
      if (out.exceptionDetails) {
        throw new Error(out.exceptionDetails.text || JSON.stringify(out.exceptionDetails));
      }
      return out.result ? out.result.value : undefined;
    }

    async function mouseClick(selector) {
      await evalNow(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', inline: 'center' });
      })()`);
      const box = await evalNow(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
      })()`);
      if (!box || box.w < 1 || box.h < 1) throw new Error(`no mouse target ${selector}`);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1,
      });
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1,
      });
    }

    async function mouseMove(selector) {
      await evalNow(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', inline: 'center' });
      })()`);
      const box = await evalNow(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
      })()`);
      if (!box || box.w < 1 || box.h < 1) throw new Error(`no mouse target ${selector}`);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
    }

    function readConfirmExpr() {
      return `(() => {
        const d = document.getElementById('ops-confirm-dialog');
        const focus = document.activeElement;
        return {
          open: !!(d && d.open),
          err: d ? (d.dataset.confirmError || '') : 'missing',
          title: document.getElementById('ops-confirm-title').textContent,
          body: document.getElementById('ops-confirm-body').textContent,
          ok: document.getElementById('ops-confirm-ok').textContent,
          danger: document.getElementById('ops-confirm-ok').classList.contains('danger'),
          focus: focus ? focus.id : '',
        };
      })()`;
    }

    async function loadSeed(width, height, seed) {
      if (scriptId) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId });
      const added = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: stubSource(seed) });
      scriptId = added.identifier;
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      caseNo += 1;
      const loaded = cdp.waitEvent('Page.loadEventFired', 12000);
      await cdp.send('Page.navigate', { url: `${origin}/newtab.html?case=${caseNo}` });
      await loaded;
      const start = Date.now();
      while (Date.now() - start < 6000) {
        const ready = await evalJson(`!!(document.body && document.body.classList.contains('studio-home') && document.getElementById('resume') && document.getElementById('resume').dataset.has !== 'pending')`);
        if (ready) return;
        await sleep(30);
      }
      const snippet = await evalJson(`document.body ? document.body.innerText.slice(0, 180) : 'no body'`);
      throw new Error(`boot timeout: ${snippet}`);
    }

    async function readLayout() {
      return evalJson(`(() => {
        const el = document.scrollingElement || document.documentElement;
        const title = document.getElementById('resume-title');
        let lines = 0;
        if (title && title.getBoundingClientRect().height) {
          const lh = parseFloat(getComputedStyle(title).lineHeight);
          if (lh) lines = Math.round(title.getBoundingClientRect().height / lh);
        }
        const lbl = document.querySelector('#sites .lbl');
        let lblMax = null;
        let lblTitle = '';
        if (lbl) {
          const cs = getComputedStyle(lbl);
          lblMax = Math.abs(parseFloat(cs.maxWidth) - parseFloat(cs.fontSize) * 6) < 1.5;
          lblTitle = lbl.getAttribute('title') || '';
        }
        const more = document.getElementById('sites-more');
        const open = document.getElementById('todos-open');
        const mount = document.getElementById('desk-3d-mount');
        const htmlCs = getComputedStyle(document.documentElement);
        const bodyCs = getComputedStyle(document.body);
        return {
          overflow: Math.round((el.scrollHeight - window.innerHeight) * 100) / 100,
          scrollTop: el.scrollTop,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          lines,
          homeSites: document.querySelectorAll('#sites .tile').length,
          allSites: document.querySelectorAll('#sites-all .tile').length,
          moreText: more ? more.textContent : '',
          moreHidden: !more || more.hidden,
          openText: open ? open.textContent : '',
          spaceHidden: !!(mount && mount.hidden),
          overflowY: htmlCs.overflowY + '/' + bodyCs.overflowY,
          lblMax,
          lblTitle,
          has: document.getElementById('resume').dataset.has,
        };
      })()`);
    }

    async function wheelScrolls() {
      await evalJson(`window.scrollTo(0, 0)`);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 480, y: 140, button: 'none' });
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel', x: 480, y: 140, deltaX: 0, deltaY: 360, button: 'none',
      });
      let previous = null;
      let stable = 0;
      let top = 0;
      const start = Date.now();
      while (Date.now() - start < 1000) {
        top = await evalJson(`(document.scrollingElement || document.documentElement).scrollTop`);
        if (top === previous) {
          stable += 1;
          if (stable >= 2) return top;
        } else {
          stable = 0;
        }
        previous = top;
        await sleep(16);
      }
      return top;
    }

    async function shoot(name) {
      await evalJson(`if (document.activeElement && document.activeElement.blur) document.activeElement.blur()`);
      if (!shotDir) return;
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      try {
        fs.writeFileSync(path.join(shotDir, name), Buffer.from(shot.data, 'base64'));
      } catch (err) {
        console.log(`screenshot skipped: ${name} (${err && err.code ? err.code : err})`);
      }
    }

    const behavior = [];
    function check(name, ok, detail) {
      behavior.push({ name, ok: !!ok, detail: detail || '' });
      if (!ok) console.error(`FAIL ${name}: ${detail || ''}`);
    }

    await loadSeed(1440, 900, { todos: todoItems('1'), sites: siteItems(6, false) });
    let layout = await readLayout();
    check('day spatial off', layout.spaceHidden, JSON.stringify(layout.spaceHidden));
    check('boot does not clip the page', !/hidden/.test(layout.overflowY), layout.overflowY);
    check('one open todo says only 全部待办', layout.openText === '全部待办' && !layout.openText.includes('这是最后一条'), layout.openText);
    const bootTodo = await evalJson(`(() => {
      const act = document.getElementById('resume-act');
      const cs = getComputedStyle(act);
      return {
        active: document.activeElement === act,
        html: document.documentElement.hasAttribute('data-boot-focus'),
        inputMarked: document.getElementById('todo-input').hasAttribute('data-boot-focus'),
        outline: cs.outlineStyle,
      };
    })()`);
    check('boot marks html and focuses 完成', bootTodo.active && bootTodo.html && !bootTodo.inputMarked && bootTodo.outline === 'none', JSON.stringify(bootTodo));
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16, nativeVirtualKeyCode: 16,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16, nativeVirtualKeyCode: 16,
    });
    const afterKey = await evalJson(`(() => {
      const cleared = !document.documentElement.hasAttribute('data-boot-focus');
      document.documentElement.setAttribute('data-boot-focus', '');
      const act = document.getElementById('resume-act');
      act.blur();
      act.focus({ focusVisible: true });
      const suppressed = getComputedStyle(act).outlineStyle;
      document.documentElement.removeAttribute('data-boot-focus');
      act.blur();
      act.focus({ focusVisible: true });
      const cs = getComputedStyle(act);
      return {
        cleared,
        suppressed,
        outline: cs.outlineStyle,
        width: cs.outlineWidth,
        match: act.matches(':focus-visible'),
        stillClear: !document.documentElement.hasAttribute('data-boot-focus'),
      };
    })()`);
    check('first keydown clears html boot mark', afterKey.cleared && afterKey.stillClear, JSON.stringify(afterKey));
    check('boot mark suppresses 完成 focus ring', afterKey.suppressed === 'none', JSON.stringify(afterKey));
    check('keyboard focus rings 完成 after boot mark clears', afterKey.outline === 'solid' && parseFloat(afterKey.width) >= 2 && afterKey.match, JSON.stringify(afterKey));
    await shoot('day-1440x900.png');

    await loadSeed(1440, 900, { todos: [], sites: [] });
    const bootEmpty = await evalJson(`(() => {
      const el = document.getElementById('todo-input');
      el.style.transition = 'none';
      el.blur();
      const blurred = getComputedStyle(el).borderBottomColor;
      el.focus();
      const cs = getComputedStyle(el);
      return {
        active: document.activeElement === el,
        html: document.documentElement.hasAttribute('data-boot-focus'),
        inputMarked: el.hasAttribute('data-boot-focus'),
        outline: cs.outlineStyle,
        focusVisible: el.matches(':focus-visible'),
        underline: cs.borderBottomWidth === '2px',
        before: blurred,
        after: cs.borderBottomColor,
      };
    })()`);
    check('boot focuses the input with underline and no ring', bootEmpty.active && bootEmpty.html && !bootEmpty.inputMarked && bootEmpty.outline === 'none' && bootEmpty.underline, JSON.stringify(bootEmpty));
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 720, y: 280, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 720, y: 280, button: 'left', clickCount: 1 });
    const afterPointer = await evalJson(`(() => {
      const el = document.getElementById('todo-input');
      if (document.activeElement !== el) el.focus();
      const cs = getComputedStyle(el);
      return {
        html: document.documentElement.hasAttribute('data-boot-focus'),
        outline: cs.outlineStyle,
        match: el.matches(':focus-visible'),
        underline: cs.borderBottomWidth,
      };
    })()`);
    check('first pointerdown clears html boot mark', !afterPointer.html && afterPointer.underline === '2px' && afterPointer.outline === 'none', JSON.stringify(afterPointer));

    await loadSeed(1440, 900, {
      todos: todoItems('5'),
      sites: siteItems(16, false),
      storageDelay: 80,
    });
    layout = await readLayout();
    check('five open todos say 还有 4 条', layout.openText === '全部待办 · 还有 4 条' && !layout.openText.includes('这是最后一条'), layout.openText);
    check('home shows 8 of 16', layout.homeSites === 8 && layout.moreText === '全部 16 个' && !layout.moreHidden, JSON.stringify(layout));
    const note = await evalJson(`(() => {
      const ta = document.getElementById('notes');
      ta.focus();
      for (let i = 1; i <= 8; i += 1) {
        ta.value = i === 8 ? '最新一笔' : ('草稿' + i);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return true;
    })()`);
    assert.ok(note);
    const saved = await waitUntil(
      () => evalJson(`({
        status: document.getElementById('notes-saved').textContent,
        notes: window.__sopifyStore.notes,
        writes: window.__sopifyNoteWrites(),
        desk: (document.getElementById('desk3d-note-status') || {}).textContent || '',
      })`),
      (row) => row && row.writes === 2 && row.status === '已存在本机' && row.notes === '最新一笔',
      4000,
    );
    check('note status matches persisted text', saved.status === '已存在本机' && saved.notes === '最新一笔', JSON.stringify(saved));
    check('note writes coalesce to in-flight plus latest', saved.writes === 2, JSON.stringify(saved));

    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9,
    });
    const noteFocus = await evalJson(`(() => {
      const ta = document.getElementById('notes');
      ta.blur();
      ta.focus({ focusVisible: true });
      const cs = getComputedStyle(ta);
      return {
        outline: cs.outlineStyle,
        width: cs.outlineWidth,
        color: cs.outlineColor,
        match: ta.matches(':focus-visible'),
        active: document.activeElement === ta,
      };
    })()`);
    check('note focus-visible ring', noteFocus.outline === 'solid' && parseFloat(noteFocus.width) >= 2, JSON.stringify(noteFocus));

    const dialogFocus = await evalJson(`(() => {
      document.getElementById('todos-open').click();
      const input = document.getElementById('todo-input-dialog');
      const first = document.activeElement === input;
      const box = document.querySelector('#todos-dialog-list input[type="checkbox"]');
      const id = box.dataset.todoId;
      box.focus();
      box.checked = !box.checked;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      const now = document.activeElement;
      return {
        first,
        restored: !!(now && now.dataset && now.dataset.todoId === id),
        jumpedToInput: !!(now && now.id === 'todo-input-dialog'),
      };
    })()`);
    check('todos dialog first-open focuses the field', dialogFocus.first, JSON.stringify(dialogFocus));
    check('todos dialog refresh keeps the checkbox', dialogFocus.restored && !dialogFocus.jumpedToInput, JSON.stringify(dialogFocus));

    const closeFocus = await evalJson(`(() => {
      const dialog = document.getElementById('ops-todos-dialog');
      if (!dialog.open) document.getElementById('todos-open').click();
      dialog.close();
      return { open: dialog.open, has: document.getElementById('resume').dataset.has };
    })()`);
    const closeActive = await waitUntil(
      () => evalJson(`document.activeElement && document.activeElement.id`),
      (id) => id === 'resume-act',
      2000,
    );
    check('todos dialog close focuses 完成', !closeFocus.open && closeActive === 'resume-act' && closeFocus.has === '1', JSON.stringify({ ...closeFocus, active: closeActive }));
    await evalJson(`document.getElementById('todos-open').click()`);
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
    });
    await waitUntil(
      () => evalJson(`document.getElementById('ops-todos-dialog').open`),
      (open) => open === false,
      2000,
    );
    const escFocus = await evalJson(`(() => {
      const dialog = document.getElementById('ops-todos-dialog');
      return {
        open: dialog.open,
        active: document.activeElement && document.activeElement.id,
        body: document.activeElement === document.body,
      };
    })()`);
    check('Esc closes todos dialog onto 完成', !escFocus.open && escFocus.active === 'resume-act' && !escFocus.body, JSON.stringify(escFocus));
    await evalJson(`(() => {
      const dialog = document.getElementById('ops-todos-dialog');
      if (!dialog.open) document.getElementById('todos-open').click();
      dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    })()`);
    await waitUntil(
      () => evalJson(`document.getElementById('ops-todos-dialog').open`),
      (open) => open === false,
      2000,
    );
    const backdropFocus = await evalJson(`(() => {
      const dialog = document.getElementById('ops-todos-dialog');
      return {
        open: dialog.open,
        active: document.activeElement && document.activeElement.id,
        body: document.activeElement === document.body,
      };
    })()`);
    check('backdrop closes todos dialog onto 完成', !backdropFocus.open && backdropFocus.active === 'resume-act' && !backdropFocus.body, JSON.stringify(backdropFocus));

    const opened = await evalJson(`(() => {
      document.getElementById('sites-more').click();
      const dialog = document.getElementById('ops-sites-dialog');
      return { open: !!(dialog && dialog.open), all: document.querySelectorAll('#sites-all .tile').length };
    })()`);
    check('全部 N 个 opens the sites dialog', opened.open && opened.all === 16, JSON.stringify(opened));


    const nextSeed = {
      todos: [
        { id: 't1', text: '待办1', done: false },
        { id: 't2', text: '待办2', done: false },
        { id: 'done', text: '已完成', done: true },
        { id: 't3', text: '待办3', done: false },
      ],
      sites: [],
    };
    function nextButtonShown(id) {
      return `(() => {
        const el = document.querySelector('#todos-dialog-list [data-todo-next="${id}"]');
        if (!el) return { present: false };
        const cs = getComputedStyle(el);
        return { present: true, opacity: cs.opacity, pointer: cs.pointerEvents, text: el.textContent };
      })()`;
    }
    await loadSeed(1440, 900, nextSeed);
    await evalJson(`document.getElementById('todos-open').click()`);
    const nextButtons = await evalJson(`(() => {
      const rows = [...document.querySelectorAll('#todos-dialog-list .todo')].map((row) => ({
        id: (row.querySelector('[data-todo-id]') || {}).dataset ? row.querySelector('[data-todo-id]').dataset.todoId : '',
        text: row.querySelector('.todo-next') ? row.querySelector('.todo-next').textContent : '',
      }));
      return rows;
    })()`);
    check(
      '设为下一件 is on later open todos only',
      nextButtons.length === 4
        && nextButtons[0].id === 't1' && nextButtons[0].text === ''
        && nextButtons[1].id === 't2' && nextButtons[1].text === '设为下一件'
        && nextButtons[2].id === 'done' && nextButtons[2].text === ''
        && nextButtons[3].id === 't3' && nextButtons[3].text === '设为下一件',
      JSON.stringify(nextButtons),
    );
    const hiddenWide = await evalJson(nextButtonShown('t2'));
    check('wide screen hides 设为下一件 until the row is pointed at', hiddenWide.present && hiddenWide.opacity === '0' && hiddenWide.pointer === 'none', JSON.stringify(hiddenWide));
    await mouseMove('#todos-dialog-list .todo:nth-child(2)');
    const hovered = await evalJson(nextButtonShown('t2'));
    check('hover shows 设为下一件', hovered.opacity === '1' && hovered.pointer === 'auto', JSON.stringify(hovered));
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
    await evalJson(`document.activeElement && document.activeElement.blur()`);
    const afterLeave = await evalJson(nextButtonShown('t2'));
    check('leaving the row hides 设为下一件 again', afterLeave.opacity === '0' && afterLeave.pointer === 'none', JSON.stringify(afterLeave));
    await evalJson(`document.querySelector('#todos-dialog-list .todo:nth-child(2) input').focus()`);
    const focusedRow = await evalJson(nextButtonShown('t2'));
    check('row focus shows 设为下一件', focusedRow.opacity === '1' && focusedRow.pointer === 'auto', JSON.stringify(focusedRow));
    const promoted = await evalJson(`(async () => {
      document.querySelector('#todos-dialog-list [data-todo-next="t3"]').click();
      const start = Date.now();
      let snap = null;
      while (Date.now() - start < 3000) {
        const box = document.querySelector('#todos-dialog-list input[data-todo-id="t3"]');
        const toast = document.getElementById('toast');
        snap = {
          title: document.getElementById('resume-title').textContent,
          toast: toast.textContent,
          shown: toast.classList.contains('show'),
          focus: document.activeElement === box,
          ids: window.__sopifyStore.todos.map((item) => item.id),
          buttonGone: !document.querySelector('#todos-dialog-list [data-todo-next="t3"]'),
          t1Has: !!document.querySelector('#todos-dialog-list [data-todo-next="t1"]'),
        };
        if (snap.title === '待办3' && snap.shown && snap.toast === '已设为下一件' && snap.focus && snap.buttonGone && snap.t1Has) break;
        await new Promise((r) => setTimeout(r, 16));
      }
      return snap;
    })()`);
    check(
      '设为下一件 updates the first screen and keeps focus',
      promoted.title === '待办3'
        && promoted.toast === '已设为下一件'
        && promoted.shown
        && promoted.focus
        && promoted.buttonGone
        && promoted.t1Has
        && JSON.stringify(promoted.ids) === JSON.stringify(['t3', 't1', 't2', 'done']),
      JSON.stringify(promoted),
    );

    await loadSeed(560, 800, nextSeed);
    await evalJson(`document.getElementById('todos-open').click()`);
    const narrow = await evalJson(nextButtonShown('t3'));
    check('narrow screen always shows 设为下一件', narrow.present && narrow.opacity === '1' && narrow.pointer === 'auto', JSON.stringify(narrow));

    await loadSeed(1440, 900, nextSeed);
    const missingMove = await evalJson(`(async () => {
      document.getElementById('todos-open').click();
      window.__sopifyStore.todos = window.__sopifyStore.todos.filter((item) => item.id !== 't3');
      document.querySelector('#todos-dialog-list [data-todo-next="t3"]').click();
      const start = Date.now();
      let snap = null;
      while (Date.now() - start < 3000) {
        const err = document.getElementById('todo-dialog-save-error');
        snap = {
          text: err ? err.textContent : '',
          hidden: err ? err.hidden : true,
          ids: window.__sopifyStore.todos.map((item) => item.id),
          rowGone: !document.querySelector('#todos-dialog-list [data-todo-id="t3"]'),
          title: document.getElementById('resume-title').textContent,
        };
        if (snap.text === '这条已在另一页删掉了' && snap.rowGone && snap.title === '待办1') break;
        await new Promise((r) => setTimeout(r, 16));
      }
      return snap;
    })()`);
    check(
      'missing move says the other page deleted it',
      missingMove.text === '这条已在另一页删掉了' && !missingMove.hidden && missingMove.rowGone && missingMove.title === '待办1' && JSON.stringify(missingMove.ids) === JSON.stringify(['t1', 't2', 'done']),
      JSON.stringify(missingMove),
    );

    await loadSeed(1440, 900, Object.assign({ failTodos: true }, nextSeed));
    const failedMove = await evalJson(`(async () => {
      document.getElementById('todos-open').click();
      document.querySelector('#todos-dialog-list [data-todo-next="t3"]').click();
      const start = Date.now();
      let snap = null;
      while (Date.now() - start < 3000) {
        const err = document.getElementById('todo-dialog-save-error');
        snap = {
          text: err ? err.textContent : '',
          hidden: err ? err.hidden : true,
          ids: window.__sopifyStore.todos.map((item) => item.id),
          still: !!document.querySelector('#todos-dialog-list [data-todo-next="t3"]'),
        };
        if (snap.text === '没存上，再点一次') break;
        await new Promise((r) => setTimeout(r, 16));
      }
      return snap;
    })()`);
    check(
      'failed move says to click again',
      failedMove.text === '没存上，再点一次' && !failedMove.hidden && failedMove.still && JSON.stringify(failedMove.ids) === JSON.stringify(['t1', 't2', 'done', 't3']),
      JSON.stringify(failedMove),
    );

    await loadSeed(1440, 900, {
      todos: [
        { id: 't1', text: '待办1', done: false },
        { id: 't2', text: '待办2', done: false },
      ],
      sites: [],
    });
    const editEnter = await evalJson(`(async () => {
      document.getElementById('todos-open').click();
      const box = document.querySelector('#todos-dialog-list [data-todo-id="t1"]');
      const checked = box.checked;
      const text = document.querySelector('#todos-dialog-list [data-todo-text="t1"]');
      const label = box.closest('label');
      const split = {
        aria: box.getAttribute('aria-label'),
        textOutside: !label.contains(text),
        onlyCheckbox: label.querySelectorAll('input,button,.todo-text,.todo-edit').length === 1,
      };
      text.click();
      const input = document.querySelector('#todos-dialog-list .todo-edit');
      if (!input) return { missing: true, checked, split };
      const stillChecked = box.checked;
      input.value = '改过的第一件';
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      const composing = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true });
      const prevented = !input.dispatchEvent(composing);
      const during = {
        text: (window.__sopifyStore.todos.find((item) => item.id === 't1') || {}).text,
        editing: !!document.querySelector('#todos-dialog-list .todo-edit'),
        count: window.__sopifyStore.todos.length,
      };
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      const start = Date.now();
      let snap = null;
      while (Date.now() - start < 3000) {
        const row = window.__sopifyStore.todos.find((item) => item.id === 't1');
        const shown = document.querySelector('#todos-dialog-list [data-todo-text="t1"]');
        snap = {
          title: document.getElementById('resume-title').textContent,
          text: row && row.text,
          ids: window.__sopifyStore.todos.map((item) => item.id),
          count: window.__sopifyStore.todos.length,
          open: document.getElementById('ops-todos-dialog').open,
          editing: !!document.querySelector('#todos-dialog-list .todo-edit'),
          shown: shown ? shown.textContent : '',
          checked: box.checked,
        };
        if (snap.text === '改过的第一件' && snap.title === '改过的第一件' && !snap.editing && snap.shown === '改过的第一件') break;
        await new Promise((r) => setTimeout(r, 16));
      }
      return { prevented, during, stillChecked, checked, snap, split };
    })()`);
    check(
      'checkbox is the only control in the label',
      editEnter.split
        && editEnter.split.aria === '完成：待办1'
        && editEnter.split.textOutside
        && editEnter.split.onlyCheckbox
        && editEnter.stillChecked === false,
      JSON.stringify(editEnter.split),
    );
    check(
      'composition Enter does not rename a todo',
      editEnter.prevented === true
        && editEnter.during.text === '待办1'
        && editEnter.during.editing
        && editEnter.during.count === 2
        && editEnter.checked === false
        && editEnter.stillChecked === false,
      JSON.stringify(editEnter),
    );
    check(
      'Enter renames the first todo and the first screen',
      editEnter.snap
        && editEnter.snap.text === '改过的第一件'
        && editEnter.snap.title === '改过的第一件'
        && editEnter.snap.shown === '改过的第一件'
        && editEnter.snap.count === 2
        && editEnter.snap.open
        && !editEnter.snap.editing
        && JSON.stringify(editEnter.snap.ids) === JSON.stringify(['t1', 't2']),
      JSON.stringify(editEnter),
    );
    await evalJson(`(() => {
      document.querySelector('#todos-dialog-list [data-todo-text="t2"]').click();
      const input = document.querySelector('#todos-dialog-list .todo-edit');
      input.focus();
      input.value = '不该留下';
      return document.activeElement === input;
    })()`);
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
    });
    const editEsc = await evalJson(`(() => {
      const row = window.__sopifyStore.todos.find((item) => item.id === 't2');
      return {
        open: document.getElementById('ops-todos-dialog').open,
        editing: !!document.querySelector('#todos-dialog-list .todo-edit'),
        text: row && row.text,
        title: document.getElementById('resume-title').textContent,
        count: window.__sopifyStore.todos.length,
        ids: window.__sopifyStore.todos.map((item) => item.id),
      };
    })()`);
    check(
      'Escape cancels a todo rename and leaves the dialog open',
      editEsc.open && !editEsc.editing && editEsc.text === '待办2' && editEsc.title === '改过的第一件' && editEsc.count === 2 && JSON.stringify(editEsc.ids) === JSON.stringify(['t1', 't2']),
      JSON.stringify(editEsc),
    );
    const editEmpty = await evalJson(`(async () => {
      document.querySelector('#todos-dialog-list [data-todo-text="t2"]').click();
      const input = document.querySelector('#todos-dialog-list .todo-edit');
      input.value = '';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 40));
      const row = window.__sopifyStore.todos.find((item) => item.id === 't2');
      return {
        text: row && row.text,
        count: window.__sopifyStore.todos.length,
        ids: window.__sopifyStore.todos.map((item) => item.id),
        editing: !!document.querySelector('#todos-dialog-list .todo-edit'),
        open: document.getElementById('ops-todos-dialog').open,
      };
    })()`);
    check(
      'empty rename cancels instead of deleting',
      editEmpty.text === '待办2' && editEmpty.count === 2 && !editEmpty.editing && editEmpty.open && JSON.stringify(editEmpty.ids) === JSON.stringify(['t1', 't2']),
      JSON.stringify(editEmpty),
    );
    const editBlur = await evalJson(`(async () => {
      document.querySelector('#todos-dialog-list [data-todo-text="t2"]').click();
      const input = document.querySelector('#todos-dialog-list .todo-edit');
      input.value = '失焦也存';
      document.getElementById('todo-input-dialog').focus();
      const start = Date.now();
      let snap = null;
      while (Date.now() - start < 3000) {
        const row = window.__sopifyStore.todos.find((item) => item.id === 't2');
        snap = {
          text: row && row.text,
          title: document.getElementById('resume-title').textContent,
          ids: window.__sopifyStore.todos.map((item) => item.id),
          count: window.__sopifyStore.todos.length,
          editing: !!document.querySelector('#todos-dialog-list .todo-edit'),
          focus: document.activeElement && document.activeElement.id,
        };
        if (snap.text === '失焦也存' && !snap.editing) break;
        await new Promise((r) => setTimeout(r, 16));
      }
      return snap;
    })()`);
    check(
      'blur saves a later todo without changing the first screen',
      editBlur.text === '失焦也存'
        && editBlur.title === '改过的第一件'
        && !editBlur.editing
        && editBlur.count === 2
        && editBlur.focus === 'todo-input-dialog'
        && JSON.stringify(editBlur.ids) === JSON.stringify(['t1', 't2']),
      JSON.stringify(editBlur),
    );

    await loadSeed(1440, 900, {
      todos: [
        { id: 't1', text: '待办1', done: false },
        { id: 't2', text: '待办2', done: false },
      ],
      sites: [],
      failTodos: true,
    });
    const editFail = await evalJson(`(async () => {
      document.getElementById('todos-open').click();
      document.querySelector('#todos-dialog-list [data-todo-text="t1"]').click();
      const input = document.querySelector('#todos-dialog-list .todo-edit');
      input.value = '还没存上';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      const start = Date.now();
      let failed = null;
      while (Date.now() - start < 3000) {
        const err = document.getElementById('todo-dialog-save-error');
        const draft = document.querySelector('#todos-dialog-list .todo-edit');
        failed = {
          error: err ? err.textContent : '',
          hidden: err ? err.hidden : true,
          editing: !!draft,
          value: draft ? draft.value : '',
          text: (window.__sopifyStore.todos.find((item) => item.id === 't1') || {}).text,
          count: window.__sopifyStore.todos.length,
          ids: window.__sopifyStore.todos.map((item) => item.id),
        };
        if (failed.error === '没存上，再点一次' && failed.editing) break;
        await new Promise((r) => setTimeout(r, 16));
      }
      const draft = document.querySelector('#todos-dialog-list .todo-edit');
      document.getElementById('todo-input-dialog').focus();
      const blurWait = Date.now();
      let afterBlur = null;
      while (Date.now() - blurWait < 3000) {
        const err = document.getElementById('todo-dialog-save-error');
        const still = document.querySelector('#todos-dialog-list .todo-edit');
        afterBlur = {
          focus: document.activeElement && document.activeElement.id,
          editing: !!still,
          value: still ? still.value : '',
          text: (window.__sopifyStore.todos.find((item) => item.id === 't1') || {}).text,
          error: err ? err.textContent : '',
        };
        if (afterBlur.editing && afterBlur.focus === 'todo-input-dialog' && afterBlur.error === '没存上，再点一次') break;
        await new Promise((r) => setTimeout(r, 16));
      }
      await new Promise((r) => setTimeout(r, 80));
      window.__sopifySetFailTodos(false);
      const again = document.querySelector('#todos-dialog-list .todo-edit');
      again.focus();
      again.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      const wait = Date.now();
      let saved = null;
      while (Date.now() - wait < 3000) {
        const row = window.__sopifyStore.todos.find((item) => item.id === 't1');
        saved = {
          text: row && row.text,
          count: window.__sopifyStore.todos.length,
          ids: window.__sopifyStore.todos.map((item) => item.id),
          editing: !!document.querySelector('#todos-dialog-list .todo-edit'),
        };
        if (saved.text === '还没存上' && !saved.editing) break;
        await new Promise((r) => setTimeout(r, 16));
      }
      return { failed, afterBlur, saved };
    })()`);
    check(
      'a failed rename keeps the same draft',
      editFail.failed
        && editFail.failed.error === '没存上，再点一次'
        && editFail.failed.hidden === false
        && editFail.failed.editing
        && editFail.failed.value === '还没存上'
        && editFail.failed.text === '待办1'
        && editFail.failed.count === 2
        && JSON.stringify(editFail.failed.ids) === JSON.stringify(['t1', 't2'])
        && editFail.afterBlur.focus === 'todo-input-dialog'
        && editFail.afterBlur.editing
        && editFail.afterBlur.value === '还没存上'
        && editFail.afterBlur.text === '待办1'
        && editFail.saved.text === '还没存上'
        && editFail.saved.count === 2
        && !editFail.saved.editing
        && JSON.stringify(editFail.saved.ids) === JSON.stringify(['t1', 't2']),
      JSON.stringify(editFail),
    );

    await loadSeed(1440, 900, {
      todos: [
        { id: 't1', text: '待办1', done: false },
        { id: 't2', text: '待办2', done: false },
      ],
      sites: [],
      storageDelay: 250,
    });
    const delayedEdit = await evalJson(`(async () => {
      document.getElementById('todos-open').click();
      document.querySelector('#todos-dialog-list [data-todo-text="t1"]').click();
      const input = document.querySelector('#todos-dialog-list .todo-edit');
      input.value = '版本1';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      input.value = '版本2';
      const midWait = Date.now();
      let mid = null;
      while (Date.now() - midWait < 3000) {
        const row = window.__sopifyStore.todos.find((item) => item.id === 't1');
        const draft = document.querySelector('#todos-dialog-list .todo-edit');
        mid = {
          stored: row && row.text,
          value: draft ? draft.value : '',
          editing: !!draft,
          count: window.__sopifyStore.todos.length,
          ids: window.__sopifyStore.todos.map((item) => item.id),
        };
        if (mid.stored === '版本1') break;
        await new Promise((r) => setTimeout(r, 16));
      }
      const draft = document.querySelector('#todos-dialog-list .todo-edit');
      if (draft) {
        draft.focus();
        draft.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      }
      const endWait = Date.now();
      let saved = null;
      while (Date.now() - endWait < 3000) {
        const row = window.__sopifyStore.todos.find((item) => item.id === 't1');
        saved = {
          stored: row && row.text,
          editing: !!document.querySelector('#todos-dialog-list .todo-edit'),
          count: window.__sopifyStore.todos.length,
          ids: window.__sopifyStore.todos.map((item) => item.id),
        };
        if (saved.stored === '版本2' && !saved.editing) break;
        await new Promise((r) => setTimeout(r, 16));
      }
      return { mid, saved };
    })()`);
    check(
      'a late save ack keeps the newer draft',
      delayedEdit.mid
        && delayedEdit.mid.stored === '版本1'
        && delayedEdit.mid.value === '版本2'
        && delayedEdit.mid.editing
        && delayedEdit.mid.count === 2
        && JSON.stringify(delayedEdit.mid.ids) === JSON.stringify(['t1', 't2'])
        && delayedEdit.saved
        && delayedEdit.saved.stored === '版本2'
        && !delayedEdit.saved.editing
        && delayedEdit.saved.count === 2
        && JSON.stringify(delayedEdit.saved.ids) === JSON.stringify(['t1', 't2']),
      JSON.stringify(delayedEdit),
    );

    const longTodo = '一二三四五六七八九十一二三四五六七八九十多出来';
    const clipTodo = [...longTodo].slice(0, 20).join('');
    await loadSeed(1440, 900, {
      todos: [
        { id: 't1', text: longTodo, done: false },
        { id: 't2', text: '待办2', done: false },
      ],
      sites: [],
    });
    const completed = await evalJson(`(async () => {
      const beforeFocus = document.activeElement && document.activeElement.id;
      document.getElementById('resume-act').click();
      const start = Date.now();
      let snap = null;
      while (Date.now() - start < 3000) {
        const row = window.__sopifyStore.todos.find((item) => item.id === 't1');
        const action = document.getElementById('toast-action');
        const toast = document.getElementById('toast');
        snap = {
          done: !!(row && row.done),
          text: row && row.text,
          title: document.getElementById('resume-title').textContent,
          toast: toast.textContent,
          shown: toast.classList.contains('show'),
          action: action.textContent,
          actionHidden: action.hidden,
          focus: document.activeElement && document.activeElement.id,
          tabbable: action.tabIndex >= 0 && !action.disabled,
          separate: action !== document.getElementById('workset-retry-unopened'),
          ids: window.__sopifyStore.todos.map((item) => item.id),
          beforeFocus,
        };
        if (snap.done && snap.shown && snap.action === '撤销') break;
        await new Promise((r) => setTimeout(r, 16));
      }
      return snap;
    })()`);
    check(
      '完成 shows an undo toast and does not steal focus',
      completed.done
        && completed.text === longTodo
        && completed.title === '待办2'
        && completed.toast === `已完成「${clipTodo}」`
        && completed.shown
        && completed.action === '撤销'
        && !completed.actionHidden
        && completed.focus !== 'toast-action'
        && completed.tabbable
        && completed.separate
        && JSON.stringify(completed.ids) === JSON.stringify(['t1', 't2']),
      JSON.stringify(completed),
    );
    const undone = await evalJson(`(async () => {
      document.getElementById('todos-open').click();
      document.querySelector('#todos-dialog-list [data-todo-text="t1"]').click();
      const input = document.querySelector('#todos-dialog-list .todo-edit');
      input.value = '最新的字';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      const start = Date.now();
      while (Date.now() - start < 3000) {
        const row = window.__sopifyStore.todos.find((item) => item.id === 't1');
        if (row && row.text === '最新的字' && row.done && !document.querySelector('#todos-dialog-list .todo-edit')) break;
        await new Promise((r) => setTimeout(r, 16));
      }
      document.getElementById('ops-todos-dialog').close();
      document.getElementById('toast-action').click();
      const wait = Date.now();
      let snap = null;
      while (Date.now() - wait < 3000) {
        const row = window.__sopifyStore.todos.find((item) => item.id === 't1');
        const action = document.getElementById('toast-action');
        snap = {
          text: row && row.text,
          done: !!(row && row.done),
          title: document.getElementById('resume-title').textContent,
          actionHidden: action.hidden,
          ids: window.__sopifyStore.todos.map((item) => item.id),
          count: window.__sopifyStore.todos.length,
        };
        if (snap.text === '最新的字' && !snap.done && snap.title === '最新的字') break;
        await new Promise((r) => setTimeout(r, 16));
      }
      return snap;
    })()`);
    check(
      '撤销 uses the latest text and clears done',
      undone.text === '最新的字'
        && !undone.done
        && undone.title === '最新的字'
        && undone.actionHidden
        && undone.count === 2
        && JSON.stringify(undone.ids) === JSON.stringify(['t1', 't2']),
      JSON.stringify(undone),
    );
    const missingUndo = await evalJson(`(async () => {
      document.getElementById('resume-act').click();
      const start = Date.now();
      while (Date.now() - start < 3000) {
        const action = document.getElementById('toast-action');
        const row = window.__sopifyStore.todos.find((item) => item.id === 't1');
        if (row && row.done && action && !action.hidden && action.textContent === '撤销') break;
        await new Promise((r) => setTimeout(r, 16));
      }
      window.__sopifyStore.todos = window.__sopifyStore.todos.filter((item) => item.id !== 't1');
      document.getElementById('toast-action').click();
      const wait = Date.now();
      let snap = null;
      while (Date.now() - wait < 3000) {
        const action = document.getElementById('toast-action');
        const toast = document.getElementById('toast');
        snap = {
          toast: toast.textContent,
          shown: toast.classList.contains('show'),
          actionHidden: action.hidden,
          title: document.getElementById('resume-title').textContent,
          ids: window.__sopifyStore.todos.map((item) => item.id),
          gone: !window.__sopifyStore.todos.some((item) => item.id === 't1'),
        };
        if (snap.toast === '这条已经删掉了' && snap.gone && snap.title === '待办2') break;
        await new Promise((r) => setTimeout(r, 16));
      }
      return snap;
    })()`);
    check(
      'undo says the item was already deleted',
      missingUndo.toast === '这条已经删掉了'
        && missingUndo.shown
        && missingUndo.actionHidden
        && missingUndo.gone
        && missingUndo.title === '待办2'
        && JSON.stringify(missingUndo.ids) === JSON.stringify(['t2']),
      JSON.stringify(missingUndo),
    );
    const dialogDone = await evalJson(`(async () => {
      document.getElementById('todos-open').click();
      document.querySelector('#todos-dialog-list [data-todo-id="t2"]').click();
      const start = Date.now();
      let snap = null;
      while (Date.now() - start < 3000) {
        const row = window.__sopifyStore.todos.find((item) => item.id === 't2');
        const action = document.getElementById('toast-action');
        const toast = document.getElementById('toast');
        snap = {
          done: !!(row && row.done),
          actionHidden: action.hidden,
          action: action.textContent,
          toast: toast.textContent,
          title: document.getElementById('resume-title').textContent,
        };
        if (snap.done) break;
        await new Promise((r) => setTimeout(r, 16));
      }
      return snap;
    })()`);
    check(
      'dialog checkbox does not offer undo',
      dialogDone.done
        && dialogDone.actionHidden
        && dialogDone.action === ''
        && dialogDone.toast !== '已完成「待办2」'
        && dialogDone.title === '',
      JSON.stringify(dialogDone),
    );

    await loadSeed(1440, 900, { todos: [], sites: [] });
    const urlError = await evalJson(`(() => {
      document.getElementById('site-add-toggle').click();
      document.getElementById('site-name').value = '坏站';
      document.getElementById('site-url').value = 'ftp://example.com/x';
      document.getElementById('site-form').requestSubmit();
      const err = document.getElementById('site-url-error');
      const input = document.getElementById('site-url');
      const field = input.closest('.site-url-field');
      const inputBox = input.getBoundingClientRect();
      const errBox = err.getBoundingClientRect();
      return {
        text: err.textContent,
        hidden: err.hidden,
        invalid: input.getAttribute('aria-invalid'),
        described: input.getAttribute('aria-describedby'),
        focused: document.activeElement === input,
        toast: document.getElementById('toast').classList.contains('show'),
        beside: !!(field && errBox.left >= inputBox.left && errBox.top < inputBox.bottom + 8),
      };
    })()`);
    check('url error sits on the field', urlError.text === '网址需要是 http(s)' && !urlError.hidden && urlError.invalid === 'true' && urlError.described === 'site-url-error' && urlError.focused && !urlError.toast && urlError.beside, JSON.stringify(urlError));
    await shoot('site-url-error.png');
    const urlCleared = await evalJson(`(() => {
      const input = document.getElementById('site-url');
      const err = document.getElementById('site-url-error');
      input.value = 'https://example.com';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return { hidden: err.hidden, invalid: input.hasAttribute('aria-invalid') };
    })()`);
    check('url error clears on input', urlCleared.hidden && !urlCleared.invalid, JSON.stringify(urlCleared));

    await loadSeed(1440, 900, { todos: todoItems('1'), sites: [], failNotes: true });
    await evalJson(`(() => {
      const ta = document.getElementById('notes');
      ta.value = '写不进去';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    const failed = await waitUntil(
      () => evalJson(`({
        status: document.getElementById('notes-saved').textContent,
        notes: window.__sopifyStore.notes,
      })`),
      (row) => row && row.status === '没存上',
      3000,
    );
    check('failed write says 没存上', failed.status === '没存上' && failed.notes === '', JSON.stringify(failed));

    await loadSeed(1440, 900, {
      todos: [{ id: 'done-1', text: '已经做完', done: true }],
      sites: [],
    });
    const doneLabel = await evalJson(`document.getElementById('todos-open').textContent`);
    const doneHint = await evalJson(`document.getElementById('todo-hint').textContent`);
    const doneHistory = await evalJson(`document.getElementById('todos-done-history').textContent`);
    check('done-only todos say 已完成 1 件', doneLabel === '全部待办 · 已完成 1 件', doneLabel);
    check('done hint drops the finished count', doneHint === '想到下一件就写下来，按 回车', doneHint);
    check('done history button still counts', doneHistory === '查看已完成 1 件', doneHistory);
    await loadSeed(1440, 900, {
      todos: [
        { id: 'open-1', text: '还剩一件', done: false },
        { id: 'done-2', text: '已经做完', done: true },
        { id: 'done-3', text: '另一件也做完', done: true },
      ],
      sites: [],
    });
    const mixedLabel = await evalJson(`document.getElementById('todos-open').textContent`);
    check('one open plus done says 已完成', mixedLabel === '全部待办 · 已完成 2 件', mixedLabel);
    const lastClose = await evalJson(`(async () => {
      document.getElementById('todos-open').click();
      const box = document.querySelector('#todos-dialog-list input[type="checkbox"]:not(:checked)');
      const id = box.dataset.todoId;
      box.focus();
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      const after = document.activeElement;
      const kept = !!(after && after.dataset && after.dataset.todoId === id);
      const start = Date.now();
      while (Date.now() - start < 3000) {
        const row = window.__sopifyStore.todos.find((item) => item.id === id);
        const boxNow = document.querySelector('#todos-dialog-list input[data-todo-id="' + id + '"]');
        if (row && row.done && boxNow && boxNow.checked) break;
        await new Promise((r) => setTimeout(r, 16));
      }
      document.querySelector('#ops-todos-dialog [data-dialog-close]').click();
      const dialog = document.getElementById('ops-todos-dialog');
      const filled = document.querySelector('.next-filled');
      return {
        kept,
        open: dialog.open,
        has: document.getElementById('resume').dataset.has,
        openerHidden: getComputedStyle(filled).display === 'none',
        label: document.getElementById('todos-open').textContent,
      };
    })()`);
    const lastActive = await waitUntil(
      () => evalJson(`document.activeElement && document.activeElement.id`),
      (id) => id === 'todo-input',
      2000,
    );
    check('close after the last open todo focuses the input', lastClose.kept && !lastClose.open && lastClose.has === '0' && lastActive === 'todo-input' && lastClose.openerHidden && lastClose.label === '全部待办 · 已完成 3 件', JSON.stringify({ ...lastClose, active: lastActive }));
    await loadSeed(1366, 650, { todos: todoItems('5'), sites: siteItems(6, false) });
    await shoot('short-1366x650.png');

    const rows = [];
    const failures = [];
    for (const [width, height] of SIZES) {
      for (const kind of TODO_KINDS) {
        for (const count of SITE_COUNTS) {
          await loadSeed(width, height, { todos: todoItems(kind), sites: siteItems(count, false) });
          const box = await readLayout();
          const scrolled = await wheelScrolls();
          const pass = box.overflow <= 1 && scrolled === 0 && !/hidden/.test(box.overflowY) && box.spaceHidden;
          const sitesOk = count > 8
            ? box.homeSites === 8 && box.moreText === `全部 ${count} 个` && !box.moreHidden
            : box.homeSites === count && box.moreHidden;
          const label = `${width}×${height} 待办${kind} 站${count}`;
          rows.push({
            size: `${width}×${height}`,
            todos: kind,
            sites: count,
            overflow: box.overflow,
            wheel: scrolled,
            lines: box.lines,
            pass: pass && sitesOk,
            exception: false,
          });
          if (!pass || !sitesOk) failures.push(`${label} overflow=${box.overflow} wheel=${scrolled} sitesOk=${sitesOk} ${box.overflowY}`);
          const expectedOpen = kind === '5' ? '全部待办 · 还有 4 条' : '全部待办';
          if (box.openText !== expectedOpen || box.openText.includes('这是最后一条')) {
            failures.push(`${label} todos-open=${box.openText}`);
          }
        }
      }
    }

    await loadSeed(1366, 650, { todos: todoItems('long'), sites: siteItems(8, true) });
    const exception = await readLayout();
    const exceptionWheel = await wheelScrolls();
    rows.push({
      size: '1366×650',
      todos: '4行长标题',
      sites: '8超长站名',
      overflow: exception.overflow,
      wheel: exceptionWheel,
      lines: exception.lines,
      pass: null,
      exception: true,
      lblMax: exception.lblMax,
      lblTitle: exception.lblTitle,
    });
    if (exception.lines < 4) failures.push(`exception title rendered ${exception.lines} lines, expected 4`);
    if (!exception.lblMax) failures.push('exception label max-width is not 6em');
    if (exception.lblTitle !== `${LONG_SITE}1`) failures.push(`exception label title=${exception.lblTitle}`);
    if (exception.homeSites !== 8 || !exception.moreHidden) failures.push('exception should render all 8 sites without 全部');

    console.log('w13 fresh session: new Chrome process before 3a cases');
    const firstPid = chrome.pid;
    const firstPort = first.port;
    cdp.close();
    killChrome(chrome);
    const second = await openChrome();
    chrome = second.child;
    cdp = second.conn;
    version = second.versionInfo;
    let firstDead = false;
    try { process.kill(firstPid, 0); } catch { firstDead = true; }
    assert.notStrictEqual(second.child.pid, firstPid, 'second chrome reused the first pid');
    assert.notStrictEqual(second.port, firstPort, 'second chrome reused the first port');
    assert.ok(firstDead, 'first chrome was still running');
    console.log(`w13 second chrome pid ${second.child.pid} port ${second.port}`);
    scriptId = null;
    caseNo = 0;

    for (const [w, h] of [[1440, 900], [1280, 720], [900, 1000]]) {
      await loadSeed(w, h, { todos: todoItems('1'), sites: siteItems(2, false) });
      const edges = await evalJson(`(async () => {
        const leftOf = (sel) => {
          const el = document.querySelector(sel);
          return el ? Math.round(el.getBoundingClientRect().left * 10) / 10 : null;
        };
        const views = [
          ['desk', '.view.active h1', '.view.active .hero'],
          ['tabs', '#tabs-h', '.view.active .viewhead'],
          ['settings', '#settings-h', '.view.active .settings-name'],
        ];
        const rows = [];
        for (const [view, titleSel, firstSel] of views) {
          document.querySelector('.studio-navbtn[data-view="' + view + '"]').click();
          await new Promise((r) => setTimeout(r, 40));
          rows.push({
            view,
            brand: leftOf('.studio-brand'),
            title: leftOf(titleSel),
            first: leftOf(firstSel),
          });
        }
        document.querySelector('.studio-navbtn[data-view="desk"]').click();
        return rows;
      })()`);
      const brands = (edges || []).map((row) => row.brand);
      const sameBrand = brands.length === 3 && brands.every((n) => Math.abs(n - brands[0]) <= 1);
      const aligned = (edges || []).every((row) => Math.abs(row.brand - row.title) <= 1 && Math.abs(row.brand - row.first) <= 1);
      check(`brand left matches across views at ${w}x${h}`, sameBrand && aligned, JSON.stringify(edges));
    }

    const tabSeed = [
      { id: 1, title: 'tabs API', url: 'https://developer.chrome.com/docs/extensions/reference/tabs' },
      { id: 2, title: 'pulls', url: 'https://github.com/Li-Sanze/sopify-tab/pull/51' },
      { id: 3, title: 'desk', url: 'https://localhost:5173/desk' },
    ];
    await loadSeed(1440, 900, { todos: todoItems('1'), sites: [], tabs: tabSeed });
    await evalNow(`document.querySelector('.studio-navbtn[data-view="settings"]').click()`);
    const dayHeads = await evalNow(`(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--studio-ink)';
      document.body.appendChild(probe);
      const ink = getComputedStyle(probe).color;
      probe.remove();
      const heads = [...document.querySelectorAll('.view[data-view="settings"] .cardhead h2')].map((el) => {
        const cs = getComputedStyle(el);
        return { text: el.textContent.replace(/\\s+/g, ''), size: parseFloat(cs.fontSize), color: cs.color };
      });
      const cards = ['s-theme', 's-worksets', 's-experiment'].map((id) => {
        const el = document.getElementById(id).closest('section');
        const r = el.getBoundingClientRect();
        return { id, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left) };
      });
      const main = document.getElementById('main');
      main.focus();
      const outline = getComputedStyle(main).outlineStyle;
      return { ink, heads, cards, outline };
    })()`);
    const dayInk = dayHeads && dayHeads.heads.every((h) => h.size >= 14 && h.color === dayHeads.ink);
    check('settings headings use studio ink at 14px+', dayInk && dayHeads.heads.length === 3, JSON.stringify(dayHeads));
    const byId = dayHeads && Object.fromEntries(dayHeads.cards.map((card) => [card.id, card]));
    const stacked = byId && Math.abs(byId['s-theme'].left - byId['s-experiment'].left) <= 2
      && byId['s-experiment'].top > byId['s-theme'].bottom
      && byId['s-experiment'].top - byId['s-theme'].bottom < 48;
    const beside = byId && byId['s-worksets'].left > byId['s-theme'].left + 40
      && Math.abs(byId['s-worksets'].top - byId['s-theme'].top) <= 2;
    check('settings stacks appearance and experiment beside saved windows', stacked && beside, JSON.stringify(dayHeads && dayHeads.cards));
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 720, height: 1000, deviceScaleFactor: 1, mobile: false,
    });
    const narrowSettings = await evalNow(`(() => {
      return ['s-theme', 's-experiment', 's-worksets'].map((id) => {
        const r = document.getElementById(id).closest('section').getBoundingClientRect();
        return { id, top: Math.round(r.top), left: Math.round(r.left) };
      });
    })()`);
    const narrowLeft = narrowSettings && narrowSettings.every((card) => Math.abs(card.left - narrowSettings[0].left) <= 2);
    const narrowOrder = narrowSettings && narrowSettings[0].top < narrowSettings[1].top && narrowSettings[1].top < narrowSettings[2].top;
    check('settings is one column at 720', narrowLeft && narrowOrder, JSON.stringify(narrowSettings));
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    check('main focus has no outline', dayHeads && dayHeads.outline === 'none', JSON.stringify(dayHeads && dayHeads.outline));
    await evalNow(`document.querySelector('input[name="themePreset"][value="night"]').click()`);
    const nightHeads = await waitUntil(
      () => evalNow(`(() => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--studio-ink)';
        document.body.appendChild(probe);
        const ink = getComputedStyle(probe).color;
        probe.remove();
        const heads = [...document.querySelectorAll('.view[data-view="settings"] .cardhead h2')].map((el) => {
          const cs = getComputedStyle(el);
          return { size: parseFloat(cs.fontSize), color: cs.color, sky: document.documentElement.dataset.sky || '' };
        });
        return { ink, heads };
      })()`),
      (row) => row && row.heads.every((h) => h.sky === 'night' && h.size >= 14 && h.color === row.ink),
      2000,
    );
    check('settings headings stay studio ink at night', !!(nightHeads && nightHeads.heads && nightHeads.heads.length === 3), JSON.stringify(nightHeads));
    await evalNow(`document.querySelector('.studio-navbtn[data-view="desk"]').click()`);
    await mouseClick('#todos-open');
    const todoFocus = await waitUntil(
      () => evalNow(`(() => {
        const d = document.getElementById('ops-todos-dialog');
        const input = document.getElementById('todo-input-dialog');
        if (!d || !d.open || !input) return { open: !!(d && d.open) };
        input.focus({ focusVisible: true });
        const cs = getComputedStyle(input);
        return { open: true, outline: cs.outlineStyle, shadow: cs.boxShadow, border: cs.borderTopColor };
      })()`),
      (row) => row && row.open === true && row.outline === 'none' && typeof row.shadow === 'string' && row.shadow !== 'none' && row.shadow.includes('px'),
      2000,
    );
    check('todo dialog input has one focus ring', !!(todoFocus && todoFocus.outline === 'none' && todoFocus.shadow && todoFocus.shadow !== 'none'), JSON.stringify(todoFocus));
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
    });

    async function groupLayout() {
      return evalNow(`(() => {
        document.querySelector('.studio-navbtn[data-view="tabs"]').click();
        const groups = document.querySelector('.groups');
        const cols = getComputedStyle(groups).gridTemplateColumns.split(/\\s+/).filter(Boolean);
        const b = document.querySelector('.grouphead b');
        const count = document.querySelector('.grouphead .count');
        const cs = getComputedStyle(b);
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:' + cs.font;
        probe.textContent = (b.textContent || '').slice(0, 16);
        document.body.appendChild(probe);
        const need = probe.getBoundingClientRect().width;
        probe.remove();
        const inkProbe = document.createElement('span');
        inkProbe.style.color = 'var(--studio-ink)';
        document.body.appendChild(inkProbe);
        const ink = getComputedStyle(inkProbe).color;
        inkProbe.remove();
        const countCs = getComputedStyle(count);
        return {
          cols: cols.length,
          domain: b.textContent,
          size: parseFloat(cs.fontSize),
          color: cs.color,
          ink,
          width: b.getBoundingClientRect().width,
          need,
          flexGrow: countCs.flexGrow,
          flexShrink: countCs.flexShrink,
        };
      })()`);
    }
    const wideGroups = await groupLayout();
    check('current tabs are 3 columns at 1440 and titles are ink', wideGroups && wideGroups.cols === 3 && wideGroups.size >= 14 && wideGroups.color === wideGroups.ink && wideGroups.flexShrink === '0', JSON.stringify(wideGroups));
    await loadSeed(900, 1000, { todos: [], sites: [], tabs: tabSeed });
    const narrowGroups = await groupLayout();
    check('current tabs are 2 columns at 900 and the domain shows 16 characters', narrowGroups && narrowGroups.cols === 2 && narrowGroups.size >= 14 && narrowGroups.color === narrowGroups.ink && narrowGroups.width + 1 >= narrowGroups.need && narrowGroups.flexShrink === '0', JSON.stringify(narrowGroups));

    await loadSeed(1440, 900, {
      todos: [],
      sites: [],
      worksets: [{
        id: 'keep',
        name: '留下的窗口',
        savedAt: 1,
        tabs: [{ title: 'a', url: 'https://a.example/' }],
      }],
    });
    await evalJson(`document.querySelector('.studio-navbtn[data-view="settings"]').click()`);
    const listed = await waitUntil(
      () => evalJson(`document.querySelectorAll('#saved-worksets .savedset').length`),
      (n) => n === 1,
      3000,
    );
    check('clear fixture lists the saved window', listed === 1, String(listed));
    await mouseClick('#worksets-clear');
    const confirmOpened = await waitUntil(
      () => evalNow(readConfirmExpr()),
      (row) => row && row.open === true,
      2000,
    );
    check('clear opens the in-page confirm', confirmOpened && confirmOpened.open === true && confirmOpened.title === '清空全部存下的窗口？' && confirmOpened.body === '只影响这台电脑，清空后找不回来。' && confirmOpened.ok === '清空' && confirmOpened.danger === true && confirmOpened.focus === 'ops-confirm-cancel', JSON.stringify(confirmOpened));
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
    });
    const afterEsc = await waitUntil(
      () => evalNow(`({
        open: document.getElementById('ops-confirm-dialog').open,
        stored: window.__sopifyStore.worksets.length,
        rows: document.querySelectorAll('#saved-worksets .savedset').length,
      })`),
      (row) => row && row.open === false,
      2000,
    );
    check('clear Esc does not delete', confirmOpened && confirmOpened.open === true && afterEsc && afterEsc.open === false && afterEsc.stored === 1 && afterEsc.rows === 1, JSON.stringify(afterEsc));
    await sleep(50);
    await mouseClick('#worksets-clear');
    const reopened = await waitUntil(
      () => evalNow(`document.getElementById('ops-confirm-dialog').open`),
      (open) => open === true,
      2000,
    );
    await mouseClick('#ops-confirm-ok');
    const cleared = await waitUntil(
      () => evalNow(`({
        open: document.getElementById('ops-confirm-dialog').open,
        stored: window.__sopifyStore.worksets.length,
        text: document.getElementById('saved-worksets').textContent,
      })`),
      (row) => row && row.open === false && row.stored === 0,
      2000,
    );
    check('clear confirm empties the list', reopened === true && cleared && cleared.open === false && cleared.stored === 0 && cleared.text.includes('还没有存下的窗口'), JSON.stringify({ reopened, cleared }));
    const desk3dNet = await evalJson(`performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /embed\\.js|scene\\.js|three\\.module/.test(n))`);
    check('space view off skips desk-3d payload', Array.isArray(desk3dNet) && desk3dNet.length === 0, JSON.stringify(desk3dNet));

    console.log('size\ttodos\tsites\toverflow_px\twheel_scrollTop\tlines\tresult');
    for (const row of rows) {
      const result = row.exception ? 'exception-case' : (row.pass ? 'pass' : 'FAIL');
      console.log(`${row.size}\t${row.todos}\t${row.sites}\t${row.overflow}\t${row.wheel}\t${row.lines}\t${result}`);
    }
    if (shotDir) {
      const matrixPath = path.join(shotDir, 'matrix.json');
      try {
        fs.writeFileSync(matrixPath, JSON.stringify({ behavior, rows, version: version.Browser || '' }, null, 2));
        console.log(`matrix ${matrixPath}`);
      } catch (err) {
        console.log(`matrix skipped: ${err && err.code ? err.code : err}`);
      }
    } else {
      console.log('matrix skipped: no writable artifact dir');
    }
    const behaviorFails = [];
    for (const item of behavior) {
      if (!item.ok) behaviorFails.push(`behavior ${item.name}: ${item.detail}`);
    }
    const matrixFails = failures.slice();
    console.log(`test-w13-firstscreen behavior: ${behaviorFails.length ? 'FAIL' : 'ok'}`);
    console.log(`test-w13-firstscreen matrix: ${matrixFails.length ? 'FAIL' : 'ok'}`);
    if (behaviorFails.length || matrixFails.length) {
      throw new Error([...behaviorFails, ...matrixFails].join('\n'));
    }
    console.log('test-w13-firstscreen: ok');
    stopWatchdog();
  } catch (err) {
    if (chromeLog) console.error(chromeLog.slice(-2000));
    throw err;
  } finally {
    if (cdp) cdp.close();
    killChrome(chrome);
    server.close();
    cleanupBrowser();
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
