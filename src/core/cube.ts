import type { Mark, CubeMove } from './types';
import { toIndex, fromIndex } from './board';

export function applyCubeMove(board: Mark[], move: CubeMove): Mark[] {
  const next = board.slice();
  if (move.kind === 'rotate') {
    applyRotate(next, move.axis, move.layer, move.dir);
  } else {
    applySlide(next, move.axis, move.dir);
  }
  return next;
}

function applyRotate(
  board: Mark[],
  axis: 'X' | 'Y' | 'Z',
  layer: 0 | 1 | 2,
  dir: 'CW' | 'CCW',
): void {
  // Collect the 9 indices in the layer and their rotated destinations
  const pairs: [number, number][] = []; // [from, to]

  for (let a = 0; a <= 2; a++) {
    for (let b = 0; b <= 2; b++) {
      let x: number, y: number, z: number;
      let nx: number, ny: number, nz: number;

      if (axis === 'Z') {
        x = a; y = b; z = layer;
        if (dir === 'CCW') { nx = 2 - y; ny = x; nz = z; }
        else               { nx = y;     ny = 2 - x; nz = z; }
      } else if (axis === 'X') {
        x = layer; y = a; z = b;
        if (dir === 'CCW') { nx = x; ny = 2 - z; nz = y; }
        else               { nx = x; ny = z;     nz = 2 - y; }
      } else { // Y
        x = b; y = layer; z = a;
        if (dir === 'CCW') { nx = 2 - z; ny = y; nz = x; }
        else               { nx = z;     ny = y; nz = 2 - x; }
      }
      pairs.push([toIndex(x, y, z), toIndex(nx, ny, nz)]);
    }
  }

  const snapshot = board.slice();
  for (const [from, to] of pairs) {
    board[to] = snapshot[from];
  }
}

function applySlide(board: Mark[], axis: 'X' | 'Y' | 'Z', dir: 'forward' | 'backward'): void {
  // forward: c → (c-1) mod 3,  backward: c → (c+1) mod 3
  const snapshot = board.slice();
  for (let i = 0; i < 27; i++) {
    const [x, y, z] = fromIndex(i);
    let nx = x, ny = y, nz = z;
    if (axis === 'X') nx = dir === 'forward' ? (x + 2) % 3 : (x + 1) % 3;
    else if (axis === 'Y') ny = dir === 'forward' ? (y + 2) % 3 : (y + 1) % 3;
    else nz = dir === 'forward' ? (z + 2) % 3 : (z + 1) % 3;
    board[toIndex(nx, ny, nz)] = snapshot[i];
  }
}

export function invertMove(move: CubeMove): CubeMove {
  if (move.kind === 'rotate') {
    return { kind: 'rotate', axis: move.axis, layer: move.layer, dir: move.dir === 'CW' ? 'CCW' : 'CW' };
  }
  return { kind: 'slide', axis: move.axis, dir: move.dir === 'forward' ? 'backward' : 'forward' };
}

export function movesEqual(a: CubeMove, b: CubeMove): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'rotate' && b.kind === 'rotate') {
    return a.axis === b.axis && a.layer === b.layer && a.dir === b.dir;
  }
  if (a.kind === 'slide' && b.kind === 'slide') {
    return a.axis === b.axis && a.dir === b.dir;
  }
  return false;
}
