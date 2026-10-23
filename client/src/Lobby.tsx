import { useState } from 'react';
import type { RoomView } from '@seq/shared';
import { MAX_PLAYERS, ALLOWED_TEAMS, MAX_SEQUENCES_TO_WIN } from '@seq/shared';
import { navigate } from './nav';
import { request } from './socket';
import { teamName } from './config';
import { Chat, Chip, Wordmark } from './ui';

export function Lobby({ room }: { room: RoomView }) {
  const isHost = room.mySeat === room.hostSeat;
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/r/${room.id}`;

  const act = async (event: string, payload: object = {}) => {
    const res = await request(event, payload);
    setMsg(res.ok ? null : res.error);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setMsg('Copy failed — select the link and copy it manually'); }
  };
  const leave = async () => { await request('room:leave'); navigate('/'); };

  return (
    <main className="lobby">
      <header className="topbar">
        <h1><Wordmark /></h1>
        <button className="btn small" onClick={leave}>Leave</button>
      </header>

      <section className="panel">
        <h2>Invite players</h2>
        <div className="linkrow">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Game link" />
          <button className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
        </div>
      </section>

      <div className="lobby-grid">
        <section className="panel">
          <h2>Players <span className="muted">{room.seats.length}/{MAX_PLAYERS}</span></h2>
          <ol className="seats">
            {room.seats.map((s, i) => (
              <li key={i}>
                <Chip team={s.team} size={16} />
                <span className="seat-name">
                  {s.name}
                  {i === room.mySeat && <em> you</em>}
                  {i === room.hostSeat && <em> host</em>}
                  {s.kind === 'bot' && <em> bot</em>}
                  {!s.connected && <em> reconnecting…</em>}
                </span>
                <span className="muted">{teamName(s.team)}</span>
                {isHost && (
                  <span className="seat-actions">
                    <button className="icon" aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => act('room:swap', { a: i, b: i - 1 })}>↑</button>
                    <button className="icon" aria-label={`Move ${s.name} down`} disabled={i === room.seats.length - 1} onClick={() => act('room:swap', { a: i, b: i + 1 })}>↓</button>
                    {i !== room.hostSeat && <button className="icon" aria-label={`Remove ${s.name}`} onClick={() => act('room:remove', { seat: i })}>✕</button>}
                  </span>
                )}
              </li>
            ))}
          </ol>
          {isHost && (
            <button className="btn small" onClick={() => act('room:addBot')} disabled={room.seats.length >= MAX_PLAYERS}>Add a bot</button>
          )}
          <p className="muted small-note">Teammates sit in alternating turns. Move players up or down to choose partners.</p>
        </section>

        <section className="panel">
          <h2>Game settings</h2>
          <fieldset disabled={!isHost}>
            <legend>Teams</legend>
            <div className="seg">
              {ALLOWED_TEAMS.map((t) => (
                <button key={t} className={room.settings.teams === t ? 'on' : ''} onClick={() => act('room:settings', { teams: t })}>{t} teams</button>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={!isHost}>
            <legend>Sequences to win</legend>
            <div className="seg">
              {Array.from({ length: MAX_SEQUENCES_TO_WIN }, (_, k) => k + 1).map((n) => (
                <button key={n} className={room.settings.sequencesToWin === n ? 'on' : ''} onClick={() => act('room:settings', { sequencesToWin: n })}>{n}</button>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={!isHost}>
            <legend>Highlight legal moves</legend>
            <div className="seg">
              {[false, true].map((v) => (
                <button key={String(v)} className={room.settings.showHints === v ? 'on' : ''} onClick={() => act('room:settings', { showHints: v })}>{v ? 'On' : 'Off'}</button>
              ))}
            </div>
          </fieldset>
          {!isHost && <p className="muted small-note">Only the host can change settings.</p>}

          {isHost ? (
            <>
              <button className="btn primary wide" disabled={!!room.startError} onClick={() => act('room:start')}>Start game</button>
              {room.startError && <p className="error">{room.startError}</p>}
            </>
          ) : (
            <p className="muted">Waiting for the host to start…</p>
          )}
          {msg && <p className="error" role="alert">{msg}</p>}
        </section>
      </div>

      <section className="panel"><h2>Chat</h2><Chat messages={room.chat} /></section>
    </main>
  );
}
