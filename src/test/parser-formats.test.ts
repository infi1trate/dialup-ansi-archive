import { describe, expect, it } from "vitest";
import { Terminal } from "@/term/terminal";
import { decodeXBin, decodeAdf, cellsToAnsi } from "@/term/formats";
import { prepareArt } from "@/term/prepare";
import { blinkPhase, CURSOR_BLINK_HZ, TEXT_BLINK_HZ } from "@/term/blink";

const enc = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
const ch = (t: Terminal, r: number, c: number) => String.fromCharCode(t.cell(r, c) & 0xff);

describe("ANSI.SYS edge cases from real art", () => {
  it("ESC[nC past the edge clamps to the last column", () => {
    const t = new Terminal(); t.feed(enc("\x1b[200CX")); expect(ch(t, 0, 79)).toBe("X"); expect(t.stats.unknown).toBe(0);
  });
  it("ESC[0;0H homes", () => { const t = new Terminal(); t.feed(enc("\x1b[5;5H\x1b[0;0HZ")); expect(ch(t, 0, 0)).toBe("Z"); });
  it("ESC[J variants clear the right regions", () => {
    const t = new Terminal(); t.feed(enc("AAAA\r\nBBBB\r\nCCCC\x1b[2;3H\x1b[J"));
    expect(ch(t, 0, 0)).toBe("A"); expect(ch(t, 1, 1)).toBe("B"); expect(ch(t, 1, 2)).toBe(" "); expect(ch(t, 2, 0)).toBe(" ");
    t.feed(enc("\x1b[1;3H\x1b[1J")); expect(ch(t, 0, 2)).toBe(" "); expect(ch(t, 0, 3)).toBe("A");
  });
  it("ESC[s / ESC[u save and restore", () => { const t = new Terminal(); t.feed(enc("\x1b[3;10H\x1b[s\x1b[20;1H\x1b[uQ")); expect(ch(t, 2, 9)).toBe("Q"); });
  it("ESC[?7h and ESC[=3h are accepted silently", () => { const t = new Terminal(); t.feed(enc("\x1b[?7h\x1b[=3h\x1b[=7lok")); expect(t.stats.unknown).toBe(0); });
  it("PabloDraw 24-bit ESC[1;R;G;Bt sets the foreground and ESC[0;R;G;Bt the background", () => {
    const t = new Terminal(); t.feed(enc("\x1b[1;255;128;0t\x1b[0;0;0;64tX\x1b[0mY"));
    const e = t.ext[t.top]!; expect(e[0]).toBe((1 << 24) | 0xff8000); expect(e[1]).toBe((1 << 24) | 0x000040);
    expect(e[2]).toBe(0); expect(t.stats.unknown).toBe(0);
  });
  it("wraps at column 80 exactly", () => { const t = new Terminal(); t.feed(enc("x".repeat(80) + "y")); expect(ch(t, 1, 0)).toBe("y"); });
});

function xbin(w: number, h: number, flags: number, extra: number[], data: number[]) {
  return new Uint8Array([...enc("XBIN\x1a"), w & 255, w >> 8, h & 255, h >> 8, 16, flags, ...extra, ...data]);
}
describe("XBin", () => {
  it("uncompressed with palette and font", () => {
    const palette = Array.from({ length: 48 }, (_, i) => (i === 3 ? 63 : 0)); // color 1 = red
    const font = new Array(256 * 16).fill(0); font[65 * 16] = 0xff;
    const img = decodeXBin(xbin(2, 1, 1 | 2, [...palette, ...font], [65, 0x01, 66, 0x02]));
    expect(img.cols).toBe(2); expect(Array.from(img.cells)).toEqual([65, 1, 66, 2]);
    expect(img.palette![1] & 0xff).toBe(255); expect(img.font!.bytes[65 * 16]).toBe(0xff);
  });
  it("decodes all four compression run types", () => {
    // type0 2 cells, type1 char run, type2 attr run, type3 both
    const d = [0x01, 65, 1, 66, 2, 0x41, 67, 3, 4, 0x81, 5, 68, 69, 0xc1, 70, 6];
    const img = decodeXBin(xbin(8, 1, 4, [], d));
    expect(Array.from(img.cells)).toEqual([65, 1, 66, 2, 67, 3, 67, 4, 68, 5, 69, 5, 70, 6, 70, 6]);
  });
  it("streams as bytes that paint the same cells", () => {
    const img = decodeXBin(xbin(3, 2, 0, [], [65, 0x1f, 66, 0x2e, 67, 0x07, 68, 0x4f, 69, 0x07, 70, 0x07]));
    const t = new Terminal({ cols: 40 }); t.setMode({ cols: 40, ice: true }); t.feed(cellsToAnsi(img.cells, 3, 2));
    // the image is 3 wide but the terminal is 40: rows stay contiguous only when cols match
    expect(ch(t, 0, 0)).toBe("A"); expect((t.cell(0, 0) >> 8) & 0xff).toBe(0x1f);
  });
});
describe("other binary formats", () => {
  it(".BIN uses the SAUCE width (160 columns by default)", () => {
    const p = prepareArt("WIDE.BIN", new Uint8Array(160 * 2 * 2).fill(0x41));
    expect(p.mode.cols).toBe(160);
  });
  it("ADF reads palette, font and 80-column data", () => {
    const raw = new Uint8Array(1 + 192 + 4096 + 4); raw.set([72, 0x0f, 73, 0x0e], 1 + 192 + 4096);
    const img = decodeAdf(raw); expect(img.cols).toBe(80); expect(Array.from(img.cells)).toEqual([72, 15, 73, 14]);
  });
});
describe("photosensitivity", () => {
  it("text and cursor blink stay under 3 flashes per second", () => { expect(TEXT_BLINK_HZ).toBeLessThan(3); expect(CURSOR_BLINK_HZ).toBeLessThan(3); });
  it("reduced motion renders blinking text steady", () => {
    for (let t = 0; t < 2; t += 0.05) expect(blinkPhase(t, TEXT_BLINK_HZ, true)).toBe(true);
  });
  it("counts flashes over 10 seconds", () => {
    let flips = 0, prev = true;
    for (let t = 0; t < 10; t += 1 / 240) { const v = blinkPhase(t, CURSOR_BLINK_HZ, false); if (v && !prev) flips++; prev = v; }
    expect(flips / 10).toBeLessThan(3);
  });
});
