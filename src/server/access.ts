import { ACCESS, accessLevel, wallBody } from '@/lib/access';
import { NetError, limit } from './net';

export async function record(s:any,c:any) {
  if(!c)return {level:'NEW USER',days:0,pieces:0,oneliners:0,wallPosts:0,ratings:0,finishedRuns:0,calls:0,credits:0,crawlBest:0,cornerBest:0};
  const {data,error}=await s.rpc('caller_record',{_caller:c.id});
  if(error)throw new NetError(503,'Caller record offline.');
  return data;
}
export async function publicLevels(s:any,rows:any[]) {
  const ids=[...new Set(rows.map(r=>r.caller_id).filter(Boolean))];
  const {data}=ids.length?await s.from('caller_access').select('caller_id,level').in('caller_id',ids):{data:[]};
  return rows.map(({caller_id,...r})=>({...r,level:data?.find((v:any)=>v.caller_id===caller_id)?.level??'NEW USER'}));
}
export async function accessAction(b:Record<string,any>,s:any,c:any,th:string,ip:string) {
  if(b.action==='record')return {record:await record(s,b.guest?null:c)};
  if(b.action==='wall') {
    const {data}=await s.from('wall_posts').select('id,caller_id,handle,body,created_at').eq('hidden',false).order('created_at',{ascending:false}).limit(30);
    return {rows:await publicLevels(s,data??[])};
  }
  if(b.action==='wallPost') {
    if(!c||c.banned||b.guest)return {ok:false,why:'GUEST may read. Earn VALIDATED to write.'};
    const r=await record(s,c);if(r.level==='NEW USER')return {ok:false,why:'THE WALL opens for posting at VALIDATED.'};
    const body=wallBody(b.body);if(!body)throw new NetError(400,'Use 1-3 lines, each at most 70 characters. No links.');
    await limit([th,ip],'wallPost',1,600);
    const {error}=await s.from('wall_posts').insert({caller_id:c.id,handle:c.handle,body});if(error)throw new NetError(503,'Wall offline.');
    return {ok:true};
  }
  if(b.action==='messageReport') {
    if(!['wall','oneliner'].includes(b.kind)||!Number.isSafeInteger(b.id)||b.id<1)throw new NetError(400,'Bad message.');
    await limit([th,ip],'messageReport',5,600);
    await s.from('message_reports').insert({caller_id:c?.id??null,kind:b.kind,message_id:b.id});return {ok:true};
  }
  if(b.action==='innerCircle') {
    if(!c||b.guest||(await record(s,c)).level!=='ELITE')return {ok:false,why:'INNER CIRCLE opens at ELITE. Earn it; never buy it.'};
    const [{data:ratings},{data:views},{data:index},{data:flags}]=await Promise.all([
      s.from('art_ratings').select('pack,file,rating'),s.from('views').select('pack,file'),s.from('archive_index').select('pack,file,title,artist,year'),s.from('flags').select('pack,file').eq('hidden',true),
    ]);
    const blocked=new Set((flags??[]).map((r:any)=>r.pack+'/'+r.file.toLowerCase()));
    const ranked=(index??[]).filter((r:any)=>r.year>=1990&&r.year<=1996&&!blocked.has(r.pack+'/'+r.file.toLowerCase())).map((r:any)=>{const rs=(ratings??[]).filter((v:any)=>v.pack===r.pack&&v.file===r.file);return {...r,count:rs.length,average:rs.reduce((n:number,v:any)=>n+v.rating,0)/(rs.length||1),views:(views??[]).filter((v:any)=>v.pack===r.pack&&v.file===r.file).length};});
    const top=ranked.filter((r:any)=>r.count>=2).sort((a:any,b:any)=>b.average-a.average||b.count-a.count||(a.pack+a.file).localeCompare(b.pack+b.file)).slice(0,10);
    const week=isoWeek(new Date());
    const weekly=ranked.filter((r:any)=>r.count||r.views).sort((a:any,b:any)=>(b.average*2+Math.log2(b.views+1)+hash(week+b.pack+b.file)/4294967296)-(a.average*2+Math.log2(a.views+1)+hash(week+a.pack+a.file)/4294967296)||(a.pack+a.file).localeCompare(b.pack+b.file)).slice(0,10);
    return {ok:true,top,weekly,week};
  }
  throw new NetError(400,'Unknown access action.');
}
export function isoWeek(date:Date){const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const year=d.getUTCFullYear(),start=new Date(Date.UTC(year,0,1));return `${year}-W${String(Math.ceil(((+d-+start)/86400000+1)/7)).padStart(2,'0')}`;}
function hash(s:string){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export async function logonAccess(s:any,c:any,board:string,speed:number,now=new Date()){
  const r=await record(s,c),level=accessLevel(r.level),cap=ACCESS[level];
  if(!c)return {record:r,level,speed:Math.min(speed,cap.speed),minutes:cap.minutes,remainingSeconds:cap.minutes*60};
  const {data:a}=await s.from('caller_access').select('*').eq('caller_id',c.id).single();
  const promotion=a?.announced_level!==level?level:null;
  await s.from('caller_access').update({announced_level:level,previous_call_at:c.last_call_at}).eq('caller_id',c.id);
  const {data:session,error}=await s.from('call_sessions').insert({caller_id:c.id,board,day:now.toISOString().slice(0,10),started_at:now.toISOString(),charged_at:now.toISOString()}).select('id').single();if(error)throw new NetError(503,'Call timer offline.');
  const {data:used}=await s.rpc('charge_call',{_session:session.id,_caller:c.id});
  return {record:r,level,promotion,speed:Math.min(speed,cap.speed),minutes:cap.minutes,remainingSeconds:Math.max(0,cap.minutes*60-(used??0)),callSession:session.id};
}