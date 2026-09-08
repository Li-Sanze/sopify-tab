(() => {
  'use strict';

  const PRESETS = ['system', 'day', 'night'];
  const STORAGE_KEY = 'themePreset';
  const DEFAULT_PRESET = 'system';
  const DEFAULT_MOTION = 'calm';

  function normalizePreset(value) {
    return PRESETS.includes(value) ? value : DEFAULT_PRESET;
  }

  function resolveSky(preset, prefersDark) {
    const p = normalizePreset(preset);
    if (p === 'day') return 'day';
    if (p === 'night') return 'night';
    return prefersDark ? 'night' : 'day';
  }

  function applyToRoot(root, preset, prefersDark) {
    const p = normalizePreset(preset);
    const sky = resolveSky(p, prefersDark);
    root.dataset.theme = p;
    root.dataset.sky = sky;
    root.style.colorScheme = sky === 'night' ? 'dark' : 'light';
    return { preset: p, sky };
  }

  function resolveSkyMotion(prefersReduce) {
    return prefersReduce ? 'still' : DEFAULT_MOTION;
  }

  function applySkyMotion(root, prefersReduce) {
    const motion = resolveSkyMotion(prefersReduce);
    if (root) root.dataset.skyMotion = motion;
    return motion;
  }

  function readCache() {
    try {
      return normalizePreset(localStorage.getItem(STORAGE_KEY));
    } catch {
      return DEFAULT_PRESET;
    }
  }

  function writeCache(preset) {
    try {
      localStorage.setItem(STORAGE_KEY, preset);
    } catch { /* private mode / quota */ }
  }

  function prefersDarkNow() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function prefersReduceNow() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  const api = {
    PRESETS,
    STORAGE_KEY,
    DEFAULT_PRESET,
    DEFAULT_MOTION,
    normalizePreset,
    resolveSky,
    resolveSkyMotion,
    applyToRoot,
    applySkyMotion,
    getPreset() {
      return currentPreset;
    },
    setPreset(preset) {
      apply(preset);
      persist(currentPreset);
    },
  };

  let currentPreset = DEFAULT_PRESET;

  function apply(preset) {
    currentPreset = normalizePreset(preset);
    if (typeof document === 'undefined' || !document.documentElement) return currentPreset;
    applyToRoot(document.documentElement, currentPreset, prefersDarkNow());
    applySkyMotion(document.documentElement, prefersReduceNow());
    document.documentElement.dispatchEvent(new CustomEvent('sopify-theme', { detail: { preset: currentPreset } }));
    return currentPreset;
  }

  function persist(preset) {
    const p = normalizePreset(preset);
    writeCache(p);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: p });
    }
  }

  function boot() {
    // chrome.storage.local.get is async. Mirror the minimal key in localStorage
    // so the first paint already has data-theme / data-sky / data-sky-motion / color-scheme.
    currentPreset = readCache();
    apply(currentPreset);

    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', () => {
        if (currentPreset === 'system') apply('system');
      });
    }

    const mqMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (mqMotion && mqMotion.addEventListener) {
      mqMotion.addEventListener('change', () => {
        if (typeof document === 'undefined' || !document.documentElement) return;
        applySkyMotion(document.documentElement, mqMotion.matches);
      });
    }

    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

    chrome.storage.local.get({ [STORAGE_KEY]: DEFAULT_PRESET }, (data) => {
      const stored = normalizePreset(data && data[STORAGE_KEY]);
      writeCache(stored);
      if (stored !== currentPreset) apply(stored);
    });

    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes[STORAGE_KEY]) return;
        const stored = normalizePreset(changes[STORAGE_KEY].newValue);
        if (stored === currentPreset) return;
        currentPreset = stored;
        writeCache(stored);
        apply(stored);
      });
    }
  }

  if (typeof window !== 'undefined') window.SopifyTheme = api;
  if (typeof document !== 'undefined' && document.documentElement) boot();
  if (typeof module === 'object' && module.exports) module.exports = api;
})();
