# Chipline

Online multiplayer "five chips in a row" card/board game. Share-link rooms, 2–12 players, 2 or 3 teams, bots, chat, reconnects. No accounts.

## Run it

```bash
npm install
npm run dev        # server :3001 + client :5173  → open http://localhost:5173
```

Production (one process serves the site and the game):

```bash
npm run build
npm start          # http://localhost:3001  (PORT env var to change)
```

Deploy anywhere that runs Node with WebSockets (Render, Railway, Fly.io). Build command: `npm install && npm run build`. Start command: `npm start`.
(Vercel serverless can't hold WebSocket connections — host the server elsewhere and set `VITE_SERVER_URL` at build time if you split them.)

Tests: `npm test` (engine rules + bots playing full games).

## Where to change things

| I want to…                                   | Edit                                   |
| -------------------------------------------- | -------------------------------------- |
| Change hand sizes, max players, seq. length  | `shared/src/rules.ts`                  |
| Use my own board layout                      | `shared/src/board.ts` → `CUSTOM_LAYOUT`|
| Change game rules (jacks, dead cards, wins)  | `shared/src/engine.ts`                 |
| Make bots smarter / dumber                   | `shared/src/bot.ts` → `WEIGHTS`        |
| Bot speed, lobby timeouts, room cleanup      | top of `server/src/rooms.ts`           |
| Add a lobby/game action                      | event in `server/src/index.ts` + method in `rooms.ts` |
| Add data the UI needs                        | `shared/src/protocol.ts` (`GameView`/`RoomView`) |
| Name, tagline, team names                    | `client/src/config.ts`                 |
| Colors, fonts, sizes                         | `client/src/styles.css` (`:root`)      |
| Board look / chips / animations              | `client/src/Board.tsx` + styles.css    |

## How it fits together

- `shared/` — pure TypeScript game engine (`createGame → legalMoves → applyMove`). No I/O, fully tested. Used by server, client, and bots.
- `server/` — Express + Socket.IO. The server owns the real game state, validates every move, and sends each player only their own hand.
- `client/` — React + Vite. Receives a `RoomView` after every change and renders it; sends moves as intents.

Rooms live in memory: a server restart ends active games.
