// Translate legacy BBS display codes to ANSI bytes before modem scheduling.
import { ANSI_VGA } from './terminal';
const attr = (v:number) => `\x1b[0${v&8?';1':''}${v&128?';5':''};3${ANSI_VGA[v&7]};4${ANSI_VGA[(v>>4)&7]}m`;
export function legacyText(bytes:Uint8Array) {
 let s=Array.from(bytes,b=>String.fromCharCode(b)).join('');
 // ANSI music is a PC-speaker command, not printable score text.
 s=s.replace(/\x1b\[M[^\r\n\x0e]*\x0e/g,'');
 s=s.replace(/@X([0-9a-f]{2})/gi,(_,h)=>attr(parseInt(h,16)))
 .replace(/\|(0\d|1[0-5])/g,(_,n)=>attr(+n))
 .replace(/@(?:COLOR:)?([0-9a-f]{2})@/gi,(_,h)=>attr(parseInt(h,16)))
 .replace(/@CLS@/gi,'\x1b[2J').replace(/@(?:PAUSE|MORE|BEEP)@/gi,'');
 // LF-only ASCII is newline, not line-feed with retained column.
 if (!s.includes('\r') && s.includes('\n')) s=s.replace(/\n/g,'\r\n');
 const out:number[]=[];
 for(let i=0;i<s.length;i++) {
  const c=s.charCodeAt(i);
  const push=(x:string)=>{for(const ch of x)out.push(ch.charCodeAt(0));};
  if(c===22 && i+1<s.length && s.charCodeAt(i+1)>=1 && s.charCodeAt(i+1)<=12) {
   const cmd=s.charCodeAt(++i);
   if(cmd===1&&i+1<s.length)push(attr(s.charCodeAt(++i)));
   else if(cmd===2)push('\x1b[5m');
   else if(cmd>=3&&cmd<=6)push(`\x1b[${['A','B','D','C'][cmd-3]}`);
   else if(cmd===7)push('\x1b[K');
   else if(cmd===8&&i+2<s.length){const y=s.charCodeAt(++i),x=s.charCodeAt(++i);push(`\x1b[${y};${x}H`);}
   else if(cmd===12)push('\x1b[2J');
   else throw new Error('AVATAR command not supported by this terminal.');
  } else if(c===25&&i+2<s.length&&!s.includes("\x1b[")){const ch=s.charCodeAt(++i),n=s.charCodeAt(++i);for(let j=0;j<n;j++)out.push(ch);}
  else out.push(c);
 }
 return new Uint8Array(out);
}
export function unsupportedReason(name:string,raw:Uint8Array,sauceType?:number) {
 const head=String.fromCharCode(...raw.subarray(0,64));
 if(head.startsWith('!|') || /\x1b\[!/.test(head) || sauceType===3 || /\.rip$/i.test(name))return 'RIPscrip needs a graphics terminal; this line carries text only.';
 if(/^(GIF8|\x89PNG|BM|RIFF|%PDF|MZ|PK\x03\x04|Rar!|7z\xbc)/.test(head) || (raw[0]===255&&raw[1]===216))return 'This is a picture, program or archive, not a text-mode screen.';
 if(/\.(gif|png|jpe?g|bmp|exe|com|zip|rar|7z|lzh|arj|wav)$/i.test(name))return 'This file cannot be shown on a text terminal. Download it instead.';
 return null;
}
/** Conservative wide-file inference: long physical rows, or a regularly packed raster. */
export function guessWidth(bytes:Uint8Array) {
 const text=Array.from(bytes,b=>String.fromCharCode(b)).join('').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'');
 const lines=text.split(/\r?\n|\r/).filter(l=>l.length>0);
 const lengths=lines.map(l=>l.length).sort((a,b)=>a-b);
 if(lines.length>=3) {const typical=lengths[Math.floor(lengths.length*.8)];if(typical>80&&typical<=160)return typical<=132?132:160;}
 if(lines.length===1 && text.length>80*25 && !bytes.includes(27) && text.length%160===0)return 160;
 return 80;
}
