import {describe,it,expect} from 'vitest';
import {GLASS,pixelBox,pictureBox,lampEase,screenLightOpacity,camera} from '@/components/room/plate-layout';
describe('Sprint B photographic plate rules',()=>{
 for(const [w,h] of [[2560,1440],[1280,720],[3840,2160]]) {
  it(`glass fractions map to registered pixels at ${w}`,()=>{const b=pixelBox(GLASS,w,h);expect(b.x).toBeCloseTo(857*w/2560);expect(b.y).toBeCloseTo(228*h/1440);expect(b.w).toBeCloseTo(800*w/2560);expect(b.h).toBeCloseTo(573*h/1440);});
 }
 it('lamp easing stays within 0..1.05 throughout toggles',()=>{for(const from of [0,.3,1,1.05])for(const on of [false,true])for(let t=0;t<400;t++){const level=lampEase(from,on,t);expect(level).toBeGreaterThanOrEqual(0);expect(level).toBeLessThanOrEqual(1.05);}});
 it('lamp reaches on at 180ms and off at 120ms',()=>{expect(lampEase(0,true,180)).toBeCloseTo(1);expect(lampEase(1,false,120)).toBe(0);});
 it('screen light is zero with monitor off even on a white screen',()=>{expect(screenLightOpacity(false,1,0)).toBe(0);expect(screenLightOpacity(false,1,1)).toBe(0);});
 it('white screen follows full light pass and lamp-on scales to 60 percent',()=>{expect(screenLightOpacity(true,1,0)).toBe(1);expect(screenLightOpacity(true,1,1)).toBeCloseTo(.6);expect(screenLightOpacity(true,0,0)).toBe(0);});
 for(const [w,h] of [[360,740],[390,844],[768,1024],[1024,768],[1366,768],[1440,900],[1920,1080],[2560,1440],[3840,2160]])it(`CRT is 4:3 inside the glass at ${w}x${h}`,()=>{for(const lean of [false,true]){const c=camera(w,h,lean),b=pixelBox(GLASS,2560*c.scale,1440*c.scale),p=pictureBox(2560*c.scale,1440*c.scale);expect(p.w/p.h).toBeCloseTo(4/3);expect(p.x).toBeGreaterThanOrEqual(b.x);expect(p.x+p.w).toBeLessThanOrEqual(b.x+b.w+.001);expect(p.h).toBeCloseTo(b.h);}});
});
