import { decode } from "./cp437";

export interface Sauce {
  title: string; author: string; group: string; date: string;
  fileSize: number; dataType: number; fileType: number;
  tInfo1: number; tInfo2: number; tFlags: number; tInfoS: string;
  ice: boolean; letterSpacing: 0 | 8 | 9;
}

export interface ParsedArt {
  sauce: Sauce | null;
  /** Bytes to stream: everything before SAUCE and before the 0x1A EOF marker. */
  body: Uint8Array;
  /** Binary formats (BIN/XB/ADF/IDF): everything before SAUCE, 0x1A is data, not EOF. */
  raw: Uint8Array;
}

const str = (b: Uint8Array, o: number, n: number) => decode(b.subarray(o, o + n)).replace(/[\s\u0000]+$/, "").trim();

export function parseSauce(bytes: Uint8Array): ParsedArt {
  let end = bytes.length;
  let sauce: Sauce | null = null;
  if (bytes.length >= 128) {
    const o = bytes.length - 128;
    const id = String.fromCharCode(...bytes.subarray(o, o + 5));
    if (id === "SAUCE") {
      const dv = new DataView(bytes.buffer, bytes.byteOffset + o, 128);
      const tFlags = bytes[o + 105];
      const ls = (tFlags >> 1) & 3;
      sauce = {
        title: str(bytes, o + 7, 35), author: str(bytes, o + 42, 20), group: str(bytes, o + 62, 20),
        date: str(bytes, o + 82, 8), fileSize: dv.getUint32(90, true), dataType: bytes[o + 94],
        fileType: bytes[o + 95], tInfo1: dv.getUint16(96, true), tInfo2: dv.getUint16(98, true),
        tFlags, tInfoS: str(bytes, o + 106, 22), ice: (tFlags & 1) === 1,
        letterSpacing: ls === 1 ? 8 : ls === 2 ? 9 : 0,
      };
      end = o;
      const comments = bytes[o + 104];
      const cStart = o - comments * 64 - 5;
      if (comments > 0 && cStart >= 0 && String.fromCharCode(...bytes.subarray(cStart, cStart + 5)) === "COMNT") end = cStart;
    }
  }
  let rawEnd = end;
  if (sauce && sauce.fileSize > 0 && sauce.fileSize <= end) rawEnd = sauce.fileSize;
  else if (sauce && rawEnd > 0 && bytes[rawEnd - 1] === 0x1a) rawEnd--;
  const raw = bytes.subarray(0, rawEnd);
  let body = bytes.subarray(0, end);
  const eof = body.indexOf(0x1a);
  if (eof >= 0) body = body.subarray(0, eof);
  return { sauce, body, raw };
}

export function sauceDate(d: string) {
  return /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : "";
}
