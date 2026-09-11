(() => {
  'use strict';

  const STORAGE_KEY = 'deskCompanion';
  const SIZE = 64;
  const INSET = 12;
  const AVOID_GAP = 10;
  const DRAG_THRESHOLD = 4;
  const STRETCH_MAX = 1.18;
  const REBOUND_MS = 280;
  const DEFAULT_PARK = { x: 1, y: 1 };
  const DEFAULT_COMPANION = {
    enabled: true,
    x: DEFAULT_PARK.x,
    y: DEFAULT_PARK.y,
    motion: 'full',
  };
  const MUST_AVOID_SELECTORS = [
    '#resume',
    '#resume-act',
    '.rail',
    '.c-workset .cardfoot',
  ];
  const SOFT_AVOID_SELECTORS = [
    '#name',
    '#todo-input',
    '#workset-filter',
    '#tab-filter',
    '#cwd',
    '#notes',
    '#notes-preview',
    '.navbtn',
    '#open-chat',
    '[data-close-tab]',
    '[data-close-host]',
    '.tile-remove',
    '.iconbtn',
    'input:not(#desk-fog-enabled)',
    'textarea',
    'button:not(#desk-fog):not(#desk-fog-reset):not(#desk-fog-enabled)',
  ];

  function clamp01(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }

  function clamp(n, min, max) {
    const x = Number(n);
    if (!Number.isFinite(x)) return min;
    if (x < min) return min;
    if (x > max) return max;
    return x;
  }

  function normalizeMotion(value) {
    return value === 'reduced' ? 'reduced' : 'full';
  }

  function normalizeDeskCompanion(raw) {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
      enabled: typeof src.enabled === 'boolean' ? src.enabled : true,
      x: Object.prototype.hasOwnProperty.call(src, 'x') ? clamp01(src.x, DEFAULT_PARK.x) : DEFAULT_PARK.x,
      y: Object.prototype.hasOwnProperty.call(src, 'y') ? clamp01(src.y, DEFAULT_PARK.y) : DEFAULT_PARK.y,
      motion: normalizeMotion(src.motion),
    };
  }

  function resolveCompanionMotion(userMotion, prefersReduce) {
    if (prefersReduce) return 'reduced';
    return normalizeMotion(userMotion);
  }

  function pixelFromNorm(norm, min, max) {
    return min + clamp01(norm, 0) * Math.max(0, max - min);
  }

  function normFromPixel(px, min, max) {
    if (max <= min) return 1;
    return clamp01((px - min) / (max - min), 1);
  }

  function boxOf(rect) {
    if (!rect) return null;
    const x = Number(rect.x);
    const y = Number(rect.y);
    const w = Number(rect.w != null ? rect.w : rect.width);
    const h = Number(rect.h != null ? rect.h : rect.height);
    if (![x, y, w, h].every(Number.isFinite) || w < 1 || h < 1) return null;
    return { x: x, y: y, w: w, h: h };
  }

  function overlapPad(a, b, gap) {
    const g = Number.isFinite(gap) ? gap : 0;
    return a.x < b.x + b.w + g
      && a.x + a.w > b.x - g
      && a.y < b.y + b.h + g
      && a.y + a.h > b.y - g;
  }

  function hitsAny(pos, size, rects, gap) {
    const blob = { x: pos.x, y: pos.y, w: size, h: size };
    return (rects || []).some((r) => r && overlapPad(blob, r, gap));
  }

  function moveBounds(viewport, size, inset, rail) {
    const viewW = Number(viewport && viewport.width);
    const viewH = Number(viewport && viewport.height);
    const pad = Number.isFinite(inset) ? inset : INSET;
    const side = Number.isFinite(size) ? size : SIZE;
    let minX = pad;
    let minY = pad;
    let maxX = Math.max(pad, (Number.isFinite(viewW) ? viewW : 0) - side - pad);
    let maxY = Math.max(pad, (Number.isFinite(viewH) ? viewH : 0) - side - pad);
    const railBox = boxOf(rail);
    if (railBox) {
      const tall = railBox.h >= railBox.w;
      if (tall && railBox.x <= pad + 8) minX = Math.max(minX, railBox.x + railBox.w + pad);
      if (!tall && railBox.y <= pad + 8) minY = Math.max(minY, railBox.y + railBox.h + pad);
    }
    if (maxX < minX) maxX = minX;
    if (maxY < minY) maxY = minY;
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function nudgeOut(x, y, size, reserved, bounds, gap) {
    const g = Number.isFinite(gap) ? gap : AVOID_GAP;
    const span = Number.isFinite(size) ? size : SIZE;
    const room = bounds || { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    let px = clamp(x, room.minX, room.maxX);
    let py = clamp(y, room.minY, room.maxY);
    const list = (reserved || []).map(boxOf).filter(Boolean);
    const travel = room.maxX - room.minX;

    for (let step = 0; step < 12; step += 1) {
      const blob = { x: px, y: py, w: span, h: span };
      const hit = list.find((r) => overlapPad(blob, r, g));
      if (!hit) return { x: px, y: py };

      const left = hit.x - span - g;
      const right = hit.x + hit.w + g;
      const up = hit.y - span - g;
      const down = hit.y + hit.h + g;
      const wide = hit.w > travel * 0.5;
      const options = wide
        ? [{ x: px, y: up }, { x: left, y: py }, { x: px, y: down }, { x: right, y: py }]
        : [{ x: left, y: py }, { x: px, y: up }, { x: right, y: py }, { x: px, y: down }];

      let nextX = px;
      let nextY = py;
      let found = false;
      for (let i = 0; i < options.length; i += 1) {
        const nx = clamp(options[i].x, room.minX, room.maxX);
        const ny = clamp(options[i].y, room.minY, room.maxY);
        if (!overlapPad({ x: nx, y: ny, w: span, h: span }, hit, g)) {
          nextX = nx;
          nextY = ny;
          found = true;
          break;
        }
        if (nx !== px || ny !== py) {
          nextX = nx;
          nextY = ny;
          found = true;
          break;
        }
      }
      if (!found || (nextX === px && nextY === py)) break;
      px = nextX;
      py = nextY;
    }
    return { x: clamp(px, room.minX, room.maxX), y: clamp(py, room.minY, room.maxY) };
  }

  function parkPixel(norm, bounds, size, mustAvoid, softAvoid) {
    const n = norm || DEFAULT_PARK;
    const side = Number.isFinite(size) ? size : SIZE;
    const room = bounds || { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    let pos = {
      x: pixelFromNorm(n.x, room.minX, room.maxX),
      y: pixelFromNorm(n.y, room.minY, room.maxY),
    };
    pos = nudgeOut(pos.x, pos.y, side, mustAvoid, room, AVOID_GAP);
    const softened = nudgeOut(pos.x, pos.y, side, (mustAvoid || []).concat(softAvoid || []), room, 8);
    if (!hitsAny(softened, side, mustAvoid, AVOID_GAP)) pos = softened;
    return pos;
  }

  function edgeFlags(pos, bounds) {
    const room = bounds || { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    const flags = [];
    if (pos.x <= room.minX + 2) flags.push('left');
    if (pos.x >= room.maxX - 2) flags.push('right');
    if (pos.y <= room.minY + 2) flags.push('top');
    if (pos.y >= room.maxY - 2) flags.push('bottom');
    return flags.join(' ');
  }

  function stretchFromDelta(dx, dy) {
    const dist = Math.hypot(Number(dx) || 0, Number(dy) || 0);
    const sx = Math.min(STRETCH_MAX, 1 + dist / 320);
    const sy = Math.max(1 / sx, 0.88);
    const rot = Math.atan2(Number(dy) || 0, Number(dx) || 0) * (180 / Math.PI);
    return { sx: sx, sy: sy, rot: rot };
  }

  const api = {
    STORAGE_KEY: STORAGE_KEY,
    SIZE: SIZE,
    INSET: INSET,
    AVOID_GAP: AVOID_GAP,
    DRAG_THRESHOLD: DRAG_THRESHOLD,
    STRETCH_MAX: STRETCH_MAX,
    REBOUND_MS: REBOUND_MS,
    DEFAULT_PARK: DEFAULT_PARK,
    DEFAULT_COMPANION: DEFAULT_COMPANION,
    MUST_AVOID_SELECTORS: MUST_AVOID_SELECTORS,
    SOFT_AVOID_SELECTORS: SOFT_AVOID_SELECTORS,
    clamp01: clamp01,
    normalizeDeskCompanion: normalizeDeskCompanion,
    resolveCompanionMotion: resolveCompanionMotion,
    pixelFromNorm: pixelFromNorm,
    normFromPixel: normFromPixel,
    moveBounds: moveBounds,
    overlapPad: overlapPad,
    hitsAny: hitsAny,
    nudgeOut: nudgeOut,
    parkPixel: parkPixel,
    edgeFlags: edgeFlags,
    stretchFromDelta: stretchFromDelta,
    setEnabled: function (on) { setEnabled(on); },
    resetPosition: function () { resetPosition(); },
  };

  if (typeof window !== 'undefined') window.SopifyDeskCompanion = api;
  if (typeof module === 'object' && module.exports) module.exports = api;

  if (typeof document === 'undefined' || !document.documentElement) return;

  const hasStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  let state = normalizeDeskCompanion(null);
  let el = null;
  let enabledInput = null;
  let live = { x: 0, y: 0 };
  let anim = null;
  let dragging = false;
  let moved = false;
  let pointerId = null;
  let origin = { x: 0, y: 0, px: 0, py: 0 };
  let persistTimer = 0;

  function prefersReduceNow() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function motionNow() {
    return resolveCompanionMotion(state.motion, prefersReduceNow());
  }

  function deskViewActive() {
    const view = document.querySelector('.view.active');
    return !view || view.getAttribute('data-view') === 'desk';
  }

  function visibleBox(node) {
    if (!node || node === el || node.hidden) return null;
    if (node.getAttribute && node.getAttribute('hidden') != null && node.hidden !== false) {
      if (node.hidden) return null;
    }
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(node) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return null;
    const r = node.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  function collectRects(selectors) {
    const out = [];
    const seen = new Set();
    (selectors || []).forEach((sel) => {
      document.querySelectorAll(sel).forEach((node) => {
        if (seen.has(node)) return;
        const box = visibleBox(node);
        if (!box) return;
        seen.add(node);
        out.push(box);
      });
    });
    return out;
  }

  function currentBounds() {
    const rail = document.querySelector('.rail');
    return moveBounds(
      { width: window.innerWidth, height: window.innerHeight },
      SIZE,
      INSET,
      visibleBox(rail),
    );
  }

  function cancelAnim() {
    if (anim) {
      try { anim.cancel(); } catch { /* already finished */ }
      anim = null;
    }
  }

  function setFogState(name) {
    if (!el) return;
    el.dataset.fog = name;
    el.hidden = name === 'hidden';
    if (name === 'hidden') {
      el.setAttribute('aria-hidden', 'true');
      el.tabIndex = -1;
    } else {
      el.removeAttribute('aria-hidden');
      el.tabIndex = 0;
    }
  }

  function applyTransform(sx, sy, rot) {
    if (!el) return;
    if (sx == null || (sx === 1 && sy === 1 && !rot)) {
      el.style.transform = '';
      return;
    }
    el.style.transform = 'rotate(' + (rot || 0) + 'deg) scale(' + sx + ', ' + sy + ')';
  }

  function applyPlace(pos, bounds) {
    live = { x: pos.x, y: pos.y };
    if (!el) return;
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
    const edge = edgeFlags(pos, bounds);
    if (edge) el.dataset.edge = edge;
    else delete el.dataset.edge;
  }

  function shown() {
    return state.enabled && deskViewActive();
  }

  function place(write) {
    if (!el) return;
    if (!shown()) {
      cancelAnim();
      setFogState('hidden');
      return;
    }
    const bounds = currentBounds();
    const pos = parkPixel(
      { x: state.x, y: state.y },
      bounds,
      SIZE,
      collectRects(MUST_AVOID_SELECTORS),
      collectRects(SOFT_AVOID_SELECTORS),
    );
    applyPlace(pos, bounds);
    if (el.dataset.fog === 'hidden' || !el.dataset.fog) setFogState('idle');
    el.hidden = false;
    el.dataset.motion = motionNow();
    if (write) persistSoon();
  }

  function persistSoon() {
    if (!hasStorage) return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      chrome.storage.local.set({ deskCompanion: normalizeDeskCompanion(state) });
    }, 80);
  }

  function persistNow() {
    if (!hasStorage) return;
    clearTimeout(persistTimer);
    chrome.storage.local.set({ deskCompanion: normalizeDeskCompanion(state) });
  }

  function setEnabled(on) {
    state.enabled = Boolean(on);
    if (enabledInput && enabledInput.checked !== state.enabled) enabledInput.checked = state.enabled;
    if (!state.enabled && el && document.activeElement === el) {
      const act = document.getElementById('resume-act');
      if (act) act.focus({ preventScroll: true });
      else el.blur();
    }
    place(false);
    persistNow();
  }

  function resetPosition() {
    state.x = DEFAULT_PARK.x;
    state.y = DEFAULT_PARK.y;
    place(false);
    persistNow();
  }

  function shortPress() {
    if (!shown() || dragging) return;
    setFogState('press');
    if (motionNow() === 'reduced') {
      applyTransform();
      setFogState('idle');
      return;
    }
    cancelAnim();
    anim = el.animate(
      [{ transform: 'scale(0.94)' }, { transform: 'scale(1)' }],
      { duration: 160, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
    const run = anim;
    run.finished.then(function () {
      if (anim === run) {
        try { run.cancel(); } catch { /* ignore */ }
        anim = null;
        applyTransform();
        setFogState('idle');
      }
    }).catch(function () { /* cancelled */ });
  }

  function reboundHome() {
    setFogState('release');
    if (motionNow() === 'reduced') {
      applyTransform();
      setFogState('dock');
      setFogState('idle');
      return;
    }
    cancelAnim();
    const from = el.style.transform || 'scale(1)';
    anim = el.animate(
      [{ transform: from }, { transform: 'rotate(0deg) scale(1, 1)' }],
      { duration: REBOUND_MS, easing: 'cubic-bezier(0.22, 0.8, 0.28, 1)', fill: 'forwards' },
    );
    const run = anim;
    run.finished.then(function () {
      if (anim === run) {
        try { run.cancel(); } catch { /* ignore */ }
        anim = null;
        applyTransform();
        setFogState('dock');
        setFogState('idle');
      }
    }).catch(function () { /* cancelled */ });
  }

  function onPointerDown(e) {
    if (!shown()) return;
    if (e.button != null && e.button !== 0) return;
    pointerId = e.pointerId;
    dragging = false;
    moved = false;
    origin = { x: e.clientX, y: e.clientY, px: live.x, py: live.y };
    setFogState('press');
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  function onPointerMove(e) {
    if (pointerId == null || e.pointerId !== pointerId) return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    dragging = true;
    moved = true;
    cancelAnim();
    setFogState('drag');
    const bounds = currentBounds();
    const next = parkPixel(
      {
        x: normFromPixel(origin.px + dx, bounds.minX, bounds.maxX),
        y: normFromPixel(origin.py + dy, bounds.minY, bounds.maxY),
      },
      bounds,
      SIZE,
      collectRects(MUST_AVOID_SELECTORS),
      [],
    );
    applyPlace(next, bounds);
    if (motionNow() === 'full') {
      const pull = stretchFromDelta(dx, dy);
      applyTransform(pull.sx, pull.sy, pull.rot * 0.12);
    } else {
      applyTransform();
    }
  }

  function onPointerUp(e) {
    if (pointerId == null || (e && e.pointerId !== pointerId)) return;
    try { el.releasePointerCapture(pointerId); } catch { /* ignore */ }
    pointerId = null;
    if (dragging) {
      const bounds = currentBounds();
      const parked = parkPixel(
        { x: normFromPixel(live.x, bounds.minX, bounds.maxX), y: normFromPixel(live.y, bounds.minY, bounds.maxY) },
        bounds,
        SIZE,
        collectRects(MUST_AVOID_SELECTORS),
        collectRects(SOFT_AVOID_SELECTORS),
      );
      applyPlace(parked, bounds);
      state.x = normFromPixel(parked.x, bounds.minX, bounds.maxX);
      state.y = normFromPixel(parked.y, bounds.minY, bounds.maxY);
      persistNow();
      reboundHome();
    } else {
      setFogState('idle');
    }
    dragging = false;
  }

  function bind() {
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('lostpointercapture', function () {
      if (pointerId != null) onPointerUp({ pointerId: pointerId });
    });
    el.addEventListener('click', function (e) {
      if (moved) {
        e.preventDefault();
        moved = false;
        return;
      }
      shortPress();
    });
    el.addEventListener('dblclick', function (e) {
      e.preventDefault();
      setEnabled(false);
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setEnabled(false);
      }
    });

    if (enabledInput) {
      enabledInput.checked = state.enabled;
      enabledInput.addEventListener('change', function () {
        setEnabled(enabledInput.checked);
      });
    }
    const resetBtn = document.getElementById('desk-fog-reset');
    if (resetBtn) resetBtn.addEventListener('click', function () { resetPosition(); });

    window.addEventListener('resize', function () { place(false); });
    document.querySelectorAll('.view').forEach(function (node) {
      new MutationObserver(function () { place(false); }).observe(node, {
        attributes: true,
        attributeFilter: ['class'],
      });
    });
    const foot = document.querySelector('.c-workset .cardfoot');
    if (foot && typeof ResizeObserver === 'function') {
      new ResizeObserver(function () { place(false); }).observe(foot);
    }
    if (typeof matchMedia === 'function') {
      const mq = matchMedia('(prefers-reduced-motion: reduce)');
      if (mq.addEventListener) {
        mq.addEventListener('change', function () {
          cancelAnim();
          applyTransform();
          if (el) el.dataset.motion = motionNow();
        });
      }
    }
    if (hasStorage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== 'local' || !changes.deskCompanion) return;
        state = normalizeDeskCompanion(changes.deskCompanion.newValue);
        if (enabledInput) enabledInput.checked = state.enabled;
        place(false);
      });
    }
  }

  function loadAndStart() {
    el = document.getElementById('desk-fog');
    enabledInput = document.getElementById('desk-fog-enabled');
    if (!el) return;
    el.style.width = SIZE + 'px';
    el.style.height = SIZE + 'px';
    const start = function (raw) {
      state = normalizeDeskCompanion(raw);
      if (enabledInput) enabledInput.checked = state.enabled;
      bind();
      place(false);
    };
    if (!hasStorage) {
      start(null);
      return;
    }
    chrome.storage.local.get({ deskCompanion: DEFAULT_COMPANION }, function (data) {
      start(data && data.deskCompanion);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndStart);
  } else {
    loadAndStart();
  }
})();
