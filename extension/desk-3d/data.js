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

export const FOLDER_COLORS = [0x5b8fd4, 0x5fa88a, 0xc48a4a, 0x8a7cc4, 0xd46b6b];

export const FOLDER_SLOTS = [
  { x: -1.7, z: 0.52 },
  { x: -0.15, z: 0.3 },
  { x: 1.35, z: 0.5 },
  { x: -0.95, z: -1.05 },
  { x: 0.6, z: -1.2 },
];

export const NOTE_SLOT = { x: 2.2, z: 0.18 };
