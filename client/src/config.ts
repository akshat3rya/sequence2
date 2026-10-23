// ─────────────────────────────────────────────────────────────
// CLIENT CONFIG — names and copy you're likely to want to change.
// Look and feel lives in styles.css (:root tokens). Chips differ by pattern, not color.
// ─────────────────────────────────────────────────────────────
export const APP_NAME = 'Chipline';
export const TAGLINE = 'Line up five chips before the other team does.';
export const TEAM_NAMES = ['Blue', 'Amber', 'Pink'];
export const teamName = (t: number) => TEAM_NAMES[t] ?? `Team ${t + 1}`;
export const MAX_NAME = 16;
