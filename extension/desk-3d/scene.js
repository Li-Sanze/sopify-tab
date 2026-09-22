/**
 * Studio 03 spatial desk (Three.js r170, local ESM).
 * Fixed orthographic view. Three objects only: monitor, folder, note.
 * No orbit / free roam / physics. Procedural geometry only.
 * Wake sources are canvas-scoped or ResizeObserver — no window listeners.
 */

import * as THREE from './vendor/three/three.module.js';
import {
  MAX_DESK_WORKSETS,
  NOTE_ID,
  PICK_NOTE,
  PICK_PRIMARY,
  PICK_SECONDARY,
} from './data.js';

const IDLE_MS = 2500;
const MAX_PIXEL_RATIO = 1.5;
const HOVER_LIFT = 0.12;

/**
 * @typedef {{
 *   key: string,
 *   id: string,
 *   kind: 'workset'|'note',
 *   label: string,
 *   group: THREE.Group,
 *   baseY: number,
 *   target: number,
 *   offset: number,
 *   anchor: THREE.Vector3,
 * }} DeskObject
 */

export class DeskScene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{
   *   onPick: (id: string, kind: string) => void,
   *   reducedMotion: boolean,
   *   catalog?: object,
   *   labelEls?: { primary?: HTMLElement|null, secondary?: HTMLElement|null, note?: HTMLElement|null },
   *   night?: boolean,
   * }} opts
   */
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.onPick = opts.onPick;
    this.reducedMotion = opts.reducedMotion;
    this._catalog = opts.catalog || { worksets: [], noteLabel: '随手记' };
    this._labelEls = opts.labelEls || {};
    this._night = !!opts.night;
    this.enabled = true;
    this.webglOk = false;
    this._raf = 0;
    this._until = 0;
    this._disposed = false;
    /** @type {DeskObject[]} */
    this.objects = [];
    /** @type {THREE.Mesh[]} */
    this.pickables = [];
    this._hover = null;
    this._textures = [];
    this._bindings = [];

    this.renderer = null;
    this.world = null;
    this.camera = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._project = new THREE.Vector3();
    this._ro = null;

    this._onPointer = (e) => this._pick(e, false);
    this._onPointerLeave = () => this._setHover(null);
    this._onClick = (e) => this._pick(e, true);
  }

  /** Try WebGL; return false if unavailable. */
  init() {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: !this.reducedMotion,
        alpha: true,
        powerPreference: 'low-power',
      });
      const gl = renderer.getContext();
      if (!gl) throw new Error('no context');
    } catch {
      this.webglOk = false;
      return false;
    }

    this.renderer = renderer;
    this.webglOk = true;
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Soft contact shadows are faked with disks; keep real shadow maps off (gates + battery).
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    this.world = new THREE.Scene();
    this.world.background = null;

    this.camera = new THREE.OrthographicCamera(-7, 7, 4, -4, 0.1, 70);
    this.camera.position.set(9.5, 9.5, 13.5);
    this.camera.lookAt(0, 0.55, 0);

    this._buildWorld();
    this.setCatalog(this._catalog);
    this.setTheme(this._night);
    this.resize();

    if (typeof ResizeObserver === 'function') {
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(this.canvas);
      if (this.canvas.parentElement) this._ro.observe(this.canvas.parentElement);
    }

    this._bind(this.canvas, 'pointermove', this._onPointer);
    this._bind(this.canvas, 'pointerleave', this._onPointerLeave);
    this._bind(this.canvas, 'click', this._onClick);
    this._bind(this.canvas, 'webglcontextlost', (e) => {
      e.preventDefault();
      this.webglOk = false;
      this.setEnabled(false);
    });

    if (typeof matchMedia === 'function') {
      this._motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
      const onMotion = (e) => {
        this.reducedMotion = !!e.matches;
        this.requestRender();
      };
      if (typeof this._motionQuery.addEventListener === 'function') {
        this._bind(this._motionQuery, 'change', onMotion);
      }
    }

    this.requestRender();
    return true;
  }

  /**
   * @param {EventTarget} el
   * @param {string} type
   * @param {EventListener} fn
   * @param {AddEventListenerOptions|boolean} [options]
   */
  _bind(el, type, fn, options) {
    el.addEventListener(type, fn, options);
    this._bindings.push(() => el.removeEventListener(type, fn, options));
  }

  mat(color, extra) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.65,
      metalness: 0,
      ...(extra || {}),
    });
  }

  shape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    r = Math.min(r, w / 2, h / 2);
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  roundMesh(w, h, d, r, material) {
    const g = new THREE.ExtrudeGeometry(this.shape(w, h, r), {
      depth: d,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: Math.min(d * 0.22, 0.035),
      bevelThickness: Math.min(d * 0.22, 0.035),
      curveSegments: 12,
    });
    g.translate(0, 0, -d / 2);
    return new THREE.Mesh(g, material);
  }

  slab(parent, w, h, d, r, material, x, y, z) {
    const m = this.roundMesh(w, h, d, r, material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  mesh(parent, geo, material, x, y, z) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x || 0, y || 0, z || 0);
    parent.add(m);
    return m;
  }

  texture(draw, w, h) {
    const c = document.createElement('canvas');
    c.width = w || 1024;
    c.height = h || 640;
    draw(c.getContext('2d'), c.width, c.height);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    this._textures.push(t);
    return t;
  }

  screenTexture(name) {
    const title = String(name || '工作台').slice(0, 15);
    return this.texture((c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#e2d8c7');
      g.addColorStop(0.4, '#efded2');
      g.addColorStop(1, '#d4c6d9');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff9';
      c.beginPath();
      c.arc(w * 0.86, h * 0.27, 105, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#79716b';
      c.font = '18px sans-serif';
      c.fillText('当前工作集', 62, 72);
      c.fillStyle = '#3c4144';
      c.font = '500 72px sans-serif';
      c.fillText(title, 60, 195);
      c.font = '22px sans-serif';
      c.fillStyle = '#847c73';
      c.fillText('思路在这里，随时接着来。', 64, 246);
      const cards = ['项目', '灵感', '记录'];
      const tones = ['#79988b', '#b58875', '#9c90aa'];
      for (let i = 0; i < 3; i += 1) {
        c.fillStyle = ['#f7f3ecd9', '#f8f4edaa', '#f8f4ed99'][i];
        if (typeof c.roundRect === 'function') {
          c.beginPath();
          c.roundRect(63 + i * 303, 328, 277, 209, 17);
          c.fill();
          c.fillStyle = tones[i];
          c.beginPath();
          c.roundRect(88 + i * 303, 354, 39, 39, 10);
          c.fill();
        } else {
          c.fillRect(63 + i * 303, 328, 277, 209);
          c.fillStyle = tones[i];
          c.fillRect(88 + i * 303, 354, 39, 39);
        }
        c.fillStyle = '#4d5556';
        c.font = '500 22px sans-serif';
        c.fillText(cards[i], 89 + i * 303, 438);
        c.fillStyle = '#b7b4ac';
        c.fillRect(89 + i * 303, 465, 155, 5);
        c.fillRect(89 + i * 303, 483, 113, 5);
      }
    });
  }

  _buildWorld() {
    this.hemi = new THREE.HemisphereLight(0xfff6e8, 0x8b8193, 2.2);
    this.world.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xffe4c4, 4.0);
    this.key.position.set(-4, 12, 6);
    this.world.add(this.key);
    this.fill = new THREE.DirectionalLight(0xc8d4f5, 1.0);
    this.fill.position.set(6, 4, -5);
    this.world.add(this.fill);

    this.tableMat = this.mat(0xe4d6c3, { roughness: 0.42 });
    this.edgeMat = this.mat(0xc2ad93, { roughness: 0.47 });
    this.steel = this.mat(0x888b8b, { metalness: 0.6, roughness: 0.35 });

    // Thick rounded desk slab (edge + top).
    this.slab(this.world, 9.2, 5.2, 0.4, 0.58, this.edgeMat, 0, -0.04, 0);
    this.slab(this.world, 9.2, 5.2, 0.12, 0.58, this.tableMat, 0, 0.21, 0);
    this._addContactShadow(this.world, 0, 0, 6.4, 3.6, 0.1);

    this._createMonitor();
    this._createFolders();
    this._createNote();
  }

  _addContactShadow(parent, x, z, sx, sz, opacity) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x665950,
      transparent: true,
      opacity: opacity == null ? 0.12 : opacity,
      depthWrite: false,
      toneMapped: false,
    });
    const disk = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), mat);
    disk.rotation.x = -Math.PI / 2;
    disk.position.set(x, 0.098, z);
    disk.scale.set(sx, sz, 1);
    parent.add(disk);
    return disk;
  }

  /**
   * @param {string} key
   * @param {THREE.Group} group
   * @param {number[]} anchor
   * @param {string} id
   * @param {'workset'|'note'} kind
   * @param {string} label
   */
  _register(key, group, anchor, id, kind, label) {
    const entry = {
      key,
      id,
      kind,
      label,
      group,
      baseY: group.position.y,
      target: 0,
      offset: 0,
      anchor: new THREE.Vector3(anchor[0], anchor[1], anchor[2]),
    };
    this.objects.push(entry);
    group.traverse((o) => {
      if (o.isMesh) {
        o.userData.pick = key;
        this.pickables.push(o);
      }
    });
    return entry;
  }

  _createMonitor() {
    const group = new THREE.Group();
    group.position.set(-1.4, 0.35, -0.48);
    this.world.add(group);

    this.slab(group, 1.15, 0.72, 0.08, 0.18, this.steel, 0, 0.025, 0.03);
    this.mesh(group, new THREE.BoxGeometry(0.18, 0.78, 0.18), this.steel, 0, 0.38, -0.2);

    const frame = this.roundMesh(3.3, 2.02, 0.18, 0.12, this.mat(0x31373a, { roughness: 0.42, metalness: 0.28 }));
    frame.position.set(0, 1.43, -0.22);
    frame.rotation.x = -0.075;
    group.add(frame);

    this.displayMat = new THREE.MeshBasicMaterial({
      map: this.screenTexture('工作台'),
      toneMapped: false,
    });
    const screenGeometry = new THREE.ShapeGeometry(this.shape(3.1, 1.81, 0.07));
    const uv = screenGeometry.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(i, uv.getX(i) / 3.1 + 0.5, uv.getY(i) / 1.81 + 0.5);
    }
    const display = new THREE.Mesh(screenGeometry, this.displayMat);
    display.position.set(0, 1.43, -0.055);
    display.rotation.x = -0.075;
    group.add(display);

    this._addContactShadow(group, 0, 0.05, 2.2, 1.1, 0.14);
    this._monitor = this._register(PICK_PRIMARY, group, [-1.85, 3.12, -0.71], '', 'workset', '');
  }

  _createFolders() {
    const group = new THREE.Group();
    group.position.set(2.02, 0.35, -0.68);
    group.rotation.y = -0.15;
    this.world.add(group);

    const bottom = this.mat(0xb8785d, { roughness: 0.67 });
    const top = this.mat(0xd99d7d, { roughness: 0.63 });
    const paper = this.mat(0xf4efe6);
    this.slab(group, 1.72, 1.55, 0.08, 0.07, bottom, 0, 0.035, 0);
    for (let i = 0; i < 3; i += 1) {
      this.slab(group, 1.55, 1.4, 0.025, 0.035, paper, 0.01, 0.09 + i * 0.037, -0.03);
    }
    const cover = this.slab(group, 1.72, 1.55, 0.048, 0.06, top, 0, 0.24, 0);
    cover.rotation.z = 0.09;
    this.slab(group, 0.65, 0.19, 0.048, 0.035, top, -0.44, 0.24, -0.81);

    const tagTex = this.texture((c, w, h) => {
      c.fillStyle = '#f1d1b5';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#785541';
      c.font = '500 32px sans-serif';
      c.fillText('工作集', 28, 55);
      c.font = '18px sans-serif';
      c.fillText('值得收好的灵感', 28, 95);
    }, 384, 128);
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.02, 0.34),
      new THREE.MeshBasicMaterial({ map: tagTex, toneMapped: true })
    );
    tag.rotation.x = -Math.PI / 2;
    tag.position.set(0.17, 0.285, -0.21);
    group.add(tag);

    this._addContactShadow(group, 0, 0, 1.6, 1.3, 0.12);
    this._folder = this._register(PICK_SECONDARY, group, [2.04, 1.04, -0.72], '', 'workset', '');
  }

  _createNote() {
    const group = new THREE.Group();
    group.position.set(1.65, 0.35, 1.52);
    group.rotation.y = 0.14;
    this.world.add(group);

    this.slab(group, 1.32, 0.95, 0.09, 0.035, this.mat(0xdcc88e), 0, 0.045, 0);
    const tex = this.texture((c, w, h) => {
      c.fillStyle = '#f5e5b4';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#897953';
      c.font = '500 37px sans-serif';
      c.fillText('随手记', 43, 74);
      c.strokeStyle = '#bdaa772f';
      c.lineWidth = 2;
      for (let y = 120; y < 260; y += 35) {
        c.beginPath();
        c.moveTo(42, y);
        c.lineTo(w - 42, y);
        c.stroke();
      }
      c.fillStyle = '#a29062';
      c.font = '23px sans-serif';
      c.fillText('记下一个好想法。', 43, 160);
    }, 512, 358);
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.93),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    p.rotation.x = -Math.PI / 2;
    p.position.y = 0.095;
    group.add(p);

    this._addContactShadow(group, 0, 0, 1.2, 0.9, 0.1);
    this._note = this._register(PICK_NOTE, group, [1.75, 0.6, 2.3], NOTE_ID, 'note', '随手记');
  }

  /**
   * @param {{ worksets?: Array<{ id: string, name: string, tabs?: unknown[] }>, noteLabel?: string }} catalog
   */
  setCatalog(catalog) {
    this._catalog = catalog || { worksets: [], noteLabel: '随手记' };
    if (!this.world) return;

    const worksets = Array.isArray(this._catalog.worksets)
      ? this._catalog.worksets.filter((w) => w && w.id).slice(0, MAX_DESK_WORKSETS)
      : [];

    if (this._monitor) {
      const w = worksets[0];
      this._monitor.group.visible = !!w;
      this._monitor.id = w ? w.id : '';
      this._monitor.label = w ? String(w.name || '工作集') : '';
      if (w && this.displayMat) {
        const old = this.displayMat.map;
        this.displayMat.map = this.screenTexture(w.name || '工作台');
        this.displayMat.needsUpdate = true;
        if (old) {
          old.dispose();
          this._textures = this._textures.filter((t) => t !== old);
        }
      }
    }

    if (this._folder) {
      const w = worksets[1];
      this._folder.group.visible = !!w;
      this._folder.id = w ? w.id : '';
      this._folder.label = w ? String(w.name || '工作集') : '';
    }

    if (this._note) {
      this._note.group.visible = true;
      this._note.id = NOTE_ID;
      this._note.label = String(this._catalog.noteLabel || '随手记');
    }

    this._syncLabels();
    this.requestRender();
  }

  /**
   * @param {boolean} night
   */
  setTheme(night) {
    this._night = !!night;
    if (!this.world) return;
    if (night) {
      this.hemi.intensity = 0.85;
      this.hemi.color.set(0x859ac3);
      this.hemi.groundColor.set(0x665275);
      this.key.intensity = 1.0;
      this.key.color.set(0xa1b5e6);
      this.fill.intensity = 0.55;
      this.tableMat.color.set(0x68717c);
      this.edgeMat.color.set(0x424952);
    } else {
      this.hemi.intensity = 2.2;
      this.hemi.color.set(0xfff6e8);
      this.hemi.groundColor.set(0x8b8193);
      this.key.intensity = 4.0;
      this.key.color.set(0xffe4c4);
      this.fill.intensity = 1.0;
      this.tableMat.color.set(0xe4d6c3);
      this.edgeMat.color.set(0xc2ad93);
    }
    this.requestRender();
  }

  setEnabled(on) {
    this.enabled = on;
    this.canvas.style.display = on && this.webglOk ? 'block' : 'none';
    if (on && this.webglOk) this.requestRender();
    else this.stopLoop();
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const parent = this.canvas.parentElement;
    const w = (parent && parent.clientWidth) || this.canvas.clientWidth || 1;
    const h = (parent && parent.clientHeight) || this.canvas.clientHeight || 1;
    if (!w || !h) return;
    const pr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    const a = w / h;
    const span = Math.max(7.15, 11.15 / a);
    this.camera.left = (-span * a) / 2;
    this.camera.right = (span * a) / 2;
    this.camera.top = span / 2;
    this.camera.bottom = -span / 2;
    this.camera.updateProjectionMatrix();
    this._syncLabels();
    this.requestRender();
  }

  _syncLabels() {
    if (!this.camera) return;
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    const map = {
      [PICK_PRIMARY]: this._labelEls.primary,
      [PICK_SECONDARY]: this._labelEls.secondary,
      [PICK_NOTE]: this._labelEls.note,
    };
    for (const obj of this.objects) {
      const el = map[obj.key];
      if (!el) continue;
      const visible = !!(obj.group && obj.group.visible && obj.id);
      el.hidden = !visible;
      if (!visible) continue;
      const title = el.querySelector('strong');
      const meta = el.querySelector('small');
      if (obj.kind === 'note') {
        if (title) title.textContent = obj.label || '随手记';
        if (meta) meta.textContent = '';
      } else {
        const ws = (this._catalog.worksets || []).find((x) => x.id === obj.id);
        const name = (ws && ws.name) || obj.label || '工作集';
        const n = ws && Array.isArray(ws.tabs) ? ws.tabs.length : 0;
        if (title) title.textContent = name;
        if (meta) meta.textContent = `${n} 个标签`;
      }
      el.setAttribute('aria-label', `${title ? title.textContent : ''} ${meta && meta.textContent ? meta.textContent : ''}`.trim());
      this._project.copy(obj.anchor);
      this._project.y += obj.offset;
      this._project.project(this.camera);
      const x = (this._project.x * 0.5 + 0.5) * w;
      const y = (-this._project.y * 0.5 + 0.5) * h;
      const half = el.offsetWidth / 2 + 8;
      el.style.left = `${Math.min(w - half, Math.max(half, x))}px`;
      el.style.top = `${Math.max(24, Math.min(h - 25, y))}px`;
    }
  }

  _setLoop(state) {
    if (this.canvas) this.canvas.dataset.desk3dLoop = state;
    const mount = this.canvas && this.canvas.closest('#desk-3d-mount');
    if (mount) mount.dataset.desk3dLoop = state;
  }

  requestRender() {
    if (!this.enabled || !this.webglOk || this._disposed) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    this._until = performance.now() + (this.reducedMotion ? 80 : 420);
    if (!this._raf) {
      this._setLoop('live');
      this._raf = requestAnimationFrame((t) => this._frame(t));
    }
  }

  stopLoop() {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
    this._setLoop('idle');
  }

  _frame(t) {
    this._raf = 0;
    if (!this.renderer || !this.world || !this.camera) {
      this._setLoop('idle');
      return;
    }
    if (!this.enabled || document.visibilityState === 'hidden') {
      this._setLoop('idle');
      return;
    }
    for (const obj of this.objects) {
      obj.offset = this.reducedMotion ? 0 : obj.offset + (obj.target - obj.offset) * 0.22;
      obj.group.position.y = obj.baseY + obj.offset;
    }
    this.renderer.render(this.world, this.camera);
    this._syncLabels();
    if (!this.reducedMotion && t < this._until) {
      this._setLoop('live');
      this._raf = requestAnimationFrame((n) => this._frame(n));
      return;
    }
    // Idle stop after brief response window (also covers reduced-motion single frame).
    clearTimeout(this._idleTimer);
    this._idleTimer = window.setTimeout(() => this.stopLoop(), this.reducedMotion ? 400 : IDLE_MS);
    this._setLoop('idle');
  }

  _setHover(key) {
    if (this._hover === key) return;
    this._hover = key;
    this.canvas.style.cursor = key ? 'pointer' : 'default';
    for (const obj of this.objects) {
      obj.target = key === obj.key && !this.reducedMotion ? HOVER_LIFT : 0;
    }
    this.requestRender();
  }

  /**
   * Expose hover for DOM label focus/pointer parity.
   * @param {string|null} key
   */
  setHover(key) {
    this._setHover(key || null);
  }

  _pick(event, click) {
    if (!this.enabled || !this.webglOk || !this.world) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    let key = null;
    for (const hit of hits) {
      let o = hit.object;
      let blocked = false;
      while (o) {
        if (!o.visible) {
          blocked = true;
          break;
        }
        if (o.userData && o.userData.pick) {
          if (!blocked) key = o.userData.pick;
          break;
        }
        o = o.parent;
      }
      if (key) break;
    }
    this._setHover(key);
    if (click && key) {
      const obj = this.objects.find((o) => o.key === key);
      if (obj && obj.id) this.onPick(obj.id, obj.kind);
    }
  }

  dispose() {
    this._disposed = true;
    this.stopLoop();
    clearTimeout(this._idleTimer);
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
    for (const unbind of this._bindings) unbind();
    this._bindings = [];
    if (this.world) {
      this.world.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (m.map) m.map.dispose();
            m.dispose();
          }
        }
      });
    }
    for (const t of this._textures) t.dispose();
    this._textures = [];
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
