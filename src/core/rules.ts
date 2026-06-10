import type { Mark, CubeMove, GameState } from './types';
import { countOnBoard } from './board';
import { applyCubeMove, invertMove, movesEqual } from './cube';
export { invertMove } from './cube';
import { checkBothWin } from './lines';

// ---- Step 1 ----

export function canPlace(state: GameState): boolean {
  return countOnBoard(state.board, state.current) <= 5;
}

export function legalPlacements(state: GameState): number[] {
  if (!canPlace(state)) return [];
  return state.board
    .map((m, i) => (m === null ? i : -1))
    .filter(i => i >= 0);
}

export function legalMoves(state: GameState): Array<{ from: number; to: number }> {
  if (canPlace(state)) return [];
  const p = state.current;
  const froms = state.board.map((m, i) => (m === p ? i : -1)).filter(i => i >= 0);
  const tos = state.board.map((m, i) => (m === null ? i : -1)).filter(i => i >= 0);
  const result: Array<{ from: number; to: number }> = [];
  for (const from of froms) {
    for (const to of tos) {
      result.push({ from, to });
    }
  }
  return result;
}

// Apply step 1: place or move. Returns new board (does not validate legality).
export function applyStep1Place(state: GameState, index: number): GameState {
  const board = state.board.slice() as Mark[];
  board[index] = state.current;
  const hand = { ...state.hand };
  hand[state.current]--;
  return { ...state, board, hand };
}

export function applyStep1Move(state: GameState, from: number, to: number): GameState {
  const board = state.board.slice() as Mark[];
  board[to] = board[from];
  board[from] = null;
  return { ...state, board };
}

// ---- Step 2 ----

export function allCubeMoves(): CubeMove[] {
  const moves: CubeMove[] = [];
  for (const axis of ['X', 'Y', 'Z'] as const) {
    for (const layer of [0, 1, 2] as const) {
      moves.push({ kind: 'rotate', axis, layer, dir: 'CW' });
      moves.push({ kind: 'rotate', axis, layer, dir: 'CCW' });
    }
    moves.push({ kind: 'slide', axis, dir: 'forward' });
    moves.push({ kind: 'slide', axis, dir: 'backward' });
  }
  return moves;
}

export function legalCubeMoves(state: GameState): CubeMove[] {
  const all = allCubeMoves();
  if (state.lastCubeMove === null) return all;
  const forbidden = invertMove(state.lastCubeMove);
  return all.filter(m => !movesEqual(m, forbidden));
}

export function isReverseCubeMove(last: CubeMove, next: CubeMove): boolean {
  return movesEqual(invertMove(last), next);
}

// ---- Win resolution after step 2 ----

export function resolveAfterCubeMove(state: GameState, move: CubeMove): GameState {
  const newBoard = applyCubeMove(state.board, move);
  const newState: GameState = {
    ...state,
    board: newBoard,
    lastCubeMove: move,
    ply: state.ply + 1,
    current: state.current === 'O' ? 'X' : 'O',
  };

  const { O, X } = checkBothWin(newBoard);
  if (O && X) return { ...newState, status: 'draw', winReason: 'simultaneous' };
  if (O) {
    return state.current === 'O'
      ? { ...newState, status: 'win:O', winReason: 'line' }
      : { ...newState, status: 'win:O', winReason: 'selfDestruct' };
  }
  if (X) {
    return state.current === 'X'
      ? { ...newState, status: 'win:X', winReason: 'line' }
      : { ...newState, status: 'win:X', winReason: 'selfDestruct' };
  }

  // Turn limit check
  if (state.settings.turnLimit !== null && newState.ply >= state.settings.turnLimit) {
    return { ...newState, status: 'draw', winReason: 'turnLimit' };
  }

  return newState;
}

// ---- Step 1 win check ----

export function checkStep1Win(state: GameState): boolean {
  const { O, X } = checkBothWin(state.board);
  return state.current === 'O' ? O : X;
}

// ---- Full turn helpers ----

export function applyFullTurn(
  state: GameState,
  step1: { kind: 'place'; index: number } | { kind: 'move'; from: number; to: number },
  cubeMove: CubeMove,
): GameState {
  let s = step1.kind === 'place'
    ? applyStep1Place(state, step1.index)
    : applyStep1Move(state, step1.from, step1.to);

  if (checkStep1Win(s)) {
    return { ...s, status: `win:${state.current}` as 'win:O' | 'win:X', winReason: 'line' };
  }
  return resolveAfterCubeMove(s, cubeMove);
}
