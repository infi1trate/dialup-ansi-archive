import { describe, expect, it } from "vitest";
import { DRIVE_CAP, dosName, evictions } from "@/machine/drive";
import { scoreOf, genFloor } from "@/bbs/door";
import { reply, isBye } from "@/bbs/chat";
import { Board, sysopAnswers } from "@/bbs/board";
import { noteName, MUSIC } from "@/machine/programs";
import { Terminal } from "@/term/terminal";
import { DIRECTORY, type HostIO } from "@/bbs/io";

describe("C:\\DOWNLOAD", () => {
  it("caps at about 3 MB", () => { expect(DRIVE_CAP).toBe(3 * 1024 * 1024); });
  it("drops the oldest files first until the new one fits", () => {
    const files = [{ name: "NEW.ANS", size: 1_000_000, at: 3 }, { name: "OLD.ANS", size: 1_500_000, at: 1 }, { name: "MID.ANS", size: 600_000, at: 2 }];
    expect(evictions(files, 1_000_000)).toEqual(["OLD.ANS"]);
    expect(evictions(files, 100)).toEqual([]);
  });
  it("names files 8.3", () => { expect(dosName("blocktronics-long.name.ans")).toBe("BLOCKTRO.ANS"); expect(dosName("FB-GK.S3M")).toBe("FB-GK.S3M"); });
});

describe("BASEMENT CRAWL", () => {
  it("scores 100 per disk, 250 per floor, plus monsters", () => { expect(scoreOf(3, 2, 50)).toBe(850); });
  it("has five floors that each have stairs and disks", () => {
    for (let d = 1; d <= 5; d++) { const f = genFloor(d); expect(f.g[f.stairs.y][f.stairs.x]).toBe(true); expect(f.items.filter((i) => i.kind === "disk").length).toBeGreaterThanOrEqual(3); if (d >= 3) expect(f.mons.some((m) => m.kind === "pump")).toBe(true); }
  });
});

describe("sysop chat", () => {
  it("answers every fourth page", () => { expect([1, 2, 3, 4, 5, 8].map((n) => sysopAnswers(n, 0, false))).toEqual([false, false, false, true, false, true]); });
  it("always answers the first page after 20 files, once", () => { expect(sysopAnswers(1, 20, false)).toBe(true); expect(sysopAnswers(1, 20, true)).toBe(false); });
  it("matches keywords", () => { expect(reply("what modem speed?")).toMatch(/files|2400|corvid/i); expect(isBye("ok bye")).toBe(true); });
});

describe("KPLAY", () => {
  it("lists tracker formats as music", () => { expect(["A.MOD", "B.S3M", "C.XM", "D.IT", "E.ANS"].map((n) => MUSIC.test(n))).toEqual([true, true, true, true, false]); });
  it("names notes", () => { expect(noteName(49)).toBe("C-4"); expect(noteName(0)).toBe("···"); expect(noteName(255)).toBe("==="); });
});

describe("board screens fit 80x25", () => {
  const io = { entry: DIRECTORY[0], profile: { filesSeen: [] }, speed: 9600, node: 1, timeLeftMs: () => 3600_000, hint() {}, send() {} } as unknown as HostIO;
  for (const entry of [DIRECTORY[0], DIRECTORY.find((d) => d.id === "void")!]) {
    it(`${entry.name}: logo and menu never scroll`, () => {
      const b = new Board({ ...io, entry });
      for (const scr of [b.logo(new (b.menuScreen().constructor as any)()), b.menuScreen()]) {
        const t = new Terminal(); t.feed(scr.build());
        expect(t.scrollbackLines).toBe(0);
      }
    });
  }
});
