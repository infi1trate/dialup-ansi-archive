// CP437 code page <-> Unicode.
export const CP437 =
  "\u0000☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼" +
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂" +
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00a0";

const REV = new Map<string, number>();
for (let i = 0; i < 256; i++) if (!REV.has(CP437[i])) REV.set(CP437[i], i);

/** Encode a Unicode string to CP437 bytes. ASCII control chars pass through unchanged. */
/** Typographic characters a 1992 PC never had, mapped to what a sysop would have typed. */
const FALLBACK: Record<string, number> = { "—": 0x2d, "–": 0x2d, "’": 0x27, "‘": 0x27, "“": 0x22, "”": 0x22, "…": 0x2e };

export function encode(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c < 0x80) out.push(c);
    else out.push(REV.get(ch) ?? FALLBACK[ch] ?? 0x3f);
  }
  return out;
}

export function decode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b < 0x20 || b === 0x7f ? (b === 0 ? " " : CP437[b]) : CP437[b];
  return s;
}
