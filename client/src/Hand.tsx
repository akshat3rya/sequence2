import type { Card } from '@seq/shared';
import { SUIT_SYMBOL, isOneEyedJack, isRed, isTwoEyedJack, rankOf, suitOf } from '@seq/shared';

export type CardStatus = 'playable' | 'dead' | 'stuck' | 'idle';

interface Props {
  cards: Card[];
  selected: Card | null;
  status: (c: Card) => CardStatus;
  onSelect: (c: Card) => void;
}

export function Hand({ cards, selected, status, onSelect }: Props) {
  return (
    <div className="hand" role="list" aria-label="Your hand">
      {cards.map((c, i) => {
        const st = status(c);
        const tag = isTwoEyedJack(c) ? 'wild' : isOneEyedJack(c) ? 'remove' : st === 'dead' ? 'dead' : '';
        return (
          <button
            key={`${c}-${i}`}
            role="listitem"
            className={['pcard', isRed(c) ? 'red' : 'black', st, selected === c && 'sel'].filter(Boolean).join(' ')}
            onClick={() => onSelect(c)}
            aria-pressed={selected === c}
            data-suit={SUIT_SYMBOL[suitOf(c)]}
          >
            <b>{rankOf(c)}</b>
            <i>{SUIT_SYMBOL[suitOf(c)]}</i>
            {tag && <small>{tag}</small>}
          </button>
        );
      })}
    </div>
  );
}
