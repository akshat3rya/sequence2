import { useEffect, useMemo, useState } from 'react';
import type { Card, Move, RoomView } from '@seq/shared';
import { CARD_CELLS, isJack, isOneEyedJack, isTwoEyedJack } from '@seq/shared';
import { Board } from './Board';
import { Hand, type CardStatus } from './Hand';
import { Chat, Chip, Rules, Wordmark } from './ui';
import { teamName } from './config';
import { navigate } from './nav';
import { request } from './socket';

/** Friendlier wording for server rejections (used when hints are off and players guess). */
function friendly(move: Move, err: string) {
  if (err !== 'Illegal move') return err;
  if (move.type === 'discardDead') return 'That card isn’t dead — it still has an open space';
  if (move.type === 'pass') return 'You still have a playable card';
  return 'That card can’t go there';
}

export function GameScreen({ room }: { room: RoomView }) {
  const g = room.game!;
  const me = room.mySeat;
  const isHost = me === room.hostSeat;
  const playing = room.phase === 'playing';
  const myTurn = playing && g.turn === me;
  const hints = g.settings.showHints;
  const [selected, setSelected] = useState<Card | null>(null);
  const [rules, setRules] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  // Selection resets whenever the turn or my hand changes.
  const handKey = g.myHand.join(',');
  useEffect(() => setSelected(null), [g.turn, handKey]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); } }, [toast]);

  const plays = useMemo(() => g.legal.filter((m): m is Extract<Move, { type: 'play' }> => m.type === 'play'), [g.legal]);
  const deadCards = useMemo(() => new Set(g.legal.filter((m) => m.type === 'discardDead').map((m) => (m as any).card as Card)), [g.legal]);
  const canPass = g.legal.some((m) => m.type === 'pass');

  // With hints off, cards carry no playable/dead styling — you work it out yourself.
  const status = (c: Card): CardStatus => {
    if (!myTurn || !hints) return 'idle';
    if (deadCards.has(c)) return 'dead';
    return plays.some((m) => m.card === c) ? 'playable' : 'stuck';
  };

  const { targets, preview } = useMemo(() => {
    const targets = new Set<string>(), preview = new Set<string>();
    if (selected && hints) {
      for (const m of plays) if (m.card === selected) targets.add(`${m.r},${m.c}`);
      if (!isJack(selected)) for (const [r, c] of CARD_CELLS.get(selected) ?? []) if (!targets.has(`${r},${c}`)) preview.add(`${r},${c}`);
    }
    return { targets, preview };
  }, [selected, plays, hints]);

  const send = async (move: Move) => {
    const res = await request('game:move', { move });
    if (!res.ok) setToast(friendly(move, res.error));
  };
  const onCell = (r: number, c: number) => selected && send({ type: 'play', card: selected, r, c });
  const onSelect = (c: Card) => setSelected((s) => (s === c ? null : c));
  const leave = async () => { await request('room:leave'); navigate('/'); };

  const needed = g.settings.sequencesToWin;
  const seqCount = (t: number) => g.sequences.filter((s) => s.team === t).length;
  const winnerNames = g.winner === null ? '' : room.seats.filter((s) => s.team === g.winner).map((s) => s.name).join(', ');

  let banner: string;
  if (g.winner !== null) banner = `${teamName(g.winner)} wins`;
  else if (!myTurn) banner = `${room.seats[g.turn].name}’s turn`;
  else if (canPass) banner = 'No playable cards';
  else if (!selected) banner = 'Your turn — pick a card';
  else if (isTwoEyedJack(selected)) banner = 'Wild jack: choose any open space';
  else if (isOneEyedJack(selected)) banner = 'Removal jack: choose an opposing chip (sequence chips are locked)';
  else if (hints && deadCards.has(selected)) banner = 'Dead card — both spaces are taken';
  else banner = hints ? 'Choose a highlighted space' : 'Choose a space on the board';

  const turnTeam = g.teamOfSeat[g.turn];
  const canSwap = myTurn && !!selected && !isJack(selected) && (hints ? deadCards.has(selected) : true);

  return (
    <main className="game">
      <header className="topbar">
        <h1><Wordmark /></h1>
        <div className="top-actions">
          <button className="btn small" onClick={() => setRules(true)}>Rules</button>
          <button className="btn small" onClick={leave}>Leave</button>
        </div>
      </header>

      <aside className="rail">
        <Hand cards={g.myHand} selected={selected} status={status} onSelect={onSelect} />
        <div className="rail-actions">
          {canSwap && <button className="btn small primary" onClick={() => send({ type: 'discardDead', card: selected! })}>Swap dead card</button>}
          {canPass && <button className="btn small primary" onClick={() => send({ type: 'pass' })}>Pass turn</button>}
        </div>
      </aside>

      <section className="stage">
        <div className={`turnbar ${myTurn ? 'mine' : ''}`} role="status">
          {g.winner === null && <Chip team={turnTeam} size={12} />}
          <span>{banner}</span>
          <span className="muted deck">Deck {g.deckCount}</span>
        </div>

        <div className="board-wrap">
          <Board
            game={g}
            targets={myTurn ? targets : new Set()}
            preview={preview}
            onCell={onCell}
            freeClick={myTurn && !hints && selected !== null}
          />
          {g.winner !== null && (
            <div className="winner" role="alertdialog" aria-label="Game over">
              <h2>{teamName(g.winner)} wins</h2>
              <p>{winnerNames}</p>
              {isHost ? (
                <button className="btn primary" onClick={() => request('room:lobby')}>Play again</button>
              ) : (
                <p className="muted">Waiting for the host to set up another round.</p>
              )}
              <button className="btn small" onClick={leave}>Leave</button>
            </div>
          )}
        </div>
        {toast && <div className="toast" role="alert">{toast}</div>}
      </section>

      <aside className="side">
        <section className="panel score">
          {Array.from({ length: g.settings.teams }, (_, t) => (
            <div key={t} className="team">
              <div className="team-head">
                <Chip team={t} size={14} /> <b>{teamName(t)}</b>
                <span className={`pips t${t}`} aria-label={`${seqCount(t)} of ${needed} sequences`}>
                  {Array.from({ length: needed }, (_, k) => <i key={k} className={k < seqCount(t) ? 'on' : ''} />)}
                </span>
              </div>
              <ul>
                {room.seats.map((s, i) => (g.teamOfSeat[i] === t ? (
                  <li key={i} className={i === g.turn && playing ? 'turn' : ''}>
                    <span className="arrow" aria-hidden>{i === g.turn && playing ? '▸' : ''}</span>
                    <span className="nm">{s.name}{i === me && <em> you</em>}{s.kind === 'bot' && <em> bot</em>}</span>
                    {!s.connected && (
                      isHost && playing
                        ? <button className="btn tiny" onClick={() => request('room:botify', { seat: i })}>Replace with bot</button>
                        : <em className="warn">offline</em>
                    )}
                    <span className="muted">{g.handCounts[i]} cards</span>
                  </li>
                ) : null))}
              </ul>
            </div>
          ))}
        </section>

        <section className={`panel chatpanel ${chatOpen ? 'open' : ''}`}>
          <button className="chat-toggle" onClick={() => setChatOpen((o) => !o)} aria-expanded={chatOpen}>
            Chat {room.chat.length > 0 && <span className="muted">({room.chat.length})</span>}
          </button>
          <Chat messages={room.chat} />
        </section>
      </aside>
      {rules && <Rules onClose={() => setRules(false)} />}
    </main>
  );
}
