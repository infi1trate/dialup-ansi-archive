import { describe, expect, it } from "vitest";
import { TAPE_MS, TapeDeck, pickMime, tapeFileName } from "@/lib/tape";

function deck(startOk = true) {
  const log: string[] = []; const timers: { f: () => void; ms: number }[] = [];
  const d = new TapeDeck({ start: () => { log.push("start"); return startOk; }, stop: () => log.push("stop"), setTimer: (f, ms) => { timers.push({ f, ms }); return timers.length - 1; }, clearTimer: () => log.push("clear") });
  return { d, log, timers };
}

describe("ten-second tape", () => {
  it("an armed deck starts on the first dial tone, not before", () => {
    const { d, log } = deck(); d.arm(); expect(d.state).toBe("armed"); expect(log).toEqual([]);
    d.dialTone(); expect(d.state).toBe("rec"); expect(log).toEqual(["start"]);
  });
  it("an unarmed deck ignores the dial tone", () => { const { d, log } = deck(); d.dialTone(); expect(d.state).toBe("idle"); expect(log).toEqual([]); });
  it("stops itself after exactly 10 seconds", () => {
    const { d, log, timers } = deck(); d.record(); expect(timers[0].ms).toBe(10_000); expect(TAPE_MS).toBe(10_000);
    timers[0].f(); expect(d.state).toBe("idle"); expect(log).toEqual(["start", "clear", "stop"]);
  });
  it("an early stop (F9 released) ends the tape once", () => { const { d, log } = deck(); d.record(); d.finish(); d.finish(); expect(log.filter((l) => l === "stop")).toHaveLength(1); });
  it("falls back to idle when recording is unavailable", () => { const { d } = deck(false); d.arm(); d.dialTone(); expect(d.state).toBe("idle"); });
  it("names files dialup-<board or desk>-<yyyymmdd-hhmm>", () => {
    const at = new Date(2026, 2, 7, 9, 5);
    expect(tapeFileName("DEAD CARRIER", at, "video/webm;codecs=vp9,opus")).toBe("dialup-dead-carrier-20260307-0905.webm");
    expect(tapeFileName(null, at, "video/webm")).toBe("dialup-desk-20260307-0905.webm");
    expect(tapeFileName("MAPLE RIDGE PC USERS GROUP BBS", at, "video/mp4")).toBe("dialup-maple-ridge-pc-users-group-bbs-20260307-0905.mp4");
  });
  it("prefers WebM, takes MP4 only when that is all there is, else nothing", () => {
    expect(pickMime(() => true)).toBe("video/webm;codecs=vp9,opus");
    expect(pickMime((m) => m.startsWith("video/mp4"))).toBe("video/mp4;codecs=avc1,mp4a.40.2");
    expect(pickMime(() => false)).toBeNull();
  });
});
