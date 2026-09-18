/**
 * Standalone reference page. Primary product path is extension/newtab.html.
 */

import { mountDesk3d } from '../../extension/desk-3d/embed.js';

const mount = document.getElementById('desk-3d-mount');
if (mount) {
  mountDesk3d(mount, { resumeSelector: '#next-thing' });
}
