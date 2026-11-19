import {it,expect} from 'vitest';
import {ACCESS,earnedLevel,nextChecklist,wallBody} from '@/lib/access';
import {maxSpeed,type Profile} from '@/machine/storage';
import {record} from '@/server/access';
const fresh={days:0,pieces:0,oneliners:0,ratings:0,finishedRuns:0};
it('VALIDATED requires two UTC days OR fifteen pieces, AND one oneliner',()=>{
  expect(earnedLevel({...fresh,days:2})).toBe('NEW USER');
  expect(earnedLevel({...fresh,days:1,pieces:14,oneliners:1})).toBe('NEW USER');
  expect(earnedLevel({...fresh,days:2,oneliners:1})).toBe('VALIDATED');
  expect(earnedLevel({...fresh,pieces:15,oneliners:1})).toBe('VALIDATED');
});
it('ELITE requires all four thresholds',()=>{const e={days:6,pieces:60,oneliners:1,ratings:3,finishedRuns:1};expect(earnedLevel(e)).toBe('ELITE');for(const k of ['days','pieces','ratings','finishedRuns'] as const)expect(earnedLevel({...e,[k]:e[k]-1})).toBe('VALIDATED');});
it('minute and speed caps are 30/9600,45/14400,60/28800',()=>{expect(ACCESS['NEW USER']).toEqual({minutes:30,speed:9600,hold:3000});expect(ACCESS.VALIDATED).toEqual({minutes:45,speed:14400,hold:2000});expect(ACCESS.ELITE).toEqual({minutes:60,speed:28800,hold:2000});});
it('GUEST record never reads or writes persistence and cannot inherit ELITE',async()=>{const db=new Proxy({},{get(){throw new Error('Guest touched database');}});expect((await record(db,null)).level).toBe('NEW USER');expect(maxSpeed({handle:null,filesSeen:Array(100).fill('p/f'),accessLevel:'ELITE'} as Profile)).toBe(9600);});
it('THE WALL accepts at most three seventy-character lines',()=>{expect(wallBody(Array(3).fill('x'.repeat(70)).join('\n'))).not.toBeNull();expect(wallBody('x'.repeat(71))).toBeNull();expect(wallBody('a\nb\nc\nd')).toBeNull();expect(wallBody('\x1b[2J')).toBeNull();});
it('progress counts retain actual values',()=>expect(nextChecklist('NEW USER',{...fresh,pieces:9})[1]).toBe('[ ] pieces viewed (OR days) 9 / 15'));