import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {measure} from './metrics';
const root='/tmp/dialup-audit/';
const m=JSON.parse(readFileSync(root+'manifest.json','utf8'));
let old:any[]=[];if(existsSync(root+'before.json'))old=JSON.parse(readFileSync(root+'before.json','utf8'));
for(const f of m)if(!old.some(o=>o.local===f.local)) old.push({...f,meta:undefined,...measure(f.file,new Uint8Array(readFileSync(root+f.local)),true)});
writeFileSync(root+'before.json',JSON.stringify(old,null,2));console.log('baseline',old.length);
