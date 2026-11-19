import { checkOneliner } from './filter';
export type AccessLevel = 'NEW USER' | 'VALIDATED' | 'ELITE';
export interface Activity { days:number; pieces:number; oneliners:number; ratings:number; finishedRuns:number }
export const ACCESS = {
  'NEW USER': {speed:9600, minutes:30, hold:3000},
  VALIDATED: {speed:14400, minutes:45, hold:2000},
  ELITE: {speed:28800, minutes:60, hold:2000},
} as const;
export function earnedLevel(a:Activity):AccessLevel {
  if(a.days>=6&&a.pieces>=60&&a.finishedRuns>=1&&a.ratings>=3)return 'ELITE';
  if((a.days>=2||a.pieces>=15)&&a.oneliners>=1)return 'VALIDATED';
  return 'NEW USER';
}
export function accessLevel(v:unknown):AccessLevel { return v==='ELITE'||v==='VALIDATED'?v:'NEW USER'; }
/** The same requirements as nextChecklist, as numbers for progress bars. */
export function checklistItems(level:AccessLevel,a:Activity):{label:string;n:number;target:number}[] {
  if(level==='ELITE')return [];
  if(level==='NEW USER')return [{label:'UTC call days (OR pieces)',n:a.days,target:2},{label:'pieces viewed (OR days)',n:a.pieces,target:15},{label:'oneliners posted',n:a.oneliners,target:1}];
  return [{label:'UTC call days',n:a.days,target:6},{label:'pieces viewed',n:a.pieces,target:60},{label:'finished scored runs',n:a.finishedRuns,target:1},{label:'pieces rated',n:a.ratings,target:3}];
}
export function nextChecklist(level:AccessLevel,a:Activity):string[] {
  const check=(label:string,n:number,target:number)=>`${n>=target?'[x]':'[ ]'} ${label} ${n} / ${target}`;
  if(level==='ELITE')return ['[x] Highest access earned. Nothing for sale.'];
  if(level==='NEW USER')return [check('UTC call days (OR pieces)',a.days,2),check('pieces viewed (OR days)',a.pieces,15),check('oneliners posted',a.oneliners,1)];
  return [check('UTC call days',a.days,6),check('pieces viewed',a.pieces,60),check('finished scored runs',a.finishedRuns,1),check('pieces rated',a.ratings,3)];
}
export function wallBody(v:unknown):string|null {
  if(typeof v!=='string')return null;
  const lines=v.trim().split('\n');
  if(!lines.length||lines.length>3||lines.some(l=>l.length>70||(!checkOneliner(l).ok&&l.trim()!=='')))return null;
  return lines.join('\n')||null;
}