import { memo } from 'react';
import type { GameView } from '@seq/shared';
import { BOARD_SIZE, FREE, LAYOUT, SUIT_SYMBOL, isRed, rankOf, suitOf } from '@seq/shared';

interface Props {
  game: GameView;
  targets: Set<string>;   // cells the selected card can legally act on
  preview: Set<string>;   // cells shown to explain a card (not clickable)
  onCell: (r: number, c: number) => void;
  freeClick: boolean;     // hints off: every space is clickable, the server judges
}

export const Board = memo(function Board({ game, targets, preview, onCell, freeClick }: Props) {
  const locked = new Set<string>();
  for (const s of game.sequences) for (const [r, c] of s.cells) locked.add(`${r},${c}`);
  const last = game.lastMove?.move.type === 'play' ? game.lastMove.move : null;
  const removed = game.lastMove?.removedTeam !== undefined;

  const cells = [];
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++) {
      const k = `${r},${c}`;
      const face = LAYOUT[r][c];
      const owner = game.board[r][c];
      const isTarget = targets.has(k);
      const isLast = !!last && last.r === r && last.c === c;
      const cls = [
        'cell',
        face === FREE ? 'free' : isRed(face) ? 'red' : 'black',
        isTarget && 'target',
        freeClick && 'pick',
        preview.has(k) && 'preview',
        (targets.size > 0 || preview.size > 0) && !isTarget && !preview.has(k) && 'dim',
        isLast && removed && 'removed',
      ].filter(Boolean).join(' ');
      cells.push(
        <button
          key={k}
          className={cls}
          disabled={!isTarget && !freeClick}
          onClick={() => onCell(r, c)}
          aria-label={face === FREE ? 'Free corner' : `${rankOf(face)} of ${suitName(suitOf(face))}${owner !== null ? `, team ${owner + 1} chip` : ''}`}
        >
          {face === FREE ? (
            <span className="face">★</span>
          ) : (
            <span className="face"><b>{rankOf(face)}</b><i>{SUIT_SYMBOL[suitOf(face)]}</i></span>
          )}
          {owner !== null && (
            <span
              className={['chip', `t${owner}`, locked.has(k) && 'locked', isLast && !removed && 'drop'].filter(Boolean).join(' ')}
            />
          )}
        </button>,
      );
    }
  return <div className="board" role="grid">{cells}</div>;
});

const suitName = (s: string) => ({ S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }[s] ?? s);
