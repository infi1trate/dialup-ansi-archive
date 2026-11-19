import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { filmDateBase, spliceSpans } from "@/film/splice";
import { FILM_CAST, FILM_HANDLE, filmNet } from "@/film/fixtures";

describe("film mode", () => {
  it("the fake clock starts at 11:47 local time", () => {
    const d = new Date(filmDateBase(new Date(2026, 10, 19, 19, 13)));
    expect([d.getHours(), d.getMinutes(), d.getDate()]).toEqual([11, 47, 19]);
  });
  it("splicing cut spans keeps exactly the recorded length", () => {
    const src = new Float32Array(10_000).fill(0.5);
    const [out] = spliceSpans([src], [[1000, 3000], [6000, 9000]]);
    expect(out.length).toBe(5000);
    expect(Math.max(...Array.from(out.subarray(0, 1500)).map((v) => Math.abs(v - 0.5)))).toBeLessThan(1e-6);
  });
  it("the crossfade at a cut has no gap in a steady sound", () => {
    const src = new Float32Array(8000).fill(1);
    const [out] = spliceSpans([src], [[1000, 2000], [4000, 6000]], 480);
    expect(Math.min(...Array.from(out))).toBeGreaterThan(0.99);
  });
  it("only the invented cast and KESTREL ever appear as callers", () => {
    const allowed = new Set<string>([FILM_HANDLE, ...FILM_CAST]);
    const now = Date.UTC(2026, 10, 19, 11, 47);
    const handles = [
      ...(filmNet("callers", {}, now)!.callers as { handle: string }[]),
      ...(filmNet("oneliners", {}, now)!.oneliners as { handle: string }[]),
      ...(filmNet("beat", { speed: 28800 }, now)!.online as { handle: string }[]),
      ...(filmNet("wall", {}, now)!.rows as { handle: string }[]),
    ].map((c) => c.handle);
    expect(handles.length).toBeGreaterThan(10);
    for (const h of handles) expect(allowed.has(h)).toBe(true);
    expect((filmNet("logon", { speed: 14400 }, now)!.caller as { handle: string; level: string })).toMatchObject({ handle: "KESTREL", level: "ELITE" });
    expect(filmNet("logon", { speed: 14400 }, now)!.speed).toBe(14400);
  });
  it("film mode is only reachable behind import.meta.env.DEV, so production builds drop it", () => {
    const files: string[] = [];
    const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (!["film", "test"].includes(n)) walk(p); } else if (/\.(ts|tsx)$/.test(n)) files.push(p); } };
    walk(join(__dirname, ".."));
    const hits = files.flatMap((f) => readFileSync(f, "utf8").split("\n").filter((l) => /@\/film\/|__filmNet/.test(l) && !/^\s*\/\//.test(l)).map((l) => [f, l] as const));
    expect(hits.length).toBeGreaterThan(0);
    for (const [f, l] of hits) {
      if (/typeof import\("@\/film\/film"\) \| null = null/.test(l)) continue; // a type only
      expect(`${f}: ${l.includes("import.meta.env.DEV")}`).toBe(`${f}: true`);
    }
  });
});
