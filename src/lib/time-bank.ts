export interface TimeAccount{day:string;allowance:number;used:number;bank:number;withdrawn:number}
export function rollTime(a:TimeAccount,day:string,allowance:number){const days=Math.max(0,Math.round((+new Date(day)-+new Date(a.day))/86400000));return days?{day,allowance,used:0,withdrawn:0,bank:Math.min(7200,a.bank+Math.max(0,a.allowance+a.withdrawn-a.used)+Math.max(0,days-1)*allowance)}:{...a,allowance};}
export function withdrawTime(a:TimeAccount){if(a.bank<900)return null;return {...a,bank:a.bank-900,withdrawn:a.withdrawn+900};}
export function clockApplies(firstDeviceCall:boolean,guest:boolean,active=true){return active&&!firstDeviceCall;}
export function guestTime(){return {remainingSeconds:1800,bank_seconds:0,allowance_seconds:1800,used_seconds:0,exempt:false,guest:true};}