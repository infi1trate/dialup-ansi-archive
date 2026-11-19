import { describe, it, expect } from "vitest";
import { checkPostcard, makeId, validId, ID_ALPHABET, ID_LENGTH, expired, expiryFrom, DAILY_LIMIT } from "@/lib/postcard";
import { sendPostcard, reportPostcard, postcardEvent, readPostcard } from "@/server/postcard";
import { CLIENT_STEPS, FUNNEL } from "@/lib/filter";

const card = (o: any = {}) => ({ board: "crawl", design: "crawl", lines: ["hello from the basement", "", ""], signature: "", ...o });

// Tiny fake of the service-role client, enough for the postcard module.
function fake(rows: any[] = []) {
  const db: Record<string, any[]> = { postcards: rows, reports: [], postcard_opens: [] }, bumps: string[] = [];
  const q = (t: string) => { const f: ((r: any) => boolean)[] = []; let upd: any = null; const api: any = {
    select: (_?: any, o?: any) => { api.head = o?.head; return api; }, eq: (k: string, v: any) => (f.push((r) => r[k] === v), api), is: (k: string, v: any) => (f.push((r) => (r[k] ?? null) === v), api), gte: (k: string, v: any) => (f.push((r) => r[k] >= v), api),
    update: (u: any) => ((upd = u), api), maybeSingle: async () => ({ data: db[t].filter((r) => f.every((g) => g(r)))[0] ?? null }),
    insert: async (r: any) => { if (t === "postcard_opens" && db[t].some((x) => x.card_id === r.card_id && x.device === r.device && x.day === r.day)) return { error: { code: "23505" } }; db[t].push(r); return { error: null }; },
    then: (res: any) => { const hit = db[t].filter((r) => f.every((g) => g(r))); if (upd) hit.forEach((r) => Object.assign(r, upd)); res(upd ? { data: hit } : { count: hit.length, data: hit }); },
  }; return api; };
  return { db, bumps, s: { from: q, rpc: async (_: string, a: any) => { bumps.push(a._step); } } };
}
const now = new Date("2026-11-19T10:00:00Z");

describe("postcards", () => {
  it("validates lengths and character set", () => {
    expect(checkPostcard(card(), "Neon").ok).toBe(true);
    expect(checkPostcard(card({ lines: ["x".repeat(61), "", ""] }), "Neon").ok).toBe(false);
    expect(checkPostcard(card({ lines: ["a", "b", "c", "d"] }), "Neon").ok).toBe(false);
    expect(checkPostcard(card({ signature: "y".repeat(21) }), "Neon").ok).toBe(false);
    expect(checkPostcard(card({ lines: ["café ☺", "", ""] }), "Neon").ok).toBe(false);
    expect(checkPostcard(card({ lines: ["", " ", ""] }), "Neon").ok).toBe(false);
    const v = checkPostcard(card(), "Neon"); expect(v.ok && v.value.signature).toBe("Neon");
  });
  it("runs the oneliner abuse filter", () => {
    expect(checkPostcard(card({ lines: ["you sh1t", "", ""] }), "Neon").ok).toBe(false);
    expect(checkPostcard(card({ lines: ["visit www.spam.com", "", ""] }), "Neon").ok).toBe(false);
  });
  it("ids are 12 symbols from a 32-symbol alphabet without vowels", () => {
    expect(ID_ALPHABET.length).toBe(32); expect(/[aeiou]/.test(ID_ALPHABET)).toBe(false);
    const id = makeId(crypto.getRandomValues(new Uint8Array(16)));
    expect(id.length).toBe(ID_LENGTH); expect(ID_LENGTH).toBeGreaterThanOrEqual(10); expect(validId(id)).toBe(true); expect(validId("hello")).toBe(false);
  });
  it("expires after 180 days", async () => {
    const exp = expiryFrom(now);
    expect(expired(exp.toISOString(), new Date(now.getTime() + 179 * 86400_000))).toBe(false);
    expect(expired(exp.toISOString(), new Date(now.getTime() + 180 * 86400_000))).toBe(true);
    const f = fake([{ id: "bcdfghjklmnp", board: "crawl", hidden: false, expires_at: "2026-01-01T00:00:00Z", lines: [] }]);
    expect((await readPostcard(f.s, "bcdfghjklmnp", now)).status).toBe("missing");
  });
  it("limits 5 per handle and 2 per guest device per UTC day", async () => {
    const f = fake();
    for (let i = 0; i < DAILY_LIMIT.handle; i++) expect((await sendPostcard(f.s, { id: "c1", handle: "Neon" }, "t1", "ip", { card: card() }, now)).id).toBeTruthy();
    expect((await sendPostcard(f.s, { id: "c1", handle: "Neon" }, "t1", "ip", { card: card() }, now)).error).toMatch(/5 postcards/);
    for (let i = 0; i < DAILY_LIMIT.guest; i++) expect((await sendPostcard(f.s, null, "g1", "ip", { card: card() }, now)).id).toBeTruthy();
    expect((await sendPostcard(f.s, null, "g1", "ip", { card: card() }, now)).error).toMatch(/2 postcards/);
    expect((await sendPostcard(f.s, null, "g1", "ip", { card: card() }, new Date("2026-11-20T00:00:01Z"))).id).toBeTruthy();
    expect(f.bumps.filter((b) => b === "postcard_sent").length).toBe(8);
  });
  it("a report hides the card and later visitors see it withdrawn", async () => {
    const f = fake();
    const { id } = await sendPostcard(f.s, null, "g1", "ip", { card: card() }, now) as any;
    expect((await readPostcard(f.s, id, now)).status).toBe("ok");
    expect((await reportPostcard(f.s, id, "g2", "ip", null)).ok).toBe(true);
    expect((await readPostcard(f.s, id, now)).status).toBe("withdrawn");
    expect(f.db.reports[0]).toMatchObject({ pack: "postcard", file: id });
  });
  it("counts opens once per device per day and records the other events", async () => {
    const f = fake(), id = "bcdfghjklmnp";
    await postcardEvent(f.s, id, "opened", "d1", now); await postcardEvent(f.s, id, "opened", "d1", now); await postcardEvent(f.s, id, "opened", "d2", now);
    await postcardEvent(f.s, id, "skipped", "d1", now); await postcardEvent(f.s, id, "replied", "d1", now); await postcardEvent(f.s, id, "entered", "d1", now);
    expect(f.bumps).toEqual(["postcard_opened", "postcard_opened", "postcard_skipped", "postcard_replied", "postcard_entered"]);
    expect((await postcardEvent(f.s, id, "bogus", "d1", now)).ok).toBe(false);
  });
  it("postcard counters are server-only steps", () => {
    for (const s of ["postcard_sent", "postcard_opened", "postcard_entered"]) { expect(FUNNEL).toContain(s); expect(CLIENT_STEPS as readonly string[]).not.toContain(s); }
  });
});

import { houseFile, isHousePack, housePack } from "@/data/housepack";
describe("house pack rename", () => {
  it("aliases the old logo name to DC-LOGO.ANS", () => {
    expect(isHousePack("crawl-01")).toBe(true);
    expect(houseFile("CRWL-LGO.ANS")).toEqual(houseFile("DC-LOGO.ANS"));
    expect(housePack().files.some((f) => /crwl/i.test(f.name))).toBe(false);
  });
  it("logo carries the current tagline and credit", () => {
    const t = new TextDecoder("latin1").decode(houseFile("DC-LOGO.ANS")!);
    expect(t).toContain("No lamers. No leeches. No carrier.");
    expect(t).toContain("logo by Static / Dead Carrier house crew");
    expect(t).not.toMatch(/486|under the stairs/i);
  });
});
