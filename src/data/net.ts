// Client side of the message base. Browser-only (called from the board/machine after power-on).
// Every call fails soft: null means "the message base is offline".
const TOKEN_KEY = "dialup.device.v1";

const rand = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

export function deviceToken(): string {
  try {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t || !/^[a-f0-9]{64}$/.test(t)) { t = rand(32); localStorage.setItem(TOKEN_KEY, t); }
    return t;
  } catch { return (memToken ??= rand(32)); }
}
let memToken: string | null = null;
export const newSessionId = () => rand(12);

export interface CallerInfo { handle: string; city: string; calls: number; files: number; speed: number; banned: boolean; level?: import("@/lib/access").AccessLevel }
export interface NetResult { [k: string]: any; error?: string; status?: number }

export async function net(action: string, body: Record<string, unknown> = {}, timeoutMs = 7000): Promise<NetResult | null> {
  // ?debug=offline simulates an unreachable message base
  if (typeof location !== "undefined" && /[?&]debug=[^&]*offline/.test(location.search)) return null;
  // film mode (dev/test builds only): a fixed invented cast answers, so no real caller is ever filmed
  if (import.meta.env.DEV && typeof location !== "undefined" && /[?&]film\b/.test(location.search)) { const f = (globalThis as { __filmNet?: (a: string, b: Record<string, unknown>) => NetResult | null | undefined }).__filmNet; const r = f ? f(action, body) : null; if (r !== undefined) return r; }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch("/api/public/net", {
      method: "POST", headers: { "content-type": "application/json" }, signal: ctl.signal,
      body: JSON.stringify({ action, token: deviceToken(), ...body }),
    });
    const j = await r.json().catch(() => null);
    if (r.status === 429) return { error: j?.error || "slow down", status: 429 };
    if (!r.ok || !j) return r.status >= 500 || !j ? null : { error: j.error, status: r.status };
    return j;
  } catch { return null; } finally { clearTimeout(t); }
}

const counted = new Set<string>();
/** Funnel step, at most once per page load. */
export function count(step: string) {
  if (counted.has(step) || typeof window === "undefined") return;
  counted.add(step);
  void net("count", { step });
}

let arts = 0;
export function artViewed() { arts++; if (arts === 1) count("first_art"); if (arts === 3) count("third_art"); }

let liveSession: string | null = null;
export function setLiveSession(s: string | null) { liveSession = s; }
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (!liveSession) return;
    navigator.sendBeacon?.("/api/public/net", new Blob([JSON.stringify({ action: "leave", token: deviceToken(), session: liveSession })], { type: "application/json" }));
  });
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400 * 2) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
