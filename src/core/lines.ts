import type { Mark, Player } from './types';
import { toIndex, onBoard } from './board';

// 13 canonical direction vectors: non-zero, first non-zero component positive
const DIRECTIONS: [number, number, number][] = [];
for (let dx = -1; dx <= 1; dx++) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dy === 0 && dz === 0) continue;
      const first = dx !== 0 ? dx : dy !== 0 ? dy : dz;
      if (first > 0) DIRECTIONS.push([dx, dy, dz]);
    }
  }
}

export type Line = [number, number, number]; // three board indices

export function generateLines(): Line[] {
  const lines: Line[] = [];
  for (const [dx, dy, dz] of DIRECTIONS) {
    for (let x = 0; x <= 2; x++) {
      for (let y = 0; y <= 2; y++) {
        for (let z = 0; z <= 2; z++) {
          const x1 = x + dx, y1 = y + dy, z1 = z + dz;
          const x2 = x + 2*dx, y2 = y + 2*dy, z2 = z + 2*dz;
          if (onBoard(x1, y1, z1) && onBoard(x2, y2, z2)) {
            lines.push([toIndex(x, y, z), toIndex(x1, y1, z1), toIndex(x2, y2, z2)]);
          }
        }
      }
    }
  }
  return lines;
}

export const LINES: Line[] = generateLines();

export function checkWinner(board: Mark[]): Player | null {
  for (const [a, b, c] of LINES) {
    const m = board[a];
    if (m !== null && m === board[b] && m === board[c]) return m as Player;
  }
  return null;
}

export function checkBothWin(board: Mark[]): { O: boolean; X: boolean } {
  let O = false, X = false;
  for (const [a, b, c] of LINES) {
    const m = board[a];
    if (m !== null && m === board[b] && m === board[c]) {
      if (m === 'O') O = true;
      else X = true;
    }
  }
  return { O, X };
}
