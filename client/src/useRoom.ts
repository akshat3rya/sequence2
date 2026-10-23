import { useEffect, useState } from 'react';
import type { RoomView } from '@seq/shared';
import { getName, getPlayerId, request, socket } from './socket';

/** Joins a room, keeps its latest view, and re-joins automatically after reconnects. */
export function useRoom(roomId: string) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    let alive = true;
    const join = async () => {
      const res = await request('room:join', { roomId, playerId: getPlayerId(), name: getName() });
      if (!alive) return;
      setError(res.ok ? null : res.error);
    };
    const onState = (v: RoomView) => { if (v.id === roomId) setRoom(v); };
    const onKick = (reason: string) => { setRoom(null); setError(reason); };
    const onConnect = () => { setConnected(true); join(); };
    const onDisconnect = () => setConnected(false);

    socket.on('room:state', onState);
    socket.on('room:kicked', onKick);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) join();
    return () => {
      alive = false;
      socket.off('room:state', onState);
      socket.off('room:kicked', onKick);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [roomId]);

  return { room, error, connected };
}
