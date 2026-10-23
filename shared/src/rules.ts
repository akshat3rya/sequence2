import type { GameSettings } from './types';

// ─────────────────────────────────────────────────────────────
// RULE CONFIG — edit here to change how games are set up.
// ─────────────────────────────────────────────────────────────
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
export const SEQUENCE_LENGTH = 5;

/** Cards dealt to each player, by number of players. */
export const HAND_SIZE: Record<number, number> = {
  2: 7, 3: 6, 4: 6, 5: 6, 6: 5, 7: 5, 8: 4, 9: 4, 10: 3, 11: 3, 12: 3,
};

export const ALLOWED_TEAMS = [2, 3];
export const MAX_SEQUENCES_TO_WIN = 3;

/** Sensible default for N players. */
export function defaultSettings(numPlayers: number): GameSettings {
  const teams = numPlayers % 2 === 0 ? 2 : numPlayers % 3 === 0 ? 3 : 2;
  return { teams, sequencesToWin: teams === 2 ? 2 : 1, showHints: false };
}

/** Returns an error message, or null if the setup is valid. */
export function validateSetup(numPlayers: number, s: GameSettings): string | null {
  if (numPlayers < MIN_PLAYERS) return `Need at least ${MIN_PLAYERS} players`;
  if (numPlayers > MAX_PLAYERS) return `At most ${MAX_PLAYERS} players`;
  if (!ALLOWED_TEAMS.includes(s.teams)) return 'Teams must be 2 or 3';
  if (numPlayers % s.teams !== 0) return `${numPlayers} players can't split evenly into ${s.teams} teams`;
  if (s.sequencesToWin < 1 || s.sequencesToWin > MAX_SEQUENCES_TO_WIN) return 'Invalid sequences-to-win';
  return null;
}
