import {ACCESS,accessLevel} from '@/lib/access';
import {record,} from './access';
import {guestTime} from '@/lib/time-bank';
import {NetError} from './net';
export async function bankAction(s:any,c:any,b:any,now:Date){if(!c||b.guest)return guestTime();if(b.action==='withdraw'&&b.minutes!==15)throw new NetError(400,'Withdraw 15 minutes at a time.');const r=await record(s,c);const {data,error}=await s.rpc('time_bank',{_caller:c.id,_allowance:ACCESS[accessLevel(r.level)].minutes*60,_now:now.toISOString(),_session:typeof b.callSession==='string'&&/^[a-f0-9-]{36}$/.test(b.callSession)?b.callSession:null,_withdraw:b.action==='withdraw'?900:0,_active:b.active!==false,_close:b.close===true});if(error)throw new NetError(400,'No fifteen minutes available in the bank.');return data;}