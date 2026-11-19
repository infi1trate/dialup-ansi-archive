import {a,pad} from './ansi';
import {Terminal} from '@/term/terminal';
import type {Prepared} from '@/term/prepare';
/** Retain the original leading character/SGR bytes; translate only placement into the contact sheet. */
export function scanPreview(prep:Prepared,startRow:number){
 const source=new Terminal({...prep.mode,rows:25});const out=a();let seq:number[]=[];
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
  if(row>=8)break;
  if(b>=32&&b!==127&&col<80){
   if(destX!==col||destY!==row){out.at(startRow+row,col+1);destX=col;destY=row;}
   out.bytes([b]);destX++;
  }
  source.feed(Uint8Array.of(b));
 }
 return out;
}
export function scanCaption(file:string,title:string,artist:string,accent:number,row:number){return a().at(row,1).k(accent,pad(`${file}  ${title}  ${artist}`,79)).at(row+1,1).k(accent,'─'.repeat(79));}