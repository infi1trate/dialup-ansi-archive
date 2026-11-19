import {a,pad,bigText} from '@/bbs/ansi';
export const INTRO_GREETS='GREETS TO LATCHKEY, NULL FOUNDRY, TIN SAINTS AND MIDNIGHT RELAY / TO EVERY CALLER WHO LETS A DISK FINISH / STATIC: KEEP THE LINE OPEN / HALFTONE: LEAVE NO CELL UNDECIDED / DIAL TONE: THE EXCHANGE IS QUIET / KICKDRUM: FOUR CHANNELS UNTIL DAWN / MR. HUTCHINS: WE LABELLED THE DISKS / NO BORROWED CODE, NO STOLEN NIGHT / ';
export function cracktroFrame(id:string,frame:number,reduced=false){
 const x=a();if(frame===0){x.cls();const group=id==='EMBER'?'LATCHKEY':'NULL FOUNDRY';const logo=a();bigText(logo,1,1,group,[15,15,15],0);
 // Expand half-block font into six rows of full cells without changing the terminal renderer.
 const rows=group==='LATCHKEY'?['#.... .###. ##### .#### #...# #...# ##### #...#','#.... #...# ..#.. #.... #...# #..#. #.... .#.#.','#.... ##### ..#.. #.... ##### ###.. ####. ..#..','#.... #...# ..#.. #.... #...# #..#. #.... ..#..','#.... #...# ..#.. #.... #...# #...# #.... ..#..','##### #...# ..#.. .#### #...# #...# ##### ..#..']:
 ['#...# #...# #.... #....  ##### .###. #...# #...# ####. ####. #...#','##..# #...# #.... #....  #.... #...# #...# ##..# #...# #...# .#.#.','#.#.# #...# #.... #....  ####. #...# #...# #.#.# #...# ####. ..#..','#..## #...# #.... #....  #.... #...# #...# #..## #...# #..#. ..#..','#...# #...# #.... #....  #.... #...# #...# #...# #...# #...# ..#..','#...# .###. ##### #####  #.... .###. .###. #...# ####. #...# ..#..'];
 rows.forEach((s,r)=>x.at(r+1,Math.floor((80-s.length)/2)+1).k(id==='EMBER'?14:11,s.replace(/#/g,'█').replace(/\./g,' ')));
 x.at(21,2).k(8,pad(`${id} / original intro / any key returns`,78));}
 for(let row=0;row<12;row++){x.at(row+7,1);for(let col=0;col<79;col++){
  if(id==='EMBER'){
   const heat=Math.max(0,Math.min(1,(row/11)-.35+.25*Math.sin(col*.27-frame*.24)+.15*Math.sin(col*.59+frame*.31)));
   const v=Math.floor(heat*7);x.k([0,4,4,12,6,14,15,15][v],[' ','░','▒','▓','▓','█','█','█'][v]);
  }else{const v=Math.floor((Math.sin(col*.13+frame*.16)+Math.cos(row*.5-frame*.12)+2)*2);x.k([1,3,9,11,13,5,12,14,15][v],['░','▒','▓','█'][v%4]);}
 }}
 const offset=reduced?INTRO_GREETS.split(' ').slice(0,frame%INTRO_GREETS.split(' ').length).join(' ').length:frame;
 const scroller=INTRO_GREETS+INTRO_GREETS;const n=offset%INTRO_GREETS.length;
 x.at(19,1).k(id==='EMBER'?14:11,pad(scroller.slice(n,n+79),79));return x;
}