import { useState } from 'react';
import { APP_NAME, MAX_NAME, TAGLINE } from './config';
import { navigate } from './nav';
import { getName, getPlayerId, request, setName } from './socket';
import { Rules, Wordmark } from './ui';

export function Home() {
  const [name, setNameState] = useState(getName());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState(false);

  const start = async (solo: boolean) => {
    const clean = name.trim();
    if (!clean) return setError('Enter a display name first');
    setName(clean);
    setBusy(true);
    setError(null);
    const res = await request<{ roomId: string }>('room:create', { playerId: getPlayerId(), name: clean, solo });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    navigate(`/r/${res.roomId}`);
  };

  return (
    <main className="home">
      <header className="hero">
        <h1><Wordmark /></h1>
        <div className="hero-row" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => <i key={i} className="t0" style={{ animationDelay: `${0.25 + i * 0.16}s` }} />)}
        </div>
        <p className="tagline">{TAGLINE}</p>
      </header>

      <section className="panel start">
        <label htmlFor="name">Display name</label>
        <input
          id="name"
          value={name}
          maxLength={MAX_NAME}
          autoComplete="nickname"
          placeholder="What should we call you?"
          onChange={(e) => setNameState(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && start(false)}
        />
        <div className="actions">
          <button className="btn primary" disabled={busy} onClick={() => start(false)}>Create game</button>
          <button className="btn" disabled={busy} onClick={() => start(true)}>Play solo vs a bot</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="muted">Create a game, share the link, and friends join from their browser. No account needed.</p>
      </section>

      <footer className="home-foot">
        <button className="link" onClick={() => setRules(true)}>How to play</button>
        <span className="muted">{APP_NAME} is an independent project, not affiliated with the makers of any commercial board game.</span>
      </footer>
      {rules && <Rules onClose={() => setRules(false)} />}
    </main>
  );
}
