/**
 * Embed desk-3d into a mount node (newtab stage or standalone prototype).
 * Lazy-inits WebGL only when 「空间视图」 is on and the stage is visible.
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
    canvas.setAttribute('aria-label', '空间桌面');
    canvas.tabIndex = -1;
    // Labels sit above the canvas; insert canvas first.
    view.insertBefore(canvas, view.firstChild);
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

function isNightSky() {
  try {
    return document.documentElement.dataset.sky === 'night';
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

  /** @type {DeskScene | null} */
  let scene = null;
  let inited = false;
  let visible = false;
  let want3d = defaultWant3d;
  /** @type {string} */
  let failReason = '';
  /** @type {Function|void} */
  let unsubscribe = undefined;
  let disposed = false;
  /** @type {IntersectionObserver | null} */
  let observer = null;
  const onVisibility = () => {
    if (disposed) return;
    if (document.visibilityState === 'hidden') {
      if (scene) scene.stopLoop();
      return;
    }
    applyMode();
  };
  const onTheme = () => {
    if (disposed) return;
    if (scene) scene.setTheme(isNightSky());
  };

  const ui = new DeskUI({
    resumeSelector,
    root: mount,
    getWorksets: options.getWorksets,
    getNote: options.getNote,
    saveNote: options.saveNote,
    restoreWorkset: options.restoreWorkset,
    onHoverPick: (key) => {
      if (scene) scene.setHover(key);
    },
  });

  const toggle = mount.querySelector('#desk3d-toggle');
  const view = mount.querySelector('#desk3d-view');
  if (!toggle || !view) return { ui, scene: null };

  toggle.checked = want3d && !failReason;
  ui.setToggleLabel(want3d && !failReason);

  function catalogForScene() {
    return ui.deskCatalog();
  }

  function syncScene() {
    const catalog = ui.syncFromHost();
    if (scene) {
      scene.setCatalog(ui.deskCatalog());
    }
    return catalog;
  }

  function markUnavailable(reason) {
    failReason = reason;
    want3d = false;
    toggle.checked = false;
    ui.setToggleLabel(false);
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
      ui.setToggleLabel(false);
      ui.showFallback(failReason);
      return;
    }

    if (!want3d) {
      mount.dataset.desk3dMode = 'dom';
      if (scene) scene.setEnabled(false);
      ui.setToggleLabel(false);
      ui.showFallback('已关闭空间视图：使用简洁桌面（与 3D 同一交互路径）。');
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
        markUnavailable('WebGL 不可用：已切换为简洁桌面，全部交互仍可用。');
        return;
      }
      const canvas = ensureCanvas(view);
      scene = new DeskScene(canvas, {
        reducedMotion,
        onPick: (id, kind) => ui.openFromScene(id, kind),
        catalog: catalogForScene(),
        labelEls: ui.labelEls(),
        night: isNightSky(),
      });
      const ok = scene.init();
      inited = true;
      if (!ok) {
        markUnavailable('WebGL 不可用：已切换为简洁桌面，全部交互仍可用。');
        return;
      }
    }

    mount.dataset.desk3dMode = 'on';
    ui.hideFallback();
    scene.setTheme(isNightSky());
    scene.setCatalog(catalogForScene());
    scene.setEnabled(true);
    ui.setToggleLabel(true);
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
    markUnavailable('WebGL 不可用：已切换为简洁桌面，全部交互仍可用。');
  }

  const box = mount.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  visible = box.height > 0 && box.bottom > 0 && box.top < vh;

  if (typeof IntersectionObserver === 'function') {
    observer = new IntersectionObserver((entries) => {
      if (disposed) return;
      visible = entries.some((e) => e.isIntersecting && e.intersectionRatio > 0);
      applyMode();
    }, { threshold: 0.05 });
    observer.observe(mount);
  }

  applyMode();

  document.addEventListener('visibilitychange', onVisibility);

  document.documentElement.addEventListener('sopify-theme', onTheme);

  if (typeof options.subscribe === 'function') {
    unsubscribe = options.subscribe(() => { syncScene(); });
  }

  console.info('[sopify-desk-3d] mounted', {
    want3d,
    reducedMotion,
    lazy: true,
    studio: '03-spatial',
  });

  return {
    ui,
    get scene() { return scene; },
    applyMode,
    syncScene,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      document.removeEventListener('visibilitychange', onVisibility);
      document.documentElement.removeEventListener('sopify-theme', onTheme);
      if (typeof unsubscribe === 'function') {
        unsubscribe();
        unsubscribe = undefined;
      }
      if (scene) {
        scene.dispose();
        scene = null;
      }
      inited = false;
      if (ui && typeof ui.dispose === 'function') ui.dispose();
      mount.innerHTML = '';
    },
  };
}
