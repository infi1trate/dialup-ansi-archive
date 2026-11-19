// Shared postcard rules (server enforces; tests cover them).
import { isProfane, hasUrl } from "./filter";
/** 32 symbols, no vowels, so ids never spell words. */
export const ID_ALPHABET = "0123456789bcdfghjklmnpqrstvwxyz-";
export const ID_LENGTH = 12;
export const LINE_MAX = 60, SIG_MAX = 20, EXPIRY_DAYS = 180;
export const DESIGNS = ["crawl", "vault", "c93", "maple", "strobe", "basement"] as const;
export type Design = (typeof DESIGNS)[number];
export const DESIGN_NAMES: Record<Design, string> = { crawl: "DEAD CARRIER", vault: "FULL BLOCK", c93: "LINE NOISE", maple: "MAPLE RIDGE", strobe: "STROBE", basement: "Greetings from the basement" };
export const DAILY_LIMIT = { handle: 5, guest: 2 };
export interface Enclosed { pack: string; file: string; year: number; artist: string }
export interface Postcard { id?: string; board: string; design: Design; lines: [string, string, string]; signature: string; enclosed?: Enclosed | null }

export function makeId(bytes: Uint8Array) { let s = ""; for (let i = 0; i < ID_LENGTH; i++) s += ID_ALPHABET[bytes[i] & 31]; return s; }
export const validId = (s: string) => s.length >= 10 && s.length <= 16 && [...s].every((c) => ID_ALPHABET.includes(c));
export const expired = (expiresAt: string, now: Date) => new Date(expiresAt).getTime() <= now.getTime();
export const expiryFrom = (now: Date) => new Date(now.getTime() + EXPIRY_DAYS * 86400_000);
/** Printable CP437 subset: plain typewriter characters. */
const PRINTABLE = /^[\x20-\x7e]*$/;

export type CardVerdict = { ok: true; value: Postcard; clean: boolean } | { ok: false; why: string };
export function checkPostcard(raw: any, handle: string): CardVerdict {
  if (!raw || typeof raw !== "object") return { ok: false, why: "Empty card." };
  if (!DESIGNS.includes(raw.design)) return { ok: false, why: "Pick a design." };
  if (typeof raw.board !== "string" || raw.board.length > 20) return { ok: false, why: "Bad board." };
  const lines = Array.isArray(raw.lines) ? raw.lines : [];
  if (lines.length > 3 || lines.some((l: unknown) => typeof l !== "string")) return { ok: false, why: "Three lines at most." };
  const l3 = [0, 1, 2].map((i) => String(lines[i] ?? "").replace(/\s+$/, "")) as [string, string, string];
  if (l3.some((l) => l.length > LINE_MAX)) return { ok: false, why: `${LINE_MAX} characters a line.` };
  if (!l3.join("").trim()) return { ok: false, why: "Write something on the card." };
  const sig = String(raw.signature ?? "").trim() || handle;
  if (sig.length > SIG_MAX) return { ok: false, why: `Signature is ${SIG_MAX} characters max.` };
  if (![...l3, sig].every((l) => PRINTABLE.test(l))) return { ok: false, why: "Printable characters only." };
  const text = [...l3, sig].join(" ");
  if (isProfane(text)) return { ok: false, why: "Keep it clean. The mail carrier reads these." };
  if (hasUrl(text)) return { ok: false, why: "No links on a postcard. Leave a number." };
  let enclosed: Enclosed | null = null;
  const e = raw.enclosed;
  if (e) {
    if (typeof e.pack !== "string" || !/^[A-Za-z0-9._-]{1,80}$/.test(e.pack) || typeof e.file !== "string" || !e.file || e.file.length > 120 || e.file.includes("/")) return { ok: false, why: "Bad enclosure." };
    enclosed = { pack: e.pack, file: e.file, year: Math.max(1980, Math.min(2030, Number(e.year) || 1994)), artist: String(e.artist ?? "").replace(/[^\x20-\x7e]/g, "").slice(0, 40) || "unknown artist" };
  }
  return { ok: true, clean: true, value: { board: raw.board, design: raw.design, lines: l3, signature: sig, enclosed } };
}
