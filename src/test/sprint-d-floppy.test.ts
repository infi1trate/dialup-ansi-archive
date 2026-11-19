import { describe, expect, it } from "vitest";
import { dirA, fileA, FloppyDrive, DISKS, NOT_READY } from "@/machine/floppy";
import { bricksStep, newBricks } from "@/machine/bricks";
import { toysLive } from "@/lib/toys";

const names = (d: 1 | 2 | 3 | 4) => DISKS[d].map((f) => f.name);
const txt = (b: Uint8Array) => String.fromCharCode(...b).replace(/\r/g, "");

describe("drive A:", () => {
  it("an empty drive is not ready: Abort, Retry, Fail?", () => {
    expect(dirA(null)).toBeNull();
    expect(fileA(null, "BRICKS")).toBeNull();
    expect(NOT_READY).toEqual(["Not ready reading drive A", "Abort, Retry, Fail?"]);
  });
  it("each disk holds exactly its files", () => {
    expect(names(1)).toEqual(["BRICKS.EXE", "READ.ME"]);
    expect(names(2)).toEqual(["DIARY.TXT", "FORMAT.COM"]);
    expect(names(3)).toHaveLength(3);
    expect(DISKS[3].every((f) => f.kind === "ansi")).toBe(true);
    expect(names(4)).toEqual(["NUMBER.TXT", "LOG.TXT"]);
    expect(dirA(1)!.join("\n")).toContain("BRICKS   EXE");
  });
  it("NUMBER.TXT holds the hidden board's number and nothing else", () => {
    expect(txt(fileA(4, "NUMBER.TXT")!.bytes).trim()).toBe("555-0113");
  });
  it("the diary mentions all five boards and the stairwell hint", () => {
    const d = txt(fileA(2, "DIARY.TXT")!.bytes);
    for (const b of ["DEAD CARRIER", "FULL BLOCK", "LINE NOISE", "MAPLE RIDGE", "STROBE"]) expect(d).toContain(b);
    expect(d).toContain("the sysop's stairwell is the password");
    expect(d.match(/^\d\d-\d\d-92/gm)).toHaveLength(5);
  });
  it("programs run by bare name; eject empties the drive", () => {
    expect(fileA(1, "bricks")?.name).toBe("BRICKS.EXE");
    expect(fileA(1, "A:\\READ.ME")?.kind).toBe("text");
    const drive = new FloppyDrive();
    expect(drive.ready).toBe(false);
    expect(drive.insert(1)).toBe("inserted");
    expect(drive.insert(3)).toBe("swapped");
    expect(drive.eject()).toBe(3);
    expect(drive.ready).toBe(false);
    expect(dirA(drive.disk)).toBeNull();
  });
});

describe("BRICKS", () => {
  it("starts with three balls and loses one when the ball drops", () => {
    let s = newBricks();
    expect(s.lives).toBe(3);
    s = { ...s, serving: 0, bx: 10, by: 22, dx: 1, dy: 1, px: 60 };
    s = bricksStep(s, 0);
    expect(s.lives).toBe(2);
  });
  it("hitting a brick scores and removes it", () => {
    let s = { ...newBricks(), serving: 0, bx: 5, by: 10, dx: 1, dy: -1 };
    s = bricksStep(s, 0);
    expect(s.score).toBeGreaterThan(0);
    expect(s.bricks.filter((b) => !b)).toHaveLength(1);
  });
});

describe("toy gating", () => {
  it("toys are inert for a first-time caller, live after one call or three minutes off-call", () => {
    expect(toysLive({ calls: 0, siteSeconds: 0, inCall: false })).toBe(false);
    expect(toysLive({ calls: 0, siteSeconds: 400, inCall: true })).toBe(false);
    expect(toysLive({ calls: 0, siteSeconds: 180, inCall: false })).toBe(true);
    expect(toysLive({ calls: 1, siteSeconds: 0, inCall: true })).toBe(true);
  });
});
