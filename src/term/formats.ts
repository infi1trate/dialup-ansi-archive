// Binary text-mode formats: .BIN, XBin (.XB), ArtWorx (.ADF), iCE Draw (.IDF).
// Each decodes to char/attribute pairs plus optional palette and font; the board then
// streams them as ANSI bytes through the modem, so they still paint at line speed.
import { ANSI_VGA } from "./terminal";

export interface CellImage {
  cols: number; rows: number;
  cells: Uint8Array; // char, attr, char, attr...
  ice: boolean;
  palette?: Uint32Array; // 16 x ABGR
  font?: { bytes: Uint8Array; height: number };
  format: "BIN" | "XBIN" | "ADF" | "IDF";
}

const six = (v: number) => Math.round(((v & 63) * 255) / 63);
function pal(src: Uint8Array, order?: number[]): Uint32Array {
  const out = new Uint32Array(16);
  for (let i = 0; i < 16; i++) {
    const j = (order ? order[i] : i) * 3;
    const r = six(src[j]), g = six(src[j + 1]), b = six(src[j + 2]);
    out[i] = ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  return out;
}

export function decodeBin(raw: Uint8Array, cols: number): CellImage {
  const n = Math.floor(raw.length / 2) * 2;
  return { cols, rows: Math.ceil(n / 2 / cols), cells: raw.subarray(0, n), ice: true, format: "BIN" };
}

export function decodeXBin(raw: Uint8Array): CellImage {
  if (raw.length < 11 || String.fromCharCode(raw[0], raw[1], raw[2], raw[3]) !== "XBIN" || raw[4] !== 0x1a) throw new Error("not an XBin file");
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.length);
  const cols = dv.getUint16(5, true), rows = dv.getUint16(7, true);
  let fh = raw[9] || 16;
  const flags = raw[10];
  let o = 11;
  let palette: Uint32Array | undefined, font: CellImage["font"];
  if (flags & 1) { palette = pal(raw.subarray(o, o + 48)); o += 48; }
  if (flags & 2) {
    const chars = flags & 16 ? 512 : 256;
    font = { bytes: raw.slice(o, o + 256 * fh), height: fh }; // 512-char fonts: first bank only
    o += chars * fh;
  } else fh = 16;
  const total = cols * rows * 2;
  let cells: Uint8Array;
  if (flags & 4) {
    cells = new Uint8Array(total);
    let w = 0;
    while (w < total && o < raw.length) {
      const b = raw[o++], type = b >> 6, count = (b & 63) + 1;
      if (type === 0) for (let i = 0; i < count && w < total; i++) { cells[w++] = raw[o++]; cells[w++] = raw[o++]; }
      else if (type === 1) { const ch = raw[o++]; for (let i = 0; i < count && w < total; i++) { cells[w++] = ch; cells[w++] = raw[o++]; } }
      else if (type === 2) { const at = raw[o++]; for (let i = 0; i < count && w < total; i++) { cells[w++] = raw[o++]; cells[w++] = at; } }
      else { const ch = raw[o++], at = raw[o++]; for (let i = 0; i < count && w < total; i++) { cells[w++] = ch; cells[w++] = at; } }
    }
  } else cells = raw.slice(o, o + total);
  return { cols, rows, cells, ice: !!(flags & 8), palette, font, format: "XBIN" };
}

/** ArtWorx: version byte, 64-entry EGA palette, 8x16 font, then 80-column char/attr pairs. */
const ADF_ORDER = [0, 1, 2, 3, 4, 5, 20, 7, 56, 57, 58, 59, 60, 61, 62, 63];
export function decodeAdf(raw: Uint8Array): CellImage {
  if (raw.length < 1 + 192 + 4096) throw new Error("not an ADF file");
  const palette = pal(raw.subarray(1, 193), ADF_ORDER);
  const font = { bytes: raw.slice(193, 193 + 4096), height: 16 };
  const data = raw.subarray(193 + 4096);
  const n = Math.floor(data.length / 2) * 2;
  return { cols: 80, rows: Math.ceil(n / 160), cells: data.subarray(0, n), ice: true, palette, font, format: "ADF" };
}

/** iCE Draw: 12-byte header, RLE char/attr data, then 8x16 font and 16-color palette at the end. */
export function decodeIdf(raw: Uint8Array): CellImage {
  if (raw.length < 12 + 4096 + 48 || raw[0] !== 0x04) throw new Error("not an IDF file");
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.length);
  const cols = Math.min(320, dv.getUint16(9, true) + 1) || 80;
  const end = raw.length - 4096 - 48;
  const out: number[] = [];
  for (let o = 12; o + 1 < end;) {
    if (raw[o] === 0x01 && raw[o + 1] === 0x00 && o + 5 < end) {
      const count = dv.getUint16(o + 2, true);
      const ch = raw[o + 4], at = raw[o + 5];
      for (let i = 0; i < count; i++) out.push(ch, at);
      o += 6;
    } else { out.push(raw[o], raw[o + 1]); o += 2; }
  }
  const cells = new Uint8Array(out);
  return { cols, rows: Math.ceil(cells.length / 2 / cols), cells, ice: true, font: { bytes: raw.slice(end, end + 4096), height: 16 }, palette: pal(raw.subarray(end + 4096, end + 4096 + 48)), format: "IDF" };
}

/** Char/attr pairs -> ANSI bytes that wrap at `cols` (ANSI.SYS wrap). Control glyphs become spaces. */
export function cellsToAnsi(cells: Uint8Array, cols: number, rows?: number): Uint8Array {
  const out: number[] = [];
  let last = -1;
  const push = (s: string) => { for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); };
  const n = rows ? Math.min(cells.length, rows * cols * 2) : cells.length;
  for (let i = 0; i + 1 < n; i += 2) {
    let ch = cells[i];
    const at = cells[i + 1];
    if (ch === 0x07 || ch === 0x08 || ch === 0x09 || ch === 0x0a || ch === 0x0d || ch === 0x1a || ch === 0x1b) ch = 0x20;
    if (at !== last) {
      const fg = at & 15, bg = (at >> 4) & 15;
      push(`\x1b[0${fg & 8 ? ";1" : ""}${bg & 8 ? ";5" : ""};3${ANSI_VGA[fg & 7]};4${ANSI_VGA[bg & 7]}m`);
      last = at;
    }
    out.push(ch);
  }
  push("\x1b[0m");
  return new Uint8Array(out);
}

export type BinaryKind = "BIN" | "XB" | "ADF" | "IDF";
export function binaryKind(name: string): BinaryKind | null {
  const m = /\.(bin|xb|adf|idf)$/i.exec(name);
  return m ? (m[1].toUpperCase() as BinaryKind) : null;
}
export function decodeBinary(name: string, raw: Uint8Array, sauceCols?: number): CellImage {
  switch (binaryKind(name)) {
    case "XB": return decodeXBin(raw);
    case "ADF": return decodeAdf(raw);
    case "IDF": return decodeIdf(raw);
    default: return decodeBin(raw, sauceCols && sauceCols >= 40 ? sauceCols : 160);
  }
}
