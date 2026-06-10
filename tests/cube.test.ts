import { describe, it, expect } from 'vitest';
import { applyCubeMove } from '../src/core/cube';
import { emptyBoard, toIndex } from '../src/core/board';
import type { Mark, CubeMove } from '../src/core/types';

function filledBoard(): Mark[] {
  // fill each cell with a unique label encoded as a mark-like string cast
  // We use a plain array and cast to Mark[] for testing identity
  const b = Array.from({ length: 27 }, (_, i) => String(i)) as unknown as Mark[];
  return b;
}

function boardsEqual(a: Mark[], b: Mark[]): boolean {
  return a.every((v, i) => v === b[i]);
}

describe('rotate: 4 times = identity', () => {
  const axes = ['X', 'Y', 'Z'] as const;
  const dirs = ['CW', 'CCW'] as const;
  const layers = [0, 1, 2] as const;

  for (const axis of axes) {
    for (const dir of dirs) {
      for (const layer of layers) {
        it(`rotate(${axis}, ${layer}, ${dir}) x4 = identity`, () => {
          const move: CubeMove = { kind: 'rotate', axis, layer, dir };
          let b = filledBoard();
          for (let i = 0; i < 4; i++) b = applyCubeMove(b, move);
          expect(boardsEqual(b, filledBoard())).toBe(true);
        });
      }
    }
  }
});

describe('rotate: CW then CCW = identity', () => {
  const axes = ['X', 'Y', 'Z'] as const;
  const layers = [0, 1, 2] as const;

  for (const axis of axes) {
    for (const layer of layers) {
      it(`rotate(${axis}, ${layer}) CW+CCW = identity`, () => {
        let b = filledBoard();
        b = applyCubeMove(b, { kind: 'rotate', axis, layer, dir: 'CW' });
        b = applyCubeMove(b, { kind: 'rotate', axis, layer, dir: 'CCW' });
        expect(boardsEqual(b, filledBoard())).toBe(true);
      });
    }
  }
});

describe('slide: forward then backward = identity', () => {
  const axes = ['X', 'Y', 'Z'] as const;
  for (const axis of axes) {
    it(`slide(${axis}) forward+backward = identity`, () => {
      let b = filledBoard();
      b = applyCubeMove(b, { kind: 'slide', axis, dir: 'forward' });
      b = applyCubeMove(b, { kind: 'slide', axis, dir: 'backward' });
      expect(boardsEqual(b, filledBoard())).toBe(true);
    });
  }
});

describe('slide: same direction 3 times = identity', () => {
  const axes = ['X', 'Y', 'Z'] as const;
  const dirs = ['forward', 'backward'] as const;
  for (const axis of axes) {
    for (const dir of dirs) {
      it(`slide(${axis}, ${dir}) x3 = identity`, () => {
        let b = filledBoard();
        for (let i = 0; i < 3; i++) b = applyCubeMove(b, { kind: 'slide', axis, dir });
        expect(boardsEqual(b, filledBoard())).toBe(true);
      });
    }
  }
});

describe('rotate semantics', () => {
  it('Z-layer-0 CCW: (x,y) → (2-y,x)', () => {
    const b = emptyBoard();
    b[toIndex(1, 0, 0)] = 'O'; // (1,0,0) → CCW → (2,1,0)
    const nb = applyCubeMove(b, { kind: 'rotate', axis: 'Z', layer: 0, dir: 'CCW' });
    expect(nb[toIndex(2, 1, 0)]).toBe('O');
    expect(nb[toIndex(1, 0, 0)]).toBeNull();
  });

  it('center cell is unchanged after rotation', () => {
    const b = emptyBoard();
    b[toIndex(1, 1, 1)] = 'X';
    // center of each layer is index (1,1,layer)
    const nb = applyCubeMove(b, { kind: 'rotate', axis: 'Z', layer: 1, dir: 'CW' });
    expect(nb[toIndex(1, 1, 1)]).toBe('X');
  });
});
