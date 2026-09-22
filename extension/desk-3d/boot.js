/**
 * Newtab entry. Keep this file free of extension storage and tab APIs.
 * Real worksets / notes / restore arrive via window.SopifyDesk3d from newtab.js.
 */

import { mountDesk3d } from './embed.js';

const mount = document.getElementById('desk-3d-mount');
const host = typeof window !== 'undefined' ? window.SopifyDesk3d : null;
if (mount) {
  mountDesk3d(mount, {
    resumeSelector: '#resume',
    defaultWant3d: !host || host.defaultWant3d !== false,
    getWorksets: host && host.getWorksets,
    getNote: host && host.getNote,
    saveNote: host && host.saveNote,
    restoreWorkset: host && host.restoreWorkset,
    subscribe: host && host.subscribe,
  });
}
