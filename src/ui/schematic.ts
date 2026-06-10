import type { Mark } from '../core/types';
import { toIndex } from '../core/board';

/**
 * 見取り図 ― 水平3層を上から見た 3×3 グリッドを3段表示。
 * 上段 = y=2, 中段 = y=1, 下段 = y=0。
 */
export class Schematic {
  /** cells[y][z*3+x] = cell element for board index toIndex(x,y,z) */
  private cells: HTMLElement[][] = [];
  private dots: HTMLElement[][] = [];   // ghost overlay dots
  private onCellClick?: (index: number) => void;

  constructor(private container: HTMLElement) {
    this.build();
  }

  private build(): void {
    this.container.innerHTML = '';
    this.container.style.cssText = `
      display:flex;flex-direction:column;gap:6px;
      padding:10px;background:#0d0d18;border-radius:8px;border:1px solid #223;
    `;

    const title = document.createElement('div');
    title.textContent = '見取り図';
    title.style.cssText = 'color:#88aacc;font-size:.73rem;letter-spacing:.1em;text-align:center;';
    this.container.appendChild(title);

    for (let y = 2; y >= 0; y--) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;';

      const lbl = document.createElement('div');
      lbl.textContent = ['下層 y=0', '中層 y=1', '上層 y=2'][y];
      lbl.style.cssText = 'color:#445;font-size:.62rem;text-align:center;';
      wrap.appendChild(lbl);

      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:2px;';

      const rowCells: HTMLElement[] = [];
      const rowDots: HTMLElement[] = [];

      for (let z = 0; z <= 2; z++) {
        for (let x = 0; x <= 2; x++) {
          const cell = document.createElement('div');
          cell.style.cssText = `
            width:32px;height:32px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            font-size:.8rem;cursor:pointer;position:relative;
            border:1px solid #334;background:#111120;color:#445;
            transition:background .12s,border-color .12s;
          `;
          const idx = toIndex(x, y, z);
          cell.dataset['idx'] = String(idx);
          cell.addEventListener('click', () => this.onCellClick?.(idx));

          // ghost dot (for preview overlay)
          const dot = document.createElement('span');
          dot.style.cssText = `
            position:absolute;bottom:1px;right:2px;
            font-size:.45rem;line-height:1;opacity:0;pointer-events:none;
          `;
          cell.appendChild(dot);

          grid.appendChild(cell);
          rowCells.push(cell);
          rowDots.push(dot);
        }
      }
      this.cells[y] = rowCells;
      this.dots[y] = rowDots;
      wrap.appendChild(grid);
      this.container.appendChild(wrap);
    }
  }

  update(
    board: Mark[],
    highlights: number[] = [],
    selected: number | null = null,
    previewBoard?: Mark[],
  ): void {
    const hl = new Set(highlights);
    for (let y = 0; y <= 2; y++) {
      for (let z = 0; z <= 2; z++) {
        for (let x = 0; x <= 2; x++) {
          const idx = toIndex(x, y, z);
          const cell = this.cells[y][z * 3 + x];
          const dot  = this.dots[y][z * 3 + x];
          const mark = board[idx];
          const isHl  = hl.has(idx);
          const isSel = selected === idx;

          // ── Main cell style ──
          cell.style.opacity = '1';
          if (mark === 'O') {
            cell.style.background = isSel ? '#6699ff' : '#1b3580';
            cell.style.border = `2px solid ${isSel ? '#88bbff' : '#4488ff'}`;
            cell.style.color = '#ddeeff';
            cell.textContent = '○';
          } else if (mark === 'X') {
            cell.style.background = isSel ? '#ff6677' : '#7a1525';
            cell.style.border = `2px solid ${isSel ? '#ff99aa' : '#ff3344'}`;
            cell.style.color = '#ffdddd';
            cell.textContent = '×';
          } else if (isHl) {
            cell.style.background = 'rgba(80,60,0,.35)';
            cell.style.border = '1px solid rgba(255,238,68,.5)';
            cell.style.color = 'rgba(255,238,68,.6)';
            cell.textContent = '·';
          } else {
            cell.style.background = '#111120';
            cell.style.border = '1px solid #334';
            cell.style.color = '#445';
            cell.textContent = '';
          }

          // ── Preview ghost dot ──
          if (previewBoard && previewBoard[idx] !== board[idx]) {
            const pMark = previewBoard[idx];
            if (pMark !== null) {
              dot.textContent = pMark === 'O' ? '○' : '×';
              dot.style.color  = pMark === 'O' ? 'rgba(100,180,255,.9)' : 'rgba(255,120,140,.9)';
              dot.style.opacity = '1';
            } else {
              dot.style.opacity = '0';
            }
            if (mark !== null && pMark === null) cell.style.opacity = '0.45';
          } else {
            dot.style.opacity = '0';
          }

          // Re-append dot to keep it on top of textContent
          if (!cell.contains(dot)) cell.appendChild(dot);
        }
      }
    }
  }

  setOnCellClick(cb: (index: number) => void): void { this.onCellClick = cb; }
}
