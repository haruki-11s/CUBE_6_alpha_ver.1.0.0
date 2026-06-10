import * as THREE from 'three';
import type { Mark, Player } from '../core/types';
import { fromIndex } from '../core/board';
import { LINES } from '../core/lines';

const CELL_SIZE = 1.2;
const BOARD_OFFSET = -CELL_SIZE;
const HALF = CELL_SIZE / 2;

const COLOR_O        = 0x4488ff;
const COLOR_X        = 0xff3344;
const COLOR_EMPTY    = 0x1a1a2e;
const COLOR_HIGHLIGHT= 0xffee44;
const COLOR_GRID_INNER = 0x2a4466;
const COLOR_GRID_OUTER = 0x4488bb;

// ── Tween ─────────────────────────────────────────────────────────────────
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
function tween(ms: number, onUpdate: (t: number) => void): Promise<void> {
  // Skip animation entirely when page is hidden (background tab / preview context)
  if (document.hidden) { onUpdate(1); return Promise.resolve(); }
  return new Promise(resolve => {
    const start = performance.now();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      onUpdate(1);
      resolve();
    };
    // Safety net: if rAF stops firing (tab goes hidden mid-animation), resolve after timeout
    const fallback = setTimeout(finish, ms + 1000);
    const tick = (now: number) => {
      if (settled) return;
      const raw = Math.min((now - start) / ms, 1);
      onUpdate(easeInOut(raw));
      if (raw < 1) requestAnimationFrame(tick);
      else { clearTimeout(fallback); finish(); }
    };
    requestAnimationFrame(tick);
  });
}

// ── Positional helpers ────────────────────────────────────────────────────
function homePos(index: number): THREE.Vector3 {
  const [x, y, z] = fromIndex(index);
  return new THREE.Vector3(
    x * CELL_SIZE + BOARD_OFFSET,
    y * CELL_SIZE + BOARD_OFFSET,
    z * CELL_SIZE + BOARD_OFFSET,
  );
}
function layerPivot(axis: 'X'|'Y'|'Z', layer: number): THREE.Vector3 {
  const off = layer * CELL_SIZE + BOARD_OFFSET;
  if (axis === 'X') return new THREE.Vector3(off, 0, 0);
  if (axis === 'Y') return new THREE.Vector3(0, off, 0);
  return new THREE.Vector3(0, 0, off);
}
function getLayerIndices(axis: 'X'|'Y'|'Z', layer: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 27; i++) {
    const c = fromIndex(i);
    const v = axis === 'X' ? c[0] : axis === 'Y' ? c[1] : c[2];
    if (v === layer) out.push(i);
  }
  return out;
}

// ── Scene3D ───────────────────────────────────────────────────────────────
export class Scene3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private spheres: THREE.Mesh[] = [];
  private previewMeshes: THREE.Mesh[] = [];

  private currentBoard: Mark[] = Array(27).fill(null);

  private isDragging = false;
  private lastMouse = { x: 0, y: 0 };
  private spherical = { theta: Math.PI / 4, phi: Math.PI / 3, radius: 8 };

  private onCellClick?: (index: number) => void;
  private raycaster = new THREE.Raycaster();

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.updateCamera();

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 8, 5);
    this.scene.add(dir);

    this.buildGrid();
    this.buildSpheres();
    this.bindEvents();
    this.resize();
    this.animate();
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  // ── Grid ─────────────────────────────────────────────────────────────
  private buildGrid(): void {
    const lo = BOARD_OFFSET - HALF;
    const hi = BOARD_OFFSET + 2 * CELL_SIZE + HALF;
    const matI = new THREE.LineBasicMaterial({ color: COLOR_GRID_INNER, transparent: true, opacity: 0.55 });
    const matO = new THREE.LineBasicMaterial({ color: COLOR_GRID_OUTER, transparent: true, opacity: 0.90 });
    const dividers = [-HALF, HALF, CELL_SIZE + HALF, 2 * CELL_SIZE + HALF].map(d => d + BOARD_OFFSET);

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const mat = ((i === 0 || i === 3) && (j === 0 || j === 3)) ? matO : matI;
        const di = dividers[i], dj = dividers[j];
        this.scene.add(this.makeLine(new THREE.Vector3(lo, di, dj), new THREE.Vector3(hi, di, dj), mat));
        this.scene.add(this.makeLine(new THREE.Vector3(di, lo, dj), new THREE.Vector3(di, hi, dj), mat));
        this.scene.add(this.makeLine(new THREE.Vector3(di, dj, lo), new THREE.Vector3(di, dj, hi), mat));
      }
    }
  }
  private makeLine(a: THREE.Vector3, b: THREE.Vector3, mat: THREE.LineBasicMaterial): THREE.Line {
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), mat);
  }

  // ── Spheres ───────────────────────────────────────────────────────────
  private buildSpheres(): void {
    const geo = new THREE.SphereGeometry(0.34, 16, 16);
    for (let i = 0; i < 27; i++) {
      const mat = new THREE.MeshPhongMaterial({ color: COLOR_EMPTY, transparent: true, opacity: 0.04, shininess: 60 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(homePos(i));
      mesh.userData = { index: i };
      this.spheres.push(mesh);
      this.scene.add(mesh);
    }
  }

  // ── Board update ──────────────────────────────────────────────────────
  updateBoard(board: Mark[], highlights: number[] = []): void {
    this.currentBoard = board.slice();
    const hl = new Set(highlights);
    for (let i = 0; i < 27; i++) {
      const mat = this.spheres[i].material as THREE.MeshPhongMaterial;
      const h = hl.has(i);
      this.spheres[i].position.copy(homePos(i));
      this.spheres[i].scale.setScalar(1);
      if (board[i] === 'O') {
        mat.color.setHex(h ? 0x88ccff : COLOR_O);
        mat.emissive.setHex(h ? 0x224488 : 0x112244);
        mat.opacity = 1; mat.transparent = false;
      } else if (board[i] === 'X') {
        mat.color.setHex(h ? 0xff8899 : COLOR_X);
        mat.emissive.setHex(h ? 0x441122 : 0x220011);
        mat.opacity = 1; mat.transparent = false;
      } else {
        mat.color.setHex(h ? COLOR_HIGHLIGHT : COLOR_EMPTY);
        mat.emissive.setHex(h ? 0x221800 : 0x000000);
        mat.opacity = h ? 0.18 : 0.04; mat.transparent = true;
      }
      mat.needsUpdate = true;
    }
  }

  // ── Preview (ghost overlay) ───────────────────────────────────────────
  showPreview(previewBoard: Mark[], currentBoard: Mark[]): void {
    this.clearPreview();
    const geo = new THREE.SphereGeometry(0.26, 12, 12);
    for (let i = 0; i < 27; i++) {
      if (previewBoard[i] === currentBoard[i]) continue;
      if (previewBoard[i] !== null) {
        const mat = new THREE.MeshPhongMaterial({
          color: previewBoard[i] === 'O' ? 0x88ccff : 0xff8899,
          transparent: true, opacity: 0.38, emissive: previewBoard[i] === 'O' ? 0x112244 : 0x220011,
        });
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(homePos(i));
        this.scene.add(m);
        this.previewMeshes.push(m);
      }
      if (currentBoard[i] !== null) {
        (this.spheres[i].material as THREE.MeshPhongMaterial).opacity = 0.28;
      }
    }
  }
  clearPreview(): void {
    for (const m of this.previewMeshes) this.scene.remove(m);
    this.previewMeshes = [];
    this.updateBoard(this.currentBoard);
  }

  // ── Win flash ─────────────────────────────────────────────────────────
  async flashWinCells(player: Player): Promise<void> {
    const winning: number[] = [];
    for (const [a, b, c] of LINES) {
      if (this.currentBoard[a] === player && this.currentBoard[b] === player && this.currentBoard[c] === player) {
        winning.push(a, b, c);
      }
    }
    const cells = [...new Set(winning)];
    for (let flash = 0; flash < 3; flash++) {
      await tween(180, t => {
        for (const i of cells) {
          (this.spheres[i].material as THREE.MeshPhongMaterial).emissive.setScalar(t * 0.6);
        }
      });
      await tween(180, t => {
        for (const i of cells) {
          (this.spheres[i].material as THREE.MeshPhongMaterial).emissive.setScalar((1 - t) * 0.6);
        }
      });
    }
  }

  // ── Animations ────────────────────────────────────────────────────────
  async animatePlace(index: number, newBoard: Mark[]): Promise<void> {
    this.updateBoard(newBoard);
    this.spheres[index].scale.setScalar(0);
    await tween(280, t => this.spheres[index].scale.setScalar(t));
  }

  async animateMove(from: number, to: number, newBoard: Mark[], mark: Mark): Promise<void> {
    const fromP = homePos(from);
    const toP   = homePos(to);
    // Show moving sphere (will land at "to") starting from "from" position
    const toMat = this.spheres[to].material as THREE.MeshPhongMaterial;
    toMat.color.setHex(mark === 'O' ? COLOR_O : COLOR_X);
    toMat.emissive.setHex(mark === 'O' ? 0x112244 : 0x220011);
    toMat.opacity = 0; toMat.transparent = true;
    this.spheres[to].position.copy(fromP);
    const fromMat = this.spheres[from].material as THREE.MeshPhongMaterial;
    await tween(360, t => {
      this.spheres[to].position.lerpVectors(fromP, toP, t);
      toMat.opacity = t;
      fromMat.opacity = Math.max(0, 1 - t);
    });
    this.spheres[to].position.copy(toP);
    this.updateBoard(newBoard);
  }

  async animateRotate(
    axis: 'X'|'Y'|'Z', layer: 0|1|2, dir: 'CW'|'CCW', newBoard: Mark[],
  ): Promise<void> {
    const indices  = getLayerIndices(axis, layer);
    const pivotPos = layerPivot(axis, layer);
    const pivot    = new THREE.Group();
    pivot.position.copy(pivotPos);
    this.scene.add(pivot);

    for (const i of indices) {
      this.scene.remove(this.spheres[i]);
      this.spheres[i].position.sub(pivotPos);
      pivot.add(this.spheres[i]);
    }

    // CCW = +PI/2 (right-hand rule), CW = -PI/2
    const angle = dir === 'CCW' ? Math.PI / 2 : -Math.PI / 2;
    await tween(420, t => {
      const a = angle * t;
      if (axis === 'X')      pivot.rotation.x = a;
      else if (axis === 'Y') pivot.rotation.y = a;
      else                   pivot.rotation.z = a;
    });

    // Brief fade for snap
    const opacities = indices.map(i => (this.spheres[i].material as THREE.MeshPhongMaterial).opacity);
    await tween(70, t => {
      indices.forEach((idx, j) => {
        (this.spheres[idx].material as THREE.MeshPhongMaterial).opacity = opacities[j] * (1 - t);
      });
    });

    // De-parent, snap to home
    for (const i of indices) {
      pivot.remove(this.spheres[i]);
      this.spheres[i].position.copy(homePos(i));
      this.scene.add(this.spheres[i]);
    }
    this.scene.remove(pivot);
    this.updateBoard(newBoard);
  }

  async animateSlide(
    axis: 'X'|'Y'|'Z', dir: 'forward'|'backward', newBoard: Mark[],
  ): Promise<void> {
    const axIdx = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
    // forward: c→(c-1)mod3, so non-wrapping slides -1; backward slides +1
    const slideAmt   = dir === 'forward' ? -CELL_SIZE : CELL_SIZE;
    const wrapCoord  = dir === 'forward' ? 0 : 2;

    const startPos   = this.spheres.map(s => s.position.clone());
    const wrapIdx: number[] = [];
    const slideIdx: number[] = [];
    for (let i = 0; i < 27; i++) {
      (fromIndex(i)[axIdx] === wrapCoord ? wrapIdx : slideIdx).push(i);
    }

    // Fade out wrapping pieces immediately
    for (const i of wrapIdx) {
      (this.spheres[i].material as THREE.MeshPhongMaterial).opacity = 0;
      (this.spheres[i].material as THREE.MeshPhongMaterial).transparent = true;
    }

    const slideVec = new THREE.Vector3();
    if (axis === 'X') slideVec.x = slideAmt;
    else if (axis === 'Y') slideVec.y = slideAmt;
    else slideVec.z = slideAmt;

    await tween(400, t => {
      for (const i of slideIdx) {
        this.spheres[i].position.addVectors(startPos[i], slideVec.clone().multiplyScalar(t));
      }
    });

    for (let i = 0; i < 27; i++) this.spheres[i].position.copy(homePos(i));
    this.updateBoard(newBoard);
  }

  // ── Input ─────────────────────────────────────────────────────────────
  setOnCellClick(cb: (index: number) => void): void { this.onCellClick = cb; }

  private bindEvents(): void {
    const c = this.canvas;
    let touchStartX = 0, touchStartY = 0, touchMoved = false;

    c.addEventListener('mousedown', e => {
      this.isDragging = false;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    c.addEventListener('mousemove', e => {
      if (e.buttons !== 1) return;
      const dx = e.clientX - this.lastMouse.x, dy = e.clientY - this.lastMouse.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) this.isDragging = true;
      this.spherical.theta -= dx * 0.01;
      this.spherical.phi = Math.max(0.15, Math.min(Math.PI - 0.15, this.spherical.phi - dy * 0.01));
      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.updateCamera();
    });
    c.addEventListener('click', e => { if (!this.isDragging) this.handleClick(e); });
    c.addEventListener('wheel', e => {
      this.spherical.radius = Math.max(4, Math.min(18, this.spherical.radius + e.deltaY * 0.01));
      this.updateCamera();
    });
    c.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; touchMoved = false;
    }, { passive: true });
    c.addEventListener('touchmove', e => {
      if (e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - touchStartX, dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dx) + Math.abs(dy) > 6) touchMoved = true;
      this.spherical.theta -= dx * 0.01;
      this.spherical.phi = Math.max(0.15, Math.min(Math.PI - 0.15, this.spherical.phi - dy * 0.01));
      touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
      this.updateCamera();
      e.preventDefault();
    }, { passive: false });
    c.addEventListener('touchend', e => {
      if (!touchMoved && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        this.handleClick({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
      }
    });
  }

  private handleClick(e: MouseEvent): void {
    if (!this.onCellClick) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const hits = this.raycaster.intersectObjects(this.spheres);
    if (hits.length > 0) this.onCellClick(hits[0].object.userData['index'] as number);
  }

  private updateCamera(): void {
    const { theta, phi, radius } = this.spherical;
    this.camera.position.set(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta),
    );
    this.camera.lookAt(0, 0, 0);
  }

  resize(): void {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    if (!document.hidden) this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
    document.removeEventListener('visibilitychange', this._onVisibility);
  }

  private _onVisibility = () => {
    if (!document.hidden) this.renderer.render(this.scene, this.camera);
  };
}
