/**
 * Embed desk-3d into a mount node (newtab stage or standalone prototype).
 * Lazy-inits WebGL only when 「有 3D」 is on and the stage is visible.
 */

import { DeskScene } from './scene.js';
import { DeskUI } from './ui.js';
import { stageInnerHTML, panelsInnerHTML } from './markup.js';
import { TOGGLE_SESSION_KEY } from './data.js';

function readWant3d() {
  try {
    const raw = sessionStorage.getItem(TOGGLE_SESSION_KEY);
    if (raw === '0') return false;
    if (raw === '1') return true;
  } catch {
    /* ignore */
  }
  return true;
}

function writeWant3d(on) {
  try {
    sessionStorage.setItem(TOGGLE_SESSION_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

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
 * @param {{ resumeSelector?: string, forceFail?: boolean }} [opts]
 */
export function mountDesk3d(mount, opts) {
  const options = opts || {};
  const resumeSelector = options.resumeSelector || '#resume';
  const reducedMotion = prefersReducedMotion();
  const forceFail = forceFailRequested(options);

  mount.innerHTML = stageInnerHTML();
  mount.dataset.desk3dMode = 'dom';
  ensurePanels();

  const ui = new DeskUI({ resumeSelector, root: mount });
  const toggle = mount.querySelector('#desk3d-toggle');
  const view = mount.querySelector('#desk3d-view');
  if (!toggle || !view) return { ui, scene: null };

  /** @type {DeskScene | null} */
  let scene = null;
  let inited = false;
  let visible = false;
  let want3d = readWant3d();
  toggle.checked = want3d;

  function applyMode() {
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
      const canvas = ensureCanvas(view);
      scene = new DeskScene(canvas, {
        reducedMotion,
        onPick: (id, kind) => ui.openFromScene(id, kind),
      });
      const ok = !forceFail && scene.init();
      inited = true;
      if (!ok) {
        want3d = false;
        toggle.checked = false;
        writeWant3d(false);
        mount.dataset.desk3dMode = 'dom';
        if (scene) {
          scene.dispose();
          scene = null;
        }
        ui.showFallback('WebGL 不可用：已切换为静态 DOM 桌面，全部交互仍可用。');
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
    writeWant3d(want3d);
    applyMode();
  });

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

  console.info('[sopify-desk-3d] mounted', {
    want3d,
    reducedMotion,
    lazy: true,
  });

  return {
    ui,
    get scene() { return scene; },
    applyMode,
  };
}
