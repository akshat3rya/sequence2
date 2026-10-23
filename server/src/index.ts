import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import type { Ack } from '@seq/shared';
import { RoomManager } from './rooms';

// ─────────────────────────────────────────────────────────────
// SERVER — Express (serves the built client) + Socket.IO (game events).
// Every handler: validate input → call RoomManager → ack({ ok } | { ok:false, error }).
// To add a feature: add an event below + a method in rooms.ts.
// ─────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN ?? true },
});

app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.rooms.size }));
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const rooms = new RoomManager(
  (socketId, view) => io.to(socketId).emit('room:state', view),
  (socketId, reason) => {
    io.to(socketId).emit('room:kicked', reason);
    const s = io.sockets.sockets.get(socketId);
    if (s) delete s.data.roomId;
  },
);

type Callback = (res: Ack<any>) => void;
const str = (v: unknown, max = 64) => String(v ?? '').slice(0, max);
const done = (cb: Callback | undefined, err: string | null, extra: object = {}) =>
  typeof cb === 'function' && cb(err ? { ok: false, error: err } : { ok: true, ...extra });

io.on('connection', (socket) => {
  const room = () => (socket.data.roomId ? rooms.get(socket.data.roomId) : undefined);

  socket.on('room:create', (p: any, cb?: Callback) => {
    const playerId = str(p?.playerId);
    if (!playerId) return done(cb, 'Missing player id');
    const r = rooms.create(socket.id, playerId, str(p?.name, 16), !!p?.solo);
    socket.data.roomId = r.id;
    rooms.broadcast(r);
    done(cb, null, { roomId: r.id });
  });

  socket.on('room:join', (p: any, cb?: Callback) => {
    const r = rooms.get(str(p?.roomId, 8));
    const playerId = str(p?.playerId);
    if (!r) return done(cb, 'Room not found — check the link');
    if (!playerId) return done(cb, 'Missing player id');
    const err = rooms.join(r, socket.id, playerId, str(p?.name, 16));
    if (!err) socket.data.roomId = r.id;
    done(cb, err);
  });

  socket.on('room:leave', (_p: any, cb?: Callback) => {
    const r = room();
    if (r) rooms.leave(r, socket.id);
    delete socket.data.roomId;
    done(cb, null);
  });

  const hostAction = (event: string, fn: (r: NonNullable<ReturnType<typeof room>>, p: any) => string | null) =>
    socket.on(event, (p: any, cb?: Callback) => {
      const r = room();
      done(cb, r ? fn(r, p) : 'Not in a room');
    });

  hostAction('room:settings', (r, p) => rooms.setSettings(r, socket.id, { teams: p?.teams, sequencesToWin: p?.sequencesToWin, showHints: p?.showHints }));
  hostAction('room:addBot', (r) => rooms.addBot(r, socket.id));
  hostAction('room:remove', (r, p) => rooms.removePlayer(r, socket.id, Number(p?.seat)));
  hostAction('room:swap', (r, p) => rooms.swapSeats(r, socket.id, Number(p?.a), Number(p?.b)));
  hostAction('room:start', (r) => rooms.startGame(r, socket.id));
  hostAction('room:lobby', (r) => rooms.backToLobby(r, socket.id));
  hostAction('room:botify', (r, p) => rooms.botify(r, socket.id, Number(p?.seat)));
  hostAction('game:move', (r, p) => rooms.move(r, socket.id, p?.move));
  hostAction('chat:send', (r, p) => rooms.chatSend(r, socket.id, p?.text));

  socket.on('disconnect', () => rooms.disconnect(socket.id));
});

server.listen(PORT, () => console.log(`Chipline server listening on :${PORT}`));
