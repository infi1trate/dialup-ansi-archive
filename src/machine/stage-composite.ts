// Composites the photographed room exactly as displayed (lamp crossfade, tinted screen light, rain, CRT through the
// glass mask, live clock, note handwriting, lit LEDs) into a canvas. Shared by the ten-second tape and the instant photo.
// Browser-only. The CRT canvas is only readable right after the engine draws, so call draw() from Engine.afterRender.
const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 1; };
/** Client-rect origin, scale and canvas offset. */
export interface Frame { left: number; top: number; k: number; ox: number; oy: number }

export function createCompositor(W: number, H: number) {
  const out = document.createElement("canvas"); out.width = W; out.height = H;
  const g = out.getContext("2d")!;
  const layer = document.createElement("canvas"); layer.width = W; layer.height = H;
  const lg = layer.getContext("2d")!;

  /** Draw the room as composited on screen. `frame` maps a client rect into canvas pixels. */
  const draw = (el: HTMLElement, crt: HTMLCanvasElement, frame: Frame) => {
    const stage = el.querySelector<HTMLElement>(".plate-stage"); if (!stage) return;
    const { left, top, k, ox, oy } = frame;
    const box = (e: Element) => { const r = e.getBoundingClientRect(); return [ox + (r.left - left) * k, oy + (r.top - top) * k, r.width * k, r.height * k] as const; };
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    const img = (sel: string) => stage.querySelector<HTMLImageElement>(sel);
    const off = img(".plate-off"), on = img(".plate-on"), light = img(".plate-screen-light");
    const plate = (im: HTMLImageElement | null, ctx: CanvasRenderingContext2D) => { if (im?.complete && im.naturalWidth) { const [x, y, w, h] = box(im); ctx.drawImage(im, x, y, w, h); } };
    plate(off, g);
    if (on) { g.globalAlpha = num(getComputedStyle(on).opacity); plate(on, g); g.globalAlpha = 1; }
    // Screen light: the plate multiplied by the live tint (same matrix the room's filter uses), added.
    const values = el.querySelector("feColorMatrix[data-room-light]")?.getAttribute("values")?.split(/\s+/).map(Number) ?? [];
    const [r, gg, b] = [values[0] ?? 0, values[6] ?? 0, values[12] ?? 0];
    if (light?.complete && r + gg + b > 0.003) {
      lg.globalCompositeOperation = "source-over"; lg.clearRect(0, 0, W, H); plate(light, lg);
      lg.globalCompositeOperation = "multiply"; lg.fillStyle = `rgb(${Math.min(255, r * 255)},${Math.min(255, gg * 255)},${Math.min(255, b * 255)})`; lg.fillRect(0, 0, W, H);
      lg.globalCompositeOperation = "destination-in"; plate(light, lg);
      const passes = Math.max(r, gg, b); const la = Math.min(1, num(getComputedStyle(light).opacity));
      g.globalCompositeOperation = "lighter"; g.globalAlpha = la; g.drawImage(layer, 0, 0);
      if (passes > 1) { g.globalAlpha = la * Math.min(1, passes - 1); g.drawImage(layer, 0, 0); }
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }
    // Lightning: the lamp-on plate through the cool tint at its displayed opacity, then the lit window glass.
    const bolt = img(".plate-lightning"), boltA = bolt ? num(getComputedStyle(bolt).opacity) : 0;
    if (bolt?.complete && boltA > 0.01) {
      lg.globalCompositeOperation = "source-over"; lg.clearRect(0, 0, W, H); plate(bolt, lg);
      lg.globalCompositeOperation = "multiply"; lg.fillStyle = "rgb(150,190,255)"; lg.fillRect(0, 0, W, H);
      lg.globalCompositeOperation = "destination-in"; plate(bolt, lg);
      g.globalAlpha = boltA; g.drawImage(layer, 0, 0); g.globalAlpha = 1;
    }
    // Rain in the window.
    const rain = stage.querySelector<HTMLCanvasElement>(".plate-rain canvas"); if (rain && rain.width) { const [x, y, w, h] = box(rain); g.globalCompositeOperation = "screen"; g.drawImage(rain, x, y, w, h);
      const wf = stage.querySelector(".plate-window-flash"), wa = wf ? num(getComputedStyle(wf).opacity) : 0;
      if (wa > 0.01) { const gr = g.createRadialGradient(x + w / 2, y + h * 0.35, 0, x + w / 2, y + h * 0.35, Math.max(w, h) * 0.75); gr.addColorStop(0, `rgba(245,248,255,${wa})`); gr.addColorStop(1, "rgba(245,248,255,0)"); g.fillStyle = gr; g.fillRect(x, y, w, h); }
      g.globalCompositeOperation = "source-over"; }
    // Prints laid into the photograph by quad (stage px, TL TR BR BL), then cut-out plate pieces that sit on top (the pin).
    const sr = stage.getBoundingClientRect(), spx = sr.width / 2560;
    const toCanvas = (X: number, Y: number) => [ox + (sr.left + X * spx - left) * k, oy + (sr.top + Y * spx - top) * k] as const;
    stage.querySelectorAll<HTMLImageElement>("img[data-quad]").forEach((im) => {
      if (!im.complete || !im.naturalWidth) return;
      const q = JSON.parse(im.dataset.quad ?? "[]") as [number, number][]; if (q.length < 4) return;
      const [p0, p1, , p3] = q.map(([X, Y]) => toCanvas(X, Y)); const w = im.naturalWidth, h = im.naturalHeight;
      g.save(); g.filter = getComputedStyle(im).filter.replace(/var\([^)]*\)/g, "1"); g.transform((p1[0] - p0[0]) / w, (p1[1] - p0[1]) / w, (p3[0] - p0[0]) / h, (p3[1] - p0[1]) / h, p0[0], p0[1]); g.drawImage(im, 0, 0); g.restore();
    });
    stage.querySelectorAll<HTMLElement>(".plate-cut").forEach((cut) => {
      const [x, y, w, h] = box(cut); g.save(); g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); g.clip();
      cut.querySelectorAll<HTMLImageElement>("img").forEach((im) => { if (!im.complete) return; const [ix, iy, iw, ih] = box(im); g.globalAlpha = num(getComputedStyle(im).opacity); g.drawImage(im, ix, iy, iw, ih); });
      g.restore(); g.globalAlpha = 1;
    });
    // The CRT, clipped to the glass by the same mask image, then the glass reflection.
    const glass = stage.querySelector<HTMLElement>(".plate-glass"); const mask = glass ? getComputedStyle(glass).maskImage || (glass.style as CSSStyleDeclaration & { maskImage?: string }).maskImage : "";
    if (glass) {
      const [x, y, w, h] = box(glass); const cr = box(crt);
      lg.globalCompositeOperation = "source-over"; lg.clearRect(0, 0, W, H); lg.drawImage(crt, cr[0], cr[1], cr[2], cr[3]);
      const m = maskImage(mask); if (m?.complete && m.naturalWidth) { lg.globalCompositeOperation = "destination-in"; lg.drawImage(m, x, y, w, h); }
      g.drawImage(layer, 0, 0);
      const refl = glass.querySelector<HTMLImageElement>(".plate-reflection"); if (refl?.complete) { g.globalAlpha = num(getComputedStyle(refl).opacity); g.globalCompositeOperation = "screen"; g.drawImage(refl, x, y, w, h); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
    }
    // The live alarm clock: each seven-segment bar in its own colour and opacity.
    stage.querySelectorAll<HTMLElement>(".plate-clock .segment, .plate-clock .clock-colon").forEach((seg) => {
      const cs = getComputedStyle(seg); const col = cs.backgroundColor; if (!col || col === "rgba(0, 0, 0, 0)") return;
      const [x, y, w, h] = box(seg); g.globalAlpha = num(cs.opacity); g.fillStyle = col;
      if (seg.classList.contains("lit")) { g.shadowColor = col; g.shadowBlur = 4 * k; }
      g.fillRect(x, y, w, h); g.shadowBlur = 0; g.globalAlpha = 1;
    });
    // Sticky-note handwriting, rotated like the page draws it.
    const note = stage.querySelector<HTMLElement>(".plate-note-writing");
    if (note) {
      // Rotated boxes grow their client rect, so size from layout and the camera's own scale.
      const cs = getComputedStyle(note); const [x, y, bw, bh] = box(note); const sc = k * (stage.getBoundingClientRect().width / (stage.offsetWidth || 1));
      const w = note.offsetWidth * sc, h = note.offsetHeight * sc, fs = parseFloat(cs.fontSize) * sc, lh = (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.04) * sc;
      g.save(); g.translate(x + bw / 2, y + bh / 2); g.rotate(-5 * Math.PI / 180); g.translate(-w / 2, -h / 2);
      g.globalAlpha = num(cs.opacity); g.globalCompositeOperation = "multiply"; g.fillStyle = cs.color; g.font = `${fs}px ${cs.fontFamily}`; g.textBaseline = "top";
      [...note.querySelectorAll("p")].forEach((pEl, i) => g.fillText(pEl.textContent ?? "", parseFloat(cs.paddingLeft) * sc, parseFloat(cs.paddingTop) * sc + i * lh, Math.max(1, w - 2 * parseFloat(cs.paddingLeft) * sc)));
      g.restore();
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

  return { canvas: out, draw };
}
/** Cover-fit the room's on-screen viewport into W x H (what the visitor sees). */
export function viewportFrame(el: HTMLElement, W: number, H: number): Frame {
  const vr = el.getBoundingClientRect(); const k = Math.max(W / vr.width, H / vr.height);
  return { left: vr.left, top: vr.top, k, ox: (W - vr.width * k) / 2, oy: (H - vr.height * k) / 2 };
}
/** Map a square of stage pixels [x, y, side] (2560x1440 plate space) onto a W x W canvas, whatever the camera shows. */
export function stageFrame(el: HTMLElement, crop: readonly [number, number, number], W: number): Frame {
  const sr = el.querySelector<HTMLElement>(".plate-stage")!.getBoundingClientRect(); const px = sr.width / 2560;
  const k = W / (crop[2] * px);
  return { left: sr.left + crop[0] * px, top: sr.top + crop[1] * px, k, ox: 0, oy: 0 };
}
