import {a} from './ansi';
import type {Board} from './board';
import {net} from '@/data/net';
import {sceneLine,type ScenePack} from '@/lib/scene';
export async function sceneBulletin(b:Board,all=false){const r=await net('scene');b.send(b.header(a(),all?'0-DAY ART':'This week in the scene',r?.scope==='week'?'Static / this ISO week':'Static / widened to this calendar month'));
 if(!r||r.cold){b.send(a().at(7,4).k(8,'Gathering the scene wires. The menu is ready; check back later.'));await b.anyKey(22);return;}
 const packs:ScenePack[]=all?r.all:r.bulletin;if(!packs.length){b.send(a().at(7,4).k(8,'No dated packs on the wires for this calendar window.'));await b.anyKey(22);return;}
 b.setScenePacks(packs);const now=new Date(r.day+'T12:00:00Z');for(;;){const pick=await b.lightbar({row:5,col:3,width:75,height:15,items:packs.map(p=>({text:sceneLine(p,now),color:11}))});if(!pick)return;await b.openScenePack(packs[pick.index]);b.send(b.header(a(),'This week in the scene','Static / ENTER opens the original pack'));}
}