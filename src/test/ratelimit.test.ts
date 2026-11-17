import { describe, expect, it } from "vitest";
import { allow, memoryStore } from "@/lib/ratelimit";

describe("rate limit (one oneliner per 10 minutes)", () => {
  it("first accepted, next rejected, accepted again after the window", async () => {
    let now = 1_000_000; const st = memoryStore(() => now);
    expect(await allow(st, ["tok", "ip"], "post", 1, 600, now)).toBe(true);
    now += 60_000;
    expect(await allow(st, ["tok", "ip"], "post", 1, 600, now)).toBe(false);
    now += 9 * 60_000 + 1; // 10 min after the first, rejected attempt must not have extended it
    expect(await allow(st, ["tok", "ip"], "post", 1, 600, now)).toBe(true);
  });
  it("a parallel burst lets exactly one through", async () => {
    const now = 5_000_000; const st = memoryStore(() => now);
    const r = await Promise.all(Array.from({ length: 12 }, () => allow(st, ["tok"], "post", 1, 600, now)));
    expect(r.filter(Boolean).length).toBe(1);
  });
  it("another IP is unaffected", async () => {
    const now = 1; const st = memoryStore(() => now);
    expect(await allow(st, ["a"], "post", 1, 600, now)).toBe(true);
    expect(await allow(st, ["b"], "post", 1, 600, now)).toBe(true);
  });
});
