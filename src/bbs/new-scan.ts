import {a,pad} from './ansi';
import type {Board} from './board';
import {net} from '@/data/net';
import {wall} from './wall';
export async function callScan(b:Board){
  const r=await net('newScan',{guest:b.guest,board:b.ioEntryId()});
  const x=b.header(a(),'New since your last call');
  const bg=b.ioEntryId()==='maple'?1:0,accent=bg?14:b.sk.a;
  if(!r||r.error){x.at(7,5).k(accent,'Message base offline. Your usual shelves are still open.',bg);b.send(x);await b.anyKey(22);return;}
  b.mailWaiting=r.mail;
  const total=r.lines+r.wall+r.scores+r.mail+r.packs.length;
  const voices:Record<string,string>={crawl:'Static counted what you missed. No excuses.',vault:'Halftone / new cells in the showroom',c93:'exchange delta / previous connection',maple:'Mr. Hutchins: here is the news since your visit.',strobe:'Kickdrum / fresh signals since your last set'};
  x.at(5,5).k(accent,pad(voices[b.ioEntryId()]??'New traffic on the line.',70),bg);
  if(!total){x.at(8,5).k(15,r.first?'First call. Welcome in; the menu is ready.':'Nothing new since your last call.',bg);b.send(x);b.hint([{key:'Enter',label:'CONTINUE'}]);await b.ioTimeout(1500);b.clearPending();return;}
  const lines=[`O  Oneliners             ${r.lines}`,`W  THE WALL messages     ${r.wall}`,`D  Door scores           ${r.scores}`,`M  New mail              ${r.mail}`,`P  Packs new to you      ${r.packs.length}`];
  lines.forEach((l,i)=>x.at(7+i*2,5).k(i%2?accent:15,pad(l,70),bg));
  x.at(21,5).k(accent,'O oneliners / W wall / D scores / M mail / P packs',bg);x.at(22,5).k(7,'ENTER continues to the menu',bg);b.send(x);
  b.hint(['O','W','D','M','P'].map(c=>({key:c,ch:c,label:c})).concat([{key:'Enter',ch:'',label:'MENU'}]));
  const k=await b.key();b.clearPending();const c=String.fromCharCode(k.ch??0).toUpperCase();
  if(c==='O')await b.oneliners();if(c==='W')await wall(b);if(c==='D')await b.doors();
  if(c==='M')await b.mail();
  if(c==='P'){const rows=r.packs.map((pack:string)=>({pack,file:'',title:'New to you'}));await b.newPacks(rows.map((r:any)=>r.pack));}
}