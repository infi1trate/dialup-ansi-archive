import {a,pad} from './ansi';
import type {Board} from './board';
import {net} from '@/data/net';
export async function wall(b:Board){
  let page=0;
  for(;;){const rows=(await net('wall'))?.rows??[];const x=b.header(a(),'THE WALL','public / 3 lines');
    rows.slice(page*3,page*3+3).forEach((r:any,i:number)=>{x.at(5+i*5,4).k(b.sk.a,pad(`#${r.id} ${r.handle} / ${r.level}`,72));r.body.split('\n').forEach((l:string,n:number)=>x.at(6+i*5+n,5).k(7,pad(l,70)));});
    if(!rows.length)x.at(7,5).k(7,'No messages yet. VALIDATED callers may leave a note.');
    x.at(21,4).k(11,'A add / R report / N next / P previous / ESC return');b.send(x);b.hint(['A','R','N','P'].map(c=>({key:c,ch:c,label:c})).concat([{key:'Escape',ch:'',label:'ESC'}]));
    const k=await b.key(),c=String.fromCharCode(k.ch??0).toUpperCase();if(k.key==='Escape')return;if(c==='N'){page=Math.min(page+1,Math.max(0,Math.ceil(rows.length/3)-1));continue;}if(c==='P'){page=Math.max(0,page-1);continue;}
    if(c==='A'){const r=(await net('record',{guest:b.guest}))?.record;if(b.guest||r?.level==='NEW USER'){b.send(a().at(22,4).eol().k(14,'Earn VALIDATED to post. Reading is open to everyone.'));await b.anyKey(23);continue;}b.send(b.header(a(),'THE WALL / Leave a note'));const lines=[];for(let i=0;i<3;i++){const line=await b.ask(7+i*2,`Line ${i+1} (empty finishes)`,70);if(!line)break;lines.push(line);}const result=await net('wallPost',{body:lines.join('\n')});b.send(a().at(18,4).k(14,result?.ok?'Message posted.':result?.why||result?.error||'Wall offline.'));await b.anyKey(22);}
    if(c==='R'){const id=Number(await b.ask(22,'Message #',10));const r=await net('messageReport',{kind:'wall',id});b.send(a().at(23,4).eol().k(14,r?.ok?'Report sent to the sysop.':'Report not filed.'));await b.key();}
  }
}
export async function innerCircle(b:Board){
  const r=await net('innerCircle',{guest:b.guest});if(!r?.ok){b.send(b.header(a(),'INNER CIRCLE').at(8,5).k(14,r?.why||'Score index offline.'));await b.anyKey(22);return;}
  for(;;){b.send(b.header(a(),'INNER CIRCLE',r.week).at(6,5).k(15,'1 Top 10 / average rating, at least two votes').at(8,5).k(11,'2 Weekly picks / ratings and views').at(12,5).k(7,'The archive belongs to its artists. I shows their credits.'));b.hint([{key:'1',ch:'1',label:'TOP 10'},{key:'2',ch:'2',label:'WEEKLY'},{key:'Escape',label:'ESC'}]);const k=await b.key();if(k.key==='Escape')return;if(k.ch===49)await b.fileResults('INNER CIRCLE / Top rated',r.top);if(k.ch===50)await b.fileResults(`INNER CIRCLE / ${r.week}`,r.weekly);}
}