import {it,expect,vi,beforeEach} from 'vitest';
import {Board} from '@/bbs/board';
import {DIRECTORY} from '@/bbs/io';
import {loadProfile} from '@/machine/storage';
import {a} from '@/bbs/ansi';
import {guestShelf} from '@/data/browsing';
import {net} from '@/data/net';
const pack={name:'real-pack',year:1994,groups:['Archive credit'],fileId:null,files:[{name:'REAL.ANS',title:'Real title',artists:['Archive artist'],size:40,viewable:true}]};
vi.mock('@/data/archive',()=>({getFile:vi.fn(async()=>a().cls().k(12,'REAL ART').build()),getPack:vi.fn(async()=>pack),fileCached:()=>true,fileTitle:()=> 'Real title',prefetchFile:()=>{},MAX_YEAR:2026}));
vi.mock('@/data/net',()=>({net:vi.fn(),newSessionId:()=> 'test',artViewed:()=>{},setLiveSession:()=>{}}));
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();});
for(const guest of [true,false])it(`${guest?'GUEST localStorage':'handle POST service'} adds, lists, opens and removes a favorite`,async()=>{
 let shelf:{pack:string;file:string}[]=[];
 vi.mocked(net).mockImplementation(async(action,body)=>{
  if(action==='favorite'){const has=shelf.length>0;shelf=has?[]:[{pack:String(body?.pack),file:String(body?.file)}];return {ok:true,favorite:!has};}
  if(action==='shelf')return {rows:shelf};return {};
 });
 const keys=['F','Escape'];const key=async()=>{const k=keys.shift()??'Escape';return {key:k,ch:k.length===1?k.charCodeAt(0):null};};
 const overlay=vi.fn();const io={entry:DIRECTORY[0],profile:loadProfile(),speed:9600,node:1,send:vi.fn(),drain:async()=>{},key,keyOrDrain:key,hint:()=>{},save:()=>{},clearOutput:()=>{},resume:()=>{},timeLeftMs:()=>3600000,client:{setMode:()=>{},overlay,artOpen:()=>{},markTop:()=>{},rows:()=>25}};
 const board=new Board(io as any);board.guest=guest;board.online=false;
 await board.viewer(pack,pack.files,0);
 expect(guest?guestShelf():shelf).toEqual([expect.objectContaining({pack:'real-pack',file:'REAL.ANS'})]);
 expect(overlay.mock.calls.some(([b])=>b&&String.fromCharCode(...b).includes('[25;1H'))).toBe(true);
 const results=vi.spyOn(board,'fileResults').mockResolvedValue();await board.shelf();
 expect(results).toHaveBeenCalledWith('Your shelf',[expect.objectContaining({file:'REAL.ANS',pack:'real-pack',title:'Real title'})]);
 const viewer=vi.spyOn(board,'viewer');keys.push('F','Escape');await board.openPath('real-pack/REAL.ANS');
 expect(viewer).toHaveBeenCalledWith(pack,pack.files,0);
 expect(guest?guestShelf():shelf).toEqual([]);
 if(!guest)expect(net).toHaveBeenCalledWith('favorite',{pack:'real-pack',file:'REAL.ANS'});
});