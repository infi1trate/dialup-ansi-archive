import type { DirEntry } from './io';
export interface BoardConfig { name:string; sysop:string; tagline:string; colors:[number,number,number]; style:'lightbar'|'prompt'|'numbered'; bulletins:{title:string;body:string[]}[]; quotes:string[] }
export const CONFIGS:Record<string,BoardConfig> = {
 crawl:{name:'DEAD CARRIER',sysop:'Static',tagline:'No lamers. No leeches. No carrier.',colors:[12,7,11],style:'lightbar',bulletins:[
 {title:'Read before leeching',body:['The line is yours. The art is not. Credit the artists.','Art earns ratio. Fictional releases spend it. No exceptions.']},
 {title:'0-DAY ART',body:['Same month. Different year. The scene never sleeps.','November in 199x is still newer than your excuses.']},
 {title:'Node maintenance',body:['Static has misplaced a stairwell. Look in the credits.','Leave a oneliner before your mother picks up the phone.']}],quotes:['A clean disconnect is a wasted opportunity.','Your ratio called. It wants an apology.','Static has already forgotten your handle.']},
 vault:{name:'FULL BLOCK',sysop:'Halftone',tagline:'Every cell a monument. Every shade a signature.',colors:[9,11,15],style:'lightbar',bulletins:[
 {title:'The Full Block collective',body:['Our invented crew draws until the kettle runs dry.','Guest archive credits belong to their original artists.']},
 {title:'Studio notes',body:['Blue is a foundation, not an excuse. Push the hot accents.','Bring a finished logo to the next critique.']},
 {title:'Pack theatre',body:['Tag a sequence and let the line draw it for you.','A good pack has rhythm even without a soundtrack.']}],quotes:['Leave no cell undecided.','Halftone says the shadows need another pass.','The kettle is empty. The buffer is full.']},
 c93:{name:'LINE NOISE',sysop:'Dial Tone',tagline:'Read quietly. Disconnect cleanly.',colors:[10,2,7],style:'prompt',bulletins:[
 {title:'Line discipline',body:['No handles spoken aloud. No telephone numbers in greets.','The archive remembers enough already.']},
 {title:'Text before pictures',body:['NFO. DIZ. ASC. TXT. Then the colored evidence.','C restores color. C also takes it away.']},
 {title:'Exchange report',body:['A clicking relay is not a conversation.','Dial Tone will not confirm that this board exists.']}],quotes:['You heard only line noise.','The relay remembers nothing.','Disconnect before the third click.']},
 maple:{name:'MAPLE RIDGE PC USERS GROUP BBS',sysop:'Mr. Hutchins',tagline:'Please limit calls to 30 minutes so others may connect.',colors:[1,15,9],style:'numbered',bulletins:[
 {title:'November meeting minutes',body:['The printer committee voted to buy one more ribbon.','Mr. Hutchins demonstrated careful disk labeling.']},
 {title:'Club potluck',body:['Bring a covered dish and your own extension lead.','Please keep beverages on the folding table, not the computer.']},
 {title:'Telephone courtesy',body:['Please limit calls to 30 minutes so others may connect.','Thank you for sharing the line. Visitors are always welcome.']}],quotes:['Please rewind the chair under the desk.','Thank you for visiting our little club.','Mr. Hutchins hopes your printer behaves.']},
 strobe:{name:'STROBE',sysop:'Kickdrum',tagline:'Sixteen colors. Four channels. No bedtime.',colors:[13,14,11],style:'lightbar',bulletins:[
 {title:'Basement frequency',body:['Kickdrum moved the mixer away from the rain leak.','The speakers are the only source. Mind the neighbors.']},
 {title:'Module crate',body:['Tunes enter the jukebox as callers discover packs.','Queue a module, then make room for the next one.']},
 {title:'Afterhours',body:['Roulette picks the next canvas. You supply the stamina.','No flashing lights here: the dance floor is in the text.']}],quotes:['The last bus left three modules ago.','Kickdrum is counting the channels, not the hours.','Keep the beat. Lose the carrier.']},
 attic:{name:'THE ATTIC',sysop:'Dustline',tagline:'Tomorrow is filed upstairs.',colors:[6,14,7],style:'lightbar',bulletins:[{title:'New shelves',body:['1997 onward. Same archive, more dust.']},{title:'Inventory',body:['Never throw out a readable disk.']},{title:'Visiting hours',body:['The stairs creak. Step lightly.']}],quotes:['Mind your head.','Tomorrow is still loading.','Leave the dust where you found it.']},
 void:{name:'VOID//NODE',sysop:'Null Relay',tagline:'No record. No receipt.',colors:[12,8,7],style:'lightbar',bulletins:[{title:'0',body:['No bulletin.']},{title:'1',body:['No witness.']},{title:'2',body:['No carrier.']}],quotes:['You were never here.','Nothing answers.','Forget the number.']}
};
export const configFor=(e:DirEntry)=>CONFIGS[e.id] ?? CONFIGS.crawl;
