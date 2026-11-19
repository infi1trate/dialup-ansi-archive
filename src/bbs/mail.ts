import {a,pad} from './ansi';
import type {Board} from './board';
import {CONFIGS} from './config';
import {net} from '@/data/net';
export async function mailbox(b:Board){
 if(b.guest){b.send(b.header(a(),'Mail').at(8,5).k(15,'GUEST has no mailbox. Apply for a handle to keep mail.'));await b.anyKey(22);return;}
 for(;;){const r=await net('mail');const rows=r?.rows??[];b.mailWaiting=r?.unread??0;const x=b.header(a(),'Your mailbox',`${b.mailWaiting} unread`);b.send(x);
   if(!rows.length){b.send(a().at(8,5).k(15,'No mail delivered. Pending notes arrive on a later call.'));await b.anyKey(22);return;}
   const pick=await b.lightbar({row:5,col:4,width:72,height:15,items:rows.map((r:any)=>({text:`${r.read_at?' ':'*'} ${pad(String(r.id),5)}${pad((CONFIGS[r.board]??CONFIGS.crawl).sysop,16)}${r.subject}`,color:b.sk.a}))});if(!pick)return;
   const result=await net('mailRead',{id:rows[pick.index].id});const msg=result?.message;if(!msg)continue;
   const cfg=CONFIGS[msg.board]??CONFIGS.crawl,date=new Date(msg.created_at);const header=[`From: ${cfg.sysop}`,`Board: ${cfg.name}`,`Date: ${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}-1993`,`Subject: ${msg.subject}`];
   const lines=[...header,'',...msg.body.split('\n').flatMap((line:string)=>wrap(line))];
   for(let start=0;start<lines.length;start+=16){const y=b.header(a(),'Private mail');lines.slice(start,start+16).forEach((l:string,i:number)=>y.at(5+i,5).k(i<4?(b.ioEntryId()==='maple'?14:b.sk.a):15,pad(l,70),b.ioEntryId()==='maple'?1:0));b.send(y);await b.anyKey(22);}
 }
}
function wrap(line:string){if(!line)return [''];const out:string[]=[];let s='';for(const w of line.split(' ')){if((s+' '+w).trim().length>70){out.push(s);s=w;}else s=(s+' '+w).trim();}out.push(s);return out;}