import type { Mark, Player, GameState } from './types';

export function toIndex(x: number, y: number, z: number): number {
  return x + 3 * y + 9 * z;
}

export function fromIndex(index: number): [number, number, number] {
  const z = Math.floor(index / 9);
  const y = Math.floor((index % 9) / 3);
  const x = index % 3;
  return [x, y, z];
}

export function emptyBoard(): Mark[] {
  return new Array<Mark>(27).fill(null);
}

export function onBoard(x: number, y: number, z: number): boolean {
  return x >= 0 && x <= 2 && y >= 0 && y <= 2 && z >= 0 && z <= 2;
}

export function countOnBoard(board: Mark[], player: Player): number {
  return board.filter(m => m === player).length;
}

export function initialGameState(): GameState {
  return {
    board: emptyBoard(),
    current: 'O',
    hand: { O: 6, X: 6 },
    lastCubeMove: null,
    status: 'playing',
    ply: 0,
    settings: { turnLimit: null },
  };
}
