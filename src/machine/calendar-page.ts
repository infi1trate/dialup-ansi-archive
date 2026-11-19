// Draws the calendar's month page from the lamp-on plate itself: the photographed sheet is unwarped, its printed ink
// lifted with a max filter so the paper keeps its photographed light falloff, then the month is printed onto it.
// Browser-only.
import { CAL_PAGE, PAGE_H, PAGE_W, monthGrid } from "@/lib/calendar";

export async function renderCalendarPage(plateUrl: string, now: Date): Promise<string> {
  const im = new Image(); im.crossOrigin = "anonymous"; im.src = plateUrl; await im.decode();
  const s = im.naturalWidth / 2560;
  const xs = CAL_PAGE.map((p) => p[0]), ys = CAL_PAGE.map((p) => p[1]);
  const bx = Math.floor(Math.min(...xs) * s) - 2, by = Math.floor(Math.min(...ys) * s) - 2, bw = Math.ceil((Math.max(...xs) - Math.min(...xs)) * s) + 4, bh = Math.ceil((Math.max(...ys) - Math.min(...ys)) * s) + 4;
  const src = document.createElement("canvas"); src.width = bw; src.height = bh;
  const sg = src.getContext("2d", { willReadFrequently: true })!; sg.drawImage(im, -bx, -by);
  const sd = sg.getImageData(0, 0, bw, bh).data;
  const W = PAGE_W, H = PAGE_H, page = document.createElement("canvas"); page.width = W; page.height = H;
  const g = page.getContext("2d")!; const pd = g.createImageData(W, H), d = pd.data;
  const [tl, tr, br, bl] = CAL_PAGE;
  for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) {
    const a = u / (W - 1), b = v / (H - 1);
    const X = ((1 - a) * (1 - b) * tl[0] + a * (1 - b) * tr[0] + a * b * br[0] + (1 - a) * b * bl[0]) * s - bx;
    const Y = ((1 - a) * (1 - b) * tl[1] + a * (1 - b) * tr[1] + a * b * br[1] + (1 - a) * b * bl[1]) * s - by;
    const i = (Math.min(bh - 1, Math.max(0, Math.round(Y))) * bw + Math.min(bw - 1, Math.max(0, Math.round(X)))) * 4, o = (v * W + u) * 4;
    d[o] = sd[i]; d[o + 1] = sd[i + 1]; d[o + 2] = sd[i + 2]; d[o + 3] = 255;
  }
  // lift the old printing: a separable max filter, then a soft box blur, then a little grain back
  const pass = (r: number, horiz: boolean, op: "max" | "mean") => {
    const copy = new Uint8ClampedArray(d);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
      let acc = op === "max" ? 0 : 0, n = 0;
      for (let k = -r; k <= r; k++) { const xx = horiz ? Math.min(W - 1, Math.max(0, x + k)) : x, yy = horiz ? y : Math.min(H - 1, Math.max(0, y + k)); const val = copy[(yy * W + xx) * 4 + c]; if (op === "max") acc = Math.max(acc, val); else { acc += val; n++; } }
      d[(y * W + x) * 4 + c] = op === "max" ? acc : acc / n;
    }
  };
  pass(6, true, "max"); pass(6, false, "max"); pass(6, true, "mean"); pass(6, false, "mean");
  let seed = 7; for (let o = 0; o < d.length; o += 4) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; const n = ((seed >> 16) % 7) - 3; d[o] += n; d[o + 1] += n; d[o + 2] += n; }
  g.putImageData(pd, 0, 0);
  // printed ink, slightly soft like the photograph
  const ink = document.createElement("canvas"); ink.width = W; ink.height = H; const k = ink.getContext("2d")!;
  const cal = monthGrid(now), rows = cal.weeks.length, top = 78, left = 16, right = W - 16, bottom = H - 26, cw = (right - left) / 7, rh = (bottom - top) / rows;
  k.fillStyle = "rgba(38,34,44,.82)"; k.font = "bold 34px Georgia, 'Times New Roman', serif"; k.textAlign = "center"; k.textBaseline = "alphabetic"; k.fillText(cal.name, W / 2, 44);
  k.font = "bold 14px Helvetica, Arial, sans-serif"; ["S", "M", "T", "W", "T", "F", "S"].forEach((l, i) => { k.fillStyle = i === 0 ? "rgba(150,40,40,.8)" : "rgba(50,45,55,.75)"; k.fillText(l, left + cw * (i + 0.5), 68); });
  k.strokeStyle = "rgba(70,64,72,.55)"; k.lineWidth = 1.5;
  for (let r = 0; r <= rows; r++) { k.beginPath(); k.moveTo(left, top + r * rh); k.lineTo(right, top + r * rh); k.stroke(); }
  for (let c = 0; c <= 7; c++) { k.beginPath(); k.moveTo(left + c * cw, top); k.lineTo(left + c * cw, bottom); k.stroke(); }
  k.font = "bold 17px Helvetica, Arial, sans-serif"; k.textAlign = "left"; k.textBaseline = "top";
  cal.weeks.forEach((w, r) => w.forEach((n, c) => { if (n == null) return; k.fillStyle = c === 0 ? "rgba(150,40,40,.82)" : "rgba(40,36,46,.82)"; k.fillText(String(n), left + c * cw + 5, top + r * rh + 4); }));
  // today, circled twice round in red ballpoint
  const cx = left + cal.today.col * cw + 15, cy = top + cal.today.row * rh + 13;
  k.strokeStyle = "rgba(176,28,36,.85)"; k.lineWidth = 2.4; k.lineCap = "round";
  for (let p = 0; p < 2; p++) { k.beginPath(); for (let t = 0; t <= 1.08; t += 0.02) { const ang = -2.2 + t * Math.PI * 2, rr = 1 + 0.06 * Math.sin(t * 9 + p); const x = cx + Math.cos(ang) * 19 * rr + p * 1.5, y = cy + Math.sin(ang) * 15 * rr - p; if (t === 0) k.moveTo(x, y); else k.lineTo(x, y); } k.stroke(); }
  g.filter = "blur(0.6px)"; g.drawImage(ink, 0, 0); g.filter = "none";
  return page.toDataURL("image/png");
}
