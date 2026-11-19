import {a,box,pad} from './ansi';
export const RELEASE_GROUPS=['LATCHKEY','NULL FOUNDRY','TIN SAINTS','MIDNIGHT RELAY'];
export const PROGRAM_IDS=['EMBER','CHROMA','DRIFTER','PATCHFOX','COILS','TOUCHBOX','NFOLOOM'];
export const RELEASES=[
 ['EMBER','Ember Array','CRACKTROS'],['CHROMA','Chroma Freight','CRACKTROS'],['DRIFTER','Drifter Saver','UTILS'],['PATCHFOX','Patchfox Trainer','UTILS'],['COILS','Coils in the Wiring','GAMEZ'],['TOUCHBOX','Touchbox Tone Bench','UTILS'],['NFOLOOM','NFO Loom','UTILS'],
 ['LEDGER','Spreadsheet of Doom','0-DAY'],['PAPERBAT','Paperbat Publisher','0-DAY'],['INKJET','Inkjet Kingdom','GAMEZ'],['MOONCART','Mooncart Rally','GAMEZ'],['DUSTWAR','Dust Ward Tactics','GAMEZ'],['PANTRY','Pantry Quest','GAMEZ'],['ROOFER','Roofline Architect','0-DAY'],['FOLDERS','Folders Forever','UTILS'],['DEFRAG','Defrag Oracle','UTILS'],['MIRROR','Mirror Clerk','UTILS'],['ZIPPER','Pocket Zipper','UTILS'],['QUARTZ','Quartz Census','0-DAY'],['SOLDER','Solder Cathedral','GAMEZ'],['RELAY','Relay Accountant','0-DAY'],['GLIDER','Glider Between Floors','GAMEZ'],['NIGHTBUS','Nightbus Dispatch','0-DAY'],['STAMP','Stamp Collector Deluxe','UTILS']
].map(([id,title,area],i)=>({id,title,area,group:RELEASE_GROUPS[i%4],cost:PROGRAM_IDS.includes(id)?3:2,runnable:PROGRAM_IDS.includes(id),version:`${1+i%3}.${i%10}`}));
export const releaseById=(id:string)=>RELEASES.find(r=>r.id===id.toUpperCase());
export function nfoBytes(id:string){const r=releaseById(id);if(!r)return new Uint8Array();const i=RELEASE_GROUPS.indexOf(r.group),c=[11,12,14,13][i];const x=a().cls();box(x,2,3,74,21,c,r.group);x.at(4,7).k(c,`▓▒░ ${r.group} ░▒▓`).at(6,7).k(15,`${r.title} ${r.version}`).at(8,7).k(7,'Entirely fictional release. Original text-mode entertainment.').at(10,7).k(c,'RELEASE NOTES').at(11,7).k(7,r.runnable?`RUN ${r.id} from Kestrel DOS. Any key exits the intros.`:'Collector edition: NFO and FILE_ID.DIZ only. No executable.').at(13,7).k(c,'GREETS').at(14,7).k(7,RELEASE_GROUPS.filter(g=>g!==r.group).join(' / ')).at(16,7).k(c,'DISTRIBUTION LINES').at(17,7).k(7,'DEAD CARRIER 555-0142 / FULL BLOCK 555-0167').at(18,7).k(7,'LINE NOISE 555-0193 / STROBE 555-0177').at(20,7).k(8,'No stolen code. No real product. No warranty from Static.');return x.build();}
export function dizBytes(id:string){const r=releaseById(id);return a().k(11,pad(r?.group??'',35)).nl().k(15,r?.title??id).nl().k(7,'An original fictional release.').nl().k(8,'Distributed by DEAD CARRIER.').build();}
export const COURIER_LOGS=[
 '01 / Tin Quay. A disk in a lunch tin. The label says nothing. I took the long bus.',
 '02 / Rain in the stairwell. Static counts the seals, not the files. Three credits short.',
 '03 / Halftone offered tea. A logo filled the screen before the kettle boiled.',
 '04 / Dial Tone answered with silence. I left the disk beside a unplugged telephone.',
 '05 / The club wanted meeting minutes. I delivered them. Mr. Hutchins lent me a coat.',
 '06 / Kickdrum had four channels and no bus fare. We traded disks for the last ticket.',
 '07 / A seventh carrier answered. No greeting. Just a staircase drawn in red.',
 '08 / Morning. Empty tin. Full pockets. The line went dead before I could say thanks.'
];
export const CREDIT_AWARDS={art:1,rating:1,oneliner:2,door:5,corner:8};
export const GUEST_CREDITS=6;
export function ledgerBalance(entries:{event:string;amount:number}[]){const seen=new Set<string>();return entries.reduce((n,e)=>{if(seen.has(e.event))return n;seen.add(e.event);return n+e.amount;},0);}
export const tagOrder=(files:string[],tags:Set<string>)=>files.filter(f=>tags.has(f));

export const orderedTags=(tags:Set<string>)=>[...tags].sort((a,b)=>a.localeCompare(b));
