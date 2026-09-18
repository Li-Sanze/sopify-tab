/**
 * Fixed-view desk scene (Three.js r170, local ESM).
 * No orbit / free roam / physics. Procedural geometry only.
 * Wake sources are canvas-scoped or ResizeObserver — no window listeners.
 */

import * as THREE from './vendor/three/three.module.js';

const IDLE_MS = 2500;
const MAX_PIXEL_RATIO = 1.5;

/** @typedef {{ id: string, kind: 'workset'|'note', label: string, mesh: THREE.Object3D }} Pickable */

export class DeskScene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ onPick: (id: string, kind: string) => void, reducedMotion: boolean }} opts
   */
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.onPick = opts.onPick;
    this.reducedMotion = opts.reducedMotion;
    this.enabled = true;
    this.webglOk = false;
    this._raf = 0;
    this._needsFrame = true;
    this._idleTimer = 0;
    this._disposed = false;
    /** @type {Pickable[]} */
    this.pickables = [];

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._highlight = null;
    this._ro = null;

    this._onPointer = (e) => this._handlePointer(e);
    this._onPointerLeave = () => this._clearHighlight();
    this._onClick = (e) => this._handleClick(e);
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
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    // Additive on NTP: keep CSS sky; stage CSS paints the board wash.
    this.scene.background = null;

    const aspect = this._aspect();
    this.camera = new THREE.PerspectiveCamera(24, aspect, 0.1, 100);
    this.camera.position.set(0.55, 3.7, 3.85);
    this.camera.lookAt(0.55, 0.14, 0.3);

    this._buildWorld();
    this.resize();

    if (typeof ResizeObserver === 'function') {
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(this.canvas);
      if (this.canvas.parentElement) this._ro.observe(this.canvas.parentElement);
    }

    this.canvas.addEventListener('pointermove', this._onPointer);
    this.canvas.addEventListener('pointerleave', this._onPointerLeave);
    this.canvas.addEventListener('click', this._onClick);

    this.requestRender();
    return true;
  }

  _aspect() {
    const w = this.canvas.clientWidth || 640;
    const h = this.canvas.clientHeight || 400;
    return w / Math.max(h, 1);
  }

  _buildWorld() {
    const hemi = new THREE.HemisphereLight(0xf0f6fc, 0xddd4c6, 1.35);
    const amb = new THREE.AmbientLight(0xf7f9fc, 1.55);
    const key = new THREE.DirectionalLight(0xfff6ea, 2.55);
    key.position.set(2.2, 5.6, 2.6);
    const fill = new THREE.DirectionalLight(0xc9d8ea, 0.72);
    fill.position.set(-2.6, 3.0, -1.0);
    this.scene.add(hemi, amb, key, fill);

    const deskMat = new THREE.MeshStandardMaterial({
      color: 0xf4efe6,
      roughness: 0.68,
      metalness: 0.0,
    });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.18, 6.2), deskMat);
    desk.position.set(0, 0, 0);
    this.scene.add(desk);

    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 0.28, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xd9d0c2, roughness: 0.85, metalness: 0 })
    );
    lip.position.set(0, -0.05, 3.1);
    this.scene.add(lip);

    const legMat = new THREE.MeshStandardMaterial({ color: 0xc8beb0, roughness: 0.75, metalness: 0 });
    const legGeo = new THREE.BoxGeometry(0.18, 1.1, 0.18);
    for (const [x, z] of [
      [-4.2, -2.6],
      [4.2, -2.6],
      [-4.2, 2.6],
      [4.2, 2.6],
    ]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, -0.64, z);
      this.scene.add(leg);
    }

    this._addFolder('focus', '专注工作集', -0.55, 0.55, 0x5b8fd4);
    this._addFolder('research', '调研工作集', 0.75, 0.35, 0x5fa88a);
    this._addNote('n1', '便签 A', 1.55, 0.55, 0xffef8a);
    this._addNote('n2', '便签 B', 2.15, -0.05, 0xffc6d4);

    this._addContactShadow(0.6, -0.85, 1.5, 1.0);
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.04, 1.1),
      new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 0.7, metalness: 0 })
    );
    pad.position.set(0.6, 0.12, -0.85);
    this.scene.add(pad);
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} sx
   * @param {number} sz
   */
  _addContactShadow(x, z, sx, sz) {
    const addDisk = (opacity, mul, y) => {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x1c2430,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const disk = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), mat);
      disk.rotation.x = -Math.PI / 2;
      disk.position.set(x, y, z);
      disk.scale.set(sx * mul, sz * mul, 1);
      disk.renderOrder = 2;
      this.scene.add(disk);
    };
    addDisk(0.28, 1.12, 0.098);
    addDisk(0.12, 1.65, 0.096);
  }

  /**
   * @param {string} text
   * @param {string} bgHex
   * @param {string} ink
   * @param {number} width
   * @param {number} depth
   */
  _makeFaceLabel(text, bgHex, ink, width, depth) {
    const c = document.createElement('canvas');
    c.width = 768;
    c.height = 384;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 768, 384);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(0, 0, 768, 96);
    ctx.fillStyle = ink;
    ctx.font = '700 64px Segoe UI, PingFang SC, Microsoft YaHei, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxW = 680;
    if (ctx.measureText(text).width <= maxW) {
      ctx.fillText(text, 384, 200);
    } else {
      const mid = Math.ceil(text.length / 2);
      ctx.fillText(text.slice(0, mid), 384, 168);
      ctx.fillText(text.slice(mid), 384, 240);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      toneMapped: false,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
    plane.rotation.x = -Math.PI / 2;
    return plane;
  }

  /**
   * @param {string} id
   * @param {string} label
   * @param {number} x
   * @param {number} z
   * @param {number} color
   */
  _addFolder(id, label, x, z, color) {
    const group = new THREE.Group();
    group.position.set(x, 0.12, z);
    this._addContactShadow(x, z, 1.45, 1.05);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.08, 1.0),
      new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0 })
    );
    body.position.y = 0.04;
    group.add(body);

    const tab = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.06, 0.22),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 })
    );
    tab.position.set(-0.3, 0.11, -0.42);
    group.add(tab);

    const face = this._makeFaceLabel(label, `#${color.toString(16).padStart(6, '0')}`, '#ffffff', 1.22, 0.72);
    face.position.set(0, 0.085, 0.02);
    group.add(face);

    group.userData = { id, kind: 'workset', label };
    this.scene.add(group);
    this.pickables.push({ id, kind: 'workset', label, mesh: group });
  }

  /**
   * @param {string} id
   * @param {string} label
   * @param {number} x
   * @param {number} z
   * @param {number} color
   */
  _addNote(id, label, x, z, color) {
    const group = new THREE.Group();
    group.position.set(x, 0.13, z);
    group.rotation.y = (id === 'n2' ? -1 : 1) * 0.12;
    this._addContactShadow(x, z, 1.05, 1.0);

    const paper = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.03, 0.95),
      new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0 })
    );
    group.add(paper);

    const face = this._makeFaceLabel(label, `#${color.toString(16).padStart(6, '0')}`, '#2a3340', 0.88, 0.88);
    face.position.set(0, 0.02, 0);
    group.add(face);

    group.userData = { id, kind: 'note', label };
    this.scene.add(group);
    this.pickables.push({ id, kind: 'note', label, mesh: group });
  }

  setEnabled(on) {
    this.enabled = on;
    this.canvas.style.display = on && this.webglOk ? 'block' : 'none';
    if (on && this.webglOk) this.requestRender();
    else this.stopLoop();
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    const pr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  requestRender() {
    if (!this.enabled || !this.webglOk || this._disposed) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    this._needsFrame = true;
    this._bumpIdle();
    if (!this._raf) this._raf = requestAnimationFrame(() => this._frame());
  }

  _bumpIdle() {
    clearTimeout(this._idleTimer);
    this._idleTimer = window.setTimeout(() => {
      this._needsFrame = false;
      this.stopLoop();
    }, this.reducedMotion ? 400 : IDLE_MS);
  }

  stopLoop() {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
  }

  _frame() {
    this._raf = 0;
    if (!this._needsFrame || !this.renderer || !this.scene || !this.camera) return;
    if (!this.enabled || document.visibilityState === 'hidden') return;
    this.renderer.render(this.scene, this.camera);
  }

  _eventToNDC(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _intersect(e) {
    if (!this.camera || !this.scene) return null;
    this._eventToNDC(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = this.pickables.map((p) => p.mesh);
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (!hits.length) return null;
    let obj = hits[0].object;
    while (obj && !obj.userData?.id) obj = obj.parent;
    return obj?.userData?.id ? obj : null;
  }

  _clearHighlight() {
    if (!this._highlight) return;
    this._highlight = null;
    this.canvas.style.cursor = 'default';
    for (const p of this.pickables) {
      p.mesh.position.y = p.kind === 'note' ? 0.13 : 0.12;
    }
    this.requestRender();
  }

  _handlePointer(e) {
    if (!this.enabled || !this.webglOk) return;
    this.requestRender();
    const hit = this._intersect(e);
    const id = hit?.userData?.id || null;
    if (id !== this._highlight) {
      this._highlight = id;
      this.canvas.style.cursor = id ? 'pointer' : 'default';
      for (const p of this.pickables) {
        const y = p.kind === 'note' ? 0.13 : 0.12;
        const boost = !this.reducedMotion && p.id === id ? 0.06 : 0;
        p.mesh.position.y = y + boost;
      }
      this.requestRender();
    }
  }

  _handleClick(e) {
    if (!this.enabled || !this.webglOk) return;
    const hit = this._intersect(e);
    if (!hit) return;
    this.onPick(hit.userData.id, hit.userData.kind);
  }

  dispose() {
    this._disposed = true;
    this.stopLoop();
    clearTimeout(this._idleTimer);
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
    this.canvas.removeEventListener('pointermove', this._onPointer);
    this.canvas.removeEventListener('pointerleave', this._onPointerLeave);
    this.canvas.removeEventListener('click', this._onClick);
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
