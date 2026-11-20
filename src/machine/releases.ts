import {a,box,pad} from '@/bbs/ansi';
import {audio} from '@/audio/bus';
import {nfoLines,nfoPage,PROGRAM_IDS,releaseById} from '@/bbs/warez-catalog';
import type {LocalEnv} from './programs';
import * as drive from './drive';
import {net} from '@/data/net';
import {cracktroFrame} from './cracktro';
export async function installed(){return (await drive.list()).filter(f=>f.pack==='fiction'&&f.file==='PROGRAM');}
/** Every program leaves the caller where they were: 80x25 text mode, a clean screen, the same prompt. */
export async function runRelease(env:LocalEnv,id:string){
 const restore=env.preserveMode?.();
 try{await runProgram(env,id);}finally{env.out(a().reset().cls());restore?.();}
}
async function runProgram(env:LocalEnv,id:string){
 const r=releaseById(id);if(!r||!PROGRAM_IDS.includes(id))return;
 window.__lovableEvents?.track?.("project.program_run",{program:id});
 const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
 if(id==='EMBER'||id==='CHROMA'){
  let frame=0;audio.emit('music',true);audio.emit('introMusic',true);
  try{for(;;){env.out(cracktroFrame(id,frame++,env.reduced()));if(await env.nextOr(sleep(env.reduced()?250:50)))return;}}
  finally{audio.emit('introMusic',false);audio.emit('music',false);}
 }
 if(id==='PATCHFOX'){const result=await net('trainer');env.out(a().cls().at(6,6).k(14,'PATCHFOX / checking BASEMENT CRAWL overlay...').at(9,6).k(10,result?.ok?'Patch applied: exactly one extra BASEMENT CRAWL attempt today.':result?.already?'Already applied today. No extra attempt added.':'Patch unavailable: apply for a handle first.').at(15,6).k(8,'Any key returns'));await env.nextOr(new Promise(()=>{}));return;}
 if(id==='NFOLOOM'){const fs=(await drive.list()).filter(f=>f.pack==='fiction'&&f.file==='NFO');const ids=fs.map(f=>drive.dosName(f.name).replace('.NFO',''));if(!ids.length)ids.push(id);let i=0,page=0;for(;;){const rel=ids[i],pages=Math.ceil(nfoLines(rel).length/23);env.out(a().bytes(nfoPage(rel,page)).at(25,1).k(8,pad(`NFO LOOM / ${i+1} of ${ids.length} ${rel} / page ${page+1} of ${pages} / SPACE page / N next / P previous / ESC`,79)));const k=await env.nextOr(new Promise(()=>{}));if(k?.key==='Escape')return;if(k?.ch===32||k?.key==='Enter'){page=(page+1)%pages;continue;}if(k?.ch===78||k?.ch===110){i=(i+1)%ids.length;page=0;}if(k?.ch===80||k?.ch===112){i=(i+ids.length-1)%ids.length;page=0;}}}
 if(id==='TOUCHBOX'){env.out(a().cls().at(4,5).k(11,'TOUCHBOX / CORVID TONE BENCH').at(7,5).k(15,'0-9 touch tones / A 1000 Hz / B 440 Hz / C 2600 Hz').at(10,5).k(8,'Source: modem speaker. ESC return.'));for(;;){const k=await env.nextOr(new Promise(()=>{}));if(k?.key==='Escape')return;const c=k?.ch===null?'':String.fromCharCode(k?.ch??0).toUpperCase();if(/^\d$/.test(c))audio.emit('dialDigit',c);if(['A','B','C'].includes(c))audio.emit('programTone',{frequency:c==='A'?1000:c==='B'?440:2600,duration:.35,speaker:'modem'});env.out(a().at(13,5).eol().k(14,`Key ${c}`));}}
 if(id==='COILS'){let snake=[{x:15,y:10},{x:14,y:10},{x:13,y:10}],dx=1,dy=0,food={x:25,y:10},score=0;for(;;){const x=a().cls();box(x,2,2,60,21,11,'COILS');x.at(1,3).k(14,`Score ${score} / Arrows steer / ESC return`);snake.forEach(p=>x.at(p.y,p.x).k(10,'█'));x.at(food.y,food.x).k(14,'*');env.out(x);const k=await env.nextOr(sleep(150));if(k?.key==='Escape')return;if(k?.key==='ArrowUp'&&dy!==1){dx=0;dy=-1;}if(k?.key==='ArrowDown'&&dy!==-1){dx=0;dy=1;}if(k?.key==='ArrowLeft'&&dx!==1){dx=-1;dy=0;}if(k?.key==='ArrowRight'&&dx!==-1){dx=1;dy=0;}const p={x:snake[0].x+dx,y:snake[0].y+dy};if(p.x<=2||p.x>=61||p.y<=2||p.y>=22||snake.some(t=>t.x===p.x&&t.y===p.y)){env.out(a().at(24,3).k(12,'Circuit broken. Any key returns.'));await env.nextOr(new Promise(()=>{}));return;}snake.unshift(p);if(p.x===food.x&&p.y===food.y){score+=10;food={x:4+Math.floor(Math.random()*54),y:4+Math.floor(Math.random()*16)};}else snake.pop();}}
 let frame=0;try{if(id!=='DRIFTER')audio.emit('music',true);for(;;){const x=a().cls();box(x,1,1,79,24,id==='EMBER'?12:13,r.title);for(let row=5;row<20;row++)for(let col=4;col<76;col++){const v=Math.floor((Math.sin(col*.15+frame*.15)+Math.cos(row*.4-frame*.12)+2)*2);x.at(row,col).k([0,4,12,6,14,7,11,15,13][v],[' ','░','▒','▓','█'][Math.min(4,Math.floor(v/2))]);}x.at(3,5).k(15,`${r.group} / ${r.title}`).at(21,5).k(11,pad(('GREETS TO LATCHKEY / NULL FOUNDRY / TIN SAINTS / MIDNIGHT RELAY / ').repeat(3).slice(frame%60),68)).at(23,5).k(8,'Any key returns');env.out(x);if(id!=='DRIFTER')audio.emit('programTone',{frequency:[220,277,330,440,330,277,247,330][frame%8],duration:.12,speaker:'music'});const k=await env.nextOr(sleep(env.reduced()?300:150));if(k)return;frame++;}}finally{audio.emit('music',false);}
}
