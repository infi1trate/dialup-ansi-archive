import {a,pad} from './ansi';
import type {Board} from './board';
import {CONFIGS} from './config';
import {net} from '@/data/net';
import {ustyle,panel,write} from './utility-chrome';
export async function mailbox(b:Board){
 if(b.guest){b.send(b.header(a(),'Mail').at(8,5).k(15,'GUEST has no mailbox. Apply for a handle to keep mail.'));await b.anyKey(22);return;}
 for(;;){const r=await net('mail');const rows=r?.rows??[];b.mailWaiting=r?.unread??0;const st=ustyle(b.ioEntryId(),b.sk.a);const x=b.header(a(),'Your mailbox',`${b.mailWaiting} unread`);panel(x,st,5,3,75,17,`${rows.length} letters / ${b.mailWaiting} unread`);write(x,st,6,5,st.dim,'  #    From            Subject',70);write(x,st,21,5,st.dim,'ENTER reads / ESC returns',70);b.send(x);
   if(!rows.length){b.send(a().at(8,5).k(15,'No mail delivered. Pending notes arrive on a later call.'));await b.anyKey(22);return;}
   const pick=await b.lightbar({row:7,col:5,width:71,height:13,items:rows.map((r:any)=>({text:`${r.read_at?' ':'*'} ${pad(String(r.id),5)}${pad((CONFIGS[r.board]??CONFIGS.crawl).sysop,16)}${r.subject}`,color:b.sk.a}))});if(!pick)return;
   const result=await net('mailRead',{id:rows[pick.index].id});const msg=result?.message;if(!msg)continue;
   const cfg=CONFIGS[msg.board]??CONFIGS.crawl,date=new Date(msg.created_at);const header=[`From: ${cfg.sysop}`,`Board: ${cfg.name}`,`Date: ${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}-1993`,`Subject: ${msg.subject}`];
      // Letter layout: header block, ruled body, signature.
   const body=msg.body.replace(/\s+$/,'').split('\n').flatMap((line:string)=>wrap(line)),sig=/^-- /.test(body[body.length-1]??'')?body.pop():'';while(body.length&&!body[body.length-1].trim())body.pop();const per=7,pages=Math.max(1,Math.ceil(body.length/per));
   for(let p=0;p<pages;p++){const y=b.header(a(),'Private mail',pages>1?`page ${p+1}/${pages}`:'');panel(y,st,5,3,75,6,'LETTER');header.forEach((l,i)=>write(y,st,6+i,6,i===3?st.text:st.accent,l,68));
     const rule=st.id==='c93'?'-'.repeat(73):st.id==='vault'?'▀'.repeat(73):'─'.repeat(73);y.at(11,4).k(st.dim,rule,st.bg);
     body.slice(p*per,p*per+per).forEach((l:string,i:number)=>write(y,st,12+i,6,15,l,70));
     if(p===pages-1){y.at(19,4).k(st.dim,rule,st.bg);if(sig)write(y,st,20,44,st.accent,sig.slice(0,33),33);}
     b.send(y);await b.anyKey(22);}
 }
}
function wrap(line:string){if(!line)return [''];const out:string[]=[];let s='';for(const w of line.split(' ')){if((s+' '+w).trim().length>70){out.push(s);s=w;}else s=(s+' '+w).trim();}out.push(s);return out;}