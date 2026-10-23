import type { Card } from './types';

export const SUITS = ['S', 'H', 'D', 'C'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

export const rankOf = (c: Card) => c.slice(0, -1);
export const suitOf = (c: Card) => c.slice(-1);
export const isRed = (c: Card) => suitOf(c) === 'H' || suitOf(c) === 'D';
export const isJack = (c: Card) => rankOf(c) === 'J';
/** Wild: place a chip on any empty space. */
export const isTwoEyedJack = (c: Card) => c === 'JD' || c === 'JC';
/** Remove one opposing chip (not part of a completed sequence). */
export const isOneEyedJack = (c: Card) => c === 'JS' || c === 'JH';

export const cardLabel = (c: Card) => rankOf(c) + SUIT_SYMBOL[suitOf(c)];

export function fullDeck(): Card[] {
  const out: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) out.push(r + s);
  return out;
}

/** Non-jack cards: the 48 cards that appear on the board (twice each). */
export function boardCards(): Card[] {
  return fullDeck().filter((c) => !isJack(c));
}

/** mulberry32 — tiny seeded PRNG. Returns [value in 0..1, nextState]. */
export function nextRandom(state: number): [number, number] {
  let t = (state + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

export function shuffle<T>(arr: T[], seed: number): { out: T[]; seed: number } {
  const out = arr.slice();
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    const [v, ns] = nextRandom(s);
    s = ns;
    const j = Math.floor(v * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { out, seed: s };
}
