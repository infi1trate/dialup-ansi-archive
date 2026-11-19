// Server-only: postcards. Reached through /api/public/net and the /p/<id> loader.
import { checkPostcard, makeId, validId, expired, expiryFrom, DAILY_LIMIT, type Postcard } from "@/lib/postcard";
type S = any;
export type CardStatus = { status: "ok"; card: Postcard & { id: string }; number: string; createdAt: string } | { status: "withdrawn" | "missing" };

export function dayStart(now: Date) { return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString(); }

export async function sendPostcard(s: S, caller: any | null, th: string, ip: string, body: any, now: Date) {
  if (caller?.banned) return { error: "This board has pulled your access." };
  const v = checkPostcard(body.card, caller?.handle ?? "GUEST");
  if (!v.ok) return { error: v.why };
  let q = s.from("postcards").select("id", { count: "exact", head: true }).gte("created_at", dayStart(now));
  q = caller ? q.eq("caller_id", caller.id) : q.eq("token_hash", th).is("caller_id", null);
  const { count } = await q;
  const cap = caller ? DAILY_LIMIT.handle : DAILY_LIMIT.guest;
  if ((count ?? 0) >= cap) return { error: `${cap} postcards a day${caller ? "" : " for guests"}. The mail goes out again at 00:00 UTC.` };
  for (let attempt = 0; attempt < 4; attempt++) {
    const id = makeId(crypto.getRandomValues(new Uint8Array(16)));
    const { error } = await s.from("postcards").insert({ id, board: v.value.board, design: v.value.design, lines: v.value.lines, signature: v.value.signature, enclosed: v.value.enclosed, caller_id: caller?.id ?? null, token_hash: th, ip_hash: ip, clean: v.clean, reply_to: validId(String(body.replyTo ?? "")) ? body.replyTo : null, created_at: now.toISOString(), expires_at: expiryFrom(now).toISOString() });
    if (!error) { await s.rpc("bump_counter", { _step: "postcard_sent" }); return { id, path: `/p/${id}` }; }
  }
  return { error: "The mail slot jammed. Try again." };
}

export async function readPostcard(s: S, id: string, now: Date): Promise<CardStatus> {
  if (!validId(id)) return { status: "missing" };
  const { data } = await s.from("postcards").select("*").eq("id", id).maybeSingle();
  if (!data || expired(data.expires_at, now)) return { status: "missing" };
  if (data.hidden) return { status: "withdrawn" };
  const { DIRECTORY } = await import("@/bbs/io");
  const number = DIRECTORY.find((d) => d.id === data.board)?.number ?? "555-0142";
  return { status: "ok", number, createdAt: data.created_at, card: { id, board: data.board, design: data.design, lines: data.lines, signature: data.signature, enclosed: data.enclosed } };
}

export async function reportPostcard(s: S, id: string, th: string, ip: string, handle: string | null) {
  if (!validId(id)) return { ok: false };
  const { data } = await s.from("postcards").update({ hidden: true }).eq("id", id).select("id");
  if (!data?.length) return { ok: false };
  await s.from("reports").insert({ pack: "postcard", file: id, reason: 1, handle, token_hash: th, ip_hash: ip });
  return { ok: true };
}

export const POSTCARD_EVENTS = { opened: "postcard_opened", skipped: "postcard_skipped", replied: "postcard_replied", entered: "postcard_entered" } as const;
/** Opens count once per card, device and UTC day; other events once per call (client) under the count limiter. */
export async function postcardEvent(s: S, id: string, kind: string, th: string, now: Date) {
  const step = (POSTCARD_EVENTS as Record<string, string>)[kind];
  if (!step || !validId(id)) return { ok: false };
  if (kind === "opened") {
    const { error } = await s.from("postcard_opens").insert({ card_id: id, device: th, day: dayStart(now).slice(0, 10) });
    if (error) return { ok: true, repeat: true };
  }
  await s.rpc("bump_counter", { _step: step });
  return { ok: true };
}
