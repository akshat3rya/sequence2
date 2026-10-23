import { io } from 'socket.io-client';
import type { Ack } from '@seq/shared';

// One socket for the whole app. In dev, Vite proxies /socket.io to :3001.
// If the server lives on another host, set VITE_SERVER_URL at build time.
const url = import.meta.env?.VITE_SERVER_URL as string | undefined;
export const socket = url ? io(url) : io();

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export function getPlayerId(): string {
  let id = get('chipline.pid');
  if (!id) {
    id = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
    set('chipline.pid', id);
  }
  return id;
}
export const getName = () => get('chipline.name') ?? '';
export const setName = (n: string) => set('chipline.name', n);

/** Emit an event and await the server's { ok } / { ok:false, error } reply. */
export function request<T = {}>(event: string, payload: object = {}): Promise<Ack<T>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: 'No response from server' }), 8000);
    socket.emit(event, payload, (res: Ack<T>) => { clearTimeout(timer); resolve(res); });
  });
}
