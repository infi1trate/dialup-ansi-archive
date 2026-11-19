import {a,box,pad} from './ansi';
export const RELEASE_GROUPS=['LATCHKEY','NULL FOUNDRY','TIN SAINTS','MIDNIGHT RELAY'];
export const PROGRAM_IDS=['EMBER','CHROMA','DRIFTER','PATCHFOX','COILS','TOUCHBOX','NFOLOOM'];
export const RELEASES=[
 ['EMBER','Ember Array','CRACKTROS'],['CHROMA','Chroma Freight','CRACKTROS'],['DRIFTER','Drifter Saver','UTILS'],['PATCHFOX','Patchfox Trainer','UTILS'],['COILS','Coils in the Wiring','GAMEZ'],['TOUCHBOX','Touchbox Tone Bench','UTILS'],['NFOLOOM','NFO Loom','UTILS'],
 ['LEDGER','Spreadsheet of Doom','0-DAY'],['PAPERBAT','Paperbat Publisher','0-DAY'],['INKJET','Inkjet Kingdom','GAMEZ'],['MOONCART','Mooncart Rally','GAMEZ'],['DUSTWAR','Dust Ward Tactics','GAMEZ'],['PANTRY','Pantry Quest','GAMEZ'],['ROOFER','Roofline Architect','0-DAY'],['FOLDERS','Folders Forever','UTILS'],['DEFRAG','Defrag Oracle','UTILS'],['MIRROR','Mirror Clerk','UTILS'],['ZIPPER','Pocket Zipper','UTILS'],['QUARTZ','Quartz Census','0-DAY'],['SOLDER','Solder Cathedral','GAMEZ'],['RELAY','Relay Accountant','0-DAY'],['GLIDER','Glider Between Floors','GAMEZ'],['NIGHTBUS','Nightbus Dispatch','0-DAY'],['STAMP','Stamp Collector Deluxe','UTILS']
].map(([id,title,area],i)=>({id,title,area,group:RELEASE_GROUPS[i%4],cost:PROGRAM_IDS.includes(id)?3:2,runnable:PROGRAM_IDS.includes(id),version:`${1+i%3}.${i%10}`}));
export const releaseById=(id:string)=>RELEASES.find(r=>r.id===id.toUpperCase());
export const NFO_LOGOS:Record<string,string[]>={
 'LATCHKEY':[
 '       __       __         __      __             ',
 '      / /____ _/ /________/ /_    / /_____ __  __ ',
 '     / / __ `/ __/ ___/ __  / /__/ //_/ _ \\ / / ',
 '    / / /_/ / /_/ /__/ / / /  __/ ,< /  __/ /_/ /',
 '   /_/\\__,_/\\__/\\___/_/ /_/\\__/_/|_|\\___/\\__, / ',
 '       / /       / /       / /            /____/ ',
 '      /_/_______/_/_______/_/___________________ ',
 ],
 'NULL FOUNDRY':[
 '░▒▓██████▓▒░  ███    ███  ███       ███',
 '▓███   ███▓   ███    ███  ███       ███',
 '████   ████   ███    ███  ███       ███',
 '████   ████   ███    ███  ███       ███',
 '▓███   ███▓   ▓████████▓  ████████  ████████',
 '░▒▓    ▓▒░      ░▒▓▓▒░   ░▒▓████▓  ░▒▓████▓',
 '          F O U N D R Y / BATCH ZERO',
 ],
 'TIN SAINTS':[
 '             . - - - .',
 '           (    +    )',
 '             ` - - `',
 '               (o)',
 '             .--|--.',
 '             /  |  \\',
 '               / \\',
 '              .   .',
 ],
 'MIDNIGHT RELAY':[
 '--.. --..  ..-- --..  ..-- --..  ..-- --..  ..-- --..',
 '..-- ..--  --.. ..--  --.. ..--  --.. ..--  --.. ..--',
 '-- -- ..   -- .. --  .. -- ..  -- .. --  .. -- .. --',
 '.. .. --   .. -- ..  -- .. --  .. -- ..  -- .. -- ..',
 '--..--..--..--..--..--..--..--..--..--..--..--..--..--',
 '..--..--..--..--..--..--..--..--..--..--..--..--..--..',
 'M I D N I G H T   /   R E L A Y   /   CIRCUIT 73',
 ]
};
const RELEASE_NOTES:Record<string,string>={
 EMBER:'a furnace of red cells rising under the latchkey sign',CHROMA:'a freight of cycling colour carried by the foundry',DRIFTER:'a quiet saver that lets the tired screen drift',PATCHFOX:'one extra basement crawl attempt for the current day',COILS:'a snake circuit; eat the contacts and avoid your own wire',TOUCHBOX:'a bench of touch tones from the corvid speaker',NFOLOOM:'a loom that turns installed release notes into pages',LEDGER:'a doomed sheet that balances imaginary debts',PAPERBAT:'a publisher for the imaginary night edition',INKJET:'a kingdom ruled by a printer with no ink',MOONCART:'a rally for grocery carts under a cardboard moon',DUSTWAR:'a tactical struggle over the last clean desk',PANTRY:'a quest through shelves of improbable preserves',ROOFER:'an architect of roofs nobody has commissioned',FOLDERS:'a filing cabinet that files itself forever',DEFRAG:'an oracle that predicts where imaginary sectors belong',MIRROR:'a clerk who stamps every form in reverse',ZIPPER:'a pocket packer for imaginary luggage',QUARTZ:'a census of clocks that refuse to agree',SOLDER:'a cathedral assembled from discarded circuit boards',RELAY:'an accountant keeping books for unconnected exchanges',GLIDER:'a paper craft drifting between basement floors',NIGHTBUS:'a dispatcher for buses that arrive after the last call',STAMP:'a collector of postage from places that never existed'
};
export function nfoLines(id:string){
 const r=releaseById(id);if(!r)return [];
 const i=RELEASES.indexOf(r),group=r.group,lower=group==='LATCHKEY',narrow=group==='TIN SAINTS',radio=group==='MIDNIGHT RELAY';
 const lines:string[]=NFO_LOGOS[group].map(s=>narrow?' '.repeat(Math.max(0,Math.floor((78-s.trim().length)/2)))+s.trim():s);
 const voice=(s:string)=>lower?s.toLowerCase():group==='NULL FOUNDRY'?s.toUpperCase():s;
 const line=(s:string)=>lines.push(narrow?' '.repeat(Math.max(0,Math.floor((78-s.length)/2)))+s:s);
 const section=(title:string,body:string[],time:string)=>{
  if(group==='NULL FOUNDRY'){
   lines.push('╔'+'═'.repeat(74)+'╗','║ '+pad(title.toUpperCase(),72)+' ║');
   body.forEach(s=>lines.push('║ '+pad(voice(s),72)+' ║'));lines.push('╚'+'═'.repeat(74)+'╝');
  }else{
   line(lower?`.:[ ${title.toLowerCase()} ]:.`:narrow?'+ + + + '+title+' + + + +':pad(title.toUpperCase(),65)+time);
   body.forEach(s=>line(voice(s)));
  }
 };
 const date=`${1992+i%3}-${String(1+i%12).padStart(2,'0')}-${String(3+i%24).padStart(2,'0')}`;
 section('Release',[`${r.title} v${r.version}`,`Released ${date}`],'00:07');
 const note=RELEASE_NOTES[r.id];
 section('Notes',lower?[note+'.','we left it beside the telephone, not at the front door.','no locks picked; no borrowed code tucked inside.',r.runnable?'the executable is small. the night is not.':'collector disk: notes only. no executable in this envelope.']:
 group==='NULL FOUNDRY'?[note+'.','CAST FROM OUR OWN CELLS. NO IMPORTED INGOTS.','THE BATCH HAS BEEN CHECKED AGAINST THE NIGHT SHIFT.',r.runnable?'EXECUTABLE INCLUDED. KEEP YOUR HANDS OFF THE POUR.':'DOCUMENTATION CAST ONLY. NO EXECUTABLE IN THIS BATCH.']:
 narrow?[note+'.','blessed are the callers who label their disks.','this modest offering has passed the vestry inspection.',r.runnable?'an executable accompanies the offering.':'a collector document; no executable is bestowed.']:
 [note+'.','LOCAL ORIGIN CONFIRMED. CARRIER STABLE.','NO OUTSIDE PAYLOAD. CHECKSUM IN THE LOG.',r.runnable?'EXECUTABLE ATTACHED. ACKNOWLEDGE RECEIPT.':'TEXT CONSIGNMENT ONLY. NO EXECUTABLE.'],'00:19');
 section('How to run',[`CD C:\\WAREZ\\${r.id}`,r.runnable?`RUN ${r.id}`:`TYPE ${r.id}.NFO`,r.id==='COILS'?'Arrow keys steer. Escape ends the circuit.':r.id==='TOUCHBOX'?'0-9 sends a tone. Escape closes the bench.':'Read the prompt; any intro key closes the display.','Return to Kestrel DOS when the session ends.'],'00:31');
 section('Greets',RELEASE_GROUPS.filter(g=>g!==group),'00:42');
 section('Distribution',[
 'DEAD CARRIER 555-0142','FULL BLOCK 555-0167','LINE NOISE 555-0193','STROBE 555-0177','COPPER LANDING 555-0186','NIGHT SWITCH 555-0154'],'00:56');
 line(voice(lower?'this release is fiction made for this board.':narrow?'this offering is fiction made for this board.':radio?'fiction made for this board. no live consignment.':'THIS RELEASE IS FICTION MADE FOR THIS BOARD.'));
 line({'LATCHKEY':'latchkey / we were never home','NULL FOUNDRY':'CAST IN NOTHING.','TIN SAINTS':'go in peace, leech not','MIDNIGHT RELAY':'relay ends. 73.'}[group]??'');
 return lines.map(s=>s.slice(0,78));
}
export function nfoBytes(id:string){const x=a().cls();for(const [i,line] of nfoLines(id).entries()){if(i)x.nl();x.k([11,7,14,10][RELEASE_GROUPS.indexOf(releaseById(id)?.group??'')],line);}return x.build();}
export function nfoPage(id:string,page:number){const lines=nfoLines(id),x=a().cls(),c=[11,7,14,10][RELEASE_GROUPS.indexOf(releaseById(id)?.group??'')];lines.slice(page*23,page*23+23).forEach((l,i)=>x.at(i+1,1).k(c,l));x.at(25,1).k(8,pad(`NFO / ${page+1} of ${Math.ceil(lines.length/23)} / ENTER next / ESC return`,78));return x.build();}
export function dizBytes(id:string){const r=releaseById(id);return a().t(r?.group??'').nl().t(`${r?.title??id} v${r?.version??'1.0'}`).nl().t('Original fictional text-mode release.').nl().t(r?.runnable?`RUN ${r.id} / Kestrel DOS`:'Collector notes / no executable').nl().t('Distributed by DEAD CARRIER.').build();}
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
