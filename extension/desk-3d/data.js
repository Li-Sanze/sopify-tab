/**
 * Demo-only desk-3d catalog.
 * Must not be written to chrome.storage or used to open real tabs.
 */

export const THREE_VENDOR = {
  name: 'three',
  version: '0.170.0',
  revision: '170',
  path: 'vendor/three/three.module.js',
  bytes: 1314681,
};

export const NOTE_SESSION_KEY = 'sopify-desk3d-notes-v1';
export const TOGGLE_SESSION_KEY = 'sopify-desk3d-on';

export const WORKSETS = {
  focus: {
    name: '专注工作集',
    pages: [
      { title: '规格草案 — Sopify Tab', url: 'https://example.com/spec' },
      { title: 'Issue #42 交互验收', url: 'https://example.com/issue/42' },
      { title: '本地预览 localhost:8765', url: 'http://localhost:8765' },
    ],
  },
  research: {
    name: '调研工作集',
    pages: [
      { title: 'Three.js 文档 (r170)', url: 'https://threejs.org/docs/' },
      { title: '固定视角桌面灵感板', url: 'https://example.com/moodboard' },
      { title: '无障碍：dialog 与焦点', url: 'https://example.com/a11y' },
    ],
  },
};

export const NOTE_LABELS = {
  n1: '便签 A',
  n2: '便签 B',
};

export const DEMO_TODOS = [
  { id: 't1', text: '打开「专注工作集」面板看一眼网页列表' },
  { id: 't2', text: '改一条便签并确认刷新后仍在（同标签页）' },
  { id: 't3', text: '用 Esc 关掉面板，焦点应回到入口' },
];

export const DEFAULT_NOTES = {
  n1: '周一：把工作集面板文案标成演示。',
  n2: '',
};
