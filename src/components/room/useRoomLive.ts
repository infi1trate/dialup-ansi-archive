import { useEffect, useRef } from 'react';
import { audio } from '@/audio/bus';
import { screenAverageColor } from '@/machine/signals';
import { lampEase, screenLightOpacity } from './plate-layout';
interface Opts {root:React.RefObject<HTMLElement|null>;getState:()=>string;reduced:boolean;lamp?:boolean}
export function useRoomLive({root,getState,reduced,lamp=true}:Opts){
 const lampTarget=useRef(lamp);lampTarget.current=lamp;
 useEffect(()=>{const el=root.current;if(!el)return;let raf=0,last=performance.now(),level=lampTarget.current?1:0,from=level,start=last,on=lampTarget.current;
 let monitor=audio.status.tube,warmStart=monitor?last-1600:last;let tgt=[0,0,0],cur=[0,0,0],velocity=[0,0,0];
 const unsub=screenAverageColor.subscribe(v=>{tgt=v;});
 const off=[audio.on('monitorOn',()=>{monitor=true;warmStart=performance.now();}),audio.on('monitorOff',()=>{monitor=false;})];
 const tick=(now:number)=>{raf=requestAnimationFrame(tick);const dt=Math.min(.04,(now-last)/1000);last=now;
 if(on!==lampTarget.current){on=lampTarget.current;from=level;start=now;}level=lampEase(from,on,now-start);
 const omega= reduced?4/1.5:4/.25;
 for(let i=0;i<3;i++){const delta=cur[i]-tgt[i],c=velocity[i]+omega*delta,e=Math.exp(-omega*dt);const next=tgt[i]+(delta+c*dt)*e;velocity[i]=(velocity[i]-omega*c*dt)*e;cur[i]+=Math.max(-255*dt,Math.min(255*dt,next-cur[i]));}
 const mx=Math.max(...cur,0),brightness=Math.min(1,mx/255),warm=Math.min(1,Math.max(0,(now-warmStart-250)/1350));
 el.style.setProperty('--lamp-level',String(level));el.style.setProperty('--screen-opacity',String(screenLightOpacity(monitor,brightness,level,warm)));
 el.style.setProperty('--screen-tint',`rgb(${cur.map(v=>mx>0?Math.round(v/mx*255):0).join(' ')})`);
 el.style.setProperty('--reflection',String(Math.min(1,level)*(.35-.25*brightness)));
 void getState;
 };raf=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(raf);unsub();off.forEach(f=>f());};},[root,getState,reduced]);
}
// Retained exported compatibility function for the previous regression suite.
export function lightAlpha(dt:number){return 1-Math.exp(-Math.max(0,dt)/300);}
