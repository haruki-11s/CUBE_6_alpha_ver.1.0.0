export type Mark = 'O' | 'X' | null;
export type Player = 'O' | 'X';

export type CubeMove =
  | { kind: 'rotate'; axis: 'X' | 'Y' | 'Z'; layer: 0 | 1 | 2; dir: 'CW' | 'CCW' }
  | { kind: 'slide';  axis: 'X' | 'Y' | 'Z'; dir: 'forward' | 'backward' };

export interface GameState {
  board: Mark[];
  current: Player;
  hand: { O: number; X: number };
  lastCubeMove: CubeMove | null;
  status: 'playing' | 'win:O' | 'win:X' | 'draw';
  winReason?: 'line' | 'selfDestruct' | 'simultaneous' | 'turnLimit';
  ply: number;
  settings: { turnLimit: number | null };
}
