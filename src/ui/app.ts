import { Scene3D } from './scene3d';
import { Schematic } from './schematic';
import { Controls } from './controls';
import {
  initialGameState,
  legalPlacements,
  applyStep1Place, applyStep1Move, resolveAfterCubeMove,
  checkStep1Win,
} from '../core/game';
import { applyCubeMove } from '../core/cube';
import type { GameState, CubeMove, Player } from '../core/types';

// ── State ─────────────────────────────────────────────────────────────────
type Phase = 'step1' | 'step1-move-from' | 'step2';

let root: HTMLElement;
let scene3d: Scene3D | null = null;
let schematic: Schematic | null = null;
let controls: Controls | null = null;
let gameState: GameState = initialGameState();
let phase: Phase = 'step1';
let selectedFrom: number | null = null;
let isAnimating = false;

// ── LocalStorage ──────────────────────────────────────────────────────────
interface SaveData { gameState: GameState; phase: Phase; selectedFrom: number | null }
const SAVE_KEY = 'cube6-save';
function saveGame(): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ gameState, phase, selectedFrom }));
}
function loadSave(): SaveData | null {
  try { const r = localStorage.getItem(SAVE_KEY); return r ? JSON.parse(r) as SaveData : null; }
  catch { return null; }
}
function clearSave(): void { localStorage.removeItem(SAVE_KEY); }

// ── Title ──────────────────────────────────────────────────────────────────
function renderTitle(): void {
  const saved = loadSave();
  root.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
      height:100vh;gap:2rem;background:#0a0a0f;">
      <div style="text-align:center;">
        <h1 style="font-size:clamp(2.5rem,8vw,4rem);color:#7af;
          text-shadow:0 0 30px #7af;letter-spacing:.2em;">CUBE 6</h1>
        <p style="color:#88f;letter-spacing:.3em;margin-top:.5rem;font-size:.9rem;">
          可変式立体マルバツゲーム</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:.8rem;min-width:260px;">
        <button id="btn-start" class="tbtn" style="border-color:#7af;color:#7af;">
          ゲーム開始 / START GAME</button>
        ${saved ? `<button id="btn-resume" class="tbtn" style="border-color:#4c8;color:#4c8;">
          ゲームを再開 / RESUME</button>` : ''}
        <button id="btn-rules" class="tbtn" style="border-color:#88f;color:#88f;">
          ルール説明 / HOW TO PLAY</button>
      </div>
    </div>
    <style>
      .tbtn{padding:.7rem 2.5rem;font-size:1rem;letter-spacing:.08em;
        background:transparent;border-width:2px;border-style:solid;
        cursor:pointer;border-radius:5px;transition:filter .2s;width:100%;}
      .tbtn:hover{filter:brightness(1.4);}
    </style>
  `;
  document.getElementById('btn-start')!.onclick = () => { clearSave(); startGame(); };
  document.getElementById('btn-resume')?.addEventListener('click', () => resumeGame());
  document.getElementById('btn-rules')!.onclick = () => showRules();
}

function resumeGame(): void {
  const data = loadSave();
  if (!data) { startGame(); return; }
  gameState = data.gameState;
  phase = data.phase;
  selectedFrom = data.selectedFrom;
  renderGame();
}

function showRules(): void {
  const o = document.createElement('div');
  o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:100;display:flex;align-items:center;justify-content:center;';
  o.innerHTML = `
    <div style="background:#0d0d18;border:1px solid #335;border-radius:10px;
      padding:1.8rem;max-width:520px;width:92%;color:#ccd;line-height:1.75;font-size:.88rem;
      max-height:80vh;overflow-y:auto;">
      <h2 style="color:#7af;margin-bottom:1rem;">ルール</h2>
      <ul style="padding-left:1.2rem;display:flex;flex-direction:column;gap:.4rem;">
        <li>各プレイヤーは手駒 <b>6個</b>（〇＝青球 / ×＝赤球）。</li>
        <li>盤上が <b>5個以下</b> → 空マスに <b>配置</b>。<b>6個</b> → 自分の駒を <b>任意の空マスへ移動</b>。</li>
        <li>1ターン = ① 配置/移動 → ② キューブ操作（必須・パス不可）。</li>
        <li>縦・横・斜め（立体対角線含む）<b>49本</b>のいずれかに3つ揃えると勝利。</li>
        <li>① で自分の列が揃ったら即勝利（② 省略）。</li>
        <li>② 後に <b>相手のみ</b> 列が揃った → <b>自爆敗け</b>。</li>
        <li>② 後に <b>両者同時に</b> 列が揃った → <b>引き分け</b>。</li>
        <li>直前の相手のキューブ操作の <b>完全な逆操作</b> は禁止。</li>
        <li>ドラッグは視点変更（ゲームの回転とは別）。</li>
      </ul>
      <button id="close-rules" style="margin-top:1.2rem;padding:.5rem 2rem;background:transparent;
        border:1px solid #7af;color:#7af;cursor:pointer;border-radius:4px;">閉じる</button>
    </div>`;
  document.body.appendChild(o);
  document.getElementById('close-rules')!.onclick = () => o.remove();
}

// ── Game screen ────────────────────────────────────────────────────────────
function startGame(): void {
  gameState = initialGameState();
  phase = 'step1';
  selectedFrom = null;
  isAnimating = false;
  renderGame();
}

function renderGame(): void {
  root.innerHTML = `
    <div id="game-root">
      <div id="top-bar">
        <span style="color:#7af;font-weight:bold;font-size:.95rem;letter-spacing:.08em;">CUBE 6</span>
        <div id="hand-display"></div>
        <div style="display:flex;gap:8px;align-items:center;">
          <label id="color-label" style="font-size:.7rem;color:#556;cursor:pointer;user-select:none;">
            <input id="symbol-toggle" type="checkbox" style="margin-right:4px;">刻印表示</label>
          <span style="font-size:.68rem;color:#445;">ドラッグ＝視点変更</span>
        </div>
      </div>
      <div id="schematic-container"></div>
      <div id="canvas-container">
        <canvas id="main-canvas" style="width:100%;height:100%;display:block;"></canvas>
        <div id="step-hint"></div>
      </div>
      <div id="controls-container"></div>
    </div>
    <style>
      #game-root{
        display:grid;
        grid-template-rows:auto 1fr;
        grid-template-columns:148px 1fr 220px;
        height:100vh;background:#0a0a0f;overflow:hidden;
      }
      #top-bar{
        grid-column:1/-1;display:flex;align-items:center;
        justify-content:space-between;
        padding:.5rem 1rem;background:#0d0d18;border-bottom:1px solid #223;
        flex-wrap:wrap;gap:4px;
      }
      #schematic-container{overflow-y:auto;padding:8px;}
      #canvas-container{position:relative;}
      #controls-container{overflow-y:auto;padding:8px;}
      #step-hint{
        position:absolute;top:10px;left:50%;transform:translateX(-50%);
        background:rgba(10,10,20,.82);border:1px solid #335;border-radius:6px;
        padding:4px 14px;font-size:.78rem;color:#aac;pointer-events:none;
        white-space:nowrap;max-width:90%;overflow:hidden;text-overflow:ellipsis;
      }
      @media(max-width:680px){
        #game-root{
          grid-template-rows:auto minmax(220px,42vw) auto auto;
          grid-template-columns:1fr;
          height:auto;min-height:100vh;overflow-y:auto;
        }
        #schematic-container{
          grid-row:3;display:flex;flex-direction:row;gap:6px;
          overflow-x:auto;padding:8px;justify-content:center;
        }
        #canvas-container{grid-row:2;}
        #controls-container{grid-row:4;}
        #step-hint{font-size:.7rem;}
      }
    </style>
  `;

  const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
  scene3d = new Scene3D(canvas);
  scene3d.setOnCellClick(idx => handleCellClick(idx));

  schematic = new Schematic(document.getElementById('schematic-container')!);
  schematic.setOnCellClick(idx => handleCellClick(idx));

  controls = new Controls(document.getElementById('controls-container')!);
  controls.setOnEvent(e => {
    if (e.type === 'pause')        confirmPause();
    if (e.type === 'previewMove')  handlePreviewMove(e.move);
    if (e.type === 'previewClear') handlePreviewClear();
    if (e.type === 'cubeMove')     handleCubeMove(e.move);
  });

  // Symbol toggle
  const toggle = document.getElementById('symbol-toggle') as HTMLInputElement;
  toggle.addEventListener('change', () => {
    // Future: show/hide ○× engravings on spheres
    // For now just store preference
    localStorage.setItem('cube6-symbols', toggle.checked ? '1' : '0');
  });
  toggle.checked = localStorage.getItem('cube6-symbols') === '1';

  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKeyDown);
  onResize();
  refresh();
}

function onResize(): void { scene3d?.resize(); }

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (phase === 'step1-move-from') { selectedFrom = null; phase = 'step1'; refresh(); }
    if (phase === 'step2' && controls) {
      controls.clearPending();
      handlePreviewClear();
    }
  }
}

// ── Refresh ────────────────────────────────────────────────────────────────
function refresh(): void {
  if (!scene3d || !schematic || !controls) return;
  const hl = getHighlights();
  scene3d.updateBoard(gameState.board, hl);
  schematic.update(gameState.board, hl, selectedFrom);
  controls.render(gameState, phase === 'step2' ? 'step2' : 'step1');
  updateHandDisplay();
  updateHint();
  saveGame();
}

function getHighlights(): number[] {
  if (phase === 'step1') return legalPlacements(gameState);
  if (phase === 'step1-move-from') {
    if (selectedFrom !== null)
      return gameState.board.map((m, i) => m === null ? i : -1).filter(i => i >= 0);
    return gameState.board.map((m, i) => m === gameState.current ? i : -1).filter(i => i >= 0);
  }
  return [];
}

function updateHandDisplay(): void {
  const el = document.getElementById('hand-display');
  if (!el) return;
  el.innerHTML = `
    <span style="color:#4488ff">〇手駒: <b>${gameState.hand.O}</b></span>
    <span style="color:#ff3344">×手駒: <b>${gameState.hand.X}</b></span>
    <span style="color:#556;font-size:.78rem">手数: ${gameState.ply}</span>
  `;
  el.style.cssText = 'display:flex;gap:1rem;align-items:center;font-size:.85rem;';
}

function updateHint(): void {
  const el = document.getElementById('step-hint');
  if (!el) return;
  const p = gameState.current === 'O' ? '〇（青）' : '×（赤）';
  if (phase === 'step1') {
    el.textContent = legalPlacements(gameState).length > 0
      ? `${p} — 空マスをクリックして配置`
      : `${p} — 自分の駒をクリックして移動元を選択`;
  } else if (phase === 'step1-move-from') {
    el.textContent = selectedFrom !== null
      ? '移動先の空マスをクリック（Esc でキャンセル）'
      : '移動する自分の駒を選択';
  } else {
    el.textContent = `${p} — 右パネルでキューブ操作を選択し、確定してください`;
  }
}

// ── Preview ────────────────────────────────────────────────────────────────
function handlePreviewMove(move: CubeMove): void {
  if (!scene3d || !schematic) return;
  const previewBoard = applyCubeMove(gameState.board, move);
  scene3d.showPreview(previewBoard, gameState.board);
  schematic.update(gameState.board, [], selectedFrom, previewBoard);
  // NOTE: controls panel updates itself in-place; no full re-render needed here
}

function handlePreviewClear(): void {
  if (!scene3d || !schematic) return;
  scene3d.clearPreview();
  refresh();
}

// ── Cell click ─────────────────────────────────────────────────────────────
function handleCellClick(idx: number): void {
  if (isAnimating || gameState.status !== 'playing') return;
  if (phase === 'step2') return; // use control panel for step2

  if (phase === 'step1') {
    const canPlace = legalPlacements(gameState).length > 0;
    if (canPlace) {
      if (gameState.board[idx] !== null) return;
      doPlace(idx);
    } else {
      if (gameState.board[idx] !== gameState.current) return;
      selectedFrom = idx;
      phase = 'step1-move-from';
      refresh();
    }
    return;
  }

  if (phase === 'step1-move-from') {
    if (selectedFrom === null) {
      if (gameState.board[idx] !== gameState.current) return;
      selectedFrom = idx; refresh(); return;
    }
    if (idx === selectedFrom) { selectedFrom = null; phase = 'step1'; refresh(); return; }
    if (gameState.board[idx] === gameState.current) { selectedFrom = idx; refresh(); return; }
    if (gameState.board[idx] !== null) return;
    doMove(selectedFrom, idx);
  }
}

// ── Step 1 actions ─────────────────────────────────────────────────────────
async function doPlace(idx: number): Promise<void> {
  const mark = gameState.current;
  isAnimating = true;
  const next = applyStep1Place(gameState, idx);
  if (checkStep1Win(next)) {
    gameState = { ...next, status: `win:${mark}` as 'win:O'|'win:X', winReason: 'line' };
    await scene3d!.animatePlace(idx, gameState.board);
    isAnimating = false;
    refresh();
    clearSave();
    await scene3d!.flashWinCells(mark as Player);
    showResult(gameState);
    return;
  }
  gameState = next;
  await scene3d!.animatePlace(idx, gameState.board).catch(() => {});
  isAnimating = false;
  phase = 'step2';
  refresh();
}

async function doMove(from: number, to: number): Promise<void> {
  const mark = gameState.board[from];
  isAnimating = true;
  const next = applyStep1Move(gameState, from, to);
  if (checkStep1Win(next)) {
    gameState = { ...next, status: `win:${gameState.current}` as 'win:O'|'win:X', winReason: 'line' };
    await scene3d!.animateMove(from, to, gameState.board, mark);
    isAnimating = false;
    selectedFrom = null;
    refresh();
    clearSave();
    await scene3d!.flashWinCells(gameState.current === 'O' ? 'X' : 'O');
    showResult(gameState);
    return;
  }
  gameState = next;
  await scene3d!.animateMove(from, to, gameState.board, mark).catch(() => {});
  isAnimating = false;
  selectedFrom = null;
  phase = 'step2';
  refresh();
}

// ── Step 2: Cube move ──────────────────────────────────────────────────────
async function handleCubeMove(move: CubeMove): Promise<void> {
  if (isAnimating) return;
  isAnimating = true;
  scene3d!.clearPreview();

  const next = resolveAfterCubeMove(gameState, move);

  // Animate BEFORE updating game state
  if (move.kind === 'rotate') {
    await scene3d!.animateRotate(move.axis, move.layer, move.dir, next.board).catch(() => {});
  } else {
    await scene3d!.animateSlide(move.axis, move.dir, next.board).catch(() => {});
  }

  gameState = next;
  isAnimating = false;
  controls!.clearPending();
  phase = 'step1';
  selectedFrom = null;

  if (gameState.status !== 'playing') {
    refresh();
    clearSave();
    if (gameState.status === 'win:O') await scene3d!.flashWinCells('O');
    else if (gameState.status === 'win:X') await scene3d!.flashWinCells('X');
    showResult(gameState);
  } else {
    refresh();
  }
}

// ── Result modal ──────────────────────────────────────────────────────────
function showResult(state: GameState): void {
  let title = '', msg = '', color = '#aaa';
  if (state.status === 'win:O') {
    color = '#4488ff'; title = '〇（青）の勝利！';
    msg = state.winReason === 'selfDestruct' ? '×が自爆しました。' : '3列揃えました！';
  } else if (state.status === 'win:X') {
    color = '#ff3344'; title = '×（赤）の勝利！';
    msg = state.winReason === 'selfDestruct' ? '〇が自爆しました。' : '3列揃えました！';
  } else {
    color = '#ffee44'; title = '引き分け！';
    msg = state.winReason === 'simultaneous' ? '両者同時に列が成立しました。' : '手数上限に達しました。';
  }
  const o = document.createElement('div');
  o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:200;display:flex;align-items:center;justify-content:center;';
  o.innerHTML = `
    <div style="background:#0d0d18;border:2px solid ${color};border-radius:12px;
      padding:2.2rem 2.8rem;text-align:center;min-width:280px;max-width:90vw;">
      <div style="font-size:1.9rem;color:${color};font-weight:bold;margin-bottom:.4rem;">${title}</div>
      <div style="color:#aab;margin-bottom:1.8rem;font-size:.92rem;">${msg}</div>
      <div style="display:flex;gap:.8rem;justify-content:center;">
        <button id="res-replay" style="padding:.55rem 1.4rem;background:transparent;
          border:1px solid ${color};color:${color};cursor:pointer;border-radius:6px;font-size:.92rem;">
          もう一度</button>
        <button id="res-title" style="padding:.55rem 1.4rem;background:transparent;
          border:1px solid #556;color:#889;cursor:pointer;border-radius:6px;font-size:.92rem;">
          タイトルへ</button>
      </div>
    </div>`;
  document.body.appendChild(o);
  document.getElementById('res-replay')!.onclick = () => { o.remove(); cleanup(); startGame(); };
  document.getElementById('res-title')!.onclick  = () => { o.remove(); cleanup(); renderTitle(); };
}

function confirmPause(): void {
  if (!confirm('ゲームを中断しますか？（進行状況は保存されています）')) return;
  cleanup();
  renderTitle();
}

function cleanup(): void {
  scene3d?.dispose();
  scene3d = null; schematic = null; controls = null;
  window.removeEventListener('resize', onResize);
  document.removeEventListener('keydown', onKeyDown);
}

// ── Entry ─────────────────────────────────────────────────────────────────
export function initApp(el: HTMLElement): void {
  root = el;
  renderTitle();
}
