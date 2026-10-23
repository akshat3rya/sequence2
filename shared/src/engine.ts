import type { Card, GameSettings, GameState, Move, Sequence } from './types';
import { BOARD_SIZE, CARD_CELLS, isFreeCell } from './board';
import { fullDeck, isJack, isOneEyedJack, isTwoEyedJack, nextRandom, shuffle } from './cards';
import { HAND_SIZE, SEQUENCE_LENGTH, validateSetup } from './rules';

// ─────────────────────────────────────────────────────────────
// GAME ENGINE — pure functions, no I/O.
//   createGame → legalMoves → applyMove → (repeat)
// States are never mutated: applyMove returns a fresh copy.
// ─────────────────────────────────────────────────────────────

const DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
const key = (r: number, c: number) => r * BOARD_SIZE + c;

export function createGame(settings: GameSettings, numSeats: number, seed: number): GameState {
  const err = validateSetup(numSeats, settings);
  if (err) throw new Error(err);

  const { out: deck, seed: rng } = shuffle([...fullDeck(), ...fullDeck()], seed);
  const handSize = HAND_SIZE[numSeats];
  const hands: Card[][] = Array.from({ length: numSeats }, () => []);
  for (let i = 0; i < handSize; i++) for (let s = 0; s < numSeats; s++) hands[s].push(deck.pop()!);

  return {
    settings,
    numSeats,
    teamOfSeat: Array.from({ length: numSeats }, (_, i) => i % settings.teams),
    board: Array.from({ length: BOARD_SIZE }, () => Array<number | null>(BOARD_SIZE).fill(null)),
    hands,
    deck,
    discard: [],
    turn: 0,
    deadUsed: false,
    sequences: [],
    winner: null,
    lastMove: null,
    moveCount: 0,
    rng,
  };
}

/** Cells that belong to a completed sequence (any team) — those chips are locked. */
export function lockedCells(state: Pick<GameState, 'sequences'>): Set<number> {
  const s = new Set<number>();
  for (const seq of state.sequences) for (const [r, c] of seq.cells) s.add(key(r, c));
  return s;
}

/** Both board spaces for this card are taken (jacks are never dead). */
export function isDeadCard(board: GameState['board'], card: Card): boolean {
  if (isJack(card)) return false;
  const cells = CARD_CELLS.get(card)!;
  return cells.every(([r, c]) => board[r][c] !== null);
}

export function legalMoves(state: GameState, seat: number): Move[] {
  if (state.winner !== null || state.turn !== seat) return [];
  const moves: Move[] = [];
  const hand = state.hands[seat];
  const myTeam = state.teamOfSeat[seat];
  const locked = lockedCells(state);
  const seen = new Set<Card>();

  for (const card of hand) {
    if (seen.has(card)) continue;
    seen.add(card);

    if (isTwoEyedJack(card)) {
      for (let r = 0; r < BOARD_SIZE; r++)
        for (let c = 0; c < BOARD_SIZE; c++)
          if (!isFreeCell(r, c) && state.board[r][c] === null) moves.push({ type: 'play', card, r, c });
    } else if (isOneEyedJack(card)) {
      for (let r = 0; r < BOARD_SIZE; r++)
        for (let c = 0; c < BOARD_SIZE; c++) {
          const owner = state.board[r][c];
          if (owner !== null && owner !== myTeam && !locked.has(key(r, c))) moves.push({ type: 'play', card, r, c });
        }
    } else {
      for (const [r, c] of CARD_CELLS.get(card)!) if (state.board[r][c] === null) moves.push({ type: 'play', card, r, c });
      if (!state.deadUsed && isDeadCard(state.board, card)) moves.push({ type: 'discardDead', card });
    }
  }
  if (moves.length === 0) moves.push({ type: 'pass' });
  return moves;
}

function sameMove(a: Move, b: Move) {
  if (a.type !== b.type) return false;
  if (a.type === 'pass') return true;
  if (a.type === 'discardDead') return a.card === (b as typeof a).card;
  const bb = b as typeof a;
  return a.card === bb.card && a.r === bb.r && a.c === bb.c;
}

function draw(state: GameState, seat: number) {
  if (state.deck.length === 0 && state.discard.length > 0) {
    const { out, seed } = shuffle(state.discard, state.rng);
    state.deck = out;
    state.discard = [];
    state.rng = seed;
  }
  const card = state.deck.pop();
  if (card) state.hands[seat].push(card);
}

function owned(board: GameState['board'], r: number, c: number, team: number) {
  return isFreeCell(r, c) || board[r][c] === team;
}

/** After `team` places a chip at (r,c): which new 5-in-a-row sequences does that complete? */
export function findNewSequences(
  board: GameState['board'],
  existing: Sequence[],
  team: number,
  r: number,
  c: number,
): Sequence[] {
  const added: Sequence[] = [];
  const used = new Set<number>();
  for (const seq of [...existing]) if (seq.team === team) for (const [a, b] of seq.cells) used.add(key(a, b));

  for (const [dr, dc] of DIRS) {
    // Contiguous run through (r,c) along this direction.
    let sr = r, sc = c;
    while (
      sr - dr >= 0 && sr - dr < BOARD_SIZE && sc - dc >= 0 && sc - dc < BOARD_SIZE &&
      owned(board, sr - dr, sc - dc, team)
    ) { sr -= dr; sc -= dc; }
    const run: [number, number][] = [];
    let cr = sr, cc = sc;
    while (cr >= 0 && cr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && owned(board, cr, cc, team)) {
      run.push([cr, cc]);
      cr += dr; cc += dc;
    }
    const idx = run.findIndex(([a, b]) => a === r && b === c);
    for (let s = 0; s + SEQUENCE_LENGTH <= run.length; s++) {
      if (idx < s || idx >= s + SEQUENCE_LENGTH) continue;
      const win = run.slice(s, s + SEQUENCE_LENGTH);
      // A new sequence may share at most ONE chip with this team's earlier sequences.
      const overlap = win.filter(([a, b]) => used.has(key(a, b))).length;
      if (overlap > 1) continue;
      added.push({ team, cells: win.map(([a, b]) => [a, b] as [number, number]) });
      for (const [a, b] of win) used.add(key(a, b));
    }
  }
  return added;
}

export type ApplyResult = { ok: true; state: GameState } | { ok: false; error: string };

export function applyMove(prev: GameState, seat: number, move: Move): ApplyResult {
  if (prev.winner !== null) return { ok: false, error: 'Game is over' };
  if (prev.turn !== seat) return { ok: false, error: 'Not your turn' };
  const legal = legalMoves(prev, seat);
  if (!legal.some((m) => sameMove(m, move))) return { ok: false, error: 'Illegal move' };

  const state: GameState = structuredClone(prev);
  const team = state.teamOfSeat[seat];
  state.moveCount++;

  if (move.type === 'discardDead') {
    const i = state.hands[seat].indexOf(move.card);
    state.hands[seat].splice(i, 1);
    state.discard.push(move.card);
    draw(state, seat);
    state.deadUsed = true;
    state.lastMove = { seat, move };
    return { ok: true, state };
  }

  if (move.type === 'pass') {
    state.lastMove = { seat, move };
    state.turn = (state.turn + 1) % state.numSeats;
    state.deadUsed = false;
    return { ok: true, state };
  }

  // Play a card.
  const i = state.hands[seat].indexOf(move.card);
  state.hands[seat].splice(i, 1);
  state.discard.push(move.card);

  let removedTeam: number | undefined;
  let newSeqs: Sequence[] = [];
  if (isOneEyedJack(move.card)) {
    removedTeam = state.board[move.r][move.c]!;
    state.board[move.r][move.c] = null;
  } else {
    state.board[move.r][move.c] = team;
    newSeqs = findNewSequences(state.board, state.sequences, team, move.r, move.c);
    state.sequences.push(...newSeqs);
    if (state.sequences.filter((s) => s.team === team).length >= state.settings.sequencesToWin) state.winner = team;
  }

  state.lastMove = { seat, move, removedTeam, newSequences: newSeqs.length };
  draw(state, seat);
  if (state.winner === null) {
    state.turn = (state.turn + 1) % state.numSeats;
    state.deadUsed = false;
  }
  return { ok: true, state };
}

export function countSequences(state: GameState, team: number) {
  return state.sequences.filter((s) => s.team === team).length;
}

// re-export for convenience
export { nextRandom };
