// Board-specific chrome for the utility screens (record, mail, wall, scans, time bank).
// Everything here is ANSI bytes; each board keeps its own visual language:
// DEAD CARRIER ragged lists + single-line panels + inverse red strips, FULL BLOCK double frames,
// gradient bars and stat tiles, LINE NOISE plain teletype lines with dot leaders, MAPLE RIDGE
// double-line boxes on blue, STROBE stripe headers.
import {a,box,pad,rpad,type Ansi} from './ansi';
export interface UStyle {id:string;bg:number;accent:number;text:number;dim:number}
export function ustyle(id:string,accent:number):UStyle{
  if(id==='maple')return {id,bg:1,accent:14,text:15,dim:11};
  if(id==='c93')return {id,bg:0,accent:10,text:2,dim:2};
  if(id==='vault')return {id,bg:0,accent:11,text:15,dim:3};
  if(id==='strobe')return {id,bg:0,accent:13,text:15,dim:11};
  return {id,bg:0,accent:accent||12,text:15,dim:7};
}
/** A titled panel in the board's own style. Content starts at row+1, col+2. */
export function panel(x:Ansi,s:UStyle,row:number,col:number,w:number,h:number,title:string){
  if(s.id==='crawl'){
    x.at(row,col).k(8,'┌'+'─'.repeat(w-2)+'┐');for(let r=row+1;r<row+h-1;r++)x.at(r,col).k(8,'│').at(r,col+w-1).k(8,'│');x.at(row+h-1,col).k(8,'└'+'─'.repeat(w-2)+'┘');
    x.at(row,col+2).c(0,4).t(` ${title} `).reset();
  }else if(s.id==='vault'){box(x,row,col,w,h,11,title,true,0);}
  else if(s.id==='maple'){box(x,row,col,w,h,15,title,true,1);}
  else if(s.id==='strobe'){
    x.at(row,col);for(let c=0;c<w;c++)x.k([13,14,11][Math.floor((c+row*4)/6)%3],'▀');
    x.at(row,col+2).c(0,3).t(` ${title} `).reset();
    for(let r=row+1;r<row+h;r++)x.at(r,col).k(13,'▌');
  }else{x.at(row,col).k(10,pad(`-- ${title} `,w).replace(/ +$/,m=>' '+'-'.repeat(Math.max(0,m.length-1))));}
  return x;
}
/** One label/value line: dot leaders on LINE NOISE, aligned columns elsewhere. */
export function field(s:UStyle,label:string,value:string|number,w:number){
  const v=String(value);
  if(s.id==='c93')return label+' '+'.'.repeat(Math.max(1,w-label.length-v.length-2))+' '+v;
  return pad(label,Math.max(0,w-v.length))+v;
}
/** Text-mode progress bar: [#####.....] 9/15, or a shaded gradient on FULL BLOCK. */
export function bar(s:UStyle,n:number,target:number,width=10){
  const f=Math.max(0,Math.min(width,Math.round(width*Math.min(n,target)/Math.max(1,target))));
  const body=s.id==='vault'?'█'.repeat(f)+(f<width?'▓▒░'.slice(0,Math.min(3,width-f)):'')+'░'.repeat(Math.max(0,width-f-3)):'#'.repeat(f)+'.'.repeat(width-f);
  return `[${body.slice(0,width)}] ${n}/${target}`;
}
/** A small stat tile (FULL BLOCK): number on top, label beneath. */
export function tile(x:Ansi,row:number,col:number,w:number,value:string|number,label:string){
  box(x,row,col,w,4,3);x.at(row+1,col+1).k(15,rpad(String(value),w-3)+' ').at(row+2,col+1).k(3,pad(label,w-2));return x;
}
export function write(x:Ansi,s:UStyle,row:number,col:number,color:number,text:string,w:number){return x.at(row,col).k(color,pad(text,w),s.bg);}
export {a};
