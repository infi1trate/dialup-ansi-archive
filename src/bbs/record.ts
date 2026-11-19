import {a,pad} from './ansi';
import type {Board} from './board';
import {net} from '@/data/net';
import {ACCESS,accessLevel,nextChecklist,checklistItems} from '@/lib/access';
import {ustyle,panel,field,bar,tile,write} from './utility-chrome';
export async function yourRecord(b:Board){
  const r=(await net('record',{guest:b.guest}))?.record??{level:'NEW USER',days:0,pieces:0,oneliners:0,wallPosts:0,ratings:0,finishedRuns:0,calls:0,credits:b.creditsLeft,crawlBest:0,cornerBest:0};
  const level=accessLevel(r.level),cap=ACCESS[level],s=ustyle(b.ioEntryId(),b.sk.a),vault=s.id==='vault';
  const next=level==='NEW USER'?'VALIDATED':level==='VALIDATED'?'ELITE':'complete';
  const x=b.header(a(),'Your record',level);
  // Left: who you are and what this level gives you.
  const h=vault?11:15;panel(x,s,5,3,37,h,'LEVEL');
  const perks=level==='NEW USER'?['Reading, oneliners, doors','3 s tagged holds']:level==='VALIDATED'?['THE WALL posting is open','2 s tagged holds']:['INNER CIRCLE is open','THE ATTIC is in your directory'];
  const left:[number,string][]=[[s.accent,b.user],[s.text,`${level} / earned, never bought`],[s.dim,`${cap.minutes} min per UTC day / ${cap.speed} bps cap`],[s.dim,''],...perks.map(p=>[s.text,'+ '+p] as [number,string])];
  if(!vault)left.push([s.dim,''],...([['Calls',r.calls],['UTC days',r.days],['Pieces viewed',r.pieces],['Oneliners',r.oneliners],['Wall posts',r.wallPosts],['Pieces rated',r.ratings]] as [string,number][]).map(([l,v])=>[s.text,field(s,l,v,33)] as [number,string]));
  left.slice(0,h-2).forEach(([c,t],i)=>write(x,s,6+i,5,c,t,33));
  // Right: the road to the next level as text-mode progress bars.
  panel(x,s,5,41,37,h,next==='complete'?'TOP OF THE BOARD':`NEXT: ${next}`);
  const items=checklistItems(level,r);const right:[number,string][]=[];
  if(!items.length)right.push([s.accent,nextChecklist(level,r)[0]]);
  items.forEach(it=>{right.push([it.n>=it.target?s.accent:s.text,`${it.n>=it.target?'[x]':'[ ]'} ${it.label}`],[s.dim,'    '+bar(s,it.n,it.target,16)]);});
  if(level==='NEW USER')right.push([s.dim,'Days OR pieces, plus a oneliner.']);
  if(!vault){if(right.length<8)right.push([s.dim,'']);([['Ratio credits',r.credits],['BASEMENT best',r.crawlBest],['THE CORNER best',r.cornerBest],['Finishes',r.finishedRuns],['Streak (UTC days)',r.streak??0]] as [string,number][]).forEach(([l,v])=>right.push([s.text,field(s,l,v,33)]));}
  right.slice(0,h-2).forEach(([c,t],i)=>write(x,s,6+i,43,c,t,33));
  if(vault)([['CALLS',r.calls],['DAYS',r.days],['PIECES',r.pieces],['LINES',r.oneliners],['WALL',r.wallPosts],['RATED',r.ratings],['CREDITS',r.credits],['STREAK',r.streak??0]] as [string,number][]).forEach(([l,v],i)=>tile(x,16,3+i*9+(i>3?3:0),9,v,l));
  if(vault)write(x,s,20,3,3,`BASEMENT best ${r.crawlBest} / THE CORNER best ${r.cornerBest} / finishes ${r.finishedRuns}`,75);
  if(b.guest)write(x,s,20,5,s.text,'GUEST activity is not saved. Apply for a handle.',70);
  x.at(21,5).k(14,b.guest?"GUEST has no bill: no retained telephone account.":"B  phone bills / ENTER returns",s.bg);
  b.send(x);b.hint([{key:"B",ch:"B",label:"PHONE BILLS"},{key:"Enter",label:"BACK"}]);const k=await b.key();b.clearPending();if(k.ch===66||k.ch===98)await b.bills();
}
export async function promotionNotice(b:Board,level:string){
  const cap=ACCESS[accessLevel(level)];
  const voices:Record<string,string>={crawl:'Static: you earned a better line. Do not waste it.',vault:'Halftone: a new place in the showroom is yours.',c93:'access changed. earned traffic. no purchase.',maple:'Mr. Hutchins: thank you for being part of our club.',strobe:'Kickdrum: another channel opens. Keep the beat.'};
  const x=b.header(a(),'ACCESS PROMOTION',level);
  [voices[b.ioEntryId()]??'Access earned.',`You are now ${level}.`,`${cap.minutes} minutes per UTC day / modem cap ${cap.speed} bps`,level==='VALIDATED'?'THE WALL posting is open. Tagged holds are now 2 seconds.':'INNER CIRCLE is open. THE ATTIC is in your directory.','Earned, never bought.'].forEach((l,i)=>x.at(7+i*2,5).k(i===1?15:(b.ioEntryId()==='maple'?14:b.sk.a),pad(l,70),b.ioEntryId()==='maple'?1:0));
  b.send(x);await b.anyKey(22);
}