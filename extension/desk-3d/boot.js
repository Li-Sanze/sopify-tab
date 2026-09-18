/**
 * Newtab entry. Keep this file free of extension storage and tab APIs.
 */

import { mountDesk3d } from './embed.js';

const mount = document.getElementById('desk-3d-mount');
if (mount) {
  mountDesk3d(mount, { resumeSelector: '#resume' });
}
