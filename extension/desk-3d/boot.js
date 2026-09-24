/**
 * Newtab entry. Keep this file free of extension storage and tab APIs.
 * Three.js loads only after the settings switch turns space view on.
 */

const mount = document.getElementById('desk-3d-mount');
let mounted = null;
let loading = null;
let cancelLoad = false;

function spaceOn() {
  const host = typeof window !== 'undefined' ? window.SopifyDesk3d : null;
  return !!(host && typeof host.getSpaceView === 'function' && host.getSpaceView() === true);
}

function hostOptions() {
  const host = typeof window !== 'undefined' ? window.SopifyDesk3d : null;
  return {
    resumeSelector: '#resume',
    defaultWant3d: true,
    getWorksets: host && host.getWorksets,
    getNote: host && host.getNote,
    saveNote: host && host.saveNote,
    restoreWorkset: host && host.restoreWorkset,
    subscribe: host && host.subscribe,
  };
}

async function turnOn() {
  if (!mount || mounted || loading) return;
  cancelLoad = false;
  mount.hidden = false;
  const job = import('./embed.js');
  loading = job;
  try {
    const mod = await job;
    if (loading !== job) return;
    loading = null;
    if (cancelLoad || !spaceOn()) {
      mount.hidden = true;
      return;
    }
    mounted = mod.mountDesk3d(mount, hostOptions());
  } catch {
    if (loading === job) loading = null;
    if (mount) mount.hidden = true;
  }
}

function turnOff() {
  cancelLoad = true;
  loading = null;
  if (mounted && typeof mounted.dispose === 'function') {
    try { mounted.dispose(); } catch { /* already gone */ }
  }
  mounted = null;
  if (mount) {
    mount.hidden = true;
    mount.innerHTML = '';
  }
}

document.addEventListener('sopify-spaceview', (event) => {
  if (event && event.detail === true) turnOn();
  else turnOff();
});

if (spaceOn()) turnOn();
