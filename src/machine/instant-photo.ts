// Instant camera: grabs the room exactly as composited (via the tape's stage compositor) in a square around the
// monitor, then makes the white-bordered print and the shareable PNG. Browser-only; lazily imported on first click.
import floppyPhoto from "@/assets/plates/floppy-disks-closeup.webp.asset.json";
import { DIRECTORY } from "@/bbs/io";
import { photoCaption, photoCrop, photoYear, printGeometry, type Box } from "@/lib/photo";
import { createCompositor, stageFrame } from "./stage-composite";
import type { Engine } from "./engine";

const SNAP = 880;
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** The next drawn frame of the room, square around the monitor. Falls back to a black tube if the CRT never draws. */
export function snapStage(engine: Engine, el: HTMLElement, monitor: Box) {
  const comp = createCompositor(SNAP, SNAP), crop = photoCrop(monitor);
  return new Promise<HTMLCanvasElement>((resolve) => {
    const prev = engine.afterRender; let done = false;
    const shoot = (crt: HTMLCanvasElement) => { if (done) return; done = true; engine.afterRender = prev; comp.draw(el, crt, stageFrame(el, crop, SNAP)); resolve(comp.canvas); };
    engine.afterRender = (crt) => { prev?.(crt); shoot(crt); };
    setTimeout(() => { if (!done) { const blank = document.createElement("canvas"); blank.width = blank.height = 4; shoot(blank); } }, 1500);
  });
}
export function deviceYear() {
  try { const v = Number(localStorage.getItem("dialup.photo.year")); if (v >= 1990 && v <= 1996) return v; const y = photoYear(Math.random()); localStorage.setItem("dialup.photo.year", String(y)); return y; } catch { return 1993; }
}
export function captionFor(boardName: string | null, now = new Date()) {
  const d = boardName ? DIRECTORY.find((e) => e.name === boardName) : null;
  return photoCaption(d ? { name: d.name, number: d.number } : null, now.getMonth(), deviceYear());
}
/** White-bordered print: the snapshot in the square window, the caption handwritten along the thick bottom border. */
export async function renderPrint(snap: HTMLCanvasElement, cap: { where: string; when: string }) {
  const g = printGeometry(SNAP + 2 * Math.round(SNAP * 4.5 / 79));
  const c = document.createElement("canvas"); c.width = g.w; c.height = g.h; const x = c.getContext("2d")!;
  x.fillStyle = css("--photo-paper"); x.fillRect(0, 0, g.w, g.h);
  // faint paper tooth so the border is not a flat fill
  for (let i = 0; i < 1600; i++) { x.globalAlpha = 0.035; x.fillStyle = i % 2 ? "#000" : "#fff"; x.fillRect(Math.random() * g.w, Math.random() * g.h, 2, 2); }
  x.globalAlpha = 1; x.drawImage(snap, g.side, g.top, g.image, g.image);
  const sh = x.createLinearGradient(0, g.top, 0, g.top + 14); sh.addColorStop(0, "rgba(0,0,0,.35)"); sh.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = sh; x.fillRect(g.side, g.top, g.image, 14);
  try { await document.fonts.load("64px 'Nanum Pen Script'"); } catch { /* font optional */ }
  x.save(); x.translate(g.side + 18, g.top + g.image + g.bottom * 0.42); x.rotate(-0.012);
  x.fillStyle = css("--note-ink"); x.globalAlpha = 0.86; x.globalCompositeOperation = "multiply";
  x.font = `${Math.round(g.bottom * 0.36)}px 'Nanum Pen Script', cursive`; x.textBaseline = "middle";
  x.fillText(cap.where, 0, 0, g.image - 40);
  x.font = `${Math.round(g.bottom * 0.3)}px 'Nanum Pen Script', cursive`; x.textAlign = "right"; x.fillText(cap.when, g.image - 30, g.bottom * 0.34);
  x.restore();
  return c;
}
const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
/** 1080x1350 PNG: the print lying on the desk. The wood is the desk's own top-down photograph (the floppy shot), in plank bands. */
export async function renderPhotoPng(print: HTMLCanvasElement, lamp: boolean) {
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d")!;
  try {
    const wood = await loadImg(floppyPhoto.url), ww = wood.naturalWidth, wh = wood.naturalHeight;
    // two disk-free strips of the desk (above and below the disks), laid as planks with a seam between them
    const strips = [[0, wh * 0.255], [wh * 0.7, wh * 0.3]] as const, bh = 150;
    for (let i = 0, y = 0; y < H; i++, y += bh) {
      const [sy, sh] = strips[i % 2], shift = ((i * 397) % ww);
      const sw = sh * (W / bh);
      x.drawImage(wood, shift % Math.max(1, ww - sw), sy, Math.min(sw, ww), sh, 0, y, W, bh);
      x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(0, y, W, 2);
    }
  } catch { x.fillStyle = css("--photo-black"); x.fillRect(0, 0, W, H); }
  const pw = 860, ph = pw * print.height / print.width;
  x.save(); x.translate(W / 2, H / 2); x.rotate(-0.035); x.shadowColor = "rgba(0,0,0,.55)"; x.shadowBlur = 40; x.shadowOffsetY = 14;
  x.drawImage(print, -pw / 2, -ph / 2, pw, ph); x.restore();
  const v = x.createRadialGradient(W / 2, H * 0.45, W * 0.3, W / 2, H / 2, W * 0.95); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, lamp ? "rgba(20,10,0,.55)" : "rgba(0,4,18,.8)");
  x.fillStyle = v; x.fillRect(0, 0, W, H);
  if (!lamp) { x.globalCompositeOperation = "multiply"; x.fillStyle = "rgb(120,130,160)"; x.fillRect(0, 0, W, H); x.globalCompositeOperation = "source-over"; }
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(Error("no photo"))), "image/png"));
}
/** Small JPEG of the print for the cork board (kept per device). */
export function corkThumb(print: HTMLCanvasElement) {
  const t = document.createElement("canvas"); t.width = 176; t.height = Math.round(176 * print.height / print.width);
  t.getContext("2d")!.drawImage(print, 0, 0, t.width, t.height); return t.toDataURL("image/jpeg", 0.82);
}
