import {selectedFont} from './fonts';
import {VGA_8X16_B64} from './vga-font';
// Amiga lettering with CP437 chrome: the board emits CP437, not Amiga control codes.
export function strobeFont(){const amiga=selectedFont('Amiga Topaz');if(!amiga)return null;const bytes=new Uint8Array(amiga.bytes),vga=Uint8Array.from(atob(VGA_8X16_B64),c=>c.charCodeAt(0));bytes.set(vga.subarray(128*16),128*16);return {bytes,height:16};}
