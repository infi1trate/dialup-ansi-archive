// FILM MODE: test environment only. Loaded by Computer behind `import.meta.env.DEV` when the URL carries ?film,
// so production builds never contain it. Records portfolio clips of the product exactly as composited for the
// tape (plates, light, overlays, CRT) at 1920x1080 / 30 fps with the synth's own output, on a virtual clock:
// every frame is drawn, the audio is rendered offline in lock-step, and the result is a VP9 + Opus WebM.
import { audio } from "@/audio/bus";
import { createCompositor, viewportFrame } from "@/machine/stage-composite";
import type { Engine } from "@/machine/engine";
import type { Machine } from "@/machine/machine";
import { ArrayBufferTarget, Muxer } from "webm-muxer";
import { createClock, type FilmClock } from "./clock";
import { filmNet, FILM_HANDLE } from "./fixtures";
import { FILM_DATE_RATE, filmDateBase, spliceSpans } from "./splice";

export const FILM_W = 1920, FILM_H = 1080, FILM_FPS = 30;
const SR = 48000, Q = 128, HOLD_MS = 500, FAST_MS = 100, QUANTIZER = 4;
const SEEDED = "dialup.film.seeded";

export interface FilmApi { lean: (v: boolean) => void; setLamp: (on: boolean) => void; takePhoto: () => Promise<void> }
interface Rec { name: string; frames: number; start: number; enc: VideoEncoder; video: { c: EncodedVideoChunk; m?: EncodedVideoChunkMetadata }[]; spans: [number, number][]; open: [number, number] | null }

let clock: FilmClock; let off: OfflineAudioContext; let realResume: () => Promise<void>;
let rendering: Promise<AudioBuffer>; let c0 = 0, v0 = 0, audioFull = false;
let m: Machine; let engine: Engine; let api: { current: FilmApi };
let rec: Rec | null = null, cutting = false, stopped = false, inflight = 0, inflightSince = 0;
const comp = typeof document !== "undefined" ? createCompositor(FILM_W, FILM_H) : null;

/** Seed this test device once (KESTREL at ELITE, quiet house, lamp on, EMBER on C:), then reload so every part
 *  of the page starts from that state. Returns false while the page reloads. */
export async function prepare(): Promise<boolean> {
  if (!localStorage.getItem(SEEDED)) { await seed(); localStorage.setItem(SEEDED, "1"); location.reload(); return false; }
  (globalThis as unknown as { __filmNet?: unknown }).__filmNet = (action: string, body: Record<string, unknown>) => filmNet(action, body, Date.now());
  (globalThis as unknown as { __filmOrigin?: string }).__filmOrigin = "https://dialup-ansi-archive.lovable.app"; // no test-host address on film
  clock = createClock(filmDateBase(new Date()), FILM_DATE_RATE);
  const realFetch = window.fetch.bind(window);
  window.fetch = ((...a: Parameters<typeof fetch>) => { if (inflight++ === 0) inflightSince = clock.real.now(); return realFetch(...a).finally(() => { inflight--; }); }) as typeof fetch;
  const seconds = Number(new URLSearchParams(location.search).get("film")) || 240;
  off = new OfflineAudioContext({ numberOfChannels: 2, length: SR * seconds, sampleRate: SR });
  realResume = OfflineAudioContext.prototype.resume.bind(off);
  Object.defineProperty(off, "resume", { value: () => Promise.resolve() }); // the bus resumes on every click; only the film may
  (audio as unknown as { ctx: BaseAudioContext }).ctx = off;
  audio.unlock(); await audio.whenReady();
  const first = off.suspend(Q / SR); rendering = off.startRendering(); await first;
  c0 = off.currentTime; v0 = clock.now();
  void pump();
  return true;
}

async function seed() {
  const profile = { handle: FILM_HANDLE, password: null, city: "Port Ellis", joke: "", lastCall: { "555-0142": "11-18-93 23:12", "555-0167": "11-17-93 22:40", "555-0193": "11-16-93 01:05", "555-0128": "11-14-93 19:30", "555-0177": "11-18-93 00:51" }, filesSeen: [], speed: 14400, fastBoot: true, calls: 211, accessLevel: "ELITE", serverFiles: 148 };
  const set = (k: string, v: unknown) => localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  set("dialup.profile.v1", profile);
  set("dialup.room.v1", { muted: false, reducedMotion: false, lamp: true, lean: false, brightness: 0.6, contrast: 0.7, modemVolume: 0.6, musicVolume: 0.6, turbo: false });
  set("dialup.quietHouse", "1"); set("dialup.site.seconds", "900"); set("dialup.photo.year", "1993"); set("dialup.saver", "starfield");
  const [drive, cat] = await Promise.all([import("@/machine/drive"), import("@/bbs/warez-catalog")]);
  const base = { pack: "fiction", year: 1993, artists: ["LATCHKEY"], groups: ["LATCHKEY"] };
  await drive.put({ ...base, name: "C:\\WAREZ\\EMBER\\EMBER.EXE", file: "PROGRAM", bytes: new TextEncoder().encode("KESTREL-RUN:EMBER") });
  await drive.put({ ...base, name: "C:\\WAREZ\\EMBER\\EMBER.NFO", file: "NFO", bytes: cat.nfoBytes("EMBER") });
  await drive.put({ ...base, name: "C:\\WAREZ\\EMBER\\FILE_ID.DIZ", file: "DIZ", bytes: cat.dizBytes("EMBER") });
}

export function attach(machine: Machine, eng: Engine, filmApi: { current: FilmApi }) {
  m = machine; engine = eng; api = filmApi;
  (m as unknown as { lastBusy: boolean }).lastBusy = true; // the line is never busy on film
  (window as unknown as { __film?: unknown }).__film = helpers;
}

// ── the clock pump ────────────────────────────────────────────────
async function pump() {
  while (!stopped) {
    if (inflight > 0 && clock.real.now() - inflightSince < 20000) { await clock.realSleep(3); continue; } // the stacks answer instantly on film
    const live = !!rec && !cutting;
    const target = clock.now() + (live ? 1000 / FILM_FPS : FAST_MS);
    await clock.runTimers(target);
    const a0 = Math.round(off.currentTime * SR);
    await audioTo(target);
    const a1 = Math.round(off.currentTime * SR);
    await clock.macrotask();
    clock.stepAnimations();
    clock.runFrame();
    if (live && rec) { capture(rec); if (rec.open) rec.open[1] = a1; else rec.open = [a0, a1]; while (rec.enc.encodeQueueSize > 6) await clock.realSleep(2); }
    else if (rec?.open) { rec.spans.push(rec.open); rec.open = null; }
    await clock.macrotask();
  }
}
async function audioTo(v: number) {
  if (audioFull) return;
  const t = Math.ceil((c0 + (v - v0) / 1000) * SR / Q) * Q / SR;
  if (t >= off.length / SR - 0.05) { audioFull = true; console.warn("film: offline audio buffer is full; raise ?film=<seconds>"); return; }
  if (t <= off.currentTime + 1e-7) return;
  const p = off.suspend(t); await realResume(); await p;
}

// ── picture ───────────────────────────────────────────────────────
const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 1; };
function capture(r: Rec) {
  const el = document.querySelector<HTMLElement>(".photo-room"); if (!el || !comp) return;
  const frame = viewportFrame(el, FILM_W, FILM_H);
  comp.draw(el, engine.screen, frame);
  overlays(comp.canvas.getContext("2d")!, frame);
  const vf = new VideoFrame(comp.canvas, { timestamp: Math.round(r.frames * 1e6 / FILM_FPS), duration: Math.round(1e6 / FILM_FPS) });
  // Constant low quantizer and a short GOP (keyframe every 1/3 s): grain and dark gradients survive the grade, cuts land anywhere (>= 12 Mbps).
  r.enc.encode(vf, { keyFrame: r.frames % 10 === 0, vp9: { quantizer: QUANTIZER } } as VideoEncoderEncodeOptions); vf.close(); r.frames++;
}
/** The two room-sized moments the stage compositor does not draw: the camera flash and the developing print. */
function overlays(g: CanvasRenderingContext2D, f: ReturnType<typeof viewportFrame>) {
  const close = document.querySelector<HTMLElement>(".photo-closeup");
  if (close) {
    g.fillStyle = getComputedStyle(close).backgroundColor; g.fillRect(0, 0, FILM_W, FILM_H);
    const btn = close.querySelector<HTMLElement>(".print-enlarged"), img = btn?.querySelector("img");
    if (btn && img?.complete && img.naturalWidth) {
      const r = btn.getBoundingClientRect(), cx = f.ox + (r.left + r.width / 2 - f.left) * f.k, cy = f.oy + (r.top + r.height / 2 - f.top) * f.k;
      const w = btn.offsetWidth * f.k, h = btn.offsetHeight * f.k, light = num(btn.style.getPropertyValue("--paper-light"));
      g.save(); g.translate(cx, cy); g.rotate(-2.5 * Math.PI / 180);
      g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = 70 * f.k; g.shadowOffsetY = 24 * f.k; g.fillStyle = "#000"; g.fillRect(-w / 2, -h / 2, w, h); g.shadowColor = "transparent";
      g.filter = `brightness(${light})`; g.drawImage(img, -w / 2, -h / 2, w, h);
      const dev = btn.querySelector<HTMLElement>(".print-develop");
      if (dev) { const cs = getComputedStyle(dev); g.globalAlpha = num(cs.opacity); g.fillStyle = cs.backgroundColor;
        g.fillRect(-w / 2 + dev.offsetLeft * f.k, -h / 2 + dev.offsetTop * f.k, dev.offsetWidth * f.k, dev.offsetHeight * f.k); g.globalAlpha = 1; }
      g.restore();
    }
  }
  drawClock(g, f);
  const flash = document.querySelector<HTMLElement>(".camera-flash");
  if (flash) { const cs = getComputedStyle(flash); g.globalAlpha = num(cs.opacity); g.fillStyle = cs.backgroundColor; g.fillRect(0, 0, FILM_W, FILM_H); g.globalAlpha = 1; }
}

/** The LED module exactly as laid out: its panel (which hides the photographed digits) under every segment shape. */
function drawClock(g: CanvasRenderingContext2D, f: ReturnType<typeof viewportFrame>) {
  const stage = document.querySelector<HTMLElement>(".plate-stage"), panel = stage?.querySelector<HTMLElement>(".plate-clock"); if (!stage || !panel) return;
  const sr = stage.getBoundingClientRect(), A = (sr.width / 2560) * f.k;
  const origin = (el: HTMLElement) => { let x = 0, y = 0, e: HTMLElement | null = el; while (e && e !== panel) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent as HTMLElement | null; } return [x, y]; };
  const pcs = getComputedStyle(panel), [tx, ty] = pcs.transformOrigin.split(" ").map(parseFloat), mt = new DOMMatrix(pcs.transform === "none" ? undefined : pcs.transform);
  g.save();
  g.setTransform(A, 0, 0, A, f.ox + (sr.left - f.left) * f.k, f.oy + (sr.top - f.top) * f.k);
  g.translate(panel.offsetLeft + tx, panel.offsetTop + ty); g.transform(mt.a, mt.b, mt.c, mt.d, mt.e, mt.f); g.translate(-tx, -ty);
  g.fillStyle = pcs.backgroundColor; g.fillRect(0, 0, panel.offsetWidth, panel.offsetHeight);
  const poly = (x: number, y: number, w: number, h: number, pts: number[][]) => { g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo : g.moveTo).call(g, x + px * w, y + py * h)); g.closePath(); g.fill(); };
  const H6 = [[.12, 0], [.88, 0], [1, .5], [.88, 1], [.12, 1], [0, .5]], V6 = [[.5, 0], [1, .12], [1, .88], [.5, 1], [0, .88], [0, .12]];
  panel.querySelectorAll<HTMLElement>(".segment, .clock-colon").forEach((seg) => {
    const cs = getComputedStyle(seg), [x, y] = origin(seg), w = seg.offsetWidth, h = seg.offsetHeight, lit = seg.classList.contains("lit");
    g.globalAlpha = num(cs.opacity); g.fillStyle = cs.backgroundColor; g.shadowColor = lit ? cs.backgroundColor : "transparent"; g.shadowBlur = lit ? 4 * A : 0;
    if (seg.classList.contains("clock-colon")) { g.fillRect(x, y, w, h); g.fillRect(x, y + 23, w, h); }
    else poly(x, y, w, h, /segment-[adg]/.test(seg.className) ? H6 : V6);
  });
  g.restore(); g.globalAlpha = 1; g.shadowBlur = 0;
}

// ── recording ─────────────────────────────────────────────────────
async function record(name: string, script: (h: typeof helpers) => Promise<void>): Promise<Blob> {
  if (rec) throw new Error("film: already recording");
  const video: Rec["video"] = [];
  const enc = new VideoEncoder({ output: (c, meta) => video.push({ c, m: meta }), error: (e) => console.error("film encoder", e) });
  enc.configure({ codec: "vp09.00.41.08", width: FILM_W, height: FILM_H, bitrateMode: "quantizer", framerate: FILM_FPS, latencyMode: "quality" });
  rec = { name, frames: 0, start: clock.now(), enc, video, spans: [], open: null };
  await sleep(HOLD_MS); // held frame to cut on
  await script(helpers);
  await sleep(HOLD_MS);
  const r = rec; rec = null; await clock.macrotask(); await clock.macrotask();
  if (r.open) { r.spans.push(r.open); r.open = null; }
  stopped = true; // one clip per page: let the offline render run to its end
  await enc.flush(); enc.close();
  await realResume(); const buf = await rendering;
  const [L, R] = spliceSpans([buf.getChannelData(0), buf.getChannelData(1)], r.spans);
  let peak = 0, sum = 0; for (let i = 0; i < L.length; i++) { const v = Math.abs(L[i]); peak = Math.max(peak, v); sum += L[i] * L[i]; }
  lastStats = { name, frames: r.frames, seconds: r.frames / FILM_FPS, audioSeconds: L.length / SR, peak, rms: Math.sqrt(sum / Math.max(1, L.length)), spans: r.spans.length, videoBytes: video.reduce((n, v) => n + v.c.byteLength, 0) };
  const audioChunks: { c: EncodedAudioChunk; m?: EncodedAudioChunkMetadata }[] = [];
  const ae = new AudioEncoder({ output: (c, meta) => audioChunks.push({ c, m: meta }), error: (e) => console.error("film audio encoder", e) });
  ae.configure({ codec: "opus", sampleRate: SR, numberOfChannels: 2, bitrate: 192_000 });
  for (let i = 0; i < L.length; i += 4800) {
    const n = Math.min(4800, L.length - i), data = new Float32Array(n * 2); data.set(L.subarray(i, i + n), 0); data.set(R.subarray(i, i + n), n);
    const ad = new AudioData({ format: "f32-planar", sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i * 1e6 / SR), data }); ae.encode(ad); ad.close();
  }
  await ae.flush(); ae.close();
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: "V_VP9", width: FILM_W, height: FILM_H, frameRate: FILM_FPS }, audio: { codec: "A_OPUS", numberOfChannels: 2, sampleRate: SR }, firstTimestampBehavior: "offset" });
  let vi = 0, ai = 0;
  while (vi < video.length || ai < audioChunks.length) {
    const v = video[vi], a = audioChunks[ai];
    if (v && (!a || v.c.timestamp <= a.c.timestamp)) { muxer.addVideoChunk(v.c, v.m); vi++; } else { muxer.addAudioChunk(a.c, a.m); ai++; }
  }
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: "video/webm" });
}
let lastStats: Record<string, unknown> | null = null;

// ── helpers for scripts (virtual time) ────────────────────────────
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const screen = () => { const out: string[] = []; for (let r = 0; r < 25; r++) { let l = ""; for (let c = 0; c < 80; c++) { const ch = engine.term.cell(r, c) & 255; l += ch >= 32 && ch < 127 ? String.fromCharCode(ch) : " "; } out.push(l.trimEnd()); } return out.join("\n"); };
const CODES: Record<string, string> = { Enter: "Enter", Escape: "Escape", " ": "Space", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", Backspace: "Backspace", "\\": "Backslash", ":": "Semicolon" };
function key(name: string, o: { ctrl?: boolean } = {}) {
  const code = CODES[name] ?? (/^[a-z]$/i.test(name) ? "Key" + name.toUpperCase() : /^\d$/.test(name) ? "Digit" + name : name);
  const init = { key: name, code, bubbles: true, cancelable: true, ctrlKey: !!o.ctrl, shiftKey: /^[A-Z]$/.test(name) };
  window.dispatchEvent(new KeyboardEvent("keydown", init));
  setTimeout(() => window.dispatchEvent(new KeyboardEvent("keyup", init)), 70);
}
async function type(text: string, cps = 8) { for (const ch of text) { key(ch === "\r" ? "Enter" : ch); await sleep(1000 / cps); } }
async function waitFor(text: string | RegExp, timeoutMs = 90_000) {
  const end = clock.now() + timeoutMs;
  for (;;) { const s = screen(); if (typeof text === "string" ? s.includes(text) : text.test(s)) return clock.now(); if (clock.now() > end) throw new Error(`film: "${text}" never appeared`); await sleep(1000 / FILM_FPS); }
}
async function until(test: () => boolean, timeoutMs = 90_000) { const end = clock.now() + timeoutMs; while (!test()) { if (clock.now() > end) throw new Error("film: condition never met"); await sleep(1000 / FILM_FPS); } }
const hints = () => m.hints.value;
/** Setup only: drive a fresh connection through the logon parade to the board's main menu. */
async function toMenu(timeoutMs = 120_000) {
  const end = clock.now() + timeoutMs;
  for (;;) {
    const h = hints();
    if (m.state.value === "session" && h.some((x) => x.label === "?")) { await sleep(400); return; }
    if (clock.now() > end) throw new Error("film: main menu never appeared");
    const s = screen();
    if (m.state.value === "session") {
      if (["L", "A", "G", "H"].every((k) => h.some((x) => x.key === k)) && /\[L\]ogin|Login/.test(s)) key("L");
      else if (s.includes("This week in the scene") && h.some((x) => x.key === "Escape")) key("Escape");
      else if (s.includes("ENTER logs you in") || h.some((x) => x.label === "CONTINUE" || x.label === "MENU")) key("Enter");
    }
    await sleep(350);
  }
}
const book = ["555-0142", "555-0167", "555-0193", "555-0128", "555-0177"];
/** Setup only: from the TELEWIRE dialing directory, dial a board (no busy signal on film). */
async function dialBoard(number: string) {
  await until(() => m.state.value === "comm");
  (m as unknown as { lastBusy: boolean }).lastBusy = true;
  const i = book.indexOf(number); if (i < 0) throw new Error("film: not in the directory " + number);
  key(String(i + 1)); await sleep(150); key("Enter");
}
async function hangup() { m.keys.abort("hangup"); await until(() => m.state.value === "comm", 30_000); }

const helpers = {
  ready: async () => { for (let i = 0; i < 600; i++) { if (document.querySelector(".plates-ready") && document.fonts.status === "loaded") return true; await clock.realSleep(100); } return false; },
  record,
  save: (blob: Blob, name: string) => { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); },
  stats: () => lastStats,
  /** Seconds of film so far (frames captured; cut time excluded), or virtual seconds outside a recording. */
  now: () => (rec ? rec.frames / FILM_FPS : clock.now() / 1000),
  /** Wait until this many seconds of film exist (the 0.5 s lead hold included; cuts excluded). */
  at: async (sec: number) => { while (rec && rec.frames < Math.round(sec * FILM_FPS)) await sleep(1000 / FILM_FPS); },
  sleep, key, type, waitFor, until, screen, hints, toMenu, dialBoard, hangup,
  state: () => m.state.value,
  lamp: (on: boolean) => api.current.setLamp(on),
  power: (on: boolean) => { if (m.powered.value !== on) m.pressPcPower(); },
  monitor: (on: boolean) => { if (m.tube.value !== on) m.pressMonitorPower(); },
  lean: async (inward: boolean, ms = 420) => {
    const st = document.querySelector<HTMLElement>(".plate-stage"); if (st) st.style.transitionDuration = `${ms}ms`;
    api.current.lean(inward); await sleep(ms + 40);
  },
  dial: async (number: string) => { key("M"); await sleep(200); await type(number, 10); key("Enter"); },
  speed: (bps: 2400 | 9600 | 14400 | 28800) => { m.profile.speed = bps; localStorage.setItem("dialup.profile.v1", JSON.stringify(m.profile)); if (m.state.value === "session") engine.modem.bps = bps; },
  turbo: (on: boolean) => { if (m.turbo.value !== on) m.toggleTurbo(); },
  degauss: () => m.pressDegauss(Date.now()),
  photo: () => api.current.takePhoto(),
  /** The caller's own skip (Space): ends the current skippable wait without a keyboard click. */
  skip: () => m.keys.push({ key: " ", ch: 32, ctrl: false, alt: false }),
  /** Run setup steps inside the clip without filming them: an instant state jump. */
  cut: async (fn: () => Promise<void>) => { cutting = true; try { await fn(); } finally { cutting = false; } },
  /** Virtual milliseconds now, and when a bus event next fires (e.g. "offHook", "ring", "handshakeStart"). */
  vnow: () => clock.now(),
  event: (name: string) => new Promise<number>((r) => { const off = audio.on(name as never, (() => { off(); r(clock.now()); }) as never); }),
  showUntil: (ms: number) => sleep(Math.max(0, ms - clock.now())),
  cutUntil: (ms: number) => helpers.cut(() => sleep(Math.max(0, ms - clock.now()))),
};
