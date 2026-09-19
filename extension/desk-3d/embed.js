/**
 * Embed desk-3d into a mount node (newtab stage or standalone prototype).
 * Lazy-inits WebGL only when 「有 3D」 is on and the stage is visible.
 * Real desk data arrives only via callbacks from newtab.js.
 */

import { DeskScene } from './scene.js';
import { DeskUI } from './ui.js';
import { stageInnerHTML, panelsInnerHTML } from './markup.js';

function ensureCanvas(view) {
  let canvas = view.querySelector('#desk3d-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'desk3d-canvas';
    canvas.setAttribute('aria-label', '固定视角工作桌');
    canvas.tabIndex = -1;
    view.appendChild(canvas);
  }
  return canvas;
}

function ensurePanels() {
  if (document.getElementById('desk3d-panel-workset')) return;
  const wrap = document.createElement('div');
  wrap.id = 'desk3d-panels';
  wrap.innerHTML = panelsInnerHTML();
  document.body.appendChild(wrap);
}

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function forceFailRequested(opts) {
  if (opts && opts.forceFail) return true;
  try {
    return new URLSearchParams(location.search).get('desk3d') === 'fail';
  } catch {
    return false;
  }
}

/**
 * @param {HTMLElement} mount
 * @param {{
 *   resumeSelector?: string,
 *   forceFail?: boolean,
 *   defaultWant3d?: boolean,
 *   getWorksets?: Function,
 *   getNote?: Function,
 *   saveNote?: Function,
 *   restoreWorkset?: Function,
 *   subscribe?: (fn: Function) => (Function|void),
 * }} [opts]
 */
export function mountDesk3d(mount, opts) {
  const options = opts || {};
  const resumeSelector = options.resumeSelector || '#resume';
  const reducedMotion = prefersReducedMotion();
  const forceFail = forceFailRequested(options);
  const defaultWant3d = options.defaultWant3d !== false;

  mount.innerHTML = stageInnerHTML();
  mount.dataset.desk3dMode = 'dom';
  ensurePanels();

  const ui = new DeskUI({
    resumeSelector,
    root: mount,
    getWorksets: options.getWorksets,
    getNote: options.getNote,
    saveNote: options.saveNote,
    restoreWorkset: options.restoreWorkset,
  });
  const toggle = mount.querySelector('#desk3d-toggle');
  const view = mount.querySelector('#desk3d-view');
  if (!toggle || !view) return { ui, scene: null };

  /** @type {DeskScene | null} */
  let scene = null;
  let inited = false;
  let visible = false;
  let want3d = defaultWant3d;
  /** @type {string} */
  let failReason = '';
  toggle.checked = want3d && !failReason;

  function catalogForScene() {
    const data = ui.readCatalog();
    return {
      worksets: data.worksets.map((w) => ({ id: w.id, name: w.name })),
      noteLabel: data.noteLabel,
    };
  }

  function syncScene() {
    const catalog = ui.syncFromHost();
    if (scene) {
      scene.setCatalog({
        worksets: catalog.worksets.map((w) => ({ id: w.id, name: w.name })),
        noteLabel: catalog.noteLabel,
      });
    }
  }

  function markUnavailable(reason) {
    failReason = reason;
    want3d = false;
    toggle.checked = false;
    mount.dataset.desk3dMode = 'dom';
    if (scene) {
      scene.dispose();
      scene = null;
    }
    inited = false;
    ui.showFallback(reason);
  }

  function applyMode() {
    if (failReason) {
      mount.dataset.desk3dMode = 'dom';
      if (scene) scene.setEnabled(false);
      ui.showFallback(failReason);
      return;
    }

    if (!want3d) {
      mount.dataset.desk3dMode = 'dom';
      if (scene) scene.setEnabled(false);
      ui.showFallback('已关闭 3D：使用静态 DOM 桌面（与 3D 同一交互路径）。');
      return;
    }

    if (!visible || document.visibilityState === 'hidden') {
      mount.dataset.desk3dMode = 'dom';
      if (scene) scene.setEnabled(false);
      ui.showFallback('');
      ui.setBanner('');
      return;
    }

    if (!inited) {
      if (forceFail) {
        markUnavailable('WebGL 不可用：已切换为静态 DOM 桌面，全部交互仍可用。');
        return;
      }
      const canvas = ensureCanvas(view);
      scene = new DeskScene(canvas, {
        reducedMotion,
        onPick: (id, kind) => ui.openFromScene(id, kind),
        catalog: catalogForScene(),
      });
      const ok = scene.init();
      inited = true;
      if (!ok) {
        markUnavailable('WebGL 不可用：已切换为静态 DOM 桌面，全部交互仍可用。');
        return;
      }
    }

    mount.dataset.desk3dMode = 'on';
    ui.hideFallback();
    scene.setEnabled(true);
    if (reducedMotion) {
      ui.setBanner('已尊重 prefers-reduced-motion：减少抗锯齿与悬停抬起，空闲更快停渲。');
    }
  }

  toggle.addEventListener('change', () => {
    want3d = toggle.checked;
    if (want3d) failReason = '';
    applyMode();
  });

  if (forceFail) {
    markUnavailable('WebGL 不可用：已切换为静态 DOM 桌面，全部交互仍可用。');
  }

  const box = mount.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  visible = box.height > 0 && box.bottom > 0 && box.top < vh;

  if (typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting && e.intersectionRatio > 0);
      applyMode();
    }, { threshold: 0.05 });
    io.observe(mount);
  }

  applyMode();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (scene) scene.stopLoop();
      return;
    }
    applyMode();
  });

  if (typeof options.subscribe === 'function') {
    options.subscribe(() => { syncScene(); });
  }

  console.info('[sopify-desk-3d] mounted', {
    want3d,
    reducedMotion,
    lazy: true,
    dogfood: true,
  });

  return {
    ui,
    get scene() { return scene; },
    applyMode,
    syncScene,
  };
}
