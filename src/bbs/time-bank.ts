import {a} from './ansi';
import type {Board} from './board';
import {ustyle,panel,field,write} from './utility-chrome';
/** used / left / banked as one 60-cell text-mode bar. */
export function timeBar(usedS:number,leftS:number,bankS:number,width=60){
  const total=Math.max(1,usedS+leftS+bankS),u=Math.round(width*usedS/total),l=Math.round(width*leftS/total),k=Math.max(0,width-u-l);
  return {used:'█'.repeat(u),left:'▓'.repeat(Math.min(l,width-u)),bank:'░'.repeat(Math.min(k,width-u-Math.min(l,width-u)))};
}
export async function timeBank(b:Board,out=false){for(;;){const r=await b.bankRead();const s=ustyle(b.ioEntryId(),b.sk.a),bg=s.bg;const x=b.header(a(),out?'Out of time today':'Time bank');if(b.guest){b.send(x.at(7,5).k(15,'GUEST gets a fresh 30 minutes per call; no time bank.',bg));await b.anyKey(22);return true;}if(!r||r.error){b.send(x.at(7,5).k(15,'The time ledger is offline. Your current call stays open.',bg));await b.anyKey(22);return true;}
 panel(x,s,5,3,75,6,'USED / LEFT / BANKED');
 const t=timeBar(r.used_seconds,Math.max(0,r.remainingSeconds),r.bank_seconds);
 x.at(7,8).k(s.accent,t.used,bg).k(s.text,t.left,bg).k(s.dim,t.bank,bg);
 x.at(8,8).k(s.accent,'█ used ',bg).k(s.text,'▓ left today ',bg).k(s.dim,'░ banked for later',bg);
 panel(x,s,12,3,75,8,'LEDGER');
 const lines:[string,string][]=[["Today's allowance",`${r.allowance_seconds/60} minutes`],['Minutes used today',(r.used_seconds/60).toFixed(1)],['Banked minutes',`${(r.bank_seconds/60).toFixed(1)} / 120`],['Withdrawn into today',`${r.withdrawn_seconds/60} minutes`],['Time left',`${(r.remainingSeconds/60).toFixed(1)} minutes`]];
 lines.forEach(([l,v],i)=>write(x,s,13+i,6,i===2?14:15,field(s,l,v,50),68));
 write(x,s,20,5,s.dim,r.exempt?'First device call: no clock warnings or cutoff.':'Unused minutes bank at 00:00 UTC.',70);
 write(x,s,21,5,14,'+ Withdraw 15 minutes / ESC '+(out?'hang up':'return'),70);
 b.send(x);b.hint([{key:'+',ch:'+',label:'+15 MIN'},{key:'Escape',label:out?'HANG UP':'BACK'}]);const k=await b.ioTimeout(3600000);b.clearPending();if(k?.ch===43){const v=await b.bankRead(true);if(v&&!v.error&&v.remainingSeconds>0){if(out)return true;}}else return !out;}}
