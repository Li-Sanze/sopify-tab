/**
 * Native DOM panels for desk-3d worksets / notes.
 * Session-only note storage. Esc closes; focus returns to trigger.
 * Never writes chrome.storage or touches chrome.tabs.
 */

import { WORKSETS, NOTE_LABELS, DEMO_TODOS, DEFAULT_NOTES, NOTE_SESSION_KEY } from './data.js';

export class DeskUI {
  /**
   * @param {{ resumeSelector?: string, root?: ParentNode }} [opts]
   */
  constructor(opts) {
    const options = opts || {};
    this.resumeSelector = options.resumeSelector || '#resume';
    this.root = options.root || document;

    this.panelWorkset = document.getElementById('desk3d-panel-workset');
    this.panelNote = document.getElementById('desk3d-panel-note');
    this.worksetName = document.getElementById('desk3d-workset-name');
    this.worksetPages = document.getElementById('desk3d-workset-pages');
    this.restoreBtn = document.getElementById('desk3d-btn-simulate-restore');
    this.restoreMsg = document.getElementById('desk3d-restore-msg');
    this.noteEditor = document.getElementById('desk3d-note-editor');
    this.todoList = document.getElementById('desk3d-todo-list');
    this.fallback = document.getElementById('desk3d-fallback');
    this.banner = document.getElementById('desk3d-banner');
    this.view = document.getElementById('desk3d-view');

    /** @type {HTMLElement | null} */
    this._returnFocus = null;
    /** @type {string | null} */
    this._activeNoteId = null;
    this._notes = this._loadNotes();
    this._todoDone = new Set();

    this._bindPanels();
    this._bindRails();
    this.renderTodos();
    this._observeResumeHeight();
  }

  /**
   * Keep --next-h / --resume-bottom in sync so panels cannot cover 下一件事.
   * On NTP this is #resume; standalone prototype may use #next-thing.
   */
  _observeResumeHeight() {
    const el = document.querySelector(this.resumeSelector);
    if (!el) return;
    const apply = () => {
      const box = el.getBoundingClientRect();
      const h = Math.ceil(box.height);
      const bottom = Math.ceil(box.bottom);
      document.documentElement.style.setProperty('--next-h', `${h}px`);
      document.documentElement.style.setProperty('--resume-bottom', `${bottom}px`);
    };
    apply();
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => apply());
      ro.observe(el);
    }
    document.addEventListener('scroll', apply, { capture: true, passive: true });
  }

  _bindPanels() {
    if (!this.panelWorkset || !this.panelNote || !this.restoreBtn || !this.noteEditor) return;

    this.panelWorkset.addEventListener('close', () => this._onPanelClosed());
    this.panelNote.addEventListener('close', () => {
      this._persistActiveNote();
      this._onPanelClosed();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.panelWorkset.open) {
        e.preventDefault();
        this.panelWorkset.close();
      } else if (this.panelNote.open) {
        e.preventDefault();
        this.panelNote.close();
      }
    });

    this.restoreBtn.addEventListener('click', () => {
      this.restoreMsg.hidden = false;
      this.restoreMsg.textContent =
        '已模拟恢复（演示）：不会打开真实标签页，也不会调用浏览器扩展 API。';
    });

    this.noteEditor.addEventListener('input', () => this._persistActiveNote());
  }

  _bindRails() {
    document.querySelectorAll('[data-desk3d-workset]').forEach((el) => {
      el.addEventListener('click', () => {
        this._returnFocus = /** @type {HTMLElement} */ (el);
        this.openWorkset(el.getAttribute('data-desk3d-workset'));
      });
    });
    document.querySelectorAll('[data-desk3d-note]').forEach((el) => {
      el.addEventListener('click', () => {
        this._returnFocus = /** @type {HTMLElement} */ (el);
        this.openNote(el.getAttribute('data-desk3d-note'));
      });
    });
  }

  /** 3D pick — same handlers as the DOM rail / static desk. */
  openFromScene(id, kind) {
    const twin =
      kind === 'workset'
        ? document.querySelector(`.desk3d-rail-btn[data-desk3d-workset="${id}"]`)
        : document.querySelector(`.desk3d-rail-btn[data-desk3d-note="${id}"]`);
    this._returnFocus = /** @type {HTMLElement} */ (twin || this.view);
    if (kind === 'workset') this.openWorkset(id);
    else if (kind === 'note') this.openNote(id);
  }

  openWorkset(id) {
    const data = WORKSETS[id];
    if (!data || !this.panelWorkset) return;
    this.restoreMsg.hidden = true;
    this.restoreMsg.textContent = '';
    this.worksetName.textContent = data.name;
    this.worksetPages.innerHTML = '';
    for (const p of data.pages) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(p.title)}</span><span class="url">${escapeHtml(p.url)}</span>`;
      this.worksetPages.appendChild(li);
    }
    if (this.panelNote.open) this.panelNote.close();
    if (!this.panelWorkset.open) this.panelWorkset.showModal();
    this.restoreBtn.focus();
  }

  openNote(id) {
    if (!this.panelNote || !this.noteEditor) return;
    this._activeNoteId = id;
    const titleEl = document.getElementById('desk3d-note-title');
    if (titleEl) titleEl.textContent = NOTE_LABELS[id] || '便签';
    this.noteEditor.value = this._notes[id] || '';
    if (this.panelWorkset.open) this.panelWorkset.close();
    if (!this.panelNote.open) this.panelNote.showModal();
    this.noteEditor.focus();
  }

  _persistActiveNote() {
    if (!this._activeNoteId || !this.noteEditor) return;
    this._notes[this._activeNoteId] = this.noteEditor.value;
    try {
      sessionStorage.setItem(NOTE_SESSION_KEY, JSON.stringify(this._notes));
    } catch {
      /* private mode etc. */
    }
  }

  _loadNotes() {
    try {
      const raw = sessionStorage.getItem(NOTE_SESSION_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_NOTES };
  }

  _onPanelClosed() {
    const el = this._returnFocus;
    this._returnFocus = null;
    requestAnimationFrame(() => {
      if (el && typeof el.focus === 'function') el.focus();
    });
  }

  /** Prototype-only. NTP uses the real #resume strip and never routes it through 3D. */
  renderTodos() {
    if (!this.todoList) return;
    this.todoList.innerHTML = '';
    for (const t of DEMO_TODOS) {
      const li = document.createElement('li');
      const done = this._todoDone.has(t.id);
      if (done) li.classList.add('done');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'desk3d-done-btn';
      btn.textContent = done ? '已完成' : '完成';
      btn.disabled = done;
      btn.setAttribute('aria-label', done ? `已完成：${t.text}` : `完成：${t.text}`);
      btn.addEventListener('click', () => {
        this._todoDone.add(t.id);
        this.renderTodos();
      });
      const span = document.createElement('span');
      span.textContent = t.text;
      li.append(btn, span);
      this.todoList.appendChild(li);
    }
  }

  showFallback(reason) {
    if (this.fallback) this.fallback.hidden = false;
    if (reason) this.setBanner(reason);
  }

  hideFallback() {
    if (this.fallback) this.fallback.hidden = true;
    this.setBanner('');
  }

  setBanner(text) {
    if (!this.banner) return;
    if (!text) {
      this.banner.hidden = true;
      this.banner.textContent = '';
      return;
    }
    this.banner.hidden = false;
    this.banner.textContent = text;
  }
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
