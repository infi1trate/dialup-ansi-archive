export function streak(days:string[],today:string){const set=new Set(days);let d=+new Date(today+'T00:00:00Z');if(!set.has(today))d-=86400000;let n=0;while(set.has(new Date(d).toISOString().slice(0,10))){n++;d-=86400000;}return n;}
export function scoreTables(rows:any[],day:string){const rank=(rs:any[])=>{const best=new Map<string,any>();for(const r of rs){const old=best.get(r.handle);if(!old||r.score>old.score)best.set(r.handle,r);}return [...best.values()].sort((a,b)=>b.score-a.score||a.handle.localeCompare(b.handle)).slice(0,10);};return {daily:rank(rows.filter(r=>(r.day??r.created_at.slice(0,10))===day)),allTime:rank(rows)};}
export async function dailyScores(s:any,door:string,now=new Date()){
 const day=now.toISOString().slice(0,10),yesterday=new Date(+new Date(day)-86400000).toISOString().slice(0,10);
 const {data}=await s.from(door==='corner'?'corner_runs':'door_scores').select(door==='corner'?'handle,score,day':'handle,score,floor,created_at').not('score','is',null).order('score',{ascending:false}).limit(10000);
 const tables=scoreTables(data??[],day);return {...tables,top:tables.daily,yesterday:scoreTables(data??[],yesterday).daily[0]??null};
}