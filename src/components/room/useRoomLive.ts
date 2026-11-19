import { useEffect, useRef } from 'react';
import { audio } from '@/audio/bus';
import { screenAverageColor, screenPictureBrightness } from '@/machine/signals';
import { lampEase, screenLight } from './plate-layout';
interface Opts {root:React.RefObject<HTMLElement|null>;getState:()=>string;reduced:boolean;lamp?:boolean}
export function useRoomLive({root,getState,reduced,lamp=true}:Opts){
 const lampTarget=useRef(lamp);lampTarget.current=lamp;
 useEffect(()=>{const el=root.current;if(!el)return;let raf=0,last=performance.now(),level=lampTarget.current?1:0,from=level,start=last,on=lampTarget.current;
 let monitor=audio.status.tube,warmStart=monitor?last-1600:last;let tgt=screenAverageColor.value,cur=[0,0,0],velocity=[0,0,0],picture=0;
 const matrix=el.querySelector('feColorMatrix[data-room-light]');
 const unsub=screenAverageColor.subscribe(v=>{tgt=v;});
 let pc=audio.status.pc,oh=false,cd=false,hs=false,rd=0,sd=0,disk=0;
 const leds=Object.fromEntries(['MR','OH','CD','HS','TR','AA','RD','SD','hdd','monitor'].map(n=>[n,el.querySelector(`[data-led="${n}"]`)]));
 const set=(name:string,on:boolean)=>leds[name]?.classList.toggle('is-on',on);
 const off=[audio.on('monitorOn',()=>{monitor=true;warmStart=performance.now();}),audio.on('monitorOff',()=>{monitor=false;}),audio.on('powerOn',()=>{pc=true;}),audio.on('powerOff',()=>{pc=false;oh=cd=hs=false;}),audio.on('offHook',()=>{oh=true;}),audio.on('connect',speed=>{cd=true;hs=speed>=14400;}),audio.on('hangup',()=>{oh=cd=hs=false;}),audio.on('byteFlow',()=>{rd=performance.now()+180;}),audio.on('keyDown',()=>{if(cd)sd=performance.now()+90;}),audio.on('diskSeek',()=>{disk=performance.now()+240;}),audio.on('floppySeek',()=>{disk=performance.now()+180;})];
 const tick=(now:number)=>{raf=requestAnimationFrame(tick);const dt=Math.min(.04,(now-last)/1000);last=now;
 if(on!==lampTarget.current){on=lampTarget.current;from=level;start=now;}level=lampEase(from,on,now-start);
 const omega=4/.25;
 for(let i=0;i<3;i++){const delta=cur[i]-tgt[i],c=velocity[i]+omega*delta,e=Math.exp(-omega*dt);const next=tgt[i]+(delta+c*dt)*e;velocity[i]=(velocity[i]-omega*c*dt)*e;cur[i]+=Math.max(-255*dt,Math.min(255*dt,next-cur[i]));}
 const mx=Math.max(...cur,0),brightness=Math.min(1,mx/255),warm=Math.min(1,Math.max(0,(now-warmStart-250)/1350));
 picture+=(screenPictureBrightness.value-picture)*(1-Math.exp(-dt/.25));
 const {gain,tint}=screenLight(cur,monitor,level,warm,picture),[r,g,b]=tint.map(v=>v*gain);
 el.style.setProperty('--lamp-level',String(level));el.style.setProperty('--screen-opacity',String(gain));
 matrix?.setAttribute('values',`${r} 0 0 0 0 0 ${g} 0 0 0 0 0 ${b} 0 0 0 0 0 1 0`);
 el.style.setProperty('--reflection',String(Math.min(1,level)*(.35-.25*brightness)));
 set('monitor',monitor);set('MR',pc);set('OH',pc&&oh);set('CD',pc&&cd);set('HS',pc&&hs);set('TR',pc&&getState()!=='off');set('AA',false);set('RD',pc&&cd&&now<rd);set('SD',pc&&now<sd);set('hdd',pc&&now<disk);
 };raf=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(raf);unsub();off.forEach(f=>f());};},[root,getState,reduced]);
}
// Retained exported compatibility function for the previous regression suite.
export function lightAlpha(dt:number){return 1-Math.exp(-Math.max(0,dt)/300);}
