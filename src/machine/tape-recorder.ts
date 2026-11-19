// Ten-second tape: composites the photographed room, its live lights and the CRT into one
// 1280x720 canvas at 30 fps, mixes in the synth's own output, and records with MediaRecorder.
// Browser-only; created from Computer's effect. Nothing is uploaded.
import { audio } from "@/audio/bus";
import { TAPE_FPS, TAPE_H, TAPE_W, TapeDeck, pickMime, tapeFileName } from "@/lib/tape";
import { currentBoardName, tapeState } from "./signals";
import type { Engine } from "./engine";

export interface TapeResult { blob: Blob; name: string; mime: string; duration: number; hasAudio: boolean; size: number }
export interface TapeHooks { onResult: (r: TapeResult) => void; onNote: (t: string | null) => void }

export function tapeSupported() {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function";
}

const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 1; };

export function createTape(engine: Engine, root: () => HTMLElement | null, hooks: TapeHooks) {
  const out = document.createElement("canvas"); out.width = TAPE_W; out.height = TAPE_H;
  const g = out.getContext("2d")!;
  const layer = document.createElement("canvas"); layer.width = TAPE_W; layer.height = TAPE_H;
  const lg = layer.getContext("2d")!;
  let rec: MediaRecorder | null = null, chunks: Blob[] = [], startedAt = 0, lastDraw = 0, tap: { close: () => void } | null = null, hasAudio = false;
  let mime = "";

  const draw = (crt: HTMLCanvasElement) => {
    const now = performance.now(); if (now - lastDraw < 1000 / TAPE_FPS - 2) return; lastDraw = now;
    const el = root(); const stage = el?.querySelector<HTMLElement>(".plate-stage"); if (!el || !stage) return;
    const sr = stage.getBoundingClientRect(); const k = TAPE_W / sr.width;
    const box = (e: Element) => { const r = e.getBoundingClientRect(); return [(r.left - sr.left) * k, (r.top - sr.top) * k, r.width * k, r.height * k] as const; };
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.fillStyle = "#000"; g.fillRect(0, 0, TAPE_W, TAPE_H);
    const img = (sel: string) => stage.querySelector<HTMLImageElement>(sel);
    const off = img(".plate-off"), on = img(".plate-on"), light = img(".plate-screen-light");
    if (off?.complete) g.drawImage(off, 0, 0, TAPE_W, TAPE_H);
    if (on?.complete) { g.globalAlpha = num(getComputedStyle(on).opacity); g.drawImage(on, 0, 0, TAPE_W, TAPE_H); g.globalAlpha = 1; }
    // Screen light: the plate multiplied by the live tint (same matrix the room's filter uses), added.
    const values = el.querySelector("feColorMatrix[data-room-light]")?.getAttribute("values")?.split(/\s+/).map(Number) ?? [];
    const [r, gg, b] = [values[0] ?? 0, values[6] ?? 0, values[12] ?? 0];
    if (light?.complete && r + gg + b > 0.003) {
      lg.globalCompositeOperation = "source-over"; lg.clearRect(0, 0, TAPE_W, TAPE_H); lg.drawImage(light, 0, 0, TAPE_W, TAPE_H);
      lg.globalCompositeOperation = "multiply"; lg.fillStyle = `rgb(${Math.min(255, r * 255)},${Math.min(255, gg * 255)},${Math.min(255, b * 255)})`; lg.fillRect(0, 0, TAPE_W, TAPE_H);
      g.globalCompositeOperation = "lighter"; g.globalAlpha = Math.min(1, num(getComputedStyle(light).opacity)); g.drawImage(layer, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      if (Math.max(r, gg, b) > 1) { g.globalCompositeOperation = "lighter"; g.globalAlpha = Math.min(1, Math.max(r, gg, b) - 1); g.drawImage(layer, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
    }
    // Rain in the window.
    const rain = stage.querySelector<HTMLCanvasElement>(".plate-rain canvas"); if (rain && rain.width) { const [x, y, w, h] = box(rain); g.globalCompositeOperation = "screen"; g.drawImage(rain, x, y, w, h); g.globalCompositeOperation = "source-over"; }
    // The CRT, clipped to the glass by the same mask image, then the glass reflection.
    const glass = stage.querySelector<HTMLElement>(".plate-glass"); const mask = glass ? getComputedStyle(glass).maskImage || (glass.style as CSSStyleDeclaration & { maskImage?: string }).maskImage : "";
    if (glass) {
      const [x, y, w, h] = box(glass); const cr = box(crt);
      lg.globalCompositeOperation = "source-over"; lg.clearRect(0, 0, TAPE_W, TAPE_H); lg.drawImage(crt, cr[0], cr[1], cr[2], cr[3]);
      const m = maskImage(mask); if (m?.complete && m.naturalWidth) { lg.globalCompositeOperation = "destination-in"; lg.drawImage(m, x, y, w, h); }
      g.drawImage(layer, 0, 0);
      const refl = glass.querySelector<HTMLImageElement>(".plate-reflection"); if (refl?.complete) { g.globalAlpha = num(getComputedStyle(refl).opacity); g.globalCompositeOperation = "screen"; g.drawImage(refl, x, y, w, h); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
    }
    // LEDs that are lit (including the REC LED), as soft dots in their own colour.
    stage.querySelectorAll<HTMLElement>(".plate-led, .tape-led").forEach((led) => {
      const cs = getComputedStyle(led); const a = num(cs.opacity); if (a < 0.05 || cs.display === "none") return;
      const [x, y, w, h] = box(led); const rad = Math.max(1.2, Math.max(w, h) / 2);
      const col = cs.backgroundColor; if (!col || col === "rgba(0, 0, 0, 0)") return;
      g.globalAlpha = a; const grd = g.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, rad * 3);
      grd.addColorStop(0, col); grd.addColorStop(0.35, col); grd.addColorStop(1, "rgba(0,0,0,0)");
      g.globalCompositeOperation = "lighter"; g.fillStyle = grd; g.beginPath(); g.arc(x + w / 2, y + h / 2, rad * 3, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    });
  };
  const masks = new Map<string, HTMLImageElement>();
  const maskImage = (css: string) => { const u = /url\(["']?([^"')]+)["']?\)/.exec(css)?.[1]; if (!u) return null; let m = masks.get(u); if (!m) { m = new Image(); m.src = u; masks.set(u, m); } return m; };

  const start = () => {
    if (!tapeSupported()) return false;
    mime = pickMime((m) => MediaRecorder.isTypeSupported(m)) ?? ""; if (!mime) return false;
    const video = out.captureStream(TAPE_FPS);
    const t = audio.tapStream(); tap = t; hasAudio = !!t && t.stream.getAudioTracks().length > 0;
    const stream = new MediaStream([...video.getVideoTracks(), ...(t?.stream.getAudioTracks() ?? [])]);
    hooks.onNote(hasAudio ? null : "TAPE: no sound to capture yet, recording picture only.");
    try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000 }); } catch { tap?.close(); return false; }
    chunks = []; lastDraw = 0;
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      engine.afterRender = null; tap?.close(); tap = null; stream.getTracks().forEach((tr) => tr.stop());
      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      hooks.onResult({ blob, mime: blob.type, size: blob.size, hasAudio, duration: (performance.now() - startedAt) / 1000, name: tapeFileName(currentBoardName.value, new Date(), mime) });
    };
    engine.afterRender = draw;
    startedAt = performance.now(); rec.start(500);
    audio.emit("tapeMotor", true);
    return true;
  };
  const stop = () => { audio.emit("tapeMotor", false); if (rec && rec.state !== "inactive") rec.stop(); rec = null; };
  const deck = new TapeDeck({ start, stop, setTimer: (f, ms) => setTimeout(f, ms), clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>) }, (s) => tapeState.set(s));
  const offHook = audio.on("offHook", () => deck.dialTone());
  return { deck, destroy: () => { offHook(); deck.finish(); engine.afterRender = null; } };
}

/** Save a finished tape: the share sheet on phones that can share files, otherwise a download. */
export async function saveTape(r: TapeResult, preferShare: boolean) {
  const file = new File([r.blob], r.name, { type: r.mime });
  if (preferShare && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Dial-Up tape" }); return; } catch { /* fall back to download */ }
  }
  const url = URL.createObjectURL(r.blob); const link = document.createElement("a");
  link.href = url; link.download = r.name; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
