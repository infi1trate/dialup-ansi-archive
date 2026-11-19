import { Terminal } from '../../src/term/terminal';
import { parseSauce } from '../../src/term/sauce';
import { prepareArt } from '../../src/term/prepare';
export function measure(name:string, bytes:Uint8Array, baseline=false) {
 const sauce=parseSauce(bytes).sauce;
 let prep;
 try { prep=prepareArt(name,bytes); } catch(e) { return {causes:['unsupported'],error:String(e)}; }
 const t=new Terminal(prep.mode);t.feed(prep.stream);
 const used=t.lines.filter(l=>Array.from(l).some(v=>(v&255)!==32&&(v&255)!==0));
 const all=used.flatMap(l=>Array.from(l).map(v=>v&255));const freq=new Map<number,number>();all.forEach(v=>freq.set(v,(freq.get(v)||0)+1));
 const text=String.fromCharCode(...all.slice(0,100000));
 const causes:string[]=[];
 if(t.stats.unknown)causes.push('unknown');
 if(sauce?.tInfo2 && Math.abs(used.length-sauce.tInfo2)>Math.max(8,sauce.tInfo2*.3))causes.push('rows');
 if(used.length>10 && used.filter(l=>(l[l.length-1]&255)!==32).length/used.length>.75 && !sauce?.tInfo1)causes.push('margin');
 if(!all.length || all.filter(v=>v!==32&&v!==0).length/all.length<.01)causes.push('blank');
 const dominant=Math.max(0,...Array.from(freq.entries()).filter(([v])=>v!==32&&v!==0).map(([,n])=>n));
 if(all.length && dominant/all.length>.9)causes.push('one-glyph');
 if(/@X[0-9a-f]{2}|@\w{2,}@|\|\d{2}/i.test(text))causes.push('color-codes');
 if(/^!\|/.test(text))causes.push('RIP');
 if(Array.from(prep.stream).filter(v=>v<32 && ![7,8,9,10,13,26,27].includes(v)).length/Math.max(1,prep.stream.length)>.1 && prep.format==='ANSI')causes.push('binary');
 if(prep.stream.includes(22)&&prep.format==='ANSI'&&!bytes.includes(27))causes.push('Avatar');
 if(sauce?.tInfoS && !/^(IBM VGA|IBM VGA 437|IBM VGA 8x16)$/i.test(sauce.tInfoS) && !prep.mode.font)causes.push('font');
 return {causes,unknown:t.stats.unknown,unknownList:t.stats.unknownList,rows:used.length,sauceRows:sauce?.tInfo2,cols:t.cols,font:sauce?.tInfoS,format:prep.format};
}
