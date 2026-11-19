// Local DOS programs that draw straight to the terminal (never through the modem): KPLAY, the screensaver.
import { a, box, center, pad, rpad } from "@/bbs/ansi";
import type { Key } from "./keyboard";

export interface LocalEnv { out(x: ReturnType<typeof a>): void; nextOr(p: Promise<unknown>): Promise<Key | null>; reduced(): boolean }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const MUSIC = /\.(mod|s3m|xm|it)$/i;

const NOTES = ["C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"];
/** libopenmpt note value -> tracker text. 0 empty, 1..120 notes, 254 cut, 255 off. */
export function noteName(n: number) {
  if (!n) return "···";
  if (n === 255 || n === 253) return "===";
  if (n === 254) return "^^^";
  if (n > 120) return "???";
  return NOTES[(n - 1) % 12] + Math.floor((n - 1) / 12);
}
const fmtT = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** KPLAY v1.3: title, channels, order/row counters, per-channel VU bars and the scrolling pattern. */
export async function kplay(env: LocalEnv, name: string, bytes: Uint8Array) {
  const head = a().reset().cls();
  head.at(1, 1).c(0, 3).t(pad(" KPLAY v1.3 · Kestrel tracker player · (c) 1993 Kestrel Systems", 79)).reset();
  box(head, 3, 2, 77, 6, 3, "MODULE");
  head.at(4, 5).k(7, "File ").k(15, pad(name, 14)).at(24, 1).c(0, 7).t(pad(" SPACE pause · ESC stop", 79)).reset();
  head.at(5, 5).k(8, "loading the Kestrel SoundBlaster-ish driver...");
  env.out(head);
  let mod: typeof import("@/audio/kplay");
  try { mod = await import("@/audio/kplay"); } catch { return fail(env, "driver failed to load"); }
  let meta: import("@/audio/kplay").TrackMeta | null = null;
  let pos: import("@/audio/kplay").TrackPos | null = null;
  let ended = false, err = "";
  try {
    await mod.play(bytes, { meta: (m) => { meta = m; }, pos: (p) => { pos = p; }, end: () => { ended = true; }, error: (e) => { err = e; } });
  } catch { return fail(env, "needs a sound card (AudioWorklet not available)"); }
  let paused = false, drawnMeta = false;
  const peaks: number[] = [];
  try {
    for (;;) {
      const k = await env.nextOr(sleep(80));
      if (k?.key === "Escape") break;
      if (k?.key === " ") { paused = !paused; mod.setPaused(paused); }
      if (err) { mod.stop(); return fail(env, `this module won't play (${err})`); }
      const m = meta as import("@/audio/kplay").TrackMeta | null, p = pos as import("@/audio/kplay").TrackPos | null;
      const x = a();
      if (m && !drawnMeta) {
        drawnMeta = true;
        x.at(5, 5).k(7, "Title ").k(14, pad(m.title || "(untitled)", 32)).k(7, "  Type ").k(11, pad(m.type, 30));
        x.at(6, 5).k(7, "Channels ").k(15, String(m.channels)).k(7, "   Orders ").k(15, String(m.orders)).k(7, "   Length ").k(15, fmtT(m.dur));
        x.at(10, 2).k(3, "CHANNELS").at(10, 28).k(3, "PATTERN");
      }
      if (m && p) {
        x.at(7, 5).k(7, "Order ").k(15, `${String(p.order).padStart(3, "0")}/${String(Math.max(0, m.orders - 1)).padStart(3, "0")}`)
          .k(7, "  Pattern ").k(15, String(p.pattern).padStart(3, "0"))
          .k(7, "  Row ").k(15, String(p.row).padStart(2, "0")).k(7, "  Time ").k(15, fmtT(p.pos)).k(7, " / ").k(15, fmtT(m.dur))
          .k(paused ? 12 : 10, paused ? "  PAUSED " : "  PLAYING").k(7, "      ");
        // VU bars, up to 12 channels
        const n = Math.min(12, m.channels);
        for (let i = 0; i < n; i++) {
          const v = Math.min(1, (p.vu[i] ?? 0) * 1.6);
          peaks[i] = Math.max(v, (peaks[i] ?? 0) - 0.04);
          const w = 16, on = Math.round(v * w), pk = Math.min(w - 1, Math.round(peaks[i] * w));
          x.at(11 + i, 2).k(8, String(i + 1).padStart(2, "0") + " ");
          for (let j = 0; j < w; j++) x.k(j < on ? (j < 10 ? 10 : j < 14 ? 14 : 12) : j === pk ? 7 : 8, j < on ? "█" : j === pk ? "▌" : "·");
        }
        if (m.channels > 12) x.at(23, 2).k(8, `+${m.channels - 12} more`);
        // pattern: 11 rows centered on the playing row, 4 channels
        const pat = m.patterns[p.pattern];
        const show = Math.min(4, m.channels);
        for (let r = -5; r <= 5; r++) {
          const row = p.row + r, cur = r === 0;
          x.at(16 + r, 24);
          const cells = pat?.rows?.[row];
          if (!cells) { x.reset().rep(" ", 55); continue; }
          x.c(cur ? 0 : 8, cur ? 3 : 0).t(String(row).padStart(2, "0") + " ");
          for (let ch = 0; ch < show; ch++) {
            const c = cells[ch] ?? [0, 0, 0, 0, 0, 0];
            x.c(cur ? 15 : c[0] ? 11 : 8, cur ? 3 : 0).t(noteName(c[0]) + " ").c(cur ? 15 : c[1] ? 13 : 8, cur ? 3 : 0).t(c[1] ? c[1].toString(16).toUpperCase().padStart(2, "0") : "··").c(cur ? 0 : 8, cur ? 3 : 0).t(" │ ");
          }
          x.reset().eol();
        }
      }
      if (x.length) env.out(x);
      if (ended) {
        env.out(a().at(22, 28).k(14, "end of module · any key"));
        await env.nextOr(new Promise(() => {}));
        break;
      }
    }
  } finally { mod.stop(); }
}

async function fail(env: LocalEnv, why: string) {
  const x = a(); box(x, 10, 15, 50, 5, 12, "KPLAY"); x.at(12, 18).k(15, pad(why, 44));
  env.out(x);
  await env.nextOr(sleep(4000));
}

/** Text-mode starfield. Returns on any key. */
export async function starfield(env: LocalEnv) {
  env.out(a().reset().cls());
  const N = 70, s: { x: number; y: number; z: number; px: number; py: number }[] = [];
  for (let i = 0; i < N; i++) s.push({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random(), px: -1, py: -1 });
  for (;;) {
    const x = a();
    for (const st of s) {
      st.z -= env.reduced() ? 0.004 : 0.012;
      if (st.z <= 0.02) { st.x = Math.random() * 2 - 1; st.y = Math.random() * 2 - 1; st.z = 1; }
      const cx = Math.round(40 + (st.x / st.z) * 30), cy = Math.round(13 + (st.y / st.z) * 10);
      if (st.px > 0) x.at(st.py, st.px).raw(" ");
      if (cx >= 1 && cx <= 79 && cy >= 1 && cy <= 25) {
        const ch = st.z > 0.66 ? "·" : st.z > 0.33 ? "∙" : "*";
        x.at(cy, cx).k(st.z > 0.66 ? 8 : st.z > 0.33 ? 7 : 15, ch); st.px = cx; st.py = cy;
      } else st.px = -1;
    }
    x.at(25, 1);
    env.out(x);
    const k = await env.nextOr(sleep(60));
    if (k) { env.out(a().reset().cls()); return; }
  }
}
export { center, rpad };

export type Saver = "starfield" | "number" | "rain";
export const SAVERS: Saver[] = ["starfield", "number", "rain"];
export async function screenSaver(env: LocalEnv, kind: Saver) {
  if (kind === "starfield") return starfield(env);
  env.out(a().reset().cls());
  let x = 8, y = 5, dx = 1, dy = 1;
  const drops = Array.from({length: 35}, () => ({x: 1 + Math.floor(Math.random()*78), y: 1 + Math.floor(Math.random()*23)}));
  for (;;) {
    const frame = a();
    if (kind === "number") {
      frame.at(y,x).t(" ".repeat(17)); x += dx; y += dy;
      if (x <= 1 || x >= 61) dx *= -1; if (y <= 1 || y >= 24) dy *= -1;
      frame.at(y,x).k(11,"BBS 555-0142");
    } else for (const d of drops) {
      frame.at(d.y,d.x).t(" "); d.y = d.y % 24 + 1;
      frame.at(d.y,d.x).k(2 + (d.y % 2)*8, String.fromCharCode(33+Math.floor(Math.random()*90)));
    }
    env.out(frame);
    if (await env.nextOr(sleep(env.reduced() ? 500 : 100))) { env.out(a().reset().cls()); return; }
  }
}
