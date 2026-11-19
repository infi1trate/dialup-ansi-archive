import {net} from './net';
import type {PackInfo} from './types';
export const discovered=new Map<string,PackInfo>();
export const jukebox:{pack:string;file:string;artist:string}[]=[{pack:'mist0896',file:'FB-GK.S3M',artist:'see module credits'}];
export function indexPack(pack:PackInfo){discovered.set(pack.name,pack);for(const f of pack.files)if(/\.(mod|s3m|xm|it)$/i.test(f.name)&&!jukebox.some(t=>t.pack===pack.name&&t.file===f.name))jukebox.push({pack:pack.name,file:f.name,artist:f.artists.join(', ')});void net('index',{rows:pack.files.filter(f=>f.viewable).map(f=>({pack:pack.name,file:f.name,year:pack.year,title:f.title??'',artist:f.artists.join(', '),groups:pack.groups.join(', ')}))});}
export function guestShelf(){try{return JSON.parse(localStorage.getItem('dialup.shelf')??'[]') as {pack:string;file:string}[];}catch{return [];}}
export function toggleGuestFavorite(pack:string,file:string){let rows=guestShelf();const has=rows.some(r=>r.pack===pack&&r.file===file);rows=has?rows.filter(r=>r.pack!==pack||r.file!==file):[...rows,{pack,file}];try{localStorage.setItem('dialup.shelf',JSON.stringify(rows));}catch{}return !has;}
