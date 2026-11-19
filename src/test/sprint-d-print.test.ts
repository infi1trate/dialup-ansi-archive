import { describe, expect, it } from "vitest";
import { Terminal } from "@/term/terminal";
import { captureScreen, dotOn, inkDensity, isBlockGlyph, printFooter, PRINT_COLS, TEXT_INK } from "@/lib/printscreen";
import { encode } from "@/term/cp437";

const row = (shot: ReturnType<typeof captureScreen>, r: number) => String.fromCharCode(...shot.chars.slice(r * PRINT_COLS, r * PRINT_COLS + PRINT_COLS)).trimEnd();

describe("print screen", () => {
  it("captures the terminal buffer as displayed", () => {
    const t = new Terminal();
    t.feed(new Uint8Array(encode("\x1b[2J\x1b[1;1H\x1b[1;31mDEAD CARRIER\x1b[0m\r\n\x1b[3;5Hsecond row")));
    const shot = captureScreen(t);
    expect(row(shot, 0)).toBe("DEAD CARRIER");
    expect(row(shot, 2)).toBe("    second row");
    expect(shot.attrs[0] & 15).toBe(12); // bright red on black
    // what was on screen at the keypress: later bytes do not change the capture
    t.feed(new Uint8Array(encode("\x1b[1;1HXXXX")));
    expect(row(shot, 0)).toBe("DEAD CARRIER");
  });
  it("colours print as three densities; black ink prints nothing", () => {
    expect(inkDensity(0)).toBe(0);
    expect(inkDensity(1)).toBe(1);
    expect(inkDensity(7)).toBe(2);
    expect(inkDensity(15)).toBe(3);
    const count = (d: 0 | 1 | 2 | 3) => { let n = 0; for (let r = 0; r < 9; r++) for (let x = 0; x < 7; x++) if (dotOn(d, r, x)) n++; return n; };
    expect(count(3)).toBeGreaterThan(count(2));
    expect(count(2)).toBeGreaterThan(count(1));
    expect(count(0)).toBe(0);
    expect(isBlockGlyph(0xdb)).toBe(true); // full block uses the dot pattern
    expect(isBlockGlyph(65)).toBe(false); // letters keep their dots and print lighter
    expect(TEXT_INK[1]).toBeLessThan(TEXT_INK[2]);
  });
  it("footer: board name and number on a call, the local machine otherwise, with today's date", () => {
    const d = new Date(2026, 10, 19);
    expect(printFooter({ name: "DEAD CARRIER", number: "555-0142" }, d)).toBe("DEAD CARRIER   555-0142   11-19-93");
    expect(printFooter(null, d)).toBe("KESTREL 486   LOCAL   11-19-93");
  });
});
