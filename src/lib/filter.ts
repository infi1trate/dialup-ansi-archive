// Shared input rules for handles and oneliners (server enforces; tests cover them).
const SUBSTR = ["fuck", "shit", "cunt", "nigger", "nigga", "faggot", "retard", "kike", "wetback", "motherf", "bitch", "whore", "rapist", "nazi", "hitler", "pedo"];
const WORDS = new Set(["ass", "fag", "fags", "spic", "chink", "dick", "cock", "twat", "slut", "tranny", "dyke", "wank", "piss", "kys", "coon", "gook", "jizz", "tits", "porn"]);
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

export const RESERVED = ["sysop", "static", "admin", "root", "guest", String.fromCharCode(99,114,97,119,108,115,112,97,99,101), "dead carrier", "halftone", "dial tone", "kickdrum", "mr. hutchins", "new"];

function norm(s: string) { return s.toLowerCase().replace(/[013457@$!]/g, (c) => LEET[c]); }

export function isProfane(s: string): boolean {
  const n = norm(stripPipes(s));
  const squashed = n.replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
  const plain = n.replace(/[^a-z]/g, "");
  if (SUBSTR.some((w) => plain.includes(w) || squashed.includes(w.replace(/(.)\1+/g, "$1")))) return true;
  return n.split(/[^a-z]+/).some((w) => WORDS.has(w));
}

const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\s*(\.|\(dot\)|\[dot\])\s*(com|net|org|io|ru|xyz|ly|gg|co|me|tv|info|biz|app|dev|cc|to|link|site|online)\b)/i;
export function hasUrl(s: string) { return URL_RE.test(stripPipes(s)); }

export const PIPE_RE = /\|(0[1-9]|1[0-5])/g;
export function stripPipes(s: string) { return s.replace(PIPE_RE, ""); }

export type Verdict = { ok: true; value: string } | { ok: false; why: string };

export function checkHandle(raw: string): Verdict {
  const h = raw.trim().replace(/\s+/g, " ");
  if (h.length < 2 || h.length > 16) return { ok: false, why: "Handles are 2 to 16 characters." };
  if (!/^[\x20-\x7e]+$/.test(h) || h.includes("|")) return { ok: false, why: "Plain typewriter characters only." };
  if (RESERVED.includes(h.toLowerCase())) return { ok: false, why: "That one's reserved." };
  if (isProfane(h)) return { ok: false, why: "Static's mom reads this board. Try another." };
  return { ok: true, value: h };
}

export function checkOneliner(raw: string): Verdict {
  const s = raw.replace(/\s+$/, "").replace(/^\s+/, "");
  if (!stripPipes(s).trim()) return { ok: false, why: "Say something." };
  if (s.length > 70) return { ok: false, why: "70 characters max." };
  if (!/^[\x20-\x7e]+$/.test(s)) return { ok: false, why: "Printable characters only." };
  if (hasUrl(s)) return { ok: false, why: "No links on the wall. Leave a number." };
  if (isProfane(s)) return { ok: false, why: "Keep it clean, the wall has kids on it." };
  return { ok: true, value: s };
}

/** Speed unlocked by number of distinct files viewed (shared with the client rule). */
export function speedFor(files: number) { return files >= 15 ? 28800 : files >= 5 ? 14400 : 9600; }

export const FUNNEL = ["landed", "powered_on", "dialed", "connected", "logged_in", "first_art", "third_art", "called_back"] as const;
