import { describe, expect, it } from "vitest";
import { checkHandle, checkOneliner, speedFor } from "@/lib/filter";

describe("handles", () => {
  it("rejects reserved names case-insensitively", () => { for (const h of ["Sysop", "STATIC", "admin", "root", "Guest", "crawlspace"]) expect(checkHandle(h).ok).toBe(false); });
  it("enforces 2-16 printable chars", () => {
    expect(checkHandle("a").ok).toBe(false);
    expect(checkHandle("a".repeat(17)).ok).toBe(false);
    expect(checkHandle("Phosphor").ok).toBe(true);
    expect(checkHandle("caf\u00e9").ok).toBe(false);
  });
});
describe("oneliners", () => {
  it("max 70 visible chars", () => { expect(checkOneliner("x".repeat(70)).ok).toBe(true); expect(checkOneliner("x".repeat(71)).ok).toBe(false); });
  it("blocks URLs", () => { expect(checkOneliner("visit www.example.com").ok).toBe(false); expect(checkOneliner("http://x.io").ok).toBe(false); });
  it("allows pipe colors", () => expect(checkOneliner("|12hi |03there").ok).toBe(true));
});
it("speed unlocks at 5 and 15 files", () => { expect(speedFor(4)).toBe(9600); expect(speedFor(5)).toBe(14400); expect(speedFor(15)).toBe(28800); });
