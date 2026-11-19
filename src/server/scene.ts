import {sceneSelection,sceneCache,type ScenePack} from '@/lib/scene';
import {getApiJson} from './archive-proxy';
export async function refreshScene(s:any,now:Date){
 const day=now.toISOString().slice(0,10);
 const {data:claim}=await s.from('scene_bulletins').upsert({day,ready:false,started_at:now.toISOString()},{onConflict:'day',ignoreDuplicates:true}).select('day');
 if(!claim?.length)return;
 try{
  const packs:ScenePack[]=[];
  for(let year=1996;year>=1990;year--){for(let page=1;;page++){const j=JSON.parse(new TextDecoder().decode(await getApiJson(`/v1/year/${year}?pagesize=100&page=${page}`)));for(const r of j.results??[])packs.push({name:String(r.name),year,groups:r.groups??[],date:r.date??r.released});if(page>=(j.page?.pages??1))break;}}
  const chosen=sceneSelection(packs,now);const wanted=new Map([...chosen.bulletin,...chosen.all].map(p=>[p.name,p]));
  // Metadata only, serial requests through the permanent proxy; never prefetch art.
  for(const p of wanted.values()){const j=JSON.parse(new TextDecoder().decode(await getApiJson(`/v1/pack/${p.name}?sauce=true&filesize=true`)));const r=j.results?.[0];if(r){p.groups=r.groups?.length?r.groups:p.groups;p.files=Object.keys(r.files??{}).length;p.date=r.date??r.released??p.date;}}
  await s.from('scene_bulletins').update({ready:true,payload:chosen}).eq('day',day);
 }catch{await s.from('scene_bulletins').update({started_at:'1970-01-01T00:00:00Z'}).eq('day',day);}
}
export async function sceneAction(s:any,now:Date,defer:(p:Promise<void>)=>void){return sceneCache(async()=>{const {data}=await s.from('scene_bulletins').select('*').eq('day',now.toISOString().slice(0,10)).maybeSingle();if(data?.ready)return {...data.payload,ready:true,day:data.day};if(data&&+now-+new Date(data.started_at)>600000)await s.from('scene_bulletins').delete().eq('day',data.day).eq('ready',false);return null;},()=>refreshScene(s,now),defer);}