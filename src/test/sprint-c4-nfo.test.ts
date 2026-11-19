import {it,expect} from 'vitest';
import {RELEASES,RELEASE_GROUPS,nfoLines,NFO_LOGOS,dizBytes} from '@/bbs/warez-catalog';
import {Terminal} from '@/term/terminal';
it('all 24 fictional NFOs have period dates, group greets, six boards and 78-column lines',()=>{
 for(const r of RELEASES){const lines=nfoLines(r.id),text=lines.join('\n');expect(lines.every(l=>l.length<=78)).toBe(true);expect(text.toLowerCase()).toContain(r.title.toLowerCase());expect(text).toMatch(/199[2-4]-\d\d-\d\d/);expect(text.toLowerCase()).toContain('fiction made for this board');for(const group of RELEASE_GROUPS.filter(g=>g!==r.group))expect(text.toLowerCase()).toContain(group.toLowerCase());expect(text.match(/555-\d{4}/g)).toHaveLength(6);expect(text.indexOf('555-0142')).toBeLessThan(text.indexOf('555-0167'));}
});
it('each group has the required emblem height and exact sign-off',()=>{
 for(const [g,min,sign] of [['LATCHKEY',7,'latchkey / we were never home'],['NULL FOUNDRY',6,'CAST IN NOTHING.'],['TIN SAINTS',8,'go in peace, leech not'],['MIDNIGHT RELAY',6,'relay ends. 73.']] as const){expect(NFO_LOGOS[g].length).toBeGreaterThanOrEqual(min);expect(nfoLines(RELEASES.find(r=>r.group===g)?.id??'').join('\n')).toContain(sign);}
});
it('FILE_ID.DIZ is five plain summary lines',()=>{const t=new Terminal();t.feed(dizBytes('EMBER'));expect(t.y).toBe(4);});
