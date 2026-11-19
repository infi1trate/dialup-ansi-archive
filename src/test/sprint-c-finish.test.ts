import {it,expect,vi} from 'vitest';
import {resolvePath,directoryEntries,type DiskFile} from '@/machine/drive';
import {Board,releasedInMonth,wrapCourier} from '@/bbs/board';
import {DIRECTORY} from '@/bbs/io';
import {sprintC} from '@/server/sprint-c';
import {orderedTags} from '@/bbs/warez-catalog';
import {familyAllowed} from '@/data/family-shelf';
it('nested release directories support CD parent and isolated DIR/TYPE/run keys',()=>{
 const root='C:\\WAREZ\\EMBER';expect(resolvePath('EMBER','C:\\WAREZ')).toBe(root);expect(resolvePath('..',root)).toBe('C:\\WAREZ');expect(resolvePath('EMBER.EXE',root)).toBe(root+'\\EMBER.EXE');expect(resolvePath('FILE_ID.DIZ',root)).toBe(root+'\\FILE_ID.DIZ');
 const fs=['EMBER.EXE','EMBER.NFO','FILE_ID.DIZ'].map(name=>({name:root+'\\'+name,pack:'fiction',bytes:new Uint8Array([1])} as DiskFile));expect(directoryEntries(fs,'C:\\WAREZ').map(e=>[e.name,e.directory])).toEqual([['EMBER',true]]);expect(directoryEntries(fs,root).map(e=>e.name)).toEqual(['EMBER.EXE','EMBER.NFO','FILE_ID.DIZ']);
});
it.each(['viewer','autoQueue','quickScan','playTags','openPath','packScreen'])('club gate denies unreviewed art through %s',async method=>{
 const entry=DIRECTORY.find(d=>d.id==='maple');const send=vi.fn(),setMode=vi.fn();const b=new Board({entry,profile:{filesSeen:[]},client:{setMode,overlay:vi.fn()},send,clearOutput:vi.fn(),node:1} as any);b.errorScreen=vi.fn(async()=>{});b.clubRefusal=vi.fn(async()=>{});b.tagged.add('unreviewed/X.ANS');const pack={name:'unreviewed',year:1993,files:[{name:'X.ANS',viewable:true}],groups:[]};
 if(method==='viewer')await b.viewer(pack as any,pack.files as any,0);else if(method==='autoQueue'||method==='quickScan')await b[method](pack as any,pack.files as any);else if(method==='playTags')await b.playTags();else if(method==='openPath')await b.openPath('unreviewed/X.ANS');else await b.packScreen(pack as any,'X.ANS');expect(send).not.toHaveBeenCalled();expect(familyAllowed('unreviewed','X.ANS')).toBe(false);
});
it('trainer grants exactly one extra attempt per day, duplicate cannot grant another',async()=>{
 const keys=new Set<string>();const s={from:()=>({insert:async(row:any)=>{const k=row.viewer+row.day;if(keys.has(k))return {error:{code:'23505'}};keys.add(k);expect(row.turns).toBe(1);return {error:null};}})};
 expect(await sprintC({action:'trainer'},s,{id:'test'},'')).toEqual({ok:true,extra:1});expect(await sprintC({action:'trainer'},s,{id:'test'},'')).toEqual({ok:false,already:true});expect(keys.size).toBe(1);
});
it('0-day matches month across 1990-1996, explicit dates override names',()=>{expect(releasedInMonth({name:'x1193',year:1993,groups:[]},11)).toBe(true);expect(releasedInMonth({name:'x1193',year:1993,groups:[],released:'1993-10-01'},11)).toBe(false);expect(releasedInMonth({name:'x1126',year:2026,groups:[]},11)).toBe(false);});
it('courier wraps complete words under 70 columns',()=>{const t='A disk in a lunch tin. '.repeat(8).trim();const lines=wrapCourier(t);expect(lines.every(l=>l.length<=70)).toBe(true);expect(lines.join(' ')).toBe(t);});

it('tag queue across packs has stable pack/file order, independent of tag timing',()=>expect(orderedTags(new Set(['z/B.ANS','a/C.ANS','a/A.ANS']))).toEqual(['a/A.ANS','a/C.ANS','z/B.ANS']));
