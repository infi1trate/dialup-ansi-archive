import {describe,it,expect,vi} from 'vitest';
import {Machine} from '@/machine/machine';
import {Terminal} from '@/term/terminal';
import {GLASS,HOTSPOTS,pixelBox,pictureBox,lampEase,screenLightOpacity,screenLight,clockDigits,camera} from '@/components/room/plate-layout';
describe('Sprint B photographic plate rules',()=>{
 for(const [w,h] of [[2560,1440],[1280,720],[3840,2160]]) {
  it(`glass fractions map to registered pixels at ${w}`,()=>{const b=pixelBox(GLASS,w,h);expect(b.x).toBeCloseTo(857*w/2560);expect(b.y).toBeCloseTo(228*h/1440);expect(b.w).toBeCloseTo(800*w/2560);expect(b.h).toBeCloseTo(573*h/1440);});
 }
 it('lamp easing stays within 0..1.05 throughout toggles',()=>{for(const from of [0,.3,1,1.05])for(const on of [false,true])for(let t=0;t<400;t++){const level=lampEase(from,on,t);expect(level).toBeGreaterThanOrEqual(0);expect(level).toBeLessThanOrEqual(1.05);}});
 it('lamp reaches on at 180ms and off at 120ms',()=>{expect(lampEase(0,true,180)).toBeCloseTo(1);expect(lampEase(1,false,120)).toBe(0);});
 it('screen light is zero with monitor off even on a white screen',()=>{expect(screenLightOpacity(false,1,0)).toBe(0);expect(screenLightOpacity(false,1,1)).toBe(0);});
 it('white screen follows full light pass and lamp-on scales to 60 percent',()=>{expect(screenLightOpacity(true,1,0)).toBe(1);expect(screenLightOpacity(true,1,1)).toBeCloseTo(.6);expect(screenLightOpacity(true,0,0)).toBe(0);});
 it('luminance gain uses 2.2, reaches .45 and .8, and caps at one',()=>{expect(screenLightOpacity(true,.45/2.2,0)).toBeCloseTo(.45);expect(screenLightOpacity(true,.8/2.2,0)).toBeCloseTo(.8);expect(screenLightOpacity(true,1,0)).toBe(1);});
 it('tint normalises the brightest channel and black adds no light',()=>{expect(screenLight([128,64,32],true,0).tint).toEqual([1,.5,.25]);expect(screenLight([0,0,0],true,0)).toEqual({gain:0,tint:[0,0,0]});expect(screenLight([255,0,0],true,0).tint).toEqual([1,0,0]);});
 it.each([[390,844],[768,1024]])('portrait bezel has exactly 8px margins at %sx%s', (w,h)=>{const c=camera(w,h,false,12),b=pixelBox(HOTSPOTS.monitor,2560*c.scale,1440*c.scale);expect(b.x+c.x).toBeCloseTo(8);expect(b.w).toBeCloseTo(w-16);expect(b.y+c.y).toBeCloseTo(12);});
 it('software keyboard viewport keeps whole bezel above controls',()=>{const c=camera(390,844,false,12,440),b=pixelBox(HOTSPOTS.monitor,2560*c.scale,1440*c.scale);expect(b.y+c.y).toBeCloseTo(12);expect(b.y+c.y+b.h).toBeLessThanOrEqual(250);});
 it('clock uses 12-hour local time with blank leading digit and midnight 12',()=>{expect(clockDigits(new Date(2026,10,19,3,7))).toBe(' 307');expect(clockDigits(new Date(2026,10,19,15,41))).toBe(' 341');expect(clockDigits(new Date(2026,10,19,0,9))).toBe('1209');});
 it('portrait notice waits 3000ms once before art and never remains over it',async()=>{const m=Object.create(Machine.prototype) as any;let release:()=>void=()=>{};m.engine={term:new Terminal()};m.portrait=true;m.portraitNoticeShown=false;m.boardOverlay=null;m.keys={clear:vi.fn(),nextOr:vi.fn((p:Promise<void>)=>p)};m.sleep=vi.fn((ms:number)=>{expect(ms).toBe(3000);return new Promise<void>(resolve=>{release=resolve;});});const waiting=m.openArt(true);expect(m.engine.term.overlay).not.toBeNull();release();await waiting;expect(m.engine.term.overlay).toBeNull();await m.openArt(true);expect(m.sleep).toHaveBeenCalledTimes(1);});
 for(const [w,h] of [[360,740],[390,844],[768,1024],[1024,768],[1366,768],[1440,900],[1920,1080],[2560,1440],[3840,2160]])it(`CRT is 4:3 inside the glass at ${w}x${h}`,()=>{for(const lean of [false,true]){const c=camera(w,h,lean),b=pixelBox(GLASS,2560*c.scale,1440*c.scale),p=pictureBox(2560*c.scale,1440*c.scale);expect(p.w/p.h).toBeCloseTo(4/3);expect(p.x).toBeGreaterThanOrEqual(b.x);expect(p.x+p.w).toBeLessThanOrEqual(b.x+b.w+.001);expect(p.h).toBeCloseTo(b.h);}});
});
