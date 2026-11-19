import {it,expect,vi} from 'vitest';
import {cracktroFrame,INTRO_GREETS} from '@/machine/cracktro';
import {introNote,INTRO_BARS} from '@/audio/intro-score';
import {runRelease} from '@/machine/releases';
import {audio} from '@/audio/bus';
import {Terminal} from '@/term/terminal';
it('both intros fit 25 rows with six-row logos, twelve effect rows and long greets',()=>{
 expect(INTRO_GREETS.length).toBeGreaterThanOrEqual(240);
 for(const id of ['EMBER','CHROMA']){const t=new Terminal();t.feed(cracktroFrame(id,0).build());expect(t.scrollbackLines).toBe(0);for(let r=0;r<6;r++)expect(Array.from(t.lines[r],c=>c&255).filter(c=>c===219).length).toBeGreaterThan(5);expect(Array.from(t.lines[18],c=>c&255).filter(c=>c!==32).length).toBeGreaterThan(40);}
});
it('score has sixteen bars, separate bass and lead, and loops',()=>{expect(INTRO_BARS).toBe(16);expect(introNote(0).bass).not.toBe(introNote(0).lead);expect(introNote(128)).toEqual(introNote(0));});
it('any key stops intro music and restores previous mode',async()=>{const events:boolean[]=[];const off=audio.on('introMusic',v=>events.push(v));const restore=vi.fn();await runRelease({out:()=>{},nextOr:async()=>({key:'x',ch:120,ctrl:false,alt:false}),reduced:()=>true,preserveMode:()=>restore},'EMBER');expect(events).toEqual([true,false]);expect(restore).toHaveBeenCalledOnce();off();});
it('every program returns to a cleared 80x25 screen with the mode restored once',async()=>{for(const id of ['COILS','TOUCHBOX','DRIFTER']){const outs:string[]=[];const restore=vi.fn();await runRelease({out:x=>outs.push(new TextDecoder('latin1').decode(x.build())),nextOr:async()=>({key:'Escape',ch:27,ctrl:false,alt:false}),reduced:()=>true,preserveMode:()=>restore},id);expect(outs.at(-1)).toContain('\x1b[2J');expect(restore).toHaveBeenCalledOnce();}});
