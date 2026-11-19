import {it,expect,vi} from 'vitest';
import {scanPreview,scanCaption} from '@/bbs/quick-scan';
import {a} from '@/bbs/ansi';
import {Terminal} from '@/term/terminal';
it('three contact-sheet pieces retain ordered captions and original attributes',()=>{
 const t=new Terminal();t.feed(a().cls().build());
 for(let i=0;i<3;i++){
  const stream=a().c(12,4);for(let r=0;r<9;r++)stream.at(r+1,1).t(`PIECE ${i} ROW ${r}`);
  const start=i===0?1:11;if(i>1)t.feed(a().at(25,1).nl(10).build());
  t.feed(scanPreview({stream:stream.build(),mode:{cols:80,ice:false,ninePixel:true},sauce:null,format:'ANSI'},start).build());
  t.feed(scanCaption(`FILE${i}.ANS`,`Title ${i}`,'Artist',11,start+8).build());
 }
 const text=t.lines.map(l=>Array.from(l,c=>String.fromCharCode(c&255)).join('')).join('\n');
 expect(text.indexOf('FILE0.ANS')).toBeLessThan(text.indexOf('FILE1.ANS'));
 expect(text.indexOf('FILE1.ANS')).toBeLessThan(text.indexOf('FILE2.ANS'));
 expect(text).not.toContain('ROW 8');
 expect((t.cell(10,0)>>8)&15).toBe(12);
 expect((t.cell(10,0)>>12)&7).toBe(4);
});
it('wide art emits only the left 80 columns',()=>{
 const p={stream:a().t('A'.repeat(80)+'B'.repeat(52)).at(2,1).t('SECOND').build(),mode:{cols:132,ice:false,ninePixel:true},sauce:null,format:'ANSI'};
 const t=new Terminal();t.feed(scanPreview(p,1).build());expect(Array.from(t.lines[0],c=>c&255)).not.toContain(66);expect(t.cell(1,0)&255).toBe(83);
});it('blank leading rows are skipped and the caption names the start row',async()=>{
 const {firstVisibleRow}=await import('@/bbs/quick-scan');
 const stream=a().cls().at(14,5).c(14,0).t('HELLO').at(15,5).t('WORLD').build();
 const p={stream,mode:{cols:80,ice:false,ninePixel:true},sauce:null,format:'ANSI'} as any;
 const from=firstVisibleRow(p);expect(from).toBe(13);
 const t=new Terminal();t.feed(scanPreview(p,1,from).build());expect(t.cell(0,4)&255).toBe(72);
 t.feed(scanCaption('1991.ANS','t','x',11,9,from).build());
 expect(Array.from(t.lines[8],c=>String.fromCharCode(c&255)).join('')).toContain('from row 14');
});
