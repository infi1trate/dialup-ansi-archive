import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {measure} from './metrics';
import {prepareArt} from '../../src/term/prepare';
import {Terminal} from '../../src/term/terminal';
import {rasterize} from '../../src/term/raster';
const root='/tmp/dialup-audit/';mkdirSync(root+'renders',{recursive:true});
const manifest=JSON.parse(readFileSync(root+'manifest.json','utf8'));
const after=manifest.map((f:any)=>{const bytes=new Uint8Array(readFileSync(root+f.local));const m=measure(f.file,bytes);return {...f,meta:undefined,...m};});
writeFileSync(root+'after.json',JSON.stringify(after,null,2));
const before=JSON.parse(readFileSync(root+'before.json','utf8'));
for(const f of after.filter((f:any)=>before.find((b:any)=>b.local===f.local)?.causes.length).slice(0,60)){
 try{const p=prepareArt(f.file,new Uint8Array(readFileSync(root+f.local)));const t=new Terminal(p.mode);t.feed(p.stream);const r=rasterize(t,t.lines.length);writeFileSync(root+'renders/'+f.local+'.ppm',Buffer.concat([Buffer.from(`P6\n${r.fw} ${r.fh}\n255\n`),Buffer.from(r.fb)]));}catch{}
}
console.log('after',after.length);
