import { describe, expect, it } from "vitest";
import { STORM_GAP_S, STORM_LEN_S, ScreenRecord, isYell, lineNoise, noiseAllowed, planStorm, rattleOutcome, stormAllowed, stormGap, upstairsAt, upstairsDue, flashVisible } from "@/lib/house";
import { HOUSE_LINES } from "@/bbs/house-lines";

const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };

describe("storms", () => {
  it("come every 8 to 15 minutes and last 40 to 70 seconds with one or two flashes", () => {
    expect(stormGap(0)).toBe(480); expect(stormGap(1)).toBe(900);
    for (const r of [0, 0.3, 0.7, 0.99]) {
      const p = planStorm(seq(r, r, 0.5, 0.5));
      expect(p.length).toBeGreaterThanOrEqual(STORM_LEN_S[0]); expect(p.length).toBeLessThanOrEqual(STORM_LEN_S[1]);
      expect(p.flashes.length).toBeGreaterThanOrEqual(1); expect(p.flashes.length).toBeLessThanOrEqual(2);
      for (const f of p.flashes) { expect(f).toBeGreaterThanOrEqual(8); expect(f).toBeLessThanOrEqual(p.length - 8); }
    }
    expect(STORM_GAP_S).toEqual([480, 900]);
  });
  it("never come before the house is awake, with quiet house on, or while the page is hidden", () => {
    expect(stormAllowed({ toysLive: false, quiet: false, visible: true })).toBe(false);
    expect(stormAllowed({ toysLive: true, quiet: true, visible: true })).toBe(false);
    expect(stormAllowed({ toysLive: true, quiet: false, visible: false })).toBe(false);
    expect(stormAllowed({ toysLive: true, quiet: false, visible: true })).toBe(true);
    expect(flashVisible(true)).toBe(false);
  });
  it("line noise only on a later call outside transfers, doors, postcards, art streams and reduced motion", () => {
    const ok = { inCall: true, firstCall: false, hushed: false, streaming: false, artOpen: false, reduced: false };
    expect(noiseAllowed(ok)).toBe(true);
    for (const k of ["firstCall", "hushed", "streaming", "artOpen", "reduced"] as const) expect(noiseAllowed({ ...ok, [k]: true })).toBe(false);
    expect(noiseAllowed({ ...ok, inCall: false })).toBe(false);
    const n = lineNoise(2400, Math.random); expect(n.length).toBe(240);
    expect([...n].every((b) => b >= 0x20 && b !== 0x7f)).toBe(true);
  });
  it("the board can repaint its screen from the last clear", () => {
    const r = new ScreenRecord(), enc = (s: string) => new TextEncoder().encode(s);
    r.push(enc("old\x1b[0m\x1b[2Jmenu")); r.push(enc("\x1b[5;1Hmore"));
    expect(new TextDecoder().decode(r.replay()!)).toBe("\x1b[0m\x1b[2Jmenu\x1b[5;1Hmore");
  });
});

describe("upstairs", () => {
  const base = { firstCall: false, quiet: false, usedThisSession: false, callSeconds: 400, dueAt: 360 };
  it("never on a first call, never in the first five minutes, once per session, and not with quiet house on", () => {
    expect(upstairsDue(base)).toBe(true);
    expect(upstairsDue({ ...base, firstCall: true })).toBe(false);
    expect(upstairsDue({ ...base, callSeconds: 299, dueAt: -1e9 })).toBe(false);
    expect(upstairsDue({ ...base, usedThisSession: true })).toBe(false);
    expect(upstairsDue({ ...base, quiet: true })).toBe(false);
    expect(upstairsAt(0)).toBe(300);
  });
  it("drops the line after sixty seconds unless the caller yelled", () => {
    expect(rattleOutcome({ noticeAt: 0, now: 59_000, reprieved: false })).toBe("wait");
    expect(rattleOutcome({ noticeAt: 0, now: 60_000, reprieved: false })).toBe("drop");
    expect(rattleOutcome({ noticeAt: 0, now: 600_000, reprieved: true })).toBe("kept");
    expect(isYell({ key: "s", ctrl: true })).toBe(true);
    expect(isYell({ key: "s", ctrl: false })).toBe(false);
    expect(isYell({ key: "Yell", ctrl: false })).toBe(true);
  });
  it("every board's notice fits the status row and names the key", () => {
    for (const l of Object.values(HOUSE_LINES)) { expect(l.rattle.length).toBeLessThanOrEqual(79); expect(l.rattle.toLowerCase()).toContain("ctrl-s"); }
    expect(HOUSE_LINES.crawl.rattle).toContain("someone is rattling your line. one minute.");
  });
});
