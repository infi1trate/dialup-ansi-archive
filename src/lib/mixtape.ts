// The cassette on the desk: a fixed running order per side, a clunk-hiss-flip between sides, ducking under the
// modem handshake, and stopping for anything else that wants the speaker. Pure state; the audio engine obeys it.
export const SIDE_A = ["latchkey", "lamp", "turbo"] as const;
export const SIDE_B = ["carrier", "loop"] as const;
export const FLIP_HISS_S = 2;
export const DUCK_DB = -12;
export const duckGain = (ducked: boolean) => (ducked ? 10 ** (DUCK_DB / 20) : 1);
export type MixAction = { kind: "play"; tune: string } | { kind: "flip" } | { kind: "stop" } | { kind: "none" };

export class Mixtape {
  state: "stopped" | "playing" | "flipping" = "stopped";
  side: "A" | "B" = "A";
  track = 0;
  ducked = false;
  get list(): readonly string[] { return this.side === "A" ? SIDE_A : SIDE_B; }
  get current() { return this.list[this.track]; }
  /** A click on the cassettes: start (never on its own), or stop. */
  press(): MixAction {
    if (this.state !== "stopped") { this.state = "stopped"; return { kind: "stop" }; }
    this.state = "playing"; return { kind: "play", tune: this.current };
  }
  /** The current tune finished: next on this side, flip after side A, rewind and stop after side B. */
  ended(): MixAction {
    if (this.state !== "playing") return { kind: "none" };
    if (this.track + 1 < this.list.length) { this.track++; return { kind: "play", tune: this.current }; }
    if (this.side === "A") { this.state = "flipping"; this.side = "B"; this.track = 0; return { kind: "flip" }; }
    this.state = "stopped"; this.side = "A"; this.track = 0; return { kind: "stop" };
  }
  /** Two seconds of hiss after the side-A clunk, then side B. */
  flipped(): MixAction { if (this.state !== "flipping") return { kind: "none" }; this.state = "playing"; return { kind: "play", tune: this.current }; }
  /** KPLAY or a cracktro took the speaker. */
  interrupt(): MixAction { if (this.state === "stopped") return { kind: "none" }; this.state = "stopped"; return { kind: "stop" }; }
  duck(on: boolean) { this.ducked = on; return duckGain(on); }
}
