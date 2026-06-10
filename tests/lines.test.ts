import { describe, it, expect } from 'vitest';
import { generateLines, checkWinner } from '../src/core/lines';
import { toIndex, emptyBoard } from '../src/core/board';
import type { Mark } from '../src/core/types';

const LINES = generateLines();

describe('line generation', () => {
  it('generates exactly 49 lines', () => {
    expect(LINES).toHaveLength(49);
  });

  it('each line has 3 distinct in-bounds indices', () => {
    for (const [a, b, c] of LINES) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(26);
      expect(b).toBeLessThanOrEqual(26);
      expect(c).toBeLessThanOrEqual(26);
      expect(new Set([a, b, c]).size).toBe(3);
    }
  });

  it('contains all 4 space diagonals', () => {
    const diagonals = [
      [toIndex(0,0,0), toIndex(1,1,1), toIndex(2,2,2)],
      [toIndex(2,0,0), toIndex(1,1,1), toIndex(0,2,2)],
      [toIndex(0,2,0), toIndex(1,1,1), toIndex(2,0,2)],
      [toIndex(0,0,2), toIndex(1,1,1), toIndex(2,2,0)],
    ];
    for (const diag of diagonals) {
      const diagSet = new Set(diag);
      const found = LINES.some(line => {
        const lineSet = new Set(line);
        return [...diagSet].every(i => lineSet.has(i));
      });
      expect(found, `diagonal ${diag} not found`).toBe(true);
    }
  });
});

describe('checkWinner', () => {
  it('returns null on empty board', () => {
    expect(checkWinner(emptyBoard())).toBeNull();
  });

  it('detects O winning on x-axis row', () => {
    const b = emptyBoard();
    b[toIndex(0,0,0)] = 'O';
    b[toIndex(1,0,0)] = 'O';
    b[toIndex(2,0,0)] = 'O';
    expect(checkWinner(b)).toBe('O');
  });

  it('detects X winning on space diagonal', () => {
    const b = emptyBoard();
    b[toIndex(0,0,0)] = 'X';
    b[toIndex(1,1,1)] = 'X';
    b[toIndex(2,2,2)] = 'X';
    expect(checkWinner(b)).toBe('X');
  });

  it('returns null when no winner', () => {
    const b: Mark[] = Array(27).fill(null);
    b[toIndex(0,0,0)] = 'O';
    b[toIndex(1,0,0)] = 'O';
    b[toIndex(2,0,0)] = 'X';
    expect(checkWinner(b)).toBeNull();
  });
});
