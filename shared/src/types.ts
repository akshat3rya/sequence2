// ─────────────────────────────────────────────────────────────
// Core types shared by server, client and bots.
// ─────────────────────────────────────────────────────────────

/** A card is "<rank><suit>", e.g. "10H", "JD", "AS". Two decks are used, so duplicates exist. */
export type Card = string;

export interface GameSettings {
  /** Number of teams: 2 or 3. Seat i belongs to team (i % teams). */
  teams: number;
  /** Sequences a team needs to win. */
  sequencesToWin: number;
  /** Highlight where the selected card can legally go (host setting, default off). */
  showHints: boolean;
}

export type Move =
  | { type: 'play'; card: Card; r: number; c: number }
  | { type: 'discardDead'; card: Card }
  | { type: 'pass' };

export interface Sequence {
  team: number;
  cells: [number, number][];
}

export interface LastMove {
  seat: number;
  move: Move;
  /** Team whose chip was removed (one-eyed jack). */
  removedTeam?: number;
  /** Number of new sequences this move created. */
  newSequences?: number;
}

/** Full authoritative state — lives on the server only. */
export interface GameState {
  settings: GameSettings;
  numSeats: number;
  teamOfSeat: number[];
  /** board[r][c] = team index that owns a chip there, or null. Free corners are always null. */
  board: (number | null)[][];
  hands: Card[][];
  deck: Card[];
  discard: Card[];
  turn: number;
  /** Has the current player already swapped a dead card this turn? */
  deadUsed: boolean;
  sequences: Sequence[];
  /** Winning team index, or null while the game is on. */
  winner: number | null;
  lastMove: LastMove | null;
  moveCount: number;
  /** PRNG state (kept in state so the engine stays pure and replayable). */
  rng: number;
}
