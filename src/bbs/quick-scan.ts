import {a,pad} from './ansi';
import {Terminal} from '@/term/terminal';
import type {Prepared} from '@/term/prepare';
/** Retain the original leading character/SGR bytes; translate only placement into the contact sheet. */
const ROWS=400;
const visible=(c:number)=>{const ch=c&255;return (ch!==0&&ch!==32&&ch!==255)||((c>>12)&7)!==0;};
/** First source row (0-based) with any visible cell; 0 when the piece is blank or starts drawn. */
export function firstVisibleRow(prep:Prepared){
 const t=new Terminal({...prep.mode,rows:ROWS});t.feed(prep.stream);
 for(let r=0;r<ROWS;r++){for(let c=0;c<80;c++)if(visible(t.cell(r,c)))return r;}
 return 0;
}
export function scanPreview(prep:Prepared,startRow:number,from=0){
 const source=new Terminal({...prep.mode,rows:ROWS});const out=a();let seq:number[]=[];
 let destX=-1,destY=-1;
 for(const b of prep.stream){
  if(b===27||seq.length){
   seq.push(b);source.feed(Uint8Array.of(b));
   if(seq.length>2&&b>=64&&b<=126){
    if(b===109||b===116)out.bytes(seq);
    seq=[];destX=-1;destY=-1;
   }
   continue;
  }
  const row=source.y,col=source.x;
  // Cursor-positioned art can jump anywhere, so keep reading; only rows in the strip are emitted.
  if(row<from+8&&row>=from&&b>=32&&b!==127&&col<80){
   if(destX!==col||destY!==row){out.at(startRow+row-from,col+1);destX=col;destY=row;}
   out.bytes([b]);destX++;
  }
  source.feed(Uint8Array.of(b));
 }
 return out;
}
export function scanCaption(file:string,title:string,artist:string,accent:number,row:number,from=0){return a().at(row,1).k(accent,pad(`${file}  ${title}  ${artist}${from?`  (from row ${from+1})`:''}`,79)).at(row+1,1).k(accent,'─'.repeat(79));}