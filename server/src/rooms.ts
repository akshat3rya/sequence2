import {
  applyMove, chooseMove, createGame, defaultSettings, legalMoves, makeGameView, validateSetup,
  MAX_PLAYERS,
} from '@seq/shared';
import type { ChatMessage, GameSettings, GameState, Move, RoomView } from '@seq/shared';

// ─────────────────────────────────────────────────────────────
// ROOM LOGIC — lobby, seats, host powers, bot turns, chat.
// All state is in memory (a restart clears rooms).
// ─────────────────────────────────────────────────────────────

// Tunables ────────────────────────────────────────────────────
export const BOT_DELAY_MS = 900;          // pause before a bot moves
export const LOBBY_GRACE_MS = 20_000;     // how long a disconnected lobby seat is held
export const ROOM_IDLE_MS = 6 * 3600_000; // idle rooms are deleted after this
const MAX_CHAT = 100;
const BOT_NAMES = ['Ada', 'Bruno', 'Cleo', 'Dax', 'Edie', 'Finn', 'Gus', 'Hana', 'Ivo', 'Juno', 'Kit', 'Lea'];

export interface Seat {
  name: string;
  kind: 'human' | 'bot';
  playerId?: string;
  socketId: string | null;
}

export interface Room {
  id: string;
  hostPlayerId: string;
  settings: GameSettings;
  seats: Seat[];
  game: GameState | null;
  chat: ChatMessage[];
  chatSeq: number;
  lastActive: number;
  botTimer: NodeJS.Timeout | null;
  graceTimers: Map<string, NodeJS.Timeout>;
}

export type Emitter = (socketId: string, room: RoomView) => void;

export class RoomManager {
  rooms = new Map<string, Room>();
  constructor(private emit: Emitter, private kick: (socketId: string, reason: string) => void) {
    setInterval(() => this.sweep(), 10 * 60_000).unref();
  }

  private sweep() {
    const now = Date.now();
    for (const [id, room] of this.rooms) if (now - room.lastActive > ROOM_IDLE_MS) this.destroy(id);
  }
  private destroy(id: string) {
    const room = this.rooms.get(id);
    if (!room) return;
    if (room.botTimer) clearTimeout(room.botTimer);
    for (const t of room.graceTimers.values()) clearTimeout(t);
    this.rooms.delete(id);
  }

  // ── helpers ──────────────────────────────────────────────
  private newId(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (;;) {
      let id = '';
      for (let i = 0; i < 5; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
      if (!this.rooms.has(id)) return id;
    }
  }
  private cleanName(n: unknown): string {
    const s = String(n ?? '').replace(/\s+/g, ' ').trim().slice(0, 16);
    return s || 'Player';
  }
  seatOf(room: Room, playerId: string) { return room.seats.findIndex((s) => s.playerId === playerId); }
  seatOfSocket(room: Room, socketId: string) { return room.seats.findIndex((s) => s.socketId === socketId); }
  hostSeat(room: Room) { return room.seats.findIndex((s) => s.playerId === room.hostPlayerId); }
  get(id: string) { return this.rooms.get(String(id).toUpperCase()); }

  private uniqueName(room: Room, base: string) {
    let name = base, n = 2;
    while (room.seats.some((s) => s.name === name)) name = `${base} ${n++}`;
    return name;
  }
  private phase(room: Room): RoomView['phase'] {
    return !room.game ? 'lobby' : room.game.winner !== null ? 'finished' : 'playing';
  }
  private system(room: Room, text: string) {
    room.chat.push({ id: ++room.chatSeq, seat: null, name: '', team: null, text, ts: Date.now() });
    if (room.chat.length > MAX_CHAT) room.chat.shift();
  }

  // ── views ────────────────────────────────────────────────
  view(room: Room, seat: number): RoomView {
    const g = room.game;
    const teams = room.settings.teams;
    return {
      id: room.id,
      phase: this.phase(room),
      mySeat: seat,
      hostSeat: this.hostSeat(room),
      settings: room.settings,
      seats: room.seats.map((s, i) => ({
        name: s.name,
        kind: s.kind,
        connected: s.kind === 'bot' || s.socketId !== null,
        team: g ? g.teamOfSeat[i] : i % teams,
      })),
      startError: validateSetup(room.seats.length, room.settings),
      game: g ? makeGameView(g, seat, g.turn === seat ? legalMoves(g, seat) : []) : null,
      chat: room.chat,
    };
  }
  broadcast(room: Room) {
    room.lastActive = Date.now();
    room.seats.forEach((s, i) => {
      if (s.socketId) this.emit(s.socketId, this.view(room, i));
    });
  }

  // ── create / join / leave ────────────────────────────────
  create(socketId: string, playerId: string, name: string, solo: boolean): Room {
    const id = this.newId();
    const room: Room = {
      id, hostPlayerId: playerId, settings: defaultSettings(2), seats: [], game: null,
      chat: [], chatSeq: 0, lastActive: Date.now(), botTimer: null, graceTimers: new Map(),
    };
    room.seats.push({ name: this.cleanName(name), kind: 'human', playerId, socketId });
    this.rooms.set(id, room);
    if (solo) {
      room.seats.push({ name: 'Bot Ada', kind: 'bot', socketId: null });
      this.startGame(room);
    }
    return room;
  }

  join(room: Room, socketId: string, playerId: string, name: string): string | null {
    const existing = this.seatOf(room, playerId);
    if (existing >= 0) {
      const seat = room.seats[existing];
      // Replace a stale socket if the same player opened a second tab.
      if (seat.socketId && seat.socketId !== socketId) this.kick(seat.socketId, 'Opened in another tab');
      seat.socketId = socketId;
      const t = room.graceTimers.get(playerId);
      if (t) { clearTimeout(t); room.graceTimers.delete(playerId); }
      this.broadcast(room);
      return null;
    }
    if (room.game) return 'This game has already started';
    if (room.seats.length >= MAX_PLAYERS) return 'This room is full';
    const clean = this.uniqueName(room, this.cleanName(name));
    room.seats.push({ name: clean, kind: 'human', playerId, socketId });
    this.system(room, `${clean} joined`);
    this.autoSettings(room);
    this.broadcast(room);
    return null;
  }

  /** Keep team settings valid as the player count changes (host can still override). */
  private autoSettings(room: Room) {
    if (validateSetup(room.seats.length, room.settings) === null) return;
    const d = defaultSettings(room.seats.length);
    if (validateSetup(room.seats.length, d) === null) room.settings = { ...d, showHints: room.settings.showHints };
  }

  disconnect(socketId: string) {
    for (const room of this.rooms.values()) {
      const i = this.seatOfSocket(room, socketId);
      if (i < 0) continue;
      const seat = room.seats[i];
      seat.socketId = null;
      if (!room.game && seat.playerId) {
        const pid = seat.playerId;
        const t = setTimeout(() => {
          room.graceTimers.delete(pid);
          const idx = this.seatOf(room, pid);
          if (idx >= 0 && room.seats[idx].socketId === null) this.removeSeat(room, idx, 'left');
        }, LOBBY_GRACE_MS);
        room.graceTimers.set(pid, t);
      }
      this.broadcast(room);
    }
  }

  private removeSeat(room: Room, idx: number, verb: string) {
    const [gone] = room.seats.splice(idx, 1);
    this.system(room, `${gone.name} ${verb}`);
    if (gone.playerId === room.hostPlayerId) {
      const next = room.seats.find((s) => s.kind === 'human');
      if (!next) { this.destroy(room.id); return; }
      room.hostPlayerId = next.playerId!;
      this.system(room, `${next.name} is now the host`);
    }
    if (!room.seats.some((s) => s.kind === 'human')) { this.destroy(room.id); return; }
    this.autoSettings(room);
    this.broadcast(room);
  }

  leave(room: Room, socketId: string) {
    const i = this.seatOfSocket(room, socketId);
    if (i < 0) return;
    if (!room.game) this.removeSeat(room, i, 'left');
    else { room.seats[i].socketId = null; this.broadcast(room); }
  }

  // ── host actions ─────────────────────────────────────────
  private requireHost(room: Room, socketId: string): string | null {
    const i = this.seatOfSocket(room, socketId);
    return i >= 0 && i === this.hostSeat(room) ? null : 'Only the host can do that';
  }

  setSettings(room: Room, socketId: string, patch: Partial<GameSettings>): string | null {
    const e = this.requireHost(room, socketId);
    if (e) return e;
    if (room.game) return 'Game already started';
    room.settings = {
      teams: Number(patch.teams ?? room.settings.teams),
      sequencesToWin: Number(patch.sequencesToWin ?? room.settings.sequencesToWin),
      showHints: patch.showHints === undefined ? room.settings.showHints : !!patch.showHints,
    };
    this.broadcast(room);
    return null;
  }

  addBot(room: Room, socketId: string): string | null {
    const e = this.requireHost(room, socketId);
    if (e) return e;
    if (room.game) return 'Game already started';
    if (room.seats.length >= MAX_PLAYERS) return 'This room is full';
    const used = new Set(room.seats.map((s) => s.name));
    const base = BOT_NAMES.find((n) => !used.has(`Bot ${n}`)) ?? 'Bot';
    room.seats.push({ name: `Bot ${base}`, kind: 'bot', socketId: null });
    this.autoSettings(room);
    this.broadcast(room);
    return null;
  }

  removePlayer(room: Room, socketId: string, idx: number): string | null {
    const e = this.requireHost(room, socketId);
    if (e) return e;
    if (room.game) return 'Game already started';
    const seat = room.seats[idx];
    if (!seat) return 'No such seat';
    if (idx === this.hostSeat(room)) return "You can't remove yourself";
    if (seat.socketId) this.kick(seat.socketId, 'The host removed you from the game');
    this.removeSeat(room, idx, seat.kind === 'bot' ? 'was removed' : 'was removed by the host');
    return null;
  }

  swapSeats(room: Room, socketId: string, a: number, b: number): string | null {
    const e = this.requireHost(room, socketId);
    if (e) return e;
    if (room.game) return 'Game already started';
    if (!room.seats[a] || !room.seats[b]) return 'No such seat';
    [room.seats[a], room.seats[b]] = [room.seats[b], room.seats[a]];
    this.broadcast(room);
    return null;
  }

  startGame(room: Room, socketId?: string): string | null {
    if (socketId) {
      const e = this.requireHost(room, socketId);
      if (e) return e;
    }
    if (room.game) return 'Game already started';
    const err = validateSetup(room.seats.length, room.settings);
    if (err) return err;
    room.game = createGame(room.settings, room.seats.length, (Math.random() * 2 ** 32) >>> 0);
    this.system(room, 'Game started');
    this.broadcast(room);
    this.scheduleBot(room);
    return null;
  }

  backToLobby(room: Room, socketId: string): string | null {
    const e = this.requireHost(room, socketId);
    if (e) return e;
    if (room.game && room.game.winner === null) return 'Game still in progress';
    if (room.botTimer) { clearTimeout(room.botTimer); room.botTimer = null; }
    room.game = null;
    // Drop humans who left while the game ran.
    room.seats = room.seats.filter((s) => s.kind === 'bot' || s.socketId !== null);
    this.autoSettings(room);
    this.broadcast(room);
    return null;
  }

  /** Host replaces a disconnected human with a bot so a stuck game can continue. */
  botify(room: Room, socketId: string, idx: number): string | null {
    const e = this.requireHost(room, socketId);
    if (e) return e;
    const seat = room.seats[idx];
    if (!seat || seat.kind !== 'human') return 'No such player';
    if (seat.socketId) return 'That player is still connected';
    room.seats[idx] = { name: `Bot ${seat.name}`, kind: 'bot', socketId: null };
    this.system(room, `${seat.name} was replaced by a bot`);
    this.broadcast(room);
    this.scheduleBot(room);
    return null;
  }

  // ── gameplay ─────────────────────────────────────────────
  move(room: Room, socketId: string, move: Move): string | null {
    const seat = this.seatOfSocket(room, socketId);
    if (seat < 0) return 'You are not in this game';
    if (!room.game) return 'Game has not started';
    if (!move || typeof move !== 'object') return 'Bad move';
    const res = applyMove(room.game, seat, move);
    if (!res.ok) return res.error;
    this.commit(room, res.state);
    return null;
  }

  private commit(room: Room, state: GameState) {
    room.game = state;
    if (state.winner !== null) {
      const names = room.seats.filter((_, i) => state.teamOfSeat[i] === state.winner).map((s) => s.name);
      this.system(room, `Team ${state.winner + 1} wins (${names.join(', ')})`);
    }
    this.broadcast(room);
    this.scheduleBot(room);
  }

  private scheduleBot(room: Room) {
    if (room.botTimer) { clearTimeout(room.botTimer); room.botTimer = null; }
    const g = room.game;
    if (!g || g.winner !== null) return;
    if (room.seats[g.turn]?.kind !== 'bot') return;
    room.botTimer = setTimeout(() => {
      room.botTimer = null;
      const cur = room.game;
      if (!cur || cur.winner !== null || room.seats[cur.turn]?.kind !== 'bot') return;
      const seat = cur.turn;
      const res = applyMove(cur, seat, chooseMove(cur, seat));
      if (res.ok) this.commit(room, res.state);
      else console.error('bot produced illegal move:', res.error);
    }, BOT_DELAY_MS);
  }

  // ── chat ─────────────────────────────────────────────────
  chatSend(room: Room, socketId: string, text: unknown): string | null {
    const seat = this.seatOfSocket(room, socketId);
    if (seat < 0) return 'You are not in this room';
    const t = String(text ?? '').trim().slice(0, 200);
    if (!t) return null;
    const team = room.game ? room.game.teamOfSeat[seat] : seat % room.settings.teams;
    room.chat.push({ id: ++room.chatSeq, seat, name: room.seats[seat].name, team, text: t, ts: Date.now() });
    if (room.chat.length > MAX_CHAT) room.chat.shift();
    this.broadcast(room);
    return null;
  }
}
