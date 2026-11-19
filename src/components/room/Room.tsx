import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { audio } from '@/audio/bus';
import { camera, fractionStyle, GLASS, HOTSPOTS } from './plate-layout';
import { plates, plateSet } from './plates';
import { useRoomLive } from './useRoomLive';
import { Rain } from './Rain';
import { Clock } from './Clock';
export interface RoomProps {
 monitor: ReactNode; controls?: ReactNode; powered: boolean; turbo: boolean; lamp: boolean; leaned: boolean; reduced: boolean;
 modemVolume: number; musicVolume: number; onMusicVolume:(v:number)=>void; getState:()=>string;
 onPcPower:()=>void; onTurbo:()=>void; onLamp:()=>void; onModemVolume:(v:number)=>void; onLean:(v:boolean)=>void; children?:ReactNode;
}
export const NOTE = ['PWR ON.','ENTER = dial.','login: GUEST','ENTER skips anything.','I = who made it.','Then kill the lamp.'];
export function Room(p: RoomProps) {
 const root=useRef<HTMLElement>(null),stage=useRef<HTMLDivElement>(null);
 const settle=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [ready,setReady]=useState(false),[note,setNote]=useState<0|1|2>(0),[attract,setAttract]=useState(false);
 const [large,setLarge]=useState(false);
 useRoomLive({root,getState:p.getState,reduced:p.reduced,lamp:p.lamp});
 const place=useCallback(()=>{ const st=stage.current,el=root.current;if(!st||!el)return;const safeTop=parseFloat(getComputedStyle(el).paddingTop)||0,available=window.visualViewport?.height??window.innerHeight;const c=camera(window.innerWidth,window.innerHeight,p.leaned,safeTop,available);el.style.setProperty('--desk-top',`${c.y+1440*c.scale-24}px`);el.style.setProperty('--stage-width',`${2560*c.scale}px`);el.style.setProperty('--stage-left',`${c.x}px`);el.style.setProperty('--usable-height',`${available}px`);st.dataset.moving="true";st.style.transform=`translate3d(${c.x}px,${c.y}px,0) scale(${c.scale})`;if(settle.current)clearTimeout(settle.current);settle.current=setTimeout(()=>{st.dataset.moving="false";},450); },[p.leaned]);
 useLayoutEffect(place,[place]);
 useEffect(()=>{window.addEventListener('resize',place);window.visualViewport?.addEventListener('resize',place);return()=>{window.removeEventListener('resize',place);window.visualViewport?.removeEventListener('resize',place);};},[place]);
 useEffect(()=>{let active=true; const size=window.innerWidth*window.devicePixelRatio>1280?1:0;setLarge(size===1);
 Promise.all([plates.on[size],plates.off[size]].map(async src=>{const image=new Image();image.src=src;await image.decode();})).then(()=>{if(active){setReady(true);document.getElementById('boot-splash')?.remove();}}).catch(()=>{if(active)setReady(true);});return()=>{active=false;};},[]);
 useEffect(()=>{const t=setTimeout(()=>setAttract(true),6000);const stop=()=>{clearTimeout(t);setAttract(false);}; window.addEventListener('pointerdown',stop,{once:true});window.addEventListener('keydown',stop,{once:true});window.addEventListener('wheel',stop,{once:true});return()=>{stop();window.removeEventListener('pointerdown',stop);window.removeEventListener('keydown',stop);window.removeEventListener('wheel',stop);};},[]);
 useEffect(()=>{const r=root.current;if(!r)return;let distance=0;
 const wheel=(e:WheelEvent)=>{if((e.target as HTMLElement).closest('.knob,.hatch,.ctxbar')||Math.abs(e.deltaY)<8)return;e.preventDefault();p.onLean(e.deltaY<0);};
 const dist=(e:TouchEvent)=>e.touches.length===2?Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY):0;
 const start=(e:TouchEvent)=>{distance=dist(e);};const move=(e:TouchEvent)=>{const d=dist(e);if(d&&distance&&d<distance*.85){e.preventDefault();p.onLean(false);distance=0;}};
 r.addEventListener('wheel',wheel,{passive:false});r.addEventListener('touchstart',start,{passive:true});r.addEventListener('touchmove',move,{passive:false});return()=>{r.removeEventListener('wheel',wheel);r.removeEventListener('touchstart',start);r.removeEventListener('touchmove',move);};},[p.onLean]);
 const hotspot=(name:keyof typeof HOTSPOTS,label:string,action:()=>void,extra='')=><Button key={name} variant="ghost" tabIndex={-1} data-touch aria-label={label} className={`plate-hotspot ${extra}`} style={fractionStyle(HOTSPOTS[name])} onPointerDown={e=>e.preventDefault()} onClick={action}/>;
 const volume=(name:'modem'|'speaker',value:number,set:(v:number)=>void)=><PlateVolume key={name} name={name} value={value} onChange={set}/>;
 return <main ref={root} className={`room photo-room ${ready?'plates-ready':''} ${p.lamp?'lamp-on':''} ${p.leaned?'leaned':''} ${p.reduced?'reduce':''} ${attract?'arrival-attract':''}`} onClick={e=>{if(!(e.target as HTMLElement).closest('[data-touch],.monitor-screen,.hatch,.ctxbar,.note-closeup')&&p.leaned)p.onLean(false);}}>
 <h1 className="sr-only">Dial-Up: DEAD CARRIER in a photographic basement</h1>
 <svg className="room-light-filter" aria-hidden><defs><filter id="room-light-tint" colorInterpolationFilters="sRGB"><feColorMatrix data-room-light type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"/></filter></defs></svg>
 <div className="desk-extension" aria-hidden><div className="desk-crop"><img className="desk-off" src={plates.off[large?1:0]} alt=""/><img className="desk-on" src={plates.on[large?1:0]} alt=""/><img className="desk-light" src={plates.light[large?1:0]} alt=""/></div></div>
 <div ref={stage} className="plate-stage">
 <img className="room-plate plate-off" src={plates.off[0]} srcSet={plateSet(plates.off)} sizes="100vw" fetchPriority="high" alt="" draggable={false}/>
 <img className="room-plate plate-on" src={plates.on[0]} srcSet={plateSet(plates.on)} sizes="100vw" fetchPriority="high" alt="" draggable={false}/>
 <img className="room-plate plate-screen-light" src={plates.light[large?1:0]} alt="" aria-hidden/>
 <div className="plate-glass" style={{...fractionStyle(GLASS),maskImage:`url(${plates.mask})`}} onClick={()=>p.onLean(true)}>{p.monitor}<img className="plate-reflection" src={plates.reflection} alt="" draggable={false}/></div>
 {p.controls}
 {hotspot('lamp','Desk lamp',p.onLamp)}
 {hotspot('sticky_note','Sticky note',()=>setNote(1))}
 {hotspot('cork_note','Pinned paper',()=>setNote(2),'secret-paper')}
 {hotspot('pc_buttons',p.powered?'PC power off':'PC power on',p.onPcPower)}
 <Button variant="ghost" tabIndex={-1} data-touch aria-label="Turbo button" aria-pressed={p.turbo} className="plate-hotspot" style={fractionStyle([.699,.8125,.014,.0347])} onClick={p.onTurbo}/>
 {hotspot('keyboard',p.leaned?'Lean back':'Keyboard',()=>p.onLean(!p.leaned))}
 {volume('modem',p.modemVolume,p.onModemVolume)}{volume('speaker',p.musicVolume,p.onMusicVolume)}
 <div className="plate-note-writing" style={fractionStyle(HOTSPOTS.sticky_note)} aria-hidden>{NOTE.map(line=><p key={line}>{line}</p>)}</div>
 <div className="plate-rain" style={fractionStyle(HOTSPOTS.window)}><Rain still={p.reduced}/></div>
 <Clock reduced={p.reduced}/>
 <span className={`plate-led pc-power ${p.powered?'is-on':'is-standby'}`} style={{left:'68.1%',top:'77.6%'}}/>
 <span className="plate-led drive-light" data-led="hdd" style={{left:'69.3%',top:'77.6%'}}/>
 <span className="plate-led monitor-light" data-led="monitor" style={{left:'61.5%',top:'61.3%'}}/>
 {['MR','OH','CD','RD','SD','HS','TR','AA'].map((led,i)=><span key={led} data-led={led} className="plate-led modem-light" style={{left:`${87.3+i*1.43}%`,top:'81.5%'}}/>)}
 </div>
 {!ready&&<div className="plate-loading" aria-label="Loading room" role="status">DIAL-UP <span>█</span></div>}
 {note!==0&&<div className="note-closeup" data-touch onClick={()=>setNote(0)}><div className="paper-enlarged" style={{'--paper-light':p.lamp?1:.025} as React.CSSProperties}>{(note===1?NOTE:['call 555-0113']).map(line=><p key={line}>{line}</p>)}</div></div>}
 <Button variant="ghost" className="desk-note" data-touch aria-label="Read sticky note" onClick={()=>setNote(1)}>▤</Button>
 {p.children}
 </main>;
}
function PlateVolume({name,value,onChange}:{name:'modem'|'speaker';value:number;onChange:(v:number)=>void}){
 const drag=useRef<{y:number,v:number}|null>(null),ref=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const el=ref.current;if(!el)return;const wheel=(e:WheelEvent)=>{e.preventDefault();e.stopPropagation();onChange(Math.max(0,Math.min(1,value-e.deltaY*.001)));};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[value,onChange]);
 return <Button ref={ref} variant="ghost" tabIndex={-1} data-touch aria-label={name==='modem'?'Modem volume knob':'Music volume knob'} className="plate-hotspot knob" style={fractionStyle(HOTSPOTS[name])} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={y:e.clientY,v:value};audio.unlock();}} onPointerMove={e=>{if(drag.current)onChange(Math.max(0,Math.min(1,drag.current.v+(drag.current.y-e.clientY)/120)));}} onPointerUp={()=>{drag.current=null;}}/>;
}
