/** Original sixteen-bar two-voice score; eight eighth-notes per bar at 125 BPM. */
export const INTRO_BARS=16;
export const INTRO_STEP=.24;
const roots=[45,45,48,48,43,43,40,40,45,48,50,50,43,40,45,52];
const lead=[0,7,12,10,7,3,7,12];
export function introNote(step:number){const bar=Math.floor(step/8)%INTRO_BARS,beat=step%8,root=roots[bar];return {bass:root+(beat%4===2?12:0),lead:root+12+lead[(beat+bar)%8]};}
export const noteFrequency=(midi:number)=>440*2**((midi-69)/12);