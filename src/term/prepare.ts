// One place that turns a downloaded file into a terminal mode + the byte stream to send.
// Used by the board's viewer, /lab, /gallery and the share card, so they always agree.
import { parseSauce, type Sauce } from "./sauce";
import { binaryKind, cellsToAnsi, decodeBinary } from "./formats";
import { selectedFont } from "./fonts";
import { guessWidth, legacyText, unsupportedReason } from "./legacy";
import type { TermMode } from "./terminal";

export function modeFor(name: string, s: Sauce | null): TermMode {
  const isBin = /\.bin$/i.test(name);
  let cols = 80;
  if (s) {
    if (isBin && s.dataType === 5 && s.fileType > 0) cols = s.fileType * 2;
    else if (isBin && s.tInfo1 >= 40) cols = s.tInfo1;
    else if (s.dataType === 1 && s.tInfo1 >= 40 && s.tInfo1 <= 320 && (s.fileType === 1 || s.fileType === 2)) cols = s.tInfo1;
  } else if (isBin) cols = 160;
  const font = selectedFont(s?.tInfoS ?? "");
  return { cols, rows: /vga50|8x8/i.test(s?.tInfoS ?? "") ? 50 : undefined, font, ice: /\.ice$/i.test(name) || isBin || !!s?.ice, ninePixel: !font && s?.letterSpacing !== 8 };
}

export interface Prepared { mode: TermMode; stream: Uint8Array; sauce: Sauce | null; format: string }

export function prepareArt(name: string, bytes: Uint8Array): Prepared {
  const art = parseSauce(bytes);
  let mode = modeFor(name, art.sauce);
  if(art.raw[0]===24 && String.fromCharCode(...art.raw.subarray(1,9))==="TUNDRA24") return {mode,stream:tundra(art.raw),sauce:art.sauce,format:"TND"};
  const detected = detectKind(name, art.raw, art.sauce);
  const reason = unsupportedReason(name, art.raw, art.sauce?.dataType);
  if (reason) throw new Error(reason);
  if (!detected) {
    const control = Array.from(art.raw).filter(v=>v<32 && ![7,8,9,10,13,22,25,26,27].includes(v)).length / Math.max(1,art.raw.length);
    if(control>.08 || (art.raw.length>1024 && !art.body.includes(27) && Array.from(art.body).filter(v=>v<32&&! [7,8,9,10,13,26,27].includes(v)).length/Math.max(1,art.body.length)>.1)) throw new Error("Binary data is not a text-mode screen. Try downloading this file.");
    const stream = legacyText(art.body);
    if (!art.sauce?.tInfo1) mode.cols = guessWidth(stream);
    return { mode, stream, sauce: art.sauce, format: /\.ice$/i.test(name) ? "iCE" : "ANSI" };
  }
  const img = decodeBinary(`art.${detected}`, art.raw, mode.cols);
  mode = {
    cols: Math.max(40, Math.min(320, img.cols)), ice: img.ice || mode.ice,
    ninePixel: img.font ? false : mode.ninePixel, palette: img.palette ?? null, font: img.font ?? null,
  };
  return { mode, stream: cellsToAnsi(img.cells, img.cols, img.rows), sauce: art.sauce, format: img.format };
}

function detectKind(name:string, raw:Uint8Array, s:Sauce|null) {
 if(String.fromCharCode(...raw.subarray(0,5)) === "XBIN\x1a")return "XB";
 if(raw.length>4156 && raw[0]===4 && raw[1]===49 && raw[2]===46)return "IDF";
 if(raw.length>=4289 && raw[0]===1 && raw.subarray(1,193).every(v=>v<=63))return "ADF";
 if(s?.dataType===5)return "BIN";
 return binaryKind(name);
}

/** Tundra24 cursor + truecolor cells, converted to progressively metered ANSI. */
function tundra(raw:Uint8Array) {
 const out:number[]=[]; const dv=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
 const push=(s:string)=>{for(const c of s)out.push(c.charCodeAt(0));};
 for(let i=9;i<raw.length;) {
  const cmd=raw[i++];
  if(cmd===1){if(i+8>raw.length)throw new Error("Truncated Tundra cursor");const y=dv.getUint32(i),x=dv.getUint32(i+4);i+=8;push(`\x1b[${y+1};${x+1}H`);continue;}
  let ch=cmd;
  if(cmd===2||cmd===4||cmd===6){
   if(i+(cmd===6?9:5)>raw.length)throw new Error("Truncated Tundra color");ch=raw[i++];
   const rgb=()=>{i++;const r=raw[i++],g=raw[i++],b=raw[i++];return `${r};${g};${b}`;};
   if(cmd===2||cmd===6)push(`\x1b[1;${rgb()}t`);
   if(cmd===4||cmd===6)push(`\x1b[0;${rgb()}t`);
  }
  out.push([7,8,9,10,13,26,27].includes(ch)?32:ch);
 }
 return new Uint8Array(out);
}
