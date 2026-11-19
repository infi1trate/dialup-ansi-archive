import {CONFIGS} from '@/bbs/config';
export const MAIL_RULES=['first','ratio','dailyTop','cornerDebt','artist','void','return','validated','elite','moderation'] as const;
export type MailRule=typeof MAIL_RULES[number];
const TEXT:Record<MailRule,string[]>={
 first:["You're in. Keep the line tidy and the artist credits intact.","Application filed. The archive is open; the caller record starts here.","The carrier held. Your handle now has a place in the log."],
 ratio:['Your ratio hit zero. Look at art, rate a piece, or finish a door.','Empty ledger. The archive earns your next fictional disk. No cash accepted.','A disk went out; the credits ran out. Read a canvas before the next request.'],
 dailyTop:['You led the daily door table. Someone will try to take that place.','Your scored run topped the day. The scorekeeper checked twice.','Top of the daily sheet. A rare tidy set of numbers.'],
 cornerDebt:['Thirty days closed with debt outstanding. The loan book outlived the coat.','THE CORNER ended owing the lender. Next time, visit the bank sooner.','Your city run finished in debt. Interest never takes the night off.'],
 artist:['Ten pieces by {artist}. Search that artist to follow the trail.','You keep returning to {artist}. Ten pieces now; Search finds the rest.','Ten canvases credit {artist}. The Search command follows that signature.'],
 void:['You found VOID//NODE. Keep the discovery quieter than the modem.','That unlisted carrier answered. The directory knows when not to speak.','The hidden line is in your record. No witness volunteered a comment.'],
 return:['Seven days or more away. Your handle and shelves waited.','The carrier returned after a long quiet week. Nothing was thrown out.','Back after seven nights or more. The archive did not pack up and leave.'],
 validated:['VALIDATED earned. 45 minutes, 14400 bps, and THE WALL posting are yours.','The record qualifies: VALIDATED. The queue now holds for two seconds.','A better line is earned, not bought. VALIDATED opens 14400 and THE WALL.'],
 elite:['ELITE earned. 60 minutes, 28800 bps, INNER CIRCLE and THE ATTIC are open.','The record reached ELITE. Rated canvases and the upstairs shelves await.','Six call days and real work. ELITE opens the fastest line and INNER CIRCLE.'],
 moderation:['A reported message was hidden. Please keep the shared boards courteous.','A report led to a hidden post. Leave a cleaner note next time; no pile-ons.','The sysop hid a reported message. Keep future posts safe for other callers.'],
};
export function variant(handle:string,rule:string){let h=0;for(const c of handle.toLowerCase()+':'+rule)h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;return h%3;}
export function mailText(handle:string,rule:MailRule,board:string,detail='',occurrence=''){
 const cfg=CONFIGS[board]??CONFIGS.crawl;
 const voice:Record<string,string>={crawl:'No excuses. Keep the carrier useful.',vault:'Every cell deserves its credit. / The kettle is on.',c93:'read quietly. disconnect cleanly.',maple:'Thank you for sharing our telephone line. Please call again.',strobe:'Keep the beat. Leave a channel for the next caller.',attic:'Mind your head on the stairs.',void:'No witness. No receipt.'};
 return {subject:rule==='artist'?`Artist trail: ${detail}`:rule.replace(/([A-Z])/g,' $1').toUpperCase(),body:TEXT[rule][variant(handle,rule+occurrence)].replace('{artist}',detail)+'\n\n'+voice[board]+'\n\n-- '+cfg.sysop};
}
export interface Queued {occurred_call:number;delivered_call:number|null}
export function eligibleMail(rows:Queued[],call:number){const delivered=rows.filter(r=>r.delivered_call===call).length;return rows.filter(r=>r.delivered_call===null&&r.occurred_call<call).slice(0,Math.max(0,2-delivered));}