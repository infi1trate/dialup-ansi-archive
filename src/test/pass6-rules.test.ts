import { describe, expect, it } from "vitest";
import { phosphorDecay } from "@/crt/crt";
import { sauceGroup } from "@/data/archive";
import { dosDate } from "@/machine/drive";
import { layoutReply } from "@/bbs/chat";

describe("pass 6 polish rules", () => {
  it("phosphor ghost is invisible within two 60 fps frames", () => {
    const k = phosphorDecay(1 / 60);
    expect(k * k).toBeLessThan(0.05);
    expect(phosphorDecay(1 / 30)).toBeCloseTo(k * k / 0.35, 5); // frame-rate independent
  });
  it("group falls back to SAUCE, then nothing", () => {
    expect(sauceGroup({ "A.ANS": { sauce: { group: "" } }, "B.ANS": { sauce: { group: "ACiD Productions " } } })).toEqual(["ACiD Productions"]);
    expect(sauceGroup({ "A.ANS": {} })).toEqual([]);
  });
  it("download dates use the pack year", () => {
    expect(dosDate(1996, new Date(2026, 10, 17))).toBe("11-17-96");
    expect(dosDate(2004, new Date(2026, 0, 5))).toBe("01-05-04");
  });
  it("sysop replies wrap at word boundaries inside 78 columns", () => {
    const long = "psst ".repeat(30) + "theres a quieter board somewhere under the stairs";
    const lines = layoutReply(long);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(78);
    expect(lines.join(" ").replace(/\s+/g, " ").trim()).toBe(long.replace(/\s+/g, " ").trim());
  });
});
