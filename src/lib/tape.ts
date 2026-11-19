// Ten-second tape: pure rules shared by the recorder and its tests (no DOM here).
export const TAPE_MS = 10_000;
export const TAPE_FPS = 30;
export const TAPE_W = 1280, TAPE_H = 720;

/** WebM first (VP9, then VP8, with Opus); MP4 only when the browser records nothing else. */
export const TAPE_MIMES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4"];
export function pickMime(supported: (m: string) => boolean): string | null {
  return TAPE_MIMES.find((m) => { try { return supported(m); } catch { return false; } }) ?? null;
}

const two = (n: number) => String(n).padStart(2, "0");
/** dialup-<board or "desk">-<yyyymmdd-hhmm>.<ext>, local time, board slug only. */
export function tapeFileName(board: string | null | undefined, at: Date, mime: string) {
  const slug = (board ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "desk";
  const stamp = `${at.getFullYear()}${two(at.getMonth() + 1)}${two(at.getDate())}-${two(at.getHours())}${two(at.getMinutes())}`;
  return `dialup-${slug}-${stamp}.${mime.startsWith("video/mp4") ? "mp4" : "webm"}`;
}

export type TapeState = "idle" | "armed" | "rec";
export interface TapeDeps {
  start: () => boolean;               // begins recording; false = unavailable
  stop: () => void;
  setTimer: (f: () => void, ms: number) => unknown;
  clearTimer: (t: unknown) => void;
}

/** Arming and the hard 10-second stop. The recorder itself is injected so this is testable. */
export class TapeDeck {
  state: TapeState = "idle";
  private timer: unknown = null;
  constructor(private d: TapeDeps, private onState: (s: TapeState) => void = () => {}) {}
  private set(s: TapeState) { this.state = s; this.onState(s); }
  arm() { if (this.state === "idle") this.set("armed"); }
  disarm() { if (this.state === "armed") this.set("idle"); }
  /** The first dial tone fires this; only an armed deck reacts. */
  dialTone() { if (this.state === "armed") this.record(); }
  record() {
    if (this.state === "rec") return false;
    if (!this.d.start()) { this.set("idle"); return false; }
    this.set("rec");
    this.timer = this.d.setTimer(() => this.finish(), TAPE_MS);
    return true;
  }
  finish() {
    if (this.state !== "rec") return;
    this.d.clearTimer(this.timer); this.timer = null;
    this.set("idle"); this.d.stop();
  }
  toggle() { if (this.state === "rec") this.finish(); else this.record(); }
}
