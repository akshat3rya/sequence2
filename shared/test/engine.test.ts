import { describe, it, expect } from 'vitest';
import {
  LAYOUT, CARD_CELLS, createGame, legalMoves, applyMove, chooseMove, findNewSequences,
  fullDeck, HAND_SIZE, defaultSettings, validateSetup, BOARD_SIZE, FREE,
} from '../src';
import type { GameState, Move } from '../src';

const emptyBoard = () => Array.from({ length: BOARD_SIZE }, () => Array<number | null>(BOARD_SIZE).fill(null));

function game(n = 2, seed = 1) {
  return createGame(defaultSettings(n), n, seed);
}

describe('layout', () => {
  it('has free corners and every non-jack card twice', () => {
    expect(LAYOUT[0][0]).toBe(FREE);
    expect(LAYOUT[0][9]).toBe(FREE);
    expect(LAYOUT[9][0]).toBe(FREE);
    expect(LAYOUT[9][9]).toBe(FREE);
    expect(CARD_CELLS.size).toBe(48);
    for (const cells of CARD_CELLS.values()) expect(cells.length).toBe(2);
  });
});

describe('setup', () => {
  it('deals the right hand size and conserves cards', () => {
    for (const n of [2, 3, 4, 6, 8, 9, 10, 12]) {
      const g = game(n);
      for (const h of g.hands) expect(h.length).toBe(HAND_SIZE[n]);
      expect(g.deck.length + g.hands.flat().length).toBe(104);
    }
  });
  it('validates team splits', () => {
    expect(validateSetup(5, { teams: 2, sequencesToWin: 2, showHints: false })).not.toBeNull();
    expect(validateSetup(6, { teams: 3, sequencesToWin: 1, showHints: false })).toBeNull();
    expect(validateSetup(1, { teams: 2, sequencesToWin: 2, showHints: false })).not.toBeNull();
  });
});

describe('moves', () => {
  it('plays a normal card and draws a replacement', () => {
    const g = game();
    const m = legalMoves(g, 0).find((x) => x.type === 'play')!;
    const r = applyMove(g, 0, m);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.hands[0].length).toBe(HAND_SIZE[2]);
      expect(r.state.turn).toBe(1);
      expect(r.state.board.flat().filter((x) => x === 0).length).toBe(1);
    }
  });
  it('rejects illegal and out-of-turn moves', () => {
    const g = game();
    expect(applyMove(g, 1, { type: 'pass' }).ok).toBe(false);
    expect(applyMove(g, 0, { type: 'play', card: 'ZZ', r: 1, c: 1 }).ok).toBe(false);
  });
  it('two-eyed jack is wild, one-eyed jack removes an opposing chip', () => {
    const g = game();
    g.hands[0] = ['JD', 'JS', '2H', '3H', '4H', '5H', '6H'];
    g.hands[1] = ['JH', '2C', '3C', '4C', '5C', '6C', '7C'];
    const wild = applyMove(g, 0, { type: 'play', card: 'JD', r: 4, c: 4 });
    expect(wild.ok).toBe(true);
    if (!wild.ok) return;
    expect(wild.state.board[4][4]).toBe(0);
    // seat 1 removes it with a one-eyed jack
    const rm = applyMove(wild.state, 1, { type: 'play', card: 'JH', r: 4, c: 4 });
    expect(rm.ok).toBe(true);
    if (rm.ok) expect(rm.state.board[4][4]).toBeNull();
    // can't remove your own chip / empty cell
    expect(legalMoves({ ...wild.state, turn: 0 } as GameState, 0).some((m) => m.type === 'play' && m.card === 'JS')).toBe(false);
  });
  it('dead card can be swapped once per turn without ending the turn', () => {
    const g = game();
    const card = '2H';
    for (const [r, c] of CARD_CELLS.get(card)!) g.board[r][c] = 1;
    g.hands[0][0] = card;
    const move: Move = { type: 'discardDead', card };
    expect(legalMoves(g, 0)).toContainEqual(move);
    const r = applyMove(g, 0, move);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.turn).toBe(0);
    expect(r.state.deadUsed).toBe(true);
    expect(legalMoves(r.state, 0).some((m) => m.type === 'discardDead')).toBe(false);
  });
  it('can’t remove chips locked in a sequence', () => {
    const g = game();
    g.board[1] = [null, 1, 1, 1, 1, 1, null, null, null, null];
    g.sequences.push({ team: 1, cells: [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5]] });
    g.board[5][5] = 1;
    g.hands[0][0] = 'JS';
    const targets = legalMoves(g, 0).filter((m) => m.type === 'play' && m.card === 'JS') as Extract<Move, { type: 'play' }>[];
    expect(targets.some((m) => m.r === 1)).toBe(false);
    expect(targets.some((m) => m.r === 5 && m.c === 5)).toBe(true);
  });
});

describe('sequences', () => {
  it('detects a row of five', () => {
    const b = emptyBoard();
    for (let c = 2; c <= 6; c++) b[4][c] = 0;
    expect(findNewSequences(b, [], 0, 4, 4).length).toBe(1);
  });
  it('corners count for every team', () => {
    const b = emptyBoard();
    for (let c = 1; c <= 4; c++) b[0][c] = 1; // + free corner at (0,0)
    expect(findNewSequences(b, [], 1, 0, 4).length).toBe(1);
  });
  it('9 in a row makes two sequences sharing one chip', () => {
    const b = emptyBoard();
    for (let c = 0; c < 9; c++) b[5][c] = 0;
    expect(findNewSequences(b, [], 0, 5, 4).length).toBe(2);
  });
  it('6 in a row is only one sequence; extending an old one adds nothing', () => {
    const b = emptyBoard();
    for (let c = 0; c < 6; c++) b[5][c] = 0;
    const old = findNewSequences(b, [], 0, 5, 2);
    expect(old.length).toBe(1);
    expect(findNewSequences(b, old, 0, 5, 5).length).toBe(0);
  });
  it('crossing sequences may share one chip', () => {
    const b = emptyBoard();
    for (let c = 0; c < 5; c++) b[5][c] = 0;
    const first = findNewSequences(b, [], 0, 5, 0);
    for (let r = 1; r < 5; r++) b[r][4] = 0; // vertical through (5,4)? rows 1..5 at col 4
    expect(findNewSequences(b, first, 0, 1, 4).length).toBe(1);
  });
  it('winning ends the game', () => {
    const g = game();
    g.settings = { teams: 2, sequencesToWin: 1, showHints: false };
    for (let c = 2; c <= 5; c++) g.board[4][c] = 0;
    g.hands[0][0] = 'JC';
    const r = applyMove(g, 0, { type: 'play', card: 'JC', r: 4, c: 6 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.winner).toBe(0);
      expect(legalMoves(r.state, 1)).toEqual([]);
    }
  });
});

describe('bots play whole games', () => {
  for (const n of [2, 3, 4, 6]) {
    it(`${n} players finish`, () => {
      for (let seed = 1; seed <= 5; seed++) {
        let g = createGame(defaultSettings(n), n, seed * 7919);
        let steps = 0;
        while (g.winner === null && steps < 3000) {
          const m = chooseMove(g, g.turn);
          const r = applyMove(g, g.turn, m);
          if (!r.ok) throw new Error(`bot made illegal move: ${r.error} ${JSON.stringify(m)}`);
          g = r.state;
          steps++;
        }
        expect(g.winner).not.toBeNull();
        expect(g.deck.length + g.discard.length + g.hands.flat().length).toBe(104);
      }
    }, 60000);
  }
});
