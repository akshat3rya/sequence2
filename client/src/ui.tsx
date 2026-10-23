import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@seq/shared';
import { APP_NAME, teamName } from './config';
import { request } from './socket';

export const Chip = ({ team, size = 14 }: { team: number; size?: number }) => (
  <span className={`chipdot t${team}`} style={{ width: size, height: size }} />
);

export function Wordmark() {
  return (
    <span className="wordmark">{APP_NAME}</span>
  );
}

export function Chat({ messages, disabled }: { messages: ChatMessage[]; disabled?: boolean }) {
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [messages.length]);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    request('chat:send', { text: t });
  };
  return (
    <div className="chat">
      <div className="chat-log" ref={box} aria-live="polite">
        {messages.length === 0 && <p className="muted">No messages yet.</p>}
        {messages.map((m) =>
          m.seat === null ? (
            <p key={m.id} className="sys">{m.text}</p>
          ) : (
            <p key={m.id}>
              <b>{m.name}</b> {m.text}
            </p>
          ),
        )}
      </div>
      <div className="chat-input">
        <input
          value={text}
          maxLength={200}
          disabled={disabled}
          placeholder="Message the table"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          aria-label="Chat message"
        />
        <button className="btn small" onClick={send} disabled={!text.trim()}>Send</button>
      </div>
    </div>
  );
}

export function Rules({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <h2>How to play</h2>
        <ul className="rules">
          <li>On your turn, play one card from your hand and put your team’s chip on a matching space on the board.</li>
          <li>Draw a new card after each play. Teams take turns around the table.</li>
          <li>Make a <b>sequence</b>: five of your team’s chips in a row (across, down or diagonal). The four corners are free and count for everyone.</li>
          <li>Two sequences may share one chip. Win by completing the number of sequences set for the game.</li>
          <li><b>♦ ♣ jacks are wild:</b> place a chip on any open space.</li>
          <li><b>♠ ♥ jacks remove</b> one opposing chip. Chips already in a sequence are locked.</li>
          <li><b>Dead card</b> (both its spaces are taken): swap it for a new card once per turn, then play as usual.</li>
        </ul>
        <button className="btn" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

export { teamName };
