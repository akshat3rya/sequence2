import type { GameState, Move } from './types';
import { BOARD_SIZE, isFreeCell } from './board';
import { isOneEyedJack, isTwoEyedJack } from './cards';
import { legalMoves } from './engine';
import { SEQUENCE_LENGTH } from './rules';

// ─────────────────────────────────────────────────────────────
// BOT — one-ply heuristic. Tweak WEIGHTS to change its personality.
// Every legal move is tried on a scratch board and scored:
//   (my team's open lines) − DEFENSE × (opponents' open lines)
// ─────────────────────────────────────────────────────────────
export const WEIGHTS = {
  /** Value of a 5-window by how many of your chips (corners count) it holds. Index = chip count. */
  line: [0, 1, 4, 16, 90, 5000],
  /** How much the bot cares about blocking opponents (1 = as much as building its own). */
  defense: 1.0,
  /** Cost of burning a wild jack / removal jack (so they're saved for good moments). */
  wildJackCost: 12,
  removalJackCost: 6,
  /** Random noise so bots aren't perfectly predictable. */
  noise: 1.5,
};

type Board = GameState['board'];

const WINDOWS: [number, number][][] = (() => {
  const w: [number, number][][] = [];
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      for (const [dr, dc] of dirs) {
        const er = r + dr * (SEQUENCE_LENGTH - 1), ec = c + dc * (SEQUENCE_LENGTH - 1);
        if (er < 0 || er >= BOARD_SIZE || ec < 0 || ec >= BOARD_SIZE) continue;
        w.push(Array.from({ length: SEQUENCE_LENGTH }, (_, i) => [r + dr * i, c + dc * i] as [number, number]));
      }
  return w;
})();

function teamScore(board: Board, team: number): number {
  let total = 0;
  for (const win of WINDOWS) {
    let mine = 0, blocked = false;
    for (const [r, c] of win) {
      if (isFreeCell(r, c)) mine++;
      else if (board[r][c] === team) mine++;
      else if (board[r][c] !== null) { blocked = true; break; }
    }
    if (!blocked) total += WEIGHTS.line[mine];
  }
  return total;
}

function evaluate(board: Board, myTeam: number, teams: number): number {
  let s = teamScore(board, myTeam);
  for (let t = 0; t < teams; t++) if (t !== myTeam) s -= WEIGHTS.defense * teamScore(board, t);
  return s;
}

export function chooseMove(state: GameState, seat: number): Move {
  const moves = legalMoves(state, seat);
  if (moves.length === 0) return { type: 'pass' };
  // Swapping a dead card is free — always do it first.
  const dead = moves.find((m) => m.type === 'discardDead');
  if (dead) return dead;
  if (moves[0].type === 'pass') return moves[0];

  const myTeam = state.teamOfSeat[seat];
  let best = moves[0], bestScore = -Infinity;
  for (const m of moves) {
    if (m.type !== 'play') continue;
    const board = state.board.map((row) => row.slice());
    board[m.r][m.c] = isOneEyedJack(m.card) ? null : myTeam;
    let score = evaluate(board, myTeam, state.settings.teams) + Math.random() * WEIGHTS.noise;
    if (isTwoEyedJack(m.card)) score -= WEIGHTS.wildJackCost;
    if (isOneEyedJack(m.card)) score -= WEIGHTS.removalJackCost;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}
