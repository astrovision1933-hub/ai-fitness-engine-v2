/**
 * Coach media registry — the real portrait photo and accent color for every
 * persona in the coach roster.
 *
 * Portraits are served from a keyless public portrait CDN so the roster ships
 * with real faces without an asset pipeline or API key. <CoachAvatar /> falls
 * back to a neon initials badge whenever a photo is unavailable, so the UI
 * never depends on the network being up.
 */

const PORTRAITS: Record<string, string> = {
  arjun: "https://randomuser.me/api/portraits/men/32.jpg",
  veer: "https://randomuser.me/api/portraits/men/45.jpg",
  aarav: "https://randomuser.me/api/portraits/men/76.jpg",
  kabir: "https://randomuser.me/api/portraits/men/52.jpg",
  rhea: "https://randomuser.me/api/portraits/women/44.jpg",
  rudra: "https://randomuser.me/api/portraits/men/86.jpg",
  max: "https://randomuser.me/api/portraits/men/12.jpg",
  athena: "https://randomuser.me/api/portraits/women/68.jpg",
  "coach prime": "https://randomuser.me/api/portraits/men/60.jpg",
};

export const DEFAULT_COACH_ACCENT = "#a3e635";

const ACCENTS: Record<string, string> = {
  arjun: "#f0b429",
  veer: "#67e8f9",
  aarav: "#a3e635",
  kabir: "#f87171",
  rhea: "#f472b6",
  rudra: "#a78bfa",
  max: "#34d399",
  athena: "#c084fc",
  "coach prime": "#fbbf24",
};

function key(name: string) {
  return name.trim().toLowerCase();
}

/** Portrait photo URL for a persona, or undefined if the roster has none. */
export function coachPortrait(name: string): string | undefined {
  return PORTRAITS[key(name)];
}

/** Accent color used for a persona's card, ring and glow. */
export function coachAccent(name: string): string {
  return ACCENTS[key(name)] ?? DEFAULT_COACH_ACCENT;
}

/** Card background gradient derived from a persona accent. */
export function coachCardGradient(accent: string) {
  return `linear-gradient(160deg, ${accent}24, #0c110c 62%)`;
}
