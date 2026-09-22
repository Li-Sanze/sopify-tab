/**
 * Shared desk-3d constants. No demo catalog.
 * Worksets / the single desk note arrive via newtab.js callbacks.
 */

export const THREE_VENDOR = {
  name: 'three',
  version: '0.170.0',
  revision: '170',
  path: 'vendor/three/three.module.js',
  bytes: 1314681,
};

/** One sticky on the desk maps to chrome.storage.local.notes. */
export const NOTE_ID = 'note';

/** Desk shows at most two worksets; extras live in the full list. */
export const MAX_DESK_WORKSETS = 2;

/** Pick keys for the three functional objects. */
export const PICK_PRIMARY = 'primary';
export const PICK_SECONDARY = 'secondary';
export const PICK_NOTE = 'note';
