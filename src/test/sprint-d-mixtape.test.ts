import { describe, expect, it } from "vitest";
import { Mixtape, SIDE_A, SIDE_B, duckGain } from "@/lib/mixtape";
import { NEW_TUNES, TUNES } from "@/audio/tunes";

describe("mixtape", () => {
  it("never plays until clicked; a second click stops", () => {
    const m = new Mixtape();
    expect(m.state).toBe("stopped");
    expect(m.press()).toEqual({ kind: "play", tune: SIDE_A[0] });
    expect(m.press()).toEqual({ kind: "stop" });
  });
  it("plays side A in order, flips (clunk + hiss), plays side B, then stops", () => {
    const m = new Mixtape(); m.press();
    expect(m.ended()).toEqual({ kind: "play", tune: SIDE_A[1] });
    expect(m.ended()).toEqual({ kind: "play", tune: SIDE_A[2] });
    expect(m.ended()).toEqual({ kind: "flip" });
    expect(m.side).toBe("B");
    expect(m.flipped()).toEqual({ kind: "play", tune: SIDE_B[0] });
    expect(m.ended()).toEqual({ kind: "play", tune: SIDE_B[1] });
    expect(m.ended()).toEqual({ kind: "stop" });
    expect(m.state).toBe("stopped");
  });
  it("ducks by 12 dB during the handshake and comes back", () => {
    const m = new Mixtape();
    expect(20 * Math.log10(m.duck(true))).toBeCloseTo(-12, 6);
    expect(m.duck(false)).toBe(1);
    expect(duckGain(true)).toBeCloseTo(0.2512, 3);
  });
  it("stops for KPLAY or a cracktro, including mid-flip", () => {
    const m = new Mixtape(); m.press();
    expect(m.interrupt()).toEqual({ kind: "stop" });
    expect(m.interrupt()).toEqual({ kind: "none" });
    m.press(); m.ended(); m.ended(); m.ended();
    expect(m.state).toBe("flipping");
    expect(m.interrupt()).toEqual({ kind: "stop" });
    expect(m.flipped()).toEqual({ kind: "none" });
  });
  it("the three new tunes run 30 to 60 seconds and every track exists", () => {
    for (const id of NEW_TUNES) { expect(TUNES[id].length).toBeGreaterThanOrEqual(30); expect(TUNES[id].length).toBeLessThanOrEqual(60); }
    for (const id of [...SIDE_A, ...SIDE_B]) expect(TUNES[id]).toBeTruthy();
    expect(new Set(NEW_TUNES.map((id) => TUNES[id].mood)).size).toBe(3);
  });
});
