import { describe, expect, it } from "vitest";
import { Modem } from "@/modem/modem";
import { Terminal } from "@/term/terminal";
import { parseSauce } from "@/term/sauce";
import { allowedSpeeds, maxSpeed, type Profile } from "@/machine/storage";

const profile = (seen: number): Profile => ({
  handle: null, password: null, city: "", joke: "", lastCall: {}, calls: 0, fastBoot: false, speed: 9600,
  filesSeen: Array.from({ length: seen }, (_, i) => `p/${i}`),
});

describe("modem speed unlocks", () => {
  it("new callers top out at 9600", () => expect(maxSpeed(profile(0))).toBe(9600));
  it("14400 requires an earned VALIDATED handle", () => { expect(maxSpeed(profile(60))).toBe(9600); expect(maxSpeed({...profile(15),handle:'Relay',accessLevel:'VALIDATED'})).toBe(14400); });
  it("28800 requires an earned ELITE handle", () => { expect(maxSpeed({...profile(60),handle:'Relay',accessLevel:'VALIDATED'})).toBe(14400); expect(maxSpeed({...profile(60),handle:'Relay',accessLevel:'ELITE'})).toBe(28800); });
  it("2400 hard mode is always available", () => expect(allowedSpeeds(profile(0))).toContain(2400));
});

describe("modem line speed", () => {
  it("releases about bps/10 bytes per second", () => {
    let got = 0;
    const m = new Modem((b) => { got += b.length; });
    m.bps = 9600;
    m.write(new Uint8Array(100000));
    for (let i = 0; i < 600; i++) m.tick(1 / 60); // 10 seconds
    expect(got).toBeGreaterThan(9600 * 0.8);
    expect(got).toBeLessThan(9600 * 1.2);
  });
  it("flush delivers everything now", () => {
    let got = 0;
    const m = new Modem((b) => { got += b.length; });
    m.write(new Uint8Array(5000));
    m.flush();
    expect(got).toBe(5000);
  });
});

describe("terminal", () => {
  const feed = (t: Terminal, s: string) => t.feed(new Uint8Array([...s].map((c) => c.charCodeAt(0))));
  it("wraps at the last column like ANSI.SYS", () => {
    const t = new Terminal();
    feed(t, "x".repeat(80));
    expect([t.x, t.y]).toEqual([0, 1]);
  });
  it("2J clears and homes the cursor", () => {
    const t = new Terminal();
    feed(t, "hello\x1b[10;10H\x1b[2J");
    expect([t.x, t.y]).toEqual([0, 0]);
    expect(t.cell(0, 0) & 0xff).toBe(0x20);
  });
  it("bold maps to bright foreground", () => {
    const t = new Terminal();
    feed(t, "\x1b[1;31mA");
    expect((t.cell(0, 0) >> 8) & 15).toBe(12);
  });
  it("counts unknown sequences", () => {
    const t = new Terminal();
    feed(t, "\x1b[5z");
    expect(t.stats.unknown).toBe(1);
  });
  it("stops at 0x1A", () => {
    const t = new Terminal();
    feed(t, "A\x1aB");
    expect(t.cell(0, 1) & 0xff).toBe(0x20);
  });
});

describe("SAUCE", () => {
  it("reads iCE flag and width, and strips the record", () => {
    const body = new Uint8Array([65, 66, 0x1a]);
    const rec = new Uint8Array(128);
    "SAUCE00".split("").forEach((c, i) => (rec[i] = c.charCodeAt(0)));
    rec[96] = 160; rec[94] = 1; rec[95] = 1; rec[105] = 1 | (1 << 1);
    const all = new Uint8Array(body.length + 128); all.set(body); all.set(rec, body.length);
    const p = parseSauce(all);
    expect(p.body.length).toBe(2);
    expect(p.sauce?.ice).toBe(true);
    expect(p.sauce?.tInfo1).toBe(160);
    expect(p.sauce?.letterSpacing).toBe(8);
  });
});
