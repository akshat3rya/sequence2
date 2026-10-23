import { useEffect, useState } from 'react';
import { APP_NAME, MAX_NAME } from './config';
import { navigate } from './nav';
import { getName, setName } from './socket';
import { useRoom } from './useRoom';
import { Lobby } from './Lobby';
import { GameScreen } from './Game';
import { Wordmark } from './ui';

export function RoomPage({ id }: { id: string }) {
  const [name, setNameState] = useState(getName());
  if (!name) return <NamePrompt onDone={(n) => { setName(n); setNameState(n); }} />;
  return <RoomInner id={id} />;
}

function NamePrompt({ onDone }: { onDone: (n: string) => void }) {
  const [n, setN] = useState('');
  return (
    <main className="home">
      <header className="hero"><h1><Wordmark /></h1><p className="tagline">You’ve been invited to a game.</p></header>
      <section className="panel start">
        <label htmlFor="n">Display name</label>
        <input id="n" autoFocus value={n} maxLength={MAX_NAME} placeholder="What should we call you?"
          onChange={(e) => setN(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && n.trim() && onDone(n.trim())} />
        <div className="actions"><button className="btn primary" disabled={!n.trim()} onClick={() => onDone(n.trim())}>Join game</button></div>
      </section>
    </main>
  );
}

function RoomInner({ id }: { id: string }) {
  const { room, error, connected } = useRoom(id);

  useEffect(() => {
    const myTurn = room?.phase === 'playing' && room.game?.turn === room.mySeat;
    document.title = myTurn ? `Your turn — ${APP_NAME}` : APP_NAME;
    return () => { document.title = APP_NAME; };
  }, [room]);

  if (!room) {
    return (
      <main className="home">
        <section className="panel start center">
          {error ? (
            <>
              <h2>Can’t join this game</h2>
              <p className="error">{error}</p>
              <button className="btn primary" onClick={() => navigate('/')}>Back to start</button>
            </>
          ) : (
            <p className="muted">Joining game {id}…</p>
          )}
        </section>
      </main>
    );
  }
  return (
    <>
      {!connected && <div className="banner" role="status">Connection lost. Reconnecting…</div>}
      {room.phase === 'lobby' ? <Lobby room={room} /> : <GameScreen room={room} />}
    </>
  );
}
