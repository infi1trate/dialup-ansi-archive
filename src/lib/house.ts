// The house around the basement: storms through the window and somebody upstairs who needs the phone.
// Pure timing and gating rules; the room, the audio engine and the machine carry them out.

/** Storms: one every 8 to 15 visible minutes, lasting 40 to 70 seconds, with one or two lightning flashes. */
export const STORM_GAP_S: [number, number] = [8 * 60, 15 * 60];
export const STORM_LEN_S: [number, number] = [40, 70];
export const FLASH_MS = 90;
export const FLASH_GAP_MS = 110;
const span = ([lo, hi]: [number, number], r: number) => lo + Math.round((hi - lo) * Math.min(1, Math.max(0, r)));
export const stormGap = (r: number) => span(STORM_GAP_S, r);
export interface StormPlan { length: number; flashes: number[] }
/** One storm: its length and the seconds into it at which lightning strikes (never in the first or last eight seconds). */
export function planStorm(rand: () => number): StormPlan {
  const length = span(STORM_LEN_S, rand());
  const n = rand() < 0.5 ? 1 : 2, room = length - 16;
  const flashes = Array.from({ length: n }, (_, i) => Math.round(8 + (room / n) * (i + 0.2 + rand() * 0.6))).sort((a, b) => a - b);
  return { length, flashes };
}
/** Storms only come once the house is awake for this visitor (same gate as the toys), quiet house off, page visible. */
export const stormAllowed = (s: { toysLive: boolean; quiet: boolean; visible: boolean }) => s.toysLive && !s.quiet && s.visible;
/** Lightning lights the room unless reduced motion asks for rain and thunder only. */
export const flashVisible = (reduced: boolean) => !reduced;

/** A flash puts about a second of line noise on a call; never on the first call, in a transfer, postcard, door or art stream. */
export function noiseAllowed(s: { inCall: boolean; firstCall: boolean; hushed: boolean; streaming: boolean; artOpen: boolean; reduced: boolean }) {
  return s.inCall && !s.firstCall && !s.hushed && !s.streaming && !s.artOpen && !s.reduced;
}
/** About one second of line noise at the line speed: printable CP437 only, so no escape sequence can be formed. */
export function lineNoise(bps: number, rand: () => number) {
  const n = Math.min(1500, Math.max(60, Math.round(bps / 10)));
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) { let b = 0x20 + Math.floor(rand() * 0xdf); if (b === 0x7f) b = 0xb0; out[i] = b; }
  return out;
}

/** Upstairs: at most once per session, never on a first call, never in the first five minutes of a call. */
export const UPSTAIRS_EARLIEST_S = 5 * 60;
export const UPSTAIRS_WINDOW_S = 12 * 60;
export const RATTLE_GRACE_S = 60;
export const upstairsAt = (r: number) => UPSTAIRS_EARLIEST_S + Math.round(UPSTAIRS_WINDOW_S * Math.min(1, Math.max(0, r)));
export function upstairsDue(s: { firstCall: boolean; quiet: boolean; usedThisSession: boolean; callSeconds: number; dueAt: number }) {
  return !s.firstCall && !s.quiet && !s.usedThisSession && s.callSeconds >= Math.max(UPSTAIRS_EARLIEST_S, s.dueAt);
}
/** After the notice: the caller yells (reprieve for the rest of the call) or the line drops at sixty seconds. */
export function rattleOutcome(s: { noticeAt: number; now: number; reprieved: boolean }): "wait" | "drop" | "kept" {
  if (s.reprieved) return "kept";
  return (s.now - s.noticeAt) / 1000 >= RATTLE_GRACE_S ? "drop" : "wait";
}
/** The reprieve key: Ctrl-S (also offered as a touch key). */
export const isYell = (k: { key: string; ctrl: boolean }) => k.key === "Yell" || (k.ctrl && (k.key === "s" || k.key === "S"));

const QUIET_KEY = "dialup.quietHouse";
export function quietHouse() { try { return localStorage.getItem(QUIET_KEY) === "1"; } catch { return false; } }
export function setQuietHouse(on: boolean) { try { localStorage.setItem(QUIET_KEY, on ? "1" : "0"); } catch { /* private mode */ } }
const SESSION_KEY = "dialup.upstairs.session";
export function upstairsUsed() { try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch { return false; } }
export function markUpstairsUsed() { try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* private mode */ } }

/** The board's record of its current screen: everything it sent since its last clear-screen, so it can repaint after noise. */
export class ScreenRecord {
  private parts: Uint8Array[] = []; private size = 0;
  constructor(private cap = 256 * 1024) {}
  push(b: Uint8Array) {
    const i = lastClear(b);
    if (i >= 0) { this.parts = [b.subarray(i)]; this.size = b.length - i; return; }
    this.parts.push(b); this.size += b.length;
    if (this.size > this.cap) { this.parts = []; this.size = 0; } // too long to replay; next clear starts again
  }
  /** Bytes that repaint the screen, starting with the clear; null if there is nothing replayable. */
  replay(): Uint8Array | null {
    if (!this.size) return null;
    const out = new Uint8Array(this.size + 4); out.set([0x1b, 0x5b, 0x30, 0x6d]); let o = 4; for (const p of this.parts) { out.set(p, o); o += p.length; }
    return out;
  }
}
function lastClear(b: Uint8Array) { for (let i = b.length - 4; i >= 0; i--) if (b[i] === 0x1b && b[i + 1] === 0x5b && b[i + 2] === 0x32 && b[i + 3] === 0x4a) return i; return -1; }
