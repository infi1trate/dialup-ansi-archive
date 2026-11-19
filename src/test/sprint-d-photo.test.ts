import { describe, expect, it } from "vitest";
import { photoCaption, photoCrop, photoYear, printGeometry, quadMatrix3d, CORK_PRINT } from "@/lib/photo";
import { HOTSPOTS } from "@/components/room/plate-layout";

describe("instant photo", () => {
  it("crops a square centred on the monitor, inside the photograph", () => {
    const [x, y, s] = photoCrop(HOTSPOTS.monitor);
    const m = HOTSPOTS.monitor, cx = (m[0] + m[2] / 2) * 2560;
    expect(s).toBeGreaterThanOrEqual(Math.round(m[2] * 2560));
    expect(Math.abs(x + s / 2 - cx)).toBeLessThan(1);
    expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
    expect(x + s).toBeLessThanOrEqual(2560); expect(y + s).toBeLessThanOrEqual(1440);
    // clamped at the edge of the photograph
    expect(photoCrop([0.9, 0.8, 0.2, 0.3])).toEqual([2560 - 525, 1440 - 525, 525]);
  });
  it("prints are square-imaged with a thick bottom border", () => {
    const g = printGeometry(880);
    expect(Math.abs(g.image - (g.w - 2 * g.side))).toBeLessThanOrEqual(1);
    expect(g.bottom).toBeGreaterThan(g.top * 3);
    expect(g.top + g.image + g.bottom).toBeCloseTo(g.h, -1);
  });
  it("caption: board name and number on a call, else the basement; date like NOV '93", () => {
    expect(photoCaption({ name: "DEAD CARRIER", number: "555-0142" }, 10, 1993)).toEqual({ where: "DEAD CARRIER 555-0142", when: "NOV '93" });
    expect(photoCaption(null, 0, 1990)).toEqual({ where: "the basement", when: "JAN '90" });
  });
  it("the device year is always 1990-1996", () => {
    expect(photoYear(0)).toBe(1990);
    expect(photoYear(0.999999)).toBe(1996);
    expect(photoYear(0.5)).toBe(1993);
  });
  it("the cork-board print lands exactly on the photographed print's corners", () => {
    const q = quadMatrix3d(100, 120, CORK_PRINT);
    const corners = [q.map(0, 0), q.map(100, 0), q.map(100, 120), q.map(0, 120)];
    corners.forEach(([x, y], i) => { expect(x).toBeCloseTo(CORK_PRINT[i][0], 4); expect(y).toBeCloseTo(CORK_PRINT[i][1], 4); });
  });
});
