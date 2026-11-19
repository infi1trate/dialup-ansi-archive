import {billLines,stubMonth,money,type Bill} from '@/lib/bill';
import {DIRECTORY} from '@/bbs/io';
import {VGA_8X16_B64} from '@/term/vga-font';
import {encode} from '@/term/cp437';
import {audio} from '@/audio/bus';

// 9-pin printer emulation: each glyph is a 7x9 dot grid sampled from the VGA ROM font.
const COLS=66,W=1080,H=1350,LEFT=66,PITCH=(W-LEFT*2)/COLS/8,ROWH=PITCH*12;
let glyphs:boolean[][][]|null=null;
export function dotFont(){if(glyphs)return glyphs;const raw=atob(VGA_8X16_B64);glyphs=[];for(let ch=0;ch<256;ch++){const g:boolean[][]=[];for(let r=0;r<9;r++){let row=0;for(let y=2+Math.floor(r*12/9);y<2+Math.floor((r+1)*12/9);y++)row|=raw.charCodeAt(ch*16+y);g.push(Array.from({length:7},(_,x)=>!!(row&(0x80>>x))));}glyphs.push(g);}return glyphs;}
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}

export function renderBill(b:Bill){const tokens=getComputedStyle(document.documentElement);const P={paper:tokens.getPropertyValue('--bill-paper').trim(),bar:tokens.getPropertyValue('--bill-bar').trim(),ink:tokens.getPropertyValue('--bill-ink').trim(),edge:tokens.getPropertyValue('--bill-edge').trim()};
const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const c=canvas.getContext('2d');if(!c)throw Error('Printer unavailable');
const font=dotFont();
c.fillStyle=P.paper;c.fillRect(0,0,W,H);
const top=40,rowY=(r:number)=>top+r*ROWH;
// green bar every other three lines on the statement part
for(let r=0;r*ROWH<H*.66;r++)if(Math.floor(r/3)%2){c.fillStyle=P.bar;c.fillRect(50,rowY(r)-2,W-100,ROWH);}
for(let y=24;y<H;y+=36){c.fillStyle=P.edge;c.beginPath();c.arc(24,y,8,0,Math.PI*2);c.arc(W-24,y,8,0,Math.PI*2);c.fill();}
c.strokeStyle=P.edge;c.lineWidth=1.2;c.setLineDash([3,5]);for(const x of [48,W-48]){c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke();}
const print=(text:string,col:number,row:number,o:{bold?:boolean;tall?:boolean}={})=>{const seed=hash(text+row),density=.74+(seed%22)/100,jitter=((seed>>5)%7-3)*.12;const bytes=encode(text);c.fillStyle=P.ink;
for(let i=0;i<bytes.length&&col+i<COLS;i++){const g=font[bytes[i]],x0=LEFT+(col+i)*PITCH*8;for(let r=0;r<9;r++)for(let x=0;x<7;x++){if(!g[r][x])continue;const px=x0+x*PITCH,py=rowY(row)+jitter+r*PITCH*(o.tall?2:1),fade=1-.28*(px/W);for(const dx of o.bold?[0,PITCH/2]:[0]){c.globalAlpha=density*fade*(.85+((seed+i*7+r*3+x)%5)*.04);c.beginPath();if(o.tall)c.ellipse(px+dx,py+PITCH*.5,PITCH*.55,PITCH*1.05,0,0,Math.PI*2);else c.arc(px+dx,py,PITCH*.58,0,Math.PI*2);c.fill();}}}c.globalAlpha=1;};
const rule=(row:number,from=0,to=COLS)=>{c.globalAlpha=.55;c.strokeStyle=P.ink;c.setLineDash([]);c.lineWidth=1;c.beginPath();c.moveTo(LEFT+from*PITCH*8,rowY(row)-3);c.lineTo(LEFT+to*PITCH*8,rowY(row)-3);c.stroke();c.globalAlpha=1;};
let r=0;
print('TRI-COUNTY BELLWIRE',Math.floor((COLS-19)/2),r,{bold:true,tall:true});r+=2;
print('PRIVATE TELEPHONE STATEMENT  /  FICTIONAL CHARGES ONLY',5,r,{bold:true});r++;
print(`ACCOUNT ${b.account}   CUSTOMER ${b.handle.toUpperCase().slice(0,20)}`,0,r++);
print(`SERVICE MONTH ${stubMonth(b.handle,b.month)}   ALL TIMES UTC   PREV BALANCE 0.00`,0,r++);
print('PAYMENT RECEIVED 0.00, THANK YOU.',0,r++);r++;
// ruled itemised calls table
const colsX=[0,6,12,38,47,54,COLS];const tableTop=r;
print('DATE  TIME  BOARD                     NUMBER    MIN   CHARGE',0,r++,{bold:true});rule(r);
const room=Math.max(4,22-b.subtotals.length);const calls=b.calls.slice(0,room);
for(const call of calls){const d=DIRECTORY.find(d=>d.id===call.board)??DIRECTORY[0];print(`${call.created_at.slice(5,10)} ${call.created_at.slice(11,16)} ${d.name.slice(0,25).padEnd(25)} ${d.number.padEnd(8)} ${String(call.minutes).padStart(4)}  ${money(call.cents).padStart(7)}`,0,r++);}
const more=b.omitted+(b.calls.length-calls.length);if(more){print(`  and ${more} shorter calls (included in totals)`,0,r++);}
if(!b.calls.length)print('  no itemized calls this month',0,r++);
rule(r);c.globalAlpha=.4;c.strokeStyle=P.ink;for(const x of colsX.slice(1,-1)){const px=LEFT+x*PITCH*8-PITCH*3;c.beginPath();c.moveTo(px,rowY(tableTop)-3);c.lineTo(px,rowY(r)-3);c.stroke();}c.globalAlpha=1;r++;
for(const s of b.subtotals){print(`${(DIRECTORY.find(d=>d.id===s.board)?.name??s.board).slice(0,30).padEnd(30)} ${String(s.calls).padStart(3)} CALLS ${String(s.minutes).padStart(5)} MIN ${money(s.cents).padStart(9)}`,0,r++);}
r++;c.strokeStyle=P.ink;c.globalAlpha=.8;c.lineWidth=2;c.strokeRect(LEFT-8,rowY(r)-6,W-LEFT*2+16,ROWH*1.5);c.globalAlpha=1;print(`TOTAL ${b.totalCalls} CALLS / ${b.totalMinutes} MINUTES`.padEnd(54)+money(b.totalCents).padStart(9),0,r,{bold:true});r+=2;
print(`PIECES VIEWED ${b.pieces}   BEST DOOR SCORE ${b.best}   RATIO +${b.earned} / -${b.spent}`,0,r++);
print(`FAVOURITE ARTIST ${b.artist.slice(0,24)}   GROUP ${b.group.slice(0,18)}`,0,r++);
print(b.notice.slice(0,COLS),0,r++);
// tear-off payment stub, bottom third
const stubY=H*.67;c.strokeStyle=P.ink;c.globalAlpha=.6;c.lineWidth=1.5;c.setLineDash([6,6]);c.beginPath();c.moveTo(48,stubY);c.lineTo(W-48,stubY);c.stroke();c.setLineDash([]);c.globalAlpha=1;
for(let x=60;x<W-60;x+=18){c.fillStyle=P.edge;c.beginPath();c.arc(x,stubY,2,0,Math.PI*2);c.fill();}
const sr=Math.ceil((stubY+20-top)/ROWH);
print('-- TEAR HERE --',Math.floor((COLS-15)/2),sr-1);
print('PAYMENT STUB (do not pay, there is nothing to pay)',8,sr+1,{bold:true});
print('TRI-COUNTY BELLWIRE BILLING',0,sr+3,{tall:true});
print(`ACCOUNT NUMBER   ${b.account}`,0,sr+6);print(`SERVICE MONTH    ${stubMonth(b.handle,b.month)}`,0,sr+7);print(`AMOUNT DUE       ${money(b.totalCents)}   (imaginary)`,0,sr+8);print('AMOUNT ENCLOSED  ________',0,sr+9);
c.strokeStyle=P.ink;c.lineWidth=1.5;c.strokeRect(LEFT-8,rowY(sr+5)-4,W-LEFT*2+16,ROWH*5.4);
const code=hash(b.account+b.month);let bx=LEFT;const by=rowY(sr+12);c.fillStyle=P.ink;for(let i=0;bx<W-LEFT-10;i++){const wide=((code>>(i%31))^i)&1;for(let d=0;d<8;d++){c.globalAlpha=.8*(1-.2*bx/W);c.beginPath();c.arc(bx,by+d*PITCH*2.2,PITCH*.7*(wide?1.5:1),0,Math.PI*2);c.fill();}bx+=PITCH*(wide?7:4.6);}c.globalAlpha=1;
print(`*${b.account.replace(/\D/g,'')}*`,0,sr+15);
c.font='12px monospace';c.fillStyle=P.ink;c.fillText('Dial-Up / https://dialup-ansi-archive.lovable.app',70,H-18);return canvas;}
export {billLines};
export async function printBill(b:Bill){audio.emit('printer',true);const stop=()=>audio.emit('printer',false);window.addEventListener('keydown',stop,{once:true});const timer=setTimeout(()=>{stop();window.removeEventListener('keydown',stop);},900);try{const canvas=renderBill(b);const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/png'));if(!blob)return;void import('@/data/net').then(n=>n.count('bill_printed'));const name=`bellwire-${b.handle.replace(/[^a-z0-9_-]/gi,'_')}-${b.month}.png`;const file=new File([blob],name,{type:'image/png'});if(matchMedia('(pointer: coarse)').matches&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'TRI-COUNTY BELLWIRE'});return;}catch{}}const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch{clearTimeout(timer);stop();window.removeEventListener('keydown',stop);}}
