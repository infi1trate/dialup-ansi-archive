// Byte-only compositions. Positions are shared by drawing and keyboard selection.
import { a, Ansi, box, center, pad, bigText, shadeBar } from './ansi';
export type MenuItem = [string,string];
export interface MenuStatus { user:string; node:number; credits:number; minutes:number; callers:string[]; oneliner:string; zeroDay:string; featured:string }
export const CLUB_TIPS = [
  'Label your disks before putting them away.', 'Keep drinks away from the keyboard.',
  'Make a second copy of your important files.', 'Turn off the printer before changing its ribbon.',
  'Ask before borrowing a club disk.', 'Keep a notebook of useful DOS commands.',
  'Check the write-protect tab on your backup disk.', 'Use a dust cover after the computer cools.',
  'Save your work before trying a new program.', 'Give the next caller a turn on the telephone.',
  'Store floppy disks away from magnets.', 'A tidy cable is a happy cable.',
];
const day = () => Math.floor(Date.now()/86400000);
export function menuPosition(id:string,i:number) {
  if(id==='vault')return {row:10+Math.floor(i/6)*5,col:3+(i%6)*13,width:12};
  if(id==='strobe') { const positions=[[11,4],[11,31],[11,57],[15,4],[15,57],[19,4],[19,31],[19,57],[22,16],[22,48]];const [row,col]=positions[i]??[22,4];return {row,col,width:22}; }
  if(id==='crawl')return {row:8+i,col:3+(i%3),width:32};
  return {row:9+Math.floor(i/2),col:6+(i%2)*36,width:32};
}
export function menuSelection(id:string,items:MenuItem[],i:number,selected:boolean,cycle=0) {
  const {row,col,width}=menuPosition(id,i),x=a(),[key,label]=items[i];
  if(id==='vault') {box(x,row,col,12,4,selected?15:3,undefined,true,selected?3:0);x.at(row+1,col+1).c(selected?0:15,selected?3:0).t(center(key,10));x.at(row+2,col+1).c(selected?0:11,selected?3:0).t(center(label.replace('Groups / packs','Packs').replace('Tagged slideshow','Slideshow').replace('Studio bulletins','Bulletins').replace('Artist index A-Z','Artists'),10));}
  else x.at(row,col).c(selected?0:id==='crawl'?7:11,selected?(id==='strobe'?(cycle%2?5:3):id==='crawl'?7:3):0).t(pad(` ${key}  ${label}`,width));
  return x;
}
export function boardLogo(id:string,name:string) {
  const x=a().cls();
  if(id==='crawl') {
    bigText(x,3,6,name,[4,4,4],8);bigText(x,2,4,name,[12,4,7],4);
    x.at(4,4).k(4,'░░').at(5,3).k(8,'░'.repeat(73));
    x.at(7,4).k(11,'CONNECT / ACCESS IS A PRIVILEGE, NOT A PERSONALITY');
  } else if(id==='vault') {
    x.at(1,1);shadeBar(x,79,3);bigText(x,3,7,name,[15,11,1],3);
    for(let r=3;r<=5;r++)x.at(r,68).k(3,'▓▒░');
    x.at(7,2).k(11,center('F U L L   B L O C K   /   T H E   S H O W R O O M',77));
  } else if(id==='strobe') {
    for(let r=1;r<=9;r++){x.at(r,1);for(let c=0;c<79;c++)x.k([13,14,11][Math.floor((c+r*3)/5)%3],'█');}
    // Six full-cell rows, 59 columns: solid lettering remains readable in thumbnails.
    const glyphs=[
      ['#########','##.......','#########','.......##','.......##','#########'],
      ['#########','...###...','...###...','...###...','...###...','...###...'],
      ['########.','##.....##','########.','##...##..','##....##.','##.....##'],
      ['.#######.','##.....##','##.....##','##.....##','##.....##','.#######.'],
      ['########.','##.....##','########.','##.....##','##.....##','########.'],
      ['#########','##.......','#######..','##.......','##.......','#########'],
    ];
    const pixels=Array.from({length:6},(_,r)=>glyphs.map(g=>g[r]).join('.'));
    for(let r=-1;r<=6;r++){
      x.at(2+r,10);
      for(let c=-1;c<=59;c++){
        const lit=pixels[r]?.[c]==='#';
        const outline=[-1,0,1].some(dy=>[-1,0,1].some(dx=>pixels[r+dy]?.[c+dx]==='#'));
        x.k(lit?15:outline?0:[13,14,11][Math.floor((c+10+(r+2)*3)/5)%3],'█');
      }
    }
    x.at(10,1).k(14,center('KICKDRUM / FOUR CHANNELS / AFTERHOURS',79));
  } else if(id==='maple') {
    x.c(15,1).raw('\x1b[2J');box(x,2,7,66,6,15,undefined,true,1);
    x.at(3,8).k(14,center('  /\\   MAPLE RIDGE   /\\',64),1);
    x.at(4,8).k(15,center('|__| PC USERS GROUP BBS |__|',64),1);
    x.at(6,8).k(14,center('Est. 1989  /  Mr. Hutchins',64),1);
  } else x.at(2,2).k(10,'LINE NOISE  node 1  2400-14400  no logs kept').nl(2).k(2,'private exchange / Dial Tone');
  return x;
}
export function drawMenu(id:string,name:string,items:MenuItem[],s:MenuStatus,selected=0) {
  const x=boardLogo(id,name);
  if(id==='crawl') {
    x.at(6,4).k(8,'COMMANDS / NO HANDHOLDING');
    // Single-line status panel; deliberately not a box around the commands.
    x.at(8,40).k(8,'┌'+'─'.repeat(36)+'┐');for(let r=9;r<22;r++)x.at(r,40).k(8,'│').at(r,77).k(8,'│');x.at(22,40).k(8,'└'+'─'.repeat(36)+'┘');
    const lines=[`NODE ${s.node} / LIVE STATUS`,`${s.user} / ${s.user==='Guest'?'VISITOR':'CALLER'}`,`RATIO: ${s.credits} credits`,`TIME LEFT: ${s.minutes} min`,'LAST THREE CALLERS',...s.callers.slice(0,3),'LATEST ONELINER',s.oneliner,`0-DAY: ${s.zeroDay} packs this month`];
    lines.forEach((t,i)=>x.at(9+i,42).k(i===0||i===4||i===8?11:7,pad(t,34)));
    items.forEach((_,i)=>x.bytes(menuSelection(id,items,i,i===selected).build()));
    x.at(24,1).c(0,4).t(pad(' NO LAMERS. NO LEECHES. NO CARRIER. / STATIC OWNS THE DISCONNECT.',79));
  } else if(id==='vault') {
    x.at(8,3).c(0,3).t(pad(` NOW SHOWING: ${s.featured}`,75));
    items.forEach((_,i)=>x.bytes(menuSelection(id,items,i,i===selected).build()));
    for(let i=items.length;i<12;i++){const {row,col}=menuPosition(id,i);box(x,row,col,12,4,1);x.at(row+1,col+1).k(3,center(['80 x 25','16 COLORS','RAW BYTES'][i-items.length]??'',10));x.at(row+2,col+1).k(1,'░▒▓████▓▒░');}
    x.at(21,3).k(15,'HALFTONE / THE COLLECTIVE LEAVES NO CELL UNDECIDED');
    x.at(22,3).k(11,'ARROWS select tile / ENTER open / letter jumps to its command');
    x.at(24,1);shadeBar(x,79,3);
  } else if(id==='maple') {
    items.forEach(([k,l],i)=>x.at(9+i,16).k(14,`${k}. `,1).k(15,pad(l,25).replace(/ +$/g,m=>'.'.repeat(m.length))+' '+['a daily picture','reviewed by the club','a pleasant discovery','meeting notices','saved pictures','catch up','find a picture','thank the artists','please call again'][i],1));
    box(x,19,7,66,4,15,'Tip of the day',true,1);x.at(21,9).k(14,center(CLUB_TIPS[day()%CLUB_TIPS.length],62),1);
    x.at(24,1).k(15,center(`Welcome, ${s.user}.  ${Math.min(30,s.minutes)} minutes left.  Thank you for sharing.`,79),1);
  } else if(id==='strobe') {
    items.forEach((_,i)=>x.bytes(menuSelection(id,items,i,i===selected).build()));
    box(x,14,29,24,6,13,'CHANNELS');x.bytes(strobeMotion(0).build());
    x.at(24,1).k(14,pad(' GREETS / FULL BLOCK / LATCHKEY / TIN SAINTS / ALL NIGHT CALLERS / ',79));
  } else x.at(7,2).k(10,'Command (?=help): ');
  return x.reset();
}
export function strobeMotion(frame:number) {
  const x=a();for(let c=0;c<4;c++){const n=1+((frame*3+c*5)%12);x.at(15+c,32).k(11,`${c+1} `).k(c%2?14:13,'█'.repeat(n)).k(8,'░'.repeat(12-n));}return x;
}
export function listChrome(id:string,name:string,title:string,sub='') {
  const x=a();
  if(id==='c93')return x.c(10).nl(2).t(`${name} / ${title.replace(/^LINE NOISE\s*\/\s*/,'')}`.slice(0,78)).nl().k(2,sub.slice(0,78)).nl();
  if(id==='maple') {x.c(15,1).raw('\x1b[2J');box(x,1,3,75,3,15,undefined,true,1);x.at(2,4).k(14,center(`${name} / ${title}`.slice(0,71),73),1);box(x,4,2,77,19,15,undefined,false,1);}
  else if(id==='vault'){x.cls();box(x,1,2,77,3,11);x.at(2,4).k(15,pad(`FULL BLOCK / ${title}`,73));for(let r=4;r<23;r++)x.at(r,1).k(3,'▓').at(r,79).k(3,'░');x.at(24,1);shadeBar(x,79,3);}
  else if(id==='strobe'){x.cls();for(let r=1;r<=3;r++){x.at(r,1);for(let c=1;c<80;c++)x.k([13,14,11][Math.floor((c+r*4)/6)%3],r===2?'▄':'▀');}x.at(2,4).c(0,3).t(pad(`STROBE >> ${title}`,65));x.at(24,1).k(13,'▀▄'.repeat(39));}
  else {x.cls().at(1,2).k(12,`DEAD CARRIER // ${title}`.slice(0,76));x.at(2,2).k(8,'░'.repeat(76));x.at(3,4).k(11,sub.slice(0,70));x.at(24,1).c(0,4).t(pad(' ARCHIVE / CREDIT THE ARTIST. KEEP YOUR RATIO. KEEP YOUR DISTANCE.',79));}
  return x;
}
export function goodbyeDesign(id:string,name:string,user:string,quote:string) {
  const x=boardLogo(id,name);
  if(id==='c93')return x.nl(3).k(10,`session closed / ${user}`).nl().k(2,'no record retained.').nl();
  const row=id==='strobe'?12:10;
  if(id==='maple'){box(x,row,10,60,9,15,'Until next time',true,1);x.at(row+3,12).k(14,center(`Thank you for visiting, ${user}.`,56),1);x.at(row+5,12).k(15,center('Please leave the telephone line tidy.',56),1);}
  else if(id==='vault'){box(x,row,4,72,10,11,'END OF EXHIBITION');bigText(x,row+2,14,'SEE YOU',[15,11,1]);x.at(row+7,7).k(11,pad('The next canvas is waiting. / Halftone',65));}
  else if(id==='strobe'){x.at(13,4).k(14,'\\\\\\ THE LAST CHANNEL FALLS SILENT ///////////////////////');x.bytes(strobeMotion(0).build());x.at(22,4).k(13,'KICKDRUM / SAME FREQUENCY NEXT TIME');}
  else{bigText(x,11,4,'NO CARRIER',[12,4,7]);x.at(17,5).k(11,`${user}: your line has been revoked.`);x.at(19,5).k(8,'Static has already forgotten you.');}
  x.at(23,2).k(id==='maple'?14:7,center(quote.slice(0,76),77),id==='maple'?1:0);return x;
}