import type { GameState, CubeMove } from '../core/types';
import { legalCubeMoves } from '../core/rules';
import { movesEqual, invertMove } from '../core/cube';

export type ControlEvent =
  | { type: 'cubeMove';     move: CubeMove }
  | { type: 'previewMove';  move: CubeMove }
  | { type: 'previewClear' }
  | { type: 'pause' };

export class Controls {
  private onEvent?: (e: ControlEvent) => void;
  private pendingMove: CubeMove | null = null;

  // Persistent references to DOM elements (avoid full re-render on selection)
  private confirmBtn:     HTMLButtonElement | null = null;
  private cancelBtn:      HTMLButtonElement | null = null;
  private selectionLabel: HTMLElement | null = null;
  private moveButtonMap   = new Map<string, { btn: HTMLButtonElement; move: CubeMove; legal: boolean }>();

  constructor(private container: HTMLElement) {}

  setOnEvent(cb: (e: ControlEvent) => void): void { this.onEvent = cb; }

  clearPending(): void {
    this.pendingMove = null;
    this._refreshButtonStyles();
    this._refreshConfirmBar();
  }

  // Full re-render (called on phase change / refresh)
  render(state: GameState, phase: 'step1' | 'step2'): void {
    this.container.innerHTML = '';
    this.confirmBtn     = null;
    this.cancelBtn      = null;
    this.selectionLabel = null;
    this.moveButtonMap.clear();

    this.container.style.cssText = `
      display:flex;flex-direction:column;gap:8px;
      padding:10px;background:#0d0d18;border-radius:8px;border:1px solid #223;
      overflow-y:auto;
    `;

    // ── Turn info ──
    const pColor = state.current === 'O' ? '#4488ff' : '#ff3344';
    const pLabel = state.current === 'O' ? '〇（青）' : '×（赤）';
    const phaseLabel = phase === 'step1' ? '① 配置 / 移動' : '② キューブ操作';
    const info = document.createElement('div');
    info.innerHTML = `
      <div style="font-size:.75rem;color:#556;">手番</div>
      <div style="font-size:1.05rem;color:${pColor};font-weight:bold;">${pLabel}</div>
      <div style="font-size:.78rem;color:#88aacc;margin-top:3px;">${phaseLabel}</div>
    `;
    this.container.appendChild(info);

    const handEl = document.createElement('div');
    handEl.style.cssText = 'display:flex;justify-content:space-between;font-size:.78rem;color:#556;';
    handEl.innerHTML = `<span>〇手駒: <b style="color:#4488ff">${state.hand.O}</b></span><span>×手駒: <b style="color:#ff3344">${state.hand.X}</b></span>`;
    this.container.appendChild(handEl);

    const plyEl = document.createElement('div');
    plyEl.style.cssText = 'font-size:.72rem;color:#445;';
    plyEl.textContent = `手数: ${state.ply}`;
    this.container.appendChild(plyEl);

    this.container.appendChild(makeSep());

    if (phase === 'step2') {
      this._buildCubeSection(state);
      this.container.appendChild(makeSep());
      this._buildConfirmBar();
      this.container.appendChild(makeSep());
    }

    // ── Pause ──
    const pause = document.createElement('button');
    pause.textContent = '中断';
    pause.style.cssText = btnCSS('transparent', '#f44', '#f44') + 'margin-top:4px;';
    pause.addEventListener('click', () => this.onEvent?.({ type: 'pause' }));
    this.container.appendChild(pause);
  }

  // ── Build cube operation list ──────────────────────────────────────────────
  private _buildCubeSection(state: GameState): void {
    const legal = legalCubeMoves(state);
    const legalSet = new Set(legal.map(mkey));

    const heading = document.createElement('div');
    heading.style.cssText = 'font-size:.73rem;color:#88aacc;margin-bottom:2px;';
    heading.textContent = 'キューブ操作を選択（必須）';
    this.container.appendChild(heading);

    // Rotate
    this.container.appendChild(sectionLabel('▸ 回転'));
    for (const axis of ['X', 'Y', 'Z'] as const) {
      for (const layer of [0, 1, 2] as const) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:3px;align-items:center;margin-bottom:2px;';
        const lbl = document.createElement('span');
        lbl.style.cssText = 'font-size:.68rem;color:#556;width:56px;flex-shrink:0;';
        lbl.textContent = `${axis}軸 層${layer}:`;
        row.appendChild(lbl);
        for (const dir of ['CW', 'CCW'] as const) {
          const move: CubeMove = { kind: 'rotate', axis, layer, dir };
          row.appendChild(this._makeMoveBtn(dir === 'CW' ? '↻CW' : '↺CCW', move, legalSet.has(mkey(move)), state));
        }
        this.container.appendChild(row);
      }
    }

    // Slide
    const sl = sectionLabel('▸ 繰越（スライド）');
    sl.style.marginTop = '6px';
    this.container.appendChild(sl);
    for (const axis of ['X', 'Y', 'Z'] as const) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:3px;align-items:center;margin-bottom:2px;';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:.68rem;color:#556;width:56px;flex-shrink:0;';
      lbl.textContent = `${axis}軸:`;
      row.appendChild(lbl);
      for (const dir of ['forward', 'backward'] as const) {
        const move: CubeMove = { kind: 'slide', axis, dir };
        row.appendChild(this._makeMoveBtn(dir === 'forward' ? '前▶' : '◀後', move, legalSet.has(mkey(move)), state));
      }
      this.container.appendChild(row);
    }
  }

  private _makeMoveBtn(label: string, move: CubeMove, legal: boolean, state: GameState): HTMLButtonElement {
    const forbidden = state.lastCubeMove !== null && movesEqual(move, invertMove(state.lastCubeMove));
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.disabled = !legal;
    btn.title = forbidden ? '直前の操作の逆操作は禁止' : '';
    const key = mkey(move);
    this.moveButtonMap.set(key, { btn, move, legal });
    this._styleMoveBtn(btn, move, legal);

    if (legal) {
      btn.addEventListener('click', () => {
        this.pendingMove = move;
        this._refreshButtonStyles();
        this._refreshConfirmBar();
        this.onEvent?.({ type: 'previewMove', move });
      });
    }
    return btn;
  }

  private _styleMoveBtn(btn: HTMLButtonElement, move: CubeMove, legal: boolean): void {
    const sel = !!this.pendingMove && mkey(move) === mkey(this.pendingMove);
    btn.style.cssText = `
      padding:3px 7px;font-size:.68rem;border-radius:3px;
      cursor:${legal ? 'pointer' : 'not-allowed'};
      background:${sel ? '#0d2d1a' : (legal ? '#1a2a3a' : '#111')};
      border:1px solid ${sel ? '#44ff88' : (legal ? '#335566' : '#222')};
      color:${sel ? '#88ffbb' : (legal ? '#aaccee' : '#333')};
      font-weight:${sel ? 'bold' : 'normal'};
      transition:background .1s;
    `;
  }

  private _refreshButtonStyles(): void {
    for (const { btn, move, legal } of this.moveButtonMap.values()) {
      this._styleMoveBtn(btn, move, legal);
    }
  }

  // ── Confirm / Cancel bar ───────────────────────────────────────────────────
  private _buildConfirmBar(): void {
    this.selectionLabel = document.createElement('div');
    this.selectionLabel.style.cssText =
      'font-size:.72rem;text-align:center;min-height:1.4em;padding:2px 0;';
    this.container.appendChild(this.selectionLabel);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;';

    this.confirmBtn = document.createElement('button');
    this.confirmBtn.textContent = '✔ 確定';
    this.confirmBtn.addEventListener('click', () => {
      if (!this.pendingMove) return;
      const m = this.pendingMove;
      this.pendingMove = null;
      this._refreshButtonStyles();
      this._refreshConfirmBar();
      this.onEvent?.({ type: 'cubeMove', move: m });
    });

    this.cancelBtn = document.createElement('button');
    this.cancelBtn.textContent = '✖ 取消';
    this.cancelBtn.addEventListener('click', () => {
      this.pendingMove = null;
      this._refreshButtonStyles();
      this._refreshConfirmBar();
      this.onEvent?.({ type: 'previewClear' });
    });

    row.appendChild(this.confirmBtn);
    row.appendChild(this.cancelBtn);
    this.container.appendChild(row);

    this._refreshConfirmBar(); // apply initial disabled state
  }

  private _refreshConfirmBar(): void {
    const has = !!this.pendingMove;
    if (this.selectionLabel) {
      this.selectionLabel.textContent = has
        ? `選択中: ${this._moveLabel(this.pendingMove!)}`
        : '↑ 操作を選択してください';
      this.selectionLabel.style.color = has ? '#88ffbb' : '#667';
    }
    if (this.confirmBtn) {
      this.confirmBtn.disabled = !has;
      this.confirmBtn.style.cssText = btnCSS(
        has ? '#113322' : '#111',
        has ? '#44ff88' : '#333',
        has ? '#44ff88' : '#555',
      ) + 'flex:1;font-size:.85rem;';
    }
    if (this.cancelBtn) {
      this.cancelBtn.disabled = !has;
      this.cancelBtn.style.cssText = btnCSS(
        has ? '#221111' : '#111',
        has ? '#ff4444' : '#333',
        has ? '#ff4444' : '#555',
      ) + 'flex:1;font-size:.85rem;';
    }
  }

  private _moveLabel(move: CubeMove): string {
    if (move.kind === 'rotate') return `回転 ${move.axis}軸 層${move.layer} ${move.dir}`;
    return `繰越 ${move.axis}軸 ${move.dir === 'forward' ? '前' : '後'}`;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function btnCSS(bg: string, border: string, color: string): string {
  return `padding:.4rem;background:${bg};border:1px solid ${border};color:${color};` +
    `cursor:pointer;border-radius:4px;font-size:.82rem;width:100%;`;
}
function makeSep(): HTMLHRElement {
  const hr = document.createElement('hr');
  hr.style.cssText = 'border-color:#223;margin:2px 0;';
  return hr;
}
function sectionLabel(text: string): HTMLDivElement {
  const d = document.createElement('div');
  d.style.cssText = 'font-size:.68rem;color:#667;margin-bottom:2px;';
  d.textContent = text;
  return d;
}
function mkey(m: CubeMove): string { return JSON.stringify(m); }
