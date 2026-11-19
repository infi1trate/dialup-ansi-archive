// Original seeded economy, shared by the door and server score replay.
export const NEIGHBORHOODS=['Latch Quay','Tin Gardens','Mercury Steps','Lantern Ward','Brick Hollow','Sump Market'];
export const GOODS=['Glow wafers','Velvet dust','Night ink','Echo beads','Silver leaf','Static resin'];
export const BASE_PRICES=[45,110,240,380,690,1250];
export const DAYS=30;
export const INTEREST=1.08;
export type CornerAction={type:'buy'|'sell';good:number;qty:number}|{type:'travel';place:number}|{type:'bank'|'withdraw'|'repay';qty:number}|{type:'coat'|'weapon'|'run'|'stand'};
export interface CornerState {seed:number;rng:number;day:number;place:number;cash:number;bank:number;debt:number;pockets:number;stock:number[];prices:number[];weapon:boolean;police:boolean;ended:boolean;message:string;offer:boolean}
export function random(s:CornerState){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function prices(s:CornerState){s.prices=BASE_PRICES.map(p=>Math.max(5,Math.round(p*(.3+random(s)*2.4))));}
export function newCorner(seed:number):CornerState{const s:CornerState={seed:seed>>>0,rng:seed>>>0,day:1,place:0,cash:1800,bank:0,debt:4000,pockets:60,stock:GOODS.map(()=>0),prices:[],weapon:false,police:false,ended:false,message:'Thirty days. One coat. Keep your accounts straight.',offer:false};prices(s);return s;}
export const cornerScore=(s:CornerState)=>Math.max(0,Math.floor(s.cash+s.bank-s.debt));
export function actCorner(old:CornerState,a:CornerAction):CornerState{
 const s:CornerState={...old,stock:[...old.stock],prices:[...old.prices]};if(s.ended)return s;
 if(s.police){if(a.type!=='run'&&a.type!=='stand')return s;const win=random(s)<(a.type==='run'?.68:s.weapon?.88:.28);if(!win){s.cash=Math.floor(s.cash*.65);s.stock=s.stock.map(()=>0);}s.police=false;s.message=win?'The patrol loses you in the service alley.':'The patrol empties your pockets and takes a cash fine.';return s;}
 const q='qty'in a?Math.max(0,Math.floor(a.qty)):0;
 if(a.type==='buy'||a.type==='sell'){if(!Number.isInteger(a.good)||a.good<0||a.good>=6||q<=0)return s;const p=s.prices[a.good];if(a.type==='buy'&&q*p<=s.cash&&s.stock.reduce((x,y)=>x+y,0)+q<=s.pockets){s.cash-=q*p;s.stock[a.good]+=q;s.message='Goods folded into the lining.';}else if(a.type==='sell'&&q<=s.stock[a.good]){s.stock[a.good]-=q;s.cash+=q*p;s.message='Cash counted twice. Deal closed.';}else s.message='Not enough cash, goods, or pocket space.';}
 if(a.type==='bank'&&q<=s.cash){s.cash-=q;s.bank+=q;s.message='The clerk stamps your deposit slip.';}
 if(a.type==='withdraw'&&q<=s.bank){s.bank-=q;s.cash+=q;s.message='Withdrawal counted under the glass.';}
 if(a.type==='repay'&&q<=s.cash){const pay=Math.min(q,s.debt);s.cash-=pay;s.debt-=pay;s.message='Marl Vane marks down the debt. Interest resumes tomorrow.';}
 if(a.type==='coat'&&s.offer&&s.cash>=1200){s.cash-=1200;s.pockets+=40;s.offer=false;s.message='Forty more pockets. Nobody asks why.';}
 if(a.type==='weapon'&&s.offer&&s.cash>=900){s.cash-=900;s.weapon=true;s.offer=false;s.message='A heavy deterrent goes in the inner pocket.';}
 if(a.type==='travel'){if(!Number.isInteger(a.place)||a.place<0||a.place>=6)return s;if(s.day>=DAYS){s.ended=true;s.message='Day 30 closes. The city settles its accounts.';return s;}s.day++;s.place=a.place;s.debt=Math.ceil(s.debt*INTEREST);prices(s);s.offer=false;const e=random(s),g=Math.floor(random(s)*6);s.message='A new district. A fresh price sheet.';if(e<.12){s.prices[g]=Math.max(5,Math.floor(s.prices[g]*.2));s.message=`A warehouse bust collapses ${GOODS[g]} prices.`;}else if(e<.24){s.prices[g]*=4;s.message=`A shortage sends ${GOODS[g]} through the roof.`;}else if(e<.31){s.cash=Math.floor(s.cash*.8);s.message='A alley mugging costs a fifth of your cash.';}else if(e<.4){s.cash+=350;s.message='A forgotten envelope holds 350 credits.';}else if(e<.55){s.offer=true;s.message='A tailor offers a coat (1200) or a deterrent (900).';}else if(e<.68){s.police=true;s.message='Patrol at the corner. Run or stand?';}}
 return s;
}
export function replayCorner(seed:number,actions:CornerAction[]){return actions.reduce(actCorner,newCorner(seed));}
