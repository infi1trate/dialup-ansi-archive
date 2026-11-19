import {dailyScores} from './daily';
import {FAMILY_SHELF} from '@/data/family-shelf';
import {NetError} from './net';
export function packInArea(board:string,row:{pack:string;file:string;year:number}) {
  if(board==='maple')return FAMILY_SHELF.some(f=>f.pack===row.pack&&f.file.toLowerCase()===row.file.toLowerCase());
  if(board==='attic')return row.year>=1997;
  if(board==='void')return true;
  if(board==='c93')return row.year>=1990&&row.year<=1996&&/\.(asc|txt|nfo|diz)$/i.test(row.file);
  return row.year>=1990&&row.year<=1996;
}
export async function newScan(s:any,c:any,board:string) {
  if(!c)return {lines:0,wall:0,scores:0,mail:0,packs:[],first:true,since:null};
  const {data:a,error}=await s.from('caller_access').select('previous_call_at').eq('caller_id',c.id).maybeSingle();if(error)throw new NetError(503,'Scan offline.');
  const since=a?.previous_call_at;
  if(!since)return {lines:0,wall:0,scores:0,mail:0,packs:[],first:true,since:null};
  const [{count:lines},{count:wall},{count:crawl},{count:corner},{data:index},{data:seen},{data:flags}]=await Promise.all([
    s.from('oneliners').select('id',{count:'exact',head:true}).eq('hidden',false).gt('created_at',since),
    s.from('wall_posts').select('id',{count:'exact',head:true}).eq('hidden',false).gt('created_at',since),
    s.from('door_scores').select('id',{count:'exact',head:true}).gt('created_at',since),
    s.from('corner_runs').select('score',{count:'exact',head:true}).not('score','is',null).gt('finished_at',since),
    s.from('archive_index').select('pack,file,year,title,artist'),s.from('views').select('pack').eq('viewer','c:'+c.id),s.from('flags').select('pack,file').eq('hidden',true),
  ]);
  const visited=new Set((seen??[]).map((r:any)=>r.pack));const hidden=new Set((flags??[]).map((r:any)=>r.pack+'/'+r.file.toLowerCase()));
  const {count:mail}=await s.from('sysop_mail').select('id',{count:'exact',head:true}).eq('caller_id',c.id).not('delivered_call','is',null).is('read_at',null);
  const packs=[...new Set((index??[]).filter((r:any)=>packInArea(board,r)&&!visited.has(r.pack)&&!hidden.has(r.pack+'/'+r.file.toLowerCase())).map((r:any)=>r.pack))].sort();
  const winners=board==='crawl'?await Promise.all([dailyScores(s,'crawl'),dailyScores(s,'corner')]):[];
  return {winners:winners.map(r=>r.yesterday),lines:lines??0,wall:wall??0,scores:(crawl??0)+(corner??0),mail:mail??0,packs,since,first:false};
}