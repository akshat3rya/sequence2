import type { Card } from './types';
import { boardCards, shuffle } from './cards';

// ─────────────────────────────────────────────────────────────
// BOARD LAYOUT — edit here.
//
// The 10x10 board has 4 free corners ('FREE') and every non-jack card
// exactly twice. By default a layout is generated from a fixed seed
// (deterministic, identical on server and client).
//
// To use your own board, set CUSTOM_LAYOUT to a 10x10 array of card
// strings (e.g. "10H", "AS") with 'FREE' in the four corners. It is
// validated at startup and will throw a clear error if wrong.
// ─────────────────────────────────────────────────────────────
export const BOARD_SIZE = 10;
export const FREE = 'FREE';
export type LayoutCell = Card | typeof FREE;

export const CUSTOM_LAYOUT: LayoutCell[][] | null = null;

const dirs8 = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
];

function isCorner(r: number, c: number) {
  return (r === 0 || r === BOARD_SIZE - 1) && (c === 0 || c === BOARD_SIZE - 1);
}

function generateLayout(): LayoutCell[][] {
  const pool = [...boardCards(), ...boardCards()];
  for (let seed = 1; seed < 100000; seed++) {
    const { out } = shuffle(pool, seed);
    const grid: LayoutCell[][] = [];
    let k = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      const row: LayoutCell[] = [];
      for (let c = 0; c < BOARD_SIZE; c++) row.push(isCorner(r, c) ? FREE : out[k++]);
      grid.push(row);
    }
    // Reject layouts where identical cards touch (keeps the board interesting).
    let ok = true;
    for (let r = 0; r < BOARD_SIZE && ok; r++)
      for (let c = 0; c < BOARD_SIZE && ok; c++) {
        if (grid[r][c] === FREE) continue;
        for (const [dr, dc] of dirs8) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && rr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && grid[rr][cc] === grid[r][c]) {
            ok = false;
            break;
          }
        }
      }
    if (ok) return grid;
  }
  throw new Error('Could not generate a board layout');
}

export function validateLayout(layout: LayoutCell[][]): void {
  if (layout.length !== BOARD_SIZE || layout.some((row) => row.length !== BOARD_SIZE))
    throw new Error('Layout must be 10x10');
  const counts = new Map<string, number>();
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++) {
      const v = layout[r][c];
      if (isCorner(r, c)) {
        if (v !== FREE) throw new Error(`Corner (${r},${c}) must be 'FREE'`);
      } else {
        if (v === FREE) throw new Error(`Only corners may be 'FREE' (found at ${r},${c})`);
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }
  for (const card of boardCards()) {
    if (counts.get(card) !== 2) throw new Error(`Card ${card} must appear exactly twice (found ${counts.get(card) ?? 0})`);
  }
  if (counts.size !== 48) throw new Error('Layout contains unknown cards (jacks are not allowed on the board)');
}

export const LAYOUT: LayoutCell[][] = CUSTOM_LAYOUT ?? generateLayout();
validateLayout(LAYOUT);

export const isFreeCell = (r: number, c: number) => LAYOUT[r][c] === FREE;

/** card -> the (up to two) board cells where it appears. */
export const CARD_CELLS: Map<Card, [number, number][]> = (() => {
  const m = new Map<Card, [number, number][]>();
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++) {
      const v = LAYOUT[r][c];
      if (v === FREE) continue;
      if (!m.has(v)) m.set(v, []);
      m.get(v)!.push([r, c]);
    }
  return m;
})();
