import { describe, expect, it } from "vitest";
import { hootAllowed, monthGrid } from "@/lib/calendar";

describe("calendar page", () => {
  it("lays out the real month Sunday-first with today in the right cell", () => {
    const g = monthGrid(new Date(2026, 10, 19)); // 19 November 2026, a Thursday; 1 November is a Sunday
    expect(g.name).toBe("NOVEMBER");
    expect(g.weeks[0][0]).toBe(1);
    expect(g.weeks.length).toBe(5);
    expect(g.weeks[g.today.row][g.today.col]).toBe(19);
    expect(g.today.col).toBe(4);
  });
  it("uses only as many weeks as the month needs", () => {
    expect(monthGrid(new Date(2026, 1, 10)).weeks.length).toBe(4); // February 2026 starts on Sunday
    expect(monthGrid(new Date(2026, 7, 31)).weeks.length).toBe(6); // August 2026 starts on Saturday
  });
  it("the owl hoots at most once every ten seconds", () => {
    expect(hootAllowed(0, 9_999)).toBe(false);
    expect(hootAllowed(0, 10_000)).toBe(true);
  });
});
