// Every box is in locked-camera plate fractions, never viewport coordinates.
export type Box = readonly [number, number, number, number];
export const GLASS: Box = [857 / 2560, 228 / 1440, 800 / 2560, 573 / 1440];
export const HOTSPOTS = {
  lamp: [0, .213, .1927, .2847], monitor: [.2799,.081,.4193,.5833],
  sticky_note: [.6602,.2083,.0573,.1273], monitor_knobs: [.5573,.5972,.0573,.0417],
  monitor_power: [.6263,.5926,.0326,.0417], pc_buttons: [.6719,.8125,.0391,.0347],
  floppy: [.3607,.7569,.1237,.0718], drive_door: [.4948,.7407,.1693,.1042],
  pc_led: [.6745,.7523,.0352,.0463], speaker: [.7161,.5787,.0846,.2662],
  modem: [.8047,.7292,.1784,.1227], modem_leds: [.8464,.8009,.1237,.0301],
  keyboard: [.1693,.8981,.6641,.1019], window: [0,0,.1432,.1736],
  cork_note: [.947,.447,.042,.096], alarm_clock: [0,.713,.1354,.1319],
} satisfies Record<string, Box>;
export const fractionStyle = ([x,y,w,h]: Box) => ({ left: `${x*100}%`, top: `${y*100}%`, width: `${w*100}%`, height: `${h*100}%` });
export const pixelBox = ([x,y,w,h]: Box, width: number, height: number) => ({x:x*width,y:y*height,w:w*width,h:h*height});
export function pictureBox(width: number, height: number) {
  const glass = pixelBox(GLASS,width,height), w=glass.h*4/3;
  return {x:glass.x+(glass.w-w)/2,y:glass.y,w,h:glass.h};
}
export function camera(width: number, height: number, leaned: boolean, safeTop=0, availableHeight=height) {
  const portrait = height > width, phoneLandscape = !portrait && height < 540;
  let scale = Math.max(width/2560,height/1440);
  if (portrait) scale = Math.min((width-16)/(HOTSPOTS.monitor[2]*2560), (availableHeight-safeTop-190)/(HOTSPOTS.monitor[3]*1440));
  if (phoneLandscape) scale = height*.92/(HOTSPOTS.monitor[3]*1440);
  if (leaned && !portrait) scale = Math.min(height*.92/(HOTSPOTS.monitor[3]*1440),width*.96/(HOTSPOTS.monitor[2]*2560));
  const cx=(GLASS[0]+GLASS[2]/2)*2560, cy=(GLASS[1]+GLASS[3]/2)*1440;
  // Desktop retains the entire registered 16:9 photo when the viewport is 16:9.
  const x = portrait ? width/2-(HOTSPOTS.monitor[0]+HOTSPOTS.monitor[2]/2)*2560*scale : Math.min(0,Math.max(width-2560*scale,width/2-cx*scale));
  const y = portrait ? safeTop-HOTSPOTS.monitor[1]*1440*scale : leaned || phoneLandscape ? height/2-cy*scale : Math.min(0,Math.max(height-1440*scale,height/2-720*scale));
  return {scale,x,y};
}
export function lampEase(from: number, on: boolean, elapsed: number) {
  const t=Math.min(1,Math.max(0,elapsed/(on?180:120)));
  const eased=1-(1-t)**3;
  return Math.max(0,Math.min(1.05,from+((on?1:0)-from)*eased+(on?.045*Math.sin(Math.PI*t):0)));
}
export function screenLightOpacity(monitor: boolean, brightness: number, lamp: number, warmup=1) {
  return monitor ? Math.max(0,Math.min(1,2.2*brightness))*Math.max(0,Math.min(1,warmup))*(1-.4*Math.min(1,lamp)) : 0;
}
export function screenLight(rgb: readonly number[], monitor: boolean, lamp: number, warmup=1, pictureBrightness=Math.max(...rgb,0)/255) {
 const max=Math.max(...rgb,0);
 const gain=screenLightOpacity(monitor,pictureBrightness,lamp,warmup);
 return {gain,tint:rgb.map(v=>max>0?v/max:0)};
}
// Digit window measured inside the original photographed alarm_clock hotspot.
export const CLOCK_DISPLAY: Box = [132/2560,1090/1440,168/2560,61/1440];
export function clockDigits(date: Date) { const hour=date.getHours()%12||12; return `${hour<10?' ':''}${hour}${String(date.getMinutes()).padStart(2,'0')}`; }