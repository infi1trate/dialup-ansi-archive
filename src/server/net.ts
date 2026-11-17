// Server-only: the multi-caller message base. Every table is RLS-locked; only this module touches it.
// Import dynamically from inside server route handlers only.
import { allow, type HitStore } from "@/lib/ratelimit";
import { checkHandle, checkOneliner, FUNNEL, speedFor } from "@/lib/filter";

type Json = Record<string, any>;
export class NetError extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function db() { return (await import("@/integrations/supabase/client.server")).supabaseAdmin; }

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
export async function sha256(s: string) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(s))); }

export async function tokenHash(token: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw new NetError(400, "bad token");
  return sha256("dialup.token:" + token);
}
export async function ipHash(req: Request) {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return sha256("dialup.ip:" + (process.env.IP_HASH_SALT || "crawlspace-555-0142") + ":" + ip);
}

// transfer phrase: PBKDF2-SHA256 (workerd caps iterations at 100k)
const ITER = 100_000;
async function pbkdf2(phrase: string, salt: Uint8Array<ArrayBuffer>) {
  const k = await crypto.subtle.importKey("raw", enc.encode(phrase), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, k, 256));
}
async function hashPhrase(phrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${hex(salt.buffer)}$${await pbkdf2(phrase, salt)}`;
}
async function verifyPhrase(phrase: string, stored: string) {
  const [, , saltHex, h] = stored.split("$");
  const salt: Uint8Array<ArrayBuffer> = new Uint8Array(saltHex.match(/../g)!.map((x) => parseInt(x, 16)));
  return safeEq(await pbkdf2(phrase, salt), h);
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Sliding-window limit; see src/lib/ratelimit.ts. */
export async function limit(keys: string[], action: string, max: number, windowSec: number) {
  const s = await db();
  const store: HitStore = {
    async count(key, act, since, upTo) {
      let q = s.from("rate_hits").select("id", { count: "exact", head: true }).eq("key", key).eq("action", act).gte("at", new Date(since).toISOString());
      if (upTo !== undefined) q = q.lte("id", upTo);
      const { count, error } = await q;
      if (error) throw new NetError(503, "offline");
      return count ?? 0;
    },
    async record(ks, act) {
      const { data, error } = await s.from("rate_hits").insert(ks.map((key) => ({ key, action: act }))).select("id");
      if (error || !data) throw new NetError(503, "offline");
      return data.map((r: any) => Number(r.id));
    },
    async remove(ids) { await s.from("rate_hits").delete().in("id", ids); },
  };
  if (!(await allow(store, keys, action, max, windowSec))) throw new NetError(429, "slow down");
  if (Math.random() < 0.02) await s.from("rate_hits").delete().lt("at", new Date(Date.now() - 86400_000).toISOString());
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const today = () => new Date().toISOString().slice(0, 10);

async function callerByToken(th: string) {
  const { data } = await (await db()).from("callers").select("*").contains("token_hashes", [th]).maybeSingle();
  return data;
}
const pub = (c: any) => c && ({ handle: c.handle, city: c.city, calls: c.calls, files: c.files_viewed, speed: c.speed_unlocked, banned: c.banned });

export async function bump(step: string) {
  if (!(FUNNEL as readonly string[]).includes(step)) throw new NetError(400, "bad step");
  await (await db()).rpc("bump_counter", { _step: step });
}

async function onlineList() {
  const since = new Date(Date.now() - 150_000).toISOString();
  const { data } = await (await db()).from("presence").select("session_id, handle, city, speed, doing, started_at").gte("updated_at", since).order("started_at").limit(8);
  return data ?? [];
}

export async function hiddenFiles(pack: string): Promise<Set<string>> {
  const { data } = await (await db()).from("flags").select("file").eq("pack", pack.toLowerCase()).eq("hidden", true);
  return new Set((data ?? []).map((r) => r.file.toLowerCase()));
}

export async function handle(b: Json, req: Request): Promise<Json> {
  const s = await db();
  const ip = await ipHash(req);
  const action = str(b.action, 20);
  switch (action) {
    case "hello": {
      const th = await tokenHash(b.token);
      await limit([th, ip], "hello", 30, 600);
      return { caller: pub(await callerByToken(th)) };
    }
    case "check": {
      await limit([ip], "check", 40, 600);
      const v = checkHandle(str(b.handle, 40));
      if (!v.ok) return { ok: false, why: v.why };
      const { data } = await s.from("callers").select("id").eq("handle_lower", v.value.toLowerCase()).maybeSingle();
      return data ? { ok: false, why: "That handle is taken." } : { ok: true };
    }
    case "claim": {
      const th = await tokenHash(b.token);
      await limit([th, ip], "claim", 10, 3600);
      const v = checkHandle(str(b.handle, 40));
      if (!v.ok) return { ok: false, why: v.why };
      const phrase = str(b.phrase, 64);
      if (phrase && phrase.length < 4) return { ok: false, why: "Transfer phrase needs 4+ characters." };
      const old = await callerByToken(th);
      const { data, error } = await s.from("callers").insert({
        handle: v.value, handle_lower: v.value.toLowerCase(), city: str(b.city, 24).replace(/[^\x20-\x7e]/g, ""),
        token_hashes: [th], phrase_hash: phrase ? await hashPhrase(phrase) : null,
      }).select("*").single();
      if (error) return { ok: false, why: error.code === "23505" ? "That handle is taken." : "The message base hiccuped." };
      // a device holds one handle at a time
      if (old) await s.from("callers").update({ token_hashes: old.token_hashes.filter((t: string) => t !== th) }).eq("id", old.id);
      return { ok: true, caller: pub(data) };
    }
    case "transfer": {
      const th = await tokenHash(b.token);
      await limit([th, ip], "transfer", 5, 600);
      const { data: c } = await s.from("callers").select("*").eq("handle_lower", str(b.handle, 40).trim().toLowerCase()).maybeSingle();
      if (!c) return { ok: false, why: "nouser" };
      if (!c.phrase_hash) return { ok: false, why: "nophrase" };
      if (!(await verifyPhrase(str(b.phrase, 64), c.phrase_hash))) return { ok: false, why: "wrong" };
      if (c.banned) return { ok: false, why: "banned" };
      const old = await callerByToken(th);
      if (old && old.id !== c.id) await s.from("callers").update({ token_hashes: old.token_hashes.filter((t: string) => t !== th) }).eq("id", old.id);
      const tokens = [...new Set([...c.token_hashes, th])].slice(-8);
      await s.from("callers").update({ token_hashes: tokens }).eq("id", c.id);
      return { ok: true, caller: pub(c) };
    }
    case "logon": {
      const th = await tokenHash(b.token);
      await limit([th, ip], "logon", 20, 600);
      const c = b.guest ? null : await callerByToken(th);
      if (c?.banned) return { banned: true };
      const speed = [2400, 9600, 14400, 28800].includes(b.speed) ? b.speed : 9600;
      let prevDay: string | null = null;
      if (c) prevDay = c.last_call_at ? String(c.last_call_at).slice(0, 10) : null;
      else {
        const { data } = await s.from("call_log").select("created_at").eq("token_hash", th).order("created_at", { ascending: false }).limit(1).maybeSingle();
        prevDay = data ? String(data.created_at).slice(0, 10) : null;
      }
      const calledBack = !!prevDay && prevDay < today();
      await s.from("call_log").insert({ caller_id: c?.id ?? null, token_hash: th, handle: c?.handle ?? null, city: c?.city ?? "", speed });
      if (c) await s.from("callers").update({ calls: c.calls + 1, last_call_at: new Date().toISOString() }).eq("id", c.id);
      await bump("logged_in");
      if (calledBack) await bump("called_back");
      return { caller: c ? pub({ ...c, calls: c.calls + 1 }) : null, calledBack };
    }
    case "callers": {
      await limit([ip], "read", 120, 600);
      const { data } = await s.from("call_log").select("handle, city, speed, created_at").not("handle", "is", null).order("created_at", { ascending: false }).limit(10);
      return { callers: data ?? [] };
    }
    case "oneliners": {
      await limit([ip], "read", 120, 600);
      const { data } = await s.from("oneliners").select("handle, body, created_at").eq("hidden", false).order("created_at", { ascending: false }).limit(15);
      return { oneliners: (data ?? []).reverse() };
    }
    case "post": {
      const th = await tokenHash(b.token);
      const c = await callerByToken(th);
      if (!c) return { ok: false, why: "Guests can't write on the wall. Apply with NEW." };
      if (c.banned) return { ok: false, why: "Your account is suspended." };
      const v = checkOneliner(str(b.body, 200));
      if (!v.ok) return { ok: false, why: v.why };
      const since = new Date(Date.now() - 600_000).toISOString();
      const { count } = await s.from("oneliners").select("id", { count: "exact", head: true }).or(`token_hash.eq.${th},ip_hash.eq.${ip}`).gte("created_at", since);
      if ((count ?? 0) > 0) throw new NetError(429, "One oneliner per caller every 10 minutes.");
      await limit([th, ip], "post", 1, 600);
      await s.from("oneliners").insert({ caller_id: c.id, handle: c.handle, body: v.value, token_hash: th, ip_hash: ip });
      return { ok: true };
    }
    case "beat": {
      const th = await tokenHash(b.token);
      const sid = str(b.session, 40);
      if (!/^[a-f0-9]{16,40}$/.test(sid)) throw new NetError(400, "bad session");
      await limit([th], "beat", 20, 60);
      const c = b.guest ? null : await callerByToken(th);
      const { data: existing } = await s.from("presence").select("token_hash").eq("session_id", sid).maybeSingle();
      if (existing && existing.token_hash !== th) throw new NetError(403, "not yours");
      await s.from("presence").upsert({
        session_id: sid, token_hash: th, handle: c?.handle ?? null, city: c?.city ?? "",
        speed: [2400, 9600, 14400, 28800].includes(b.speed) ? b.speed : 9600,
        doing: str(b.doing, 40).replace(/[^\x20-\x7e]/g, "") || "idle", updated_at: new Date().toISOString(),
      });
      if (Math.random() < 0.05) await s.from("presence").delete().lt("updated_at", new Date(Date.now() - 3600_000).toISOString());
      const list = await onlineList();
      return { online: list.map((r) => ({ handle: r.handle, city: r.city, speed: r.speed, doing: r.doing, me: r.session_id === sid })) };
    }
    case "leave": {
      const th = await tokenHash(b.token);
      await s.from("presence").delete().eq("session_id", str(b.session, 40)).eq("token_hash", th);
      return { ok: true };
    }
    case "view": {
      const th = await tokenHash(b.token);
      await limit([th], "view", 120, 600);
      const pack = str(b.pack, 80).toLowerCase(), file = str(b.file, 120);
      if (!/^[a-z0-9._\-]+$/.test(pack) || !file) throw new NetError(400, "bad file");
      const c = await callerByToken(th);
      const viewer = c ? "c:" + c.id : "t:" + th;
      await s.from("views").upsert({ viewer, pack, file }, { onConflict: "viewer,pack,file", ignoreDuplicates: true });
      if (!c) return { files: null };
      const { count } = await s.from("views").select("pack", { count: "exact", head: true }).eq("viewer", viewer);
      const files = count ?? 0;
      await s.from("callers").update({ files_viewed: files, speed_unlocked: speedFor(files) }).eq("id", c.id);
      return { files, speed: speedFor(files) };
    }
    case "top": {
      await limit([ip], "read", 120, 600);
      const { data } = await s.rpc("top_files", { _limit: 10 });
      return { top: data ?? [] };
    }
    case "report": {
      const th = await tokenHash(b.token);
      await limit([th, ip], "report", 5, 600);
      const reason = Number(b.reason);
      if (![1, 2, 3].includes(reason)) throw new NetError(400, "bad reason");
      const c = await callerByToken(th);
      await s.from("reports").insert({ pack: str(b.pack, 80).toLowerCase(), file: str(b.file, 120), reason, handle: c?.handle ?? null, token_hash: th, ip_hash: ip });
      return { ok: true };
    }
    case "count": {
      await limit([ip], "count:" + str(b.step, 20), 20, 3600);
      await bump(str(b.step, 20));
      return { ok: true };
    }
    case "sysop": return sysop(b, ip);
  }
  throw new NetError(400, "unknown action");
}

async function sysop(b: Json, ip: string): Promise<Json> {
  const key = process.env.SYSOP_KEY;
  if (!key) return { disabled: true };
  await limit([ip], "sysop", 60, 600);
  const given = str(b.key, 200);
  if (!safeEq(await sha256(given), await sha256(key))) {
    await limit([ip], "sysop-fail", 5, 600);
    return { denied: true };
  }
  const s = await db();
  const arg = str(b.arg, 120).trim();
  switch (str(b.op, 20)) {
    case "auth": return { ok: true };
    case "oneliners": {
      const { data } = await s.from("oneliners").select("id, handle, body, hidden").order("created_at", { ascending: false }).limit(15);
      return { rows: data ?? [] };
    }
    case "hideOneliner": {
      const { data } = await s.from("oneliners").update({ hidden: true }).eq("id", Number(arg) || 0).select("id");
      return { ok: !!data?.length };
    }
    case "ban": {
      const { data } = await s.from("callers").update({ banned: true }).eq("handle_lower", arg.toLowerCase()).select("id");
      if (data?.length) await s.from("oneliners").update({ hidden: true }).in("caller_id", data.map((d) => d.id));
      return { ok: !!data?.length };
    }
    case "reports": {
      const { data } = await s.from("reports").select("pack, file, reason, handle, created_at").order("created_at", { ascending: false }).limit(15);
      return { rows: data ?? [] };
    }
    case "hide": case "unhide": {
      const [pack, file] = arg.split("/");
      if (!pack || !file) return { ok: false };
      await s.from("flags").upsert({ pack: pack.toLowerCase(), file, hidden: b.op === "hide", updated_at: new Date().toISOString() });
      return { ok: true };
    }
    case "counters": {
      const since = new Date(Date.now() - 13 * 86400_000).toISOString().slice(0, 10);
      const { data } = await s.from("daily_counters").select("day, step, count").gte("day", since).order("day");
      return { rows: data ?? [] };
    }
  }
  return { ok: false };
}
