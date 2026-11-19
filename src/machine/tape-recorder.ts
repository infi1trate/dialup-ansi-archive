// Ten-second tape: composites the photographed room, its live lights and the CRT into one
// 1280x720 canvas at 30 fps, mixes in the synth's own output, and records with MediaRecorder.
// Browser-only; created from Computer's effect. Nothing is uploaded.
import { audio } from "@/audio/bus";
import { TAPE_FPS, TAPE_H, TAPE_W, TapeDeck, pickMime, tapeFileName } from "@/lib/tape";
import { currentBoardName, tapeState } from "./signals";
import type { Engine } from "./engine";
import { createCompositor, viewportFrame } from "./stage-composite";

export interface TapeResult { blob: Blob; name: string; mime: string; duration: number; hasAudio: boolean; size: number }
export interface TapeHooks { onResult: (r: TapeResult) => void; onNote: (t: string | null) => void }

export function tapeSupported() {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function";
}


export function createTape(engine: Engine, root: () => HTMLElement | null, hooks: TapeHooks) {
  const comp = createCompositor(TAPE_W, TAPE_H);
  const out = comp.canvas;
  let rec: MediaRecorder | null = null, chunks: Blob[] = [], startedAt = 0, lastDraw = 0, tap: { close: () => void } | null = null, hasAudio = false;
  let mime = "";
  // Everything is placed by its on-screen rectangle, so the tape frames exactly what the caller
  // sees: leaned in is leaned in. The viewport is cover-fitted to 1280x720.
  const draw = (crt: HTMLCanvasElement) => {
    const now = performance.now(); if (now - lastDraw < 1000 / TAPE_FPS - 2) return; lastDraw = now;
    const el = root(); if (!el) return;
    comp.draw(el, crt, viewportFrame(el, TAPE_W, TAPE_H));
  };

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
