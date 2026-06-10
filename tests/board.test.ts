import { describe, it, expect } from 'vitest';
import { toIndex, fromIndex, emptyBoard } from '../src/core/board';

describe('coordinate round-trip', () => {
  it('converts all 27 cells correctly', () => {
    for (let x = 0; x <= 2; x++) {
      for (let y = 0; y <= 2; y++) {
        for (let z = 0; z <= 2; z++) {
          const idx = toIndex(x, y, z);
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThanOrEqual(26);
          const [rx, ry, rz] = fromIndex(idx);
          expect(rx).toBe(x);
          expect(ry).toBe(y);
          expect(rz).toBe(z);
        }
      }
    }
  });

  it('index formula: x + 3y + 9z', () => {
    expect(toIndex(0, 0, 0)).toBe(0);
    expect(toIndex(2, 2, 2)).toBe(26);
    expect(toIndex(1, 0, 0)).toBe(1);
    expect(toIndex(0, 1, 0)).toBe(3);
    expect(toIndex(0, 0, 1)).toBe(9);
  });

  it('emptyBoard has 27 null cells', () => {
    const b = emptyBoard();
    expect(b).toHaveLength(27);
    expect(b.every(m => m === null)).toBe(true);
  });
});
