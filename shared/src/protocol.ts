import type { GameSettings, GameState, LastMove, Move, Sequence, Card } from './types';

// ─────────────────────────────────────────────────────────────
// Client ⇄ server contract. Add new fields here first, then
// fill them in (server/src/rooms.ts) and read them (client).
// ─────────────────────────────────────────────────────────────

export interface SeatView {
  name: string;
  kind: 'human' | 'bot';
  connected: boolean;
  team: number;
}

/** What one player is allowed to see of the game (no deck, no other hands). */
export interface GameView {
  settings: GameSettings;
  teamOfSeat: number[];
  board: (number | null)[][];
  turn: number;
  winner: number | null;
  sequences: Sequence[];
  lastMove: LastMove | null;
  handCounts: number[];
  deckCount: number;
  deadUsed: boolean;
  myHand: Card[];
  /** Legal moves for me right now (empty when it's not my turn). */
  legal: Move[];
}

export interface ChatMessage {
  id: number;
  seat: number | null; // null = system message
  name: string;
  team: number | null;
  text: string;
  ts: number;
}

export interface RoomView {
  id: string;
  phase: 'lobby' | 'playing' | 'finished';
  mySeat: number;
  hostSeat: number;
  settings: GameSettings;
  seats: SeatView[];
  /** Why the game can't start yet (null = ready). */
  startError: string | null;
  game: GameView | null;
  chat: ChatMessage[];
}

export function makeGameView(state: GameState, seat: number, legal: Move[]): GameView {
  return {
    settings: state.settings,
    teamOfSeat: state.teamOfSeat,
    board: state.board,
    turn: state.turn,
    winner: state.winner,
    sequences: state.sequences,
    lastMove: state.lastMove,
    handCounts: state.hands.map((h) => h.length),
    deckCount: state.deck.length,
    deadUsed: state.deadUsed,
    myHand: state.hands[seat],
    legal,
  };
}

// Socket events (client → server). All use acknowledgements: ack({ ok: true, ... } | { ok: false, error })
export type Ack<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
