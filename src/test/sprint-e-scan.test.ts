import {it,expect} from 'vitest';
import {packInArea,newScan} from '@/server/new-scan';
import {FAMILY_SHELF} from '@/data/family-shelf';
it('scan uses the previous call snapshot, not the current logon time',async()=>{
 const times:string[]=[];const query=(table:string):any=>{const q:any={select:()=>q,eq:()=>q,gt:(_c:string,v:string)=>{times.push(v);return q;},gte:()=>q,not:()=>q,is:()=>q,maybeSingle:async()=>({data:{previous_call_at:'2026-11-17T12:00:00Z'}}),then:(resolve:any)=>resolve({data:[],count:2})};return q;};
 const r=await newScan({from:query},{id:'caller'},'crawl');expect(r.lines).toBe(2);expect(r.wall).toBe(2);expect(r.scores).toBe(4);expect(times).toEqual(Array(4).fill('2026-11-17T12:00:00Z'));
});
it('first-time GUEST scan never touches durable data',async()=>expect((await newScan({from(){throw Error('Guest persisted');}},null,'crawl')).first).toBe(true));
it('new packs honor each board area including the family allowlist',()=>{const f=FAMILY_SHELF[0];expect(packInArea('maple',{...f,year:1993})).toBe(true);expect(packInArea('maple',{pack:'not-reviewed',file:'x.ans',year:1993})).toBe(false);expect(packInArea('c93',{pack:'p',file:'x.nfo',year:1993})).toBe(true);expect(packInArea('c93',{pack:'p',file:'x.ans',year:1993})).toBe(false);expect(packInArea('crawl',{pack:'p',file:'x.ans',year:1997})).toBe(false);});