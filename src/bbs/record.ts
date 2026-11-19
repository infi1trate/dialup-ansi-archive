import {a,pad} from './ansi';
import type {Board} from './board';
import {net} from '@/data/net';
import {ACCESS,accessLevel,nextChecklist} from '@/lib/access';
export async function yourRecord(b:Board){
  const r=(await net('record',{guest:b.guest}))?.record??{level:'NEW USER',days:0,pieces:0,oneliners:0,wallPosts:0,ratings:0,finishedRuns:0,calls:0,credits:b.creditsLeft,crawlBest:0,cornerBest:0};
  const level=accessLevel(r.level),cap=ACCESS[level];
  const x=b.header(a(),'Your record',level);
  const lines=[`${b.user} / ${level} / earned, never bought`,`${cap.minutes} min per UTC day / ${cap.speed} bps cap`,`${r.calls} calls / ${r.days} UTC days / ${r.pieces} pieces viewed`,`${r.oneliners} oneliners / ${r.wallPosts} wall posts / ${r.ratings} pieces rated`,`Ratio credits ${r.credits} / BASEMENT best ${r.crawlBest}`,`THE CORNER best ${r.cornerBest} / scored finishes ${r.finishedRuns}`,`Next level: ${level==='NEW USER'?'VALIDATED':level==='VALIDATED'?'ELITE':'complete'}`,...nextChecklist(level,r),...(b.guest?['GUEST activity is not saved. Apply for a handle.']:[])];
  lines.forEach((l,i)=>x.at(5+i,5).k(i===0?(b.ioEntryId()==='maple'?14:b.sk.a):15,pad(l,70),b.ioEntryId()==='maple'?1:0));
  b.send(x);await b.anyKey(22);
}
export async function promotionNotice(b:Board,level:string){
  const cap=ACCESS[accessLevel(level)];
  const voices:Record<string,string>={crawl:'Static: you earned a better line. Do not waste it.',vault:'Halftone: a new place in the showroom is yours.',c93:'access changed. earned traffic. no purchase.',maple:'Mr. Hutchins: thank you for being part of our club.',strobe:'Kickdrum: another channel opens. Keep the beat.'};
  const x=b.header(a(),'ACCESS PROMOTION',level);
  [voices[b.ioEntryId()]??'Access earned.',`You are now ${level}.`,`${cap.minutes} minutes per UTC day / modem cap ${cap.speed} bps`,level==='VALIDATED'?'THE WALL posting is open. Tagged holds are now 2 seconds.':'INNER CIRCLE is open. THE ATTIC is in your directory.','Earned, never bought.'].forEach((l,i)=>x.at(7+i*2,5).k(i===1?15:(b.ioEntryId()==='maple'?14:b.sk.a),pad(l,70),b.ioEntryId()==='maple'?1:0));
  b.send(x);await b.anyKey(22);
}