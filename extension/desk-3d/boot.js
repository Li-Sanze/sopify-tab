/**
 * Newtab entry. Keep this file free of chrome.storage / chrome.tabs.
 */

import { mountDesk3d } from './embed.js';

const mount = document.getElementById('desk-3d-mount');
if (mount) {
  mountDesk3d(mount, { resumeSelector: '#resume' });
}
