import {it,expect} from 'vitest';
import {boardLogo,drawMenu,goodbyeDesign,listChrome,CLUB_TIPS,menuPosition} from '@/bbs/designs';
import {Terminal} from '@/term/terminal';
const status={user:'Guest',node:1,credits:6,minutes:60,callers:['A','B','C'],oneliner:'Hello',zeroDay:'5',featured:'test-pack'};
it('four compositions fit 80x25; LINE NOISE teletype scrolling is intentionally exempt',()=>{for(const id of ['crawl','vault','maple','strobe'])for(const s of [boardLogo(id,id),drawMenu(id,id,Array.from({length:id==='crawl'?14:id==='maple'?9:10},(_,i)=>[String(i),'Item']),status),listChrome(id,id,'Pack list'),goodbyeDesign(id,id,'Guest','Bye')]){const t=new Terminal();t.feed(s.build());expect(t.scrollbackLines,id).toBe(0);}});
it('FULL BLOCK uses six columns and two-dimensional tile coordinates',()=>{expect(menuPosition('vault',5)).toEqual({row:10,col:68,width:12});expect(menuPosition('vault',6)).toEqual({row:15,col:3,width:12});});
it('community tips offer at least twelve choices',()=>expect(CLUB_TIPS.length).toBeGreaterThanOrEqual(12));
it('STROBE uses six rows of solid white full blocks spanning 59 columns',()=>{
  const t=new Terminal();t.feed(boardLogo('strobe','STROBE').build());
  for(let r=1;r<7;r++){
    const white=Array.from({length:80},(_,c)=>t.cell(r,c)).filter(cell=>(cell&255)===219&&((cell>>8)&15)===15);
    expect(white.length).toBeGreaterThanOrEqual(19);
  }
  expect((t.cell(1,10)>>8)&15).toBe(15);
  expect((t.cell(1,68)>>8)&15).toBe(15);
});