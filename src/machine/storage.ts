// Persistent caller profile, stored only in this browser.
import type { Speed } from "@/modem/modem";

export interface Profile {
  handle: string | null; password: string | null; city: string; joke: string;
  lastCall: Record<string, string>; filesSeen: string[]; speed: Speed; fastBoot: boolean;
  calls: number;
  /** Distinct files viewed as counted by the message base (survives device changes). */
  serverFiles?: number;
}

const KEY = "dialup.profile.v1";
const DEFAULT: Profile = { handle: null, password: null, city: "", joke: "", lastCall: {}, filesSeen: [], speed: 9600, fastBoot: false, calls: 0 };

export function loadProfile(): Profile {
  if (typeof window === "undefined") return { ...DEFAULT };
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
  } catch { return { ...DEFAULT }; }
}

export function saveProfile(p: Profile) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage full or blocked */ }
}

/** Highest speed the caller has unlocked: 14400 after 5 files, 28800 after 15 (local or server count). */
export function maxSpeed(p: Profile): Speed {
  const n = Math.max(p.filesSeen.length, p.serverFiles ?? 0);
  return n >= 15 ? 28800 : n >= 5 ? 14400 : 9600;
}
export function allowedSpeeds(p: Profile): Speed[] {
  const m = maxSpeed(p);
  return ([2400, 9600, 14400, 28800] as Speed[]).filter((s) => s <= m);
}
