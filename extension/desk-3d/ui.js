/**
 * Native DOM panels for desk-3d worksets / notes.
 * Real data only via host callbacks injected from newtab.js.
 * No demo catalog. No extension storage or tab APIs here.
 */

import { NOTE_ID } from './data.js';

export class DeskUI {
  /**
   * @param {{
   *   resumeSelector?: string,
   *   root?: ParentNode,
   *   getWorksets?: () => Array<{ id: string, name: string, savedAt?: number, tabs?: Array<{ title: string, url: string }> }>,
   *   getNote?: () => string,
   *   saveNote?: (text: string) => void,
   *   restoreWorkset?: (id: string) => void,
   * }} [opts]
   */
  constructor(opts) {
    const options = opts || {};
    this.resumeSelector = options.resumeSelector || '#resume';
    this.root = options.root || document;
    this.host = {
      getWorksets: typeof options.getWorksets === 'function' ? options.getWorksets : null,
      getNote: typeof options.getNote === 'function' ? options.getNote : null,
      saveNote: typeof options.saveNote === 'function' ? options.saveNote : null,
      restoreWorkset: typeof options.restoreWorkset === 'function' ? options.restoreWorkset : null,
    };

    this.panelWorkset = document.getElementById('desk3d-panel-workset');
    this.panelNote = document.getElementById('desk3d-panel-note');
    this.worksetName = document.getElementById('desk3d-workset-name');
    this.worksetPages = document.getElementById('desk3d-workset-pages');
    this.restoreBtn = document.getElementById('desk3d-btn-restore');
    this.restoreMsg = document.getElementById('desk3d-restore-msg');
    this.noteEditor = document.getElementById('desk3d-note-editor');
    this.todoList = document.getElementById('desk3d-todo-list');
    this.fallback = document.getElementById('desk3d-fallback');
    this.banner = document.getElementById('desk3d-banner');
    this.view = document.getElementById('desk3d-view');
    this.surface = document.getElementById('desk3d-fallback-surface');
    this.railEntries = document.getElementById('desk3d-rail-entries');

    /** @type {HTMLElement | null} */
    this._returnFocus = null;
    /** @type {string | null} */
    this._activeWorksetId = null;

    this._bindPanels();
    this._bindEntries();
    this.syncFromHost();
    this._renderTodoAnchor();
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
    if (this.panelWorkset) {
      this.panelWorkset.addEventListener('close', () => this._onPanelClosed());
    }
    if (this.panelNote) {
      this.panelNote.addEventListener('close', () => {
        this._persistNote();
        this._onPanelClosed();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.panelWorkset && this.panelWorkset.open) {
        e.preventDefault();
        this.panelWorkset.close();
      } else if (this.panelNote && this.panelNote.open) {
        e.preventDefault();
        this.panelNote.close();
      }
    });

    if (this.restoreBtn) {
      this.restoreBtn.hidden = !this.host.restoreWorkset;
      this.restoreBtn.addEventListener('click', () => {
        if (!this._activeWorksetId || !this.host.restoreWorkset) return;
        this.host.restoreWorkset(this._activeWorksetId);
      });
    }

    if (this.noteEditor) {
      this.noteEditor.addEventListener('input', () => this._persistNote());
    }
  }

  _bindEntries() {
    const onClick = (el, kind) => {
      this._returnFocus = /** @type {HTMLElement} */ (el);
      if (kind === 'workset') this.openWorkset(el.getAttribute('data-desk3d-workset'));
      else this.openNote();
    };
    const root = this.root instanceof Element || this.root === document ? this.root : document;
    root.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const ws = target.closest && target.closest('[data-desk3d-workset]');
      const note = target.closest && target.closest('[data-desk3d-note]');
      if (ws) onClick(ws, 'workset');
      else if (note) onClick(note, 'note');
    });
  }

  /** 3D pick — same handlers as the DOM rail / static desk. */
  openFromScene(id, kind) {
    const twin =
      kind === 'workset'
        ? this.root.querySelector(`.desk3d-rail-btn[data-desk3d-workset="${cssAttr(id)}"]`)
        : this.root.querySelector(`.desk3d-rail-btn[data-desk3d-note]`);
    this._returnFocus = /** @type {HTMLElement} */ (twin || this.view);
    if (kind === 'workset') this.openWorkset(id);
    else if (kind === 'note') this.openNote();
  }

  readCatalog() {
    const worksets = this.host.getWorksets ? this.host.getWorksets() : [];
    const list = Array.isArray(worksets) ? worksets.filter((w) => w && typeof w.id === 'string' && w.id) : [];
    const noteText = this.host.getNote ? String(this.host.getNote() || '') : '';
    return {
      worksets: list,
      noteText,
      noteLabel: noteOneLiner(noteText) || '便签',
    };
  }

  syncFromHost() {
    const catalog = this.readCatalog();
    this._renderEntries(catalog);
    if (this.panelNote && this.panelNote.open && this.noteEditor && this.noteEditor !== document.activeElement) {
      this.noteEditor.value = catalog.noteText;
    }
    if (this.panelWorkset && this.panelWorkset.open && this._activeWorksetId) {
      this._fillWorkset(this._activeWorksetId, false);
    }
    return catalog;
  }

  _renderEntries(catalog) {
    const data = catalog || this.readCatalog();
    if (this.surface) {
      this.surface.innerHTML = '';
      if (!data.worksets.length) {
        const empty = document.createElement('p');
        empty.className = 'desk3d-empty';
        empty.textContent = '还没有保存的工作集。';
        this.surface.appendChild(empty);
      }
      data.worksets.forEach((w, i) => {
        this.surface.appendChild(chipButton('workset', w.id, w.name || '工作集', i));
      });
      this.surface.appendChild(chipButton('note', NOTE_ID, data.noteLabel, 0));
    }
    if (this.railEntries) {
      this.railEntries.innerHTML = '';
      if (!data.worksets.length) {
        const empty = document.createElement('p');
        empty.className = 'desk3d-empty';
        empty.textContent = '还没有保存的工作集。';
        this.railEntries.appendChild(empty);
      }
      data.worksets.forEach((w) => {
        this.railEntries.appendChild(railButton('workset', w.id, `打开：${w.name || '工作集'}`));
      });
      this.railEntries.appendChild(railButton('note', NOTE_ID, '编辑：便签'));
    }
  }

  openWorkset(id) {
    if (!this.panelWorkset) return;
    if (!this._fillWorkset(id, true)) return;
    if (this.panelNote && this.panelNote.open) this.panelNote.close();
    if (!this.panelWorkset.open) this.panelWorkset.showModal();
    if (this.restoreBtn && !this.restoreBtn.hidden) this.restoreBtn.focus();
  }

  /**
   * @param {string} id
   * @param {boolean} resetStatus
   */
  _fillWorkset(id, resetStatus) {
    const catalog = this.readCatalog();
    const data = catalog.worksets.find((w) => w.id === id);
    if (!data) return false;
    this._activeWorksetId = id;
    if (resetStatus && this.restoreMsg) {
      this.restoreMsg.hidden = true;
      this.restoreMsg.textContent = '';
    }
    if (this.worksetName) this.worksetName.textContent = data.name || '工作集';
    if (this.worksetPages) {
      this.worksetPages.innerHTML = '';
      const pages = Array.isArray(data.tabs) ? data.tabs : [];
      if (!pages.length) {
        const li = document.createElement('li');
        li.className = 'desk3d-empty';
        li.textContent = '这个工作集没有网页。';
        this.worksetPages.appendChild(li);
      } else {
        for (const p of pages) {
          const li = document.createElement('li');
          li.innerHTML = `<span>${escapeHtml(p.title || p.url || '')}</span><span class="url">${escapeHtml(p.url || '')}</span>`;
          this.worksetPages.appendChild(li);
        }
      }
    }
    return true;
  }

  openNote() {
    if (!this.panelNote || !this.noteEditor) return;
    this.noteEditor.value = this.host.getNote ? String(this.host.getNote() || '') : '';
    if (this.panelWorkset && this.panelWorkset.open) this.panelWorkset.close();
    if (!this.panelNote.open) this.panelNote.showModal();
    this.noteEditor.focus();
  }

  _persistNote() {
    if (!this.noteEditor || !this.host.saveNote) return;
    this.host.saveNote(this.noteEditor.value);
  }

  _onPanelClosed() {
    const el = this._returnFocus;
    this._returnFocus = null;
    requestAnimationFrame(() => {
      if (el && typeof el.focus === 'function') el.focus();
    });
  }

  /** Prototype-only empty slot. NTP uses real #resume and never routes todos through 3D. */
  _renderTodoAnchor() {
    if (!this.todoList) return;
    this.todoList.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'desk3d-empty';
    li.textContent = '还没有下一件事。主路径在 newtab 的真实待办。';
    this.todoList.appendChild(li);
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

export function noteOneLiner(notes) {
  const line = String(notes || '').split(/\r?\n/).map((s) => s.trim()).find(Boolean);
  return line || '';
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cssAttr(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function chipButton(kind, id, label, index) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = kind === 'note' ? 'desk3d-chip note' : `desk3d-chip folder tone-${index % 5}`;
  if (kind === 'note') btn.setAttribute('data-desk3d-note', id);
  else btn.setAttribute('data-desk3d-workset', id);
  btn.textContent = label;
  return btn;
}

function railButton(kind, id, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = kind === 'note' ? 'desk3d-rail-btn note' : 'desk3d-rail-btn';
  if (kind === 'note') btn.setAttribute('data-desk3d-note', id);
  else btn.setAttribute('data-desk3d-workset', id);
  btn.textContent = label;
  return btn;
}
