// CRAWL-01: the board's own house pack, generated in code so the loop works offline.
import { Ansi, a, bigText, shadeBar, center } from "@/bbs/ansi";
import type { PackInfo } from "./types";
import { VGA_8X16_B64 } from "@/term/vga-font";

/** House ansimations shown in the board's [A]nimations area. */
export const HOUSE_ANIMATIONS = ["SPINNER.ANS", "RAIN.ANS"];

export const HOUSE_PACK = "crawl-01";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function sauce(title: string, author: string, group: string, opts: { cols?: number; lines?: number; ice?: boolean; ft?: number; dt?: number } = {}) {
  const b = new Uint8Array(129);
  b[0] = 0x1a;
  const put = (o: number, s: string, n: number) => { for (let i = 0; i < n; i++) b[1 + o + i] = i < s.length ? s.charCodeAt(i) : 0x20; };
  put(0, "SAUCE00", 7); put(7, title, 35); put(42, author, 20); put(62, group, 20); put(82, "19940214", 8);
  b[1 + 94] = opts.dt ?? 1; b[1 + 95] = opts.ft ?? 1;
  const c = opts.cols ?? 80, l = opts.lines ?? 25;
  b[1 + 96] = c & 255; b[1 + 97] = c >> 8; b[1 + 98] = l & 255; b[1 + 99] = l >> 8;
  b[1 + 105] = (opts.ice ? 1 : 0) | (2 << 1);
  put(106, "IBM VGA", 22);
  return b;
}
const join = (x: Uint8Array, s: Uint8Array) => { const o = new Uint8Array(x.length + s.length); o.set(x); o.set(s, x.length); return o; };

function diz() {
  const x = a();
  x.k(9, "  ▄▄▄ ▄▄▄  ▄▄▄ ▄   ▄ ▄").nl().k(11, " █    █▄▄▀ █▄▄█ █ ▄ █ █").nl().k(3, " ▀▀▀▀ ▀  ▀ ▀  ▀ ▀▀ ▀▀ ▀▀▀").k(8, " -01").nl();
  x.k(8, "─────────────────────────────────────────────").nl();
  x.k(7, " DEAD CARRIER house pack, volume one.").nl();
  x.k(13, " Eight pieces by the sysop at 3am: logo, stairs,").nl().k(15, " scroller, 2 ansimations, ascii, iCE and XBin.").nl();
  x.k(11, " Call ").k(15, "555-0142").k(11, " · 9600 baud · 24hrs").nl();
  x.k(8, " p.s. call 555-01?3 ... the middle digit is").nl().k(8, "      how many stairs creak").nl().reset();
  return x.build();
}

function logo() {
  const x = a().cls();
  x.at(2, 4); shadeBar(x, 72, 1);
  x.at(4, 30).k(8, "t h e");
  bigText(x, 6, 10, "DEAD CARRIER", [11, 3, 1], 8);
  bigText(x, 10, 30, "BBS", [13, 5, 5], 8);
  x.at(15, 4); shadeBar(x, 72, 5);
  x.at(17, 1).k(7, center("Running on a 486 under the stairs since 1991", 80));
  x.at(19, 1).k(3, center("sysop: Static  ·  node 1-2  ·  9600-28800", 80));
  x.at(22, 60).k(8, "logo by static/crwl").at(25, 1).reset();
  return join(x.build(), sauce("DEAD CARRIER logo", "Static", "DEAD CARRIER"));
}

function stairs() {
  const x = a().cls();
  const r = rng(7);
  for (let row = 1; row <= 24; row++) {
    x.at(row, 1);
    for (let c = 0; c < 80; c++) {
      const step = Math.floor(c / 8);
      const edge = 24 - step * 2;
      if (row > edge) {
        const top = row === edge + 1;
        x.c(top ? 14 : 6, top ? 6 : 0).t(top ? "▀" : r() < 0.15 ? "▒" : "▓");
      } else if (c < 4 || (row < 3)) x.c(8).t("░");
      else if (r() < 0.012) x.c(9).t("·");
      else x.c(0).t(" ");
    }
  }
  // the machine under the stairs
  x.at(19, 6).k(7, "┌──────┐").at(20, 6).k(7, "│").k(10, "▒▒▒▒▒▒").k(7, "│").at(21, 6).k(7, "└──┬┬──┘").at(22, 5).k(8, "▄▄▄▀▀▄▄▄▄");
  x.at(20, 8).k(10, "C:\\>").at(23, 4).k(12, "•").k(8, " hdd");
  x.at(3, 50).k(15, "UNDER THE STAIRS").at(4, 50).k(8, "a still life, 1994").at(25, 1).reset();
  return join(x.build(), sauce("Under the Stairs", "Static", "DEAD CARRIER"));
}

function scroller() {
  const x = a().cls();
  const words = ["THE", "DEAD CARRIER", "KEEPS", "THE", "SCENE", "ALIVE", "CALL", "AFTER", "MIDNIGHT", "LEAVE", "A", "ONELINER"];
  const r = rng(42);
  const grad = [1, 9, 11, 15, 11, 9, 1, 5, 13, 15, 13, 5];
  for (let line = 0; line < 140; line++) {
    const phase = Math.sin(line / 9) * 22 + Math.sin(line / 23) * 9;
    const cx = 40 + Math.round(phase);
    const w = 6 + Math.round((Math.sin(line / 5) + 1) * 3);
    const color = grad[Math.floor(line / 3) % grad.length];
    for (let c = 0; c < 79; c++) {
      const d = Math.abs(c - cx);
      if (d < w) x.k(color, d < w - 3 ? "█" : d < w - 2 ? "▓" : d < w - 1 ? "▒" : "░");
      else if (r() < 0.02) x.k(8, "·");
      else x.t(" ");
    }
    if (line % 12 === 6) { const wd = words[Math.floor(line / 12) % words.length]; x.raw("\r").k(15, ` ${wd}`); }
    x.nl();
  }
  x.k(13, center("· end of scroller · crwl 1994 ·", 79)).nl().reset();
  return join(x.build(), sauce("Tunnel Scroller", "Static", "DEAD CARRIER", { lines: 141 }));
}

function spinner() {
  // Cursor-movement ansimation: redraws the same cells repeatedly; the modem speed is the frame rate.
  const x = a().cls();
  x.at(3, 26).k(11, "╔══════════════════════════╗").at(4, 26).k(11, "║").k(15, "   CONNECTING TO NODE 1   ").k(11, "║").at(5, 26).k(11, "╚══════════════════════════╝");
  const spin = ["│", "/", "─", "\\"];
  for (let f = 0; f < 160; f++) {
    x.at(12, 40).k(14, spin[f % 4]);
    const bar = Math.floor((f / 160) * 50);
    x.at(15, 15).k(8, "[").c(9).rep("█", bar).c(1).rep("░", 50 - bar).k(8, "]");
    const bx = 15 + ((f * 2) % 50);
    x.at(18, 15).k(0, " ".repeat(52)).at(18, bx).k(13, "▄█▄");
    x.at(20, 34).k(7, `frame ${String(f).padStart(3, "0")}/160`);
  }
  x.at(12, 40).k(10, "√").at(22, 30).k(15, "CONNECTED · WELCOME HOME").at(25, 1).reset();
  return join(x.build(), sauce("Spinner (ansimation)", "Static", "DEAD CARRIER"));
}

function rain() {
  // Second ansimation: rain down a basement window, drawn with cursor moves only.
  const x = a().cls();
  x.at(2, 20).k(8, "╓" + "─".repeat(38) + "╖");
  for (let r = 3; r <= 16; r++) x.at(r, 20).k(8, "║").at(r, 59).k(8, "║");
  x.at(17, 20).k(8, "╙" + "─".repeat(38) + "╜");
  x.at(19, 22).k(3, "2 AM. the streetlight hums. so does the 486.");
  const R = rng(13);
  const drops = Array.from({ length: 14 }, () => ({ c: 21 + Math.floor(R() * 38), r: 3 + Math.floor(R() * 14) }));
  for (let f = 0; f < 120; f++) {
    for (const d of drops) {
      x.at(d.r, d.c).t(" ");
      d.r++; if (d.r > 16) { d.r = 3; d.c = 21 + Math.floor(R() * 38); }
      x.at(d.r, d.c).k(d.r % 3 ? 9 : 11, d.r > 14 ? "." : "│");
    }
    if (f % 40 === 30) x.at(10, 21).k(14, "░▒▓ headlights ▓▒░".padEnd(38)); else if (f % 40 === 34) x.at(10, 21).t(" ".repeat(38));
  }
  x.at(25, 1).reset();
  return join(x.build(), sauce("Window rain (ansimation)", "Static", "DEAD CARRIER"));
}

/** XBin piece with its own palette (amber phosphor ramp) and font tweak, RLE-compressed. */
function xbinPiece() {
  const W = 80, H = 25;
  const cells = new Uint8Array(W * H * 2);
  const put = (x: number, y: number, ch: number, at: number) => { const o = (y * W + x) * 2; cells[o] = ch; cells[o + 1] = at; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = Math.sin(x / 9) + Math.cos(y / 4 + x / 23);
    put(x, y, v > 1.1 ? 0xdb : v > 0.5 ? 0xb2 : v > 0 ? 0xb1 : v > -0.6 ? 0xb0 : 0x20, (Math.min(7, Math.max(0, Math.round((v + 2) * 1.7))) << 4) | 15);
  }
  const msg = " XBIN · CUSTOM PALETTE · CUSTOM FONT · CRWL ";
  for (let i = 0; i < msg.length; i++) put(18 + i, 12, msg.charCodeAt(i), 0x0e);
  put(17, 12, 0x01, 0x0e); put(18 + msg.length, 12, 0x01, 0x0e);
  // palette: 16 amber tones (6-bit RGB)
  const pal: number[] = [];
  for (let i = 0; i < 16; i++) pal.push(Math.round((i / 15) * 63), Math.round((i / 15) * 44), Math.round((i / 15) * 12));
  // font: VGA font with glyph 0x01 replaced by a little staircase
  const vga = atob(VGA_8X16_B64);
  const font = new Uint8Array(4096); for (let i = 0; i < 4096; i++) font[i] = vga.charCodeAt(i);
  [0, 0, 0x03, 0x03, 0x0f, 0x0f, 0x3f, 0x3f, 0xff, 0xff, 0, 0, 0, 0, 0, 0].forEach((b, r) => (font[16 + r] = b));
  // RLE: type 3 for repeated cells, type 0 literals
  const out: number[] = [];
  for (let i = 0; i < W * H;) {
    let n = 1;
    while (i + n < W * H && n < 64 && cells[(i + n) * 2] === cells[i * 2] && cells[(i + n) * 2 + 1] === cells[i * 2 + 1]) n++;
    if (n >= 3) { out.push(0xc0 | (n - 1), cells[i * 2], cells[i * 2 + 1]); i += n; continue; }
    let m = 1;
    while (i + m < W * H && m < 64 && !(cells[(i + m) * 2] === cells[(i + m + 1) * 2] && cells[(i + m) * 2 + 1] === cells[(i + m + 1) * 2 + 1])) m++;
    out.push(m - 1); for (let k = 0; k < m; k++) out.push(cells[(i + k) * 2], cells[(i + k) * 2 + 1]);
    i += m;
  }
  const head = [..."XBIN"].map((c) => c.charCodeAt(0)).concat([0x1a, W, 0, H, 0, 16, 1 | 2 | 4 | 8]);
  const body = new Uint8Array([...head, ...pal, ...font, ...out]);
  return join(body, sauce("Amber (XBin)", "Static", "DEAD CARRIER", { dt: 6, ft: 0, cols: W, lines: H }));
}

function ascii() {
  const s = [
    "", "        _______________________________________",
    "       |  ___________________________________  |",
    "       | |                                   | |",
    "       | |   ATDT 555-0142                   | |",
    "       | |   CONNECT 9600                    | |",
    "       | |                                   | |",
    "       | |   welcome to dead carrier.      | |",
    "       | |___________________________________| |",
    "       |_______________________________________|",
    "            \\_______________________________/",
    "         ___________________________________",
    "        /  [] [] [] [] [] [] [] [] [] [] []  \\",
    "       /  [] [] [] [] [] [] [] [] [] [] [] [] \\",
    "      /_________________________________________\\",
    "", "            pure ascii by static / crwl '94", "",
  ].join("\r\n");
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return join(out, sauce("Terminal (ascii)", "Static", "DEAD CARRIER", { ft: 0 }));
}

function ice() {
  const x = a().cls();
  for (let row = 1; row <= 24; row++) {
    x.at(row, 1);
    for (let c = 0; c < 80; c++) {
      const v = Math.sin(c / 7 + row / 4) + Math.cos(row / 3 - c / 11);
      const bg = v > 1 ? 15 : v > 0.3 ? 11 : v > -0.4 ? 9 : v > -1.1 ? 3 : 1;
      x.c(v > 0.6 ? 1 : 9, bg).t(v > 1.4 ? "▓" : v > 0.9 ? "▒" : v > 0.2 ? "░" : " ");
    }
  }
  x.at(11, 30).c(15, 1).t("  ICE COLD  CRWL  ").at(12, 30).c(1, 15).t(" bright backgrounds ").at(25, 1).reset();
  return join(x.build(), sauce("Ice Cold", "Static", "DEAD CARRIER", { ice: true }));
}

const FILES: Record<string, { make: () => Uint8Array; artists: string[] }> = {
  "FILE_ID.DIZ": { make: diz, artists: ["static"] },
  "CRWL-LGO.ANS": { make: logo, artists: ["static"] },
  "STAIRS.ANS": { make: stairs, artists: ["static"] },
  "SCROLLER.ANS": { make: scroller, artists: ["static"] },
  "SPINNER.ANS": { make: spinner, artists: ["static"] },
  "RAIN.ANS": { make: rain, artists: ["static"] },
  "AMBER.XB": { make: xbinPiece, artists: ["static"] },
  "TERMINAL.ASC": { make: ascii, artists: ["static"] },
  "ICECOLD.ICE": { make: ice, artists: ["static"] },
  "CRAWL01.EXE": { make: () => new Uint8Array(0), artists: ["static"] },
};

const cache = new Map<string, Uint8Array>();
export function houseFile(name: string): Uint8Array | null {
  const f = FILES[name.toUpperCase()];
  if (!f) return null;
  if (!cache.has(name)) cache.set(name, f.make());
  return cache.get(name)!;
}

export function housePack(): PackInfo {
  return {
    name: HOUSE_PACK, year: 1994, groups: ["Dead Carrier house crew"], fileId: "FILE_ID.DIZ", house: true,
    files: Object.keys(FILES).map((n) => ({
      name: n, artists: FILES[n].artists, size: n.endsWith(".EXE") ? 23114 : houseFile(n)!.length, viewable: !n.endsWith(".EXE"),
    })),
  };
}

export const HOUSE_FILE_NAMES = Object.keys(FILES).filter((n) => !n.endsWith(".EXE"));
export type { Ansi };
