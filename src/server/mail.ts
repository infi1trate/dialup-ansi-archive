import {mailText,type MailRule} from './mail-rules';
import {isoWeek,record} from './access';
import {NetError} from './net';
export async function queueMail(s:any,c:any,rule:MailRule,board:string,detail='',key=rule as string){
 if(!c||c.banned)return;
 const text=mailText(c.handle,rule,board,detail,key);
 const {error}=await s.from('sysop_mail').upsert({caller_id:c.id,rule_key:key,board,...text,occurred_call:c.calls},{onConflict:'caller_id,rule_key',ignoreDuplicates:true});if(error)throw new NetError(503,'Mail spool offline.');
}
export async function inspectMail(s:any,c:any,board:string){
 if(!c)return;
 const r=await record(s,c);
 if(c.calls>=1)await queueMail(s,{...c,calls:Math.max(1,c.calls-1)},'first',board);
 if(r.level==='VALIDATED'||r.level==='ELITE')await queueMail(s,c,'validated',board);
 if(r.level==='ELITE')await queueMail(s,c,'elite',board);
 const {data:ledger}=await s.from('credit_ledger').select('amount,created_at').eq('caller_id',c.id).order('created_at');let balance=0;
 for(const v of ledger??[]){const before=balance;balance+=v.amount;if(before>0&&balance<=0){await queueMail(s,c,'ratio',board);break;}}
 const {data:views}=await s.from('views').select('pack,file').eq('viewer','c:'+c.id);
 if(views?.length>=10){const {data:index}=await s.from('archive_index').select('pack,file,artist');const artists=new Map<string,number>();for(const v of views){const name=index?.find((r:any)=>r.pack===v.pack&&r.file===v.file)?.artist;if(name)artists.set(name,(artists.get(name)??0)+1);}const artist=[...artists].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).find(([,n])=>n>=10);if(artist)await queueMail(s,c,'artist',board,artist[0]);}
}
export async function mailAction(s:any,c:any,b:Record<string,any>){
 if(!c||b.guest)return {rows:[],guest:true,why:'GUEST has no private mailbox. Apply for a handle.'};
 if(b.action==='mailRead'){
   if(!Number.isSafeInteger(b.id)||b.id<1)throw new NetError(400,'Bad mail number.');
   const {data,error}=await s.from('sysop_mail').update({read_at:new Date().toISOString()}).eq('id',b.id).eq('caller_id',c.id).not('delivered_call','is',null).select('id,board,subject,body,created_at,read_at').maybeSingle();if(error)throw new NetError(503,'Mailbox offline.');return {message:data};
 }
 const {data,error}=await s.from('sysop_mail').select('id,board,subject,created_at,read_at,delivered_call').eq('caller_id',c.id).not('delivered_call','is',null).order('id',{ascending:false});if(error)throw new NetError(503,'Mailbox offline.');return {rows:data??[],unread:(data??[]).filter((r:any)=>!r.read_at).length};
}
export async function dailyTopMail(s:any,c:any,board:string,door:string,now=new Date()){
 const day=now.toISOString().slice(0,10),table=door==='corner'?'corner_runs':'door_scores';let query=s.from(table).select('caller_id,score').not('score','is',null).order('score',{ascending:false}).limit(1);
 query=door==='corner'?query.eq('day',day):query.gte('created_at',day+'T00:00:00Z').lt('created_at',new Date(+new Date(day)+86400000).toISOString());
 const {data}=await query;if(data?.[0]?.caller_id===c.id)await queueMail(s,c,'dailyTop',board,door,'dailyTop:'+isoWeek(now));
}