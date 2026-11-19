import { useEffect, useState } from 'react';
import { CLOCK_DISPLAY, clockDigits, fractionStyle } from './plate-layout';

const SEGMENTS=['a','b','c','d','e','f','g'];
const DIGITS:Record<string,string>={'0':'abcdef','1':'bc','2':'abdeg','3':'abcdg','4':'bcfg','5':'acdfg','6':'acdefg','7':'abc','8':'abcdefg','9':'abcdfg',' ':''};
/** A physical LED module, not terminal content; browser-local time only. */
export function Clock({reduced}:{reduced:boolean}) {
 const [time,setTime]=useState<Date|null>(null);
 useEffect(()=>{const update=()=>setTime(new Date());update();const id=setInterval(update,500);return()=>clearInterval(id);},[]);
 const digits=time?clockDigits(time):'    ',colon=reduced||!time||time.getSeconds()%2===0;
 return <div className="plate-clock" style={fractionStyle(CLOCK_DISPLAY)} role="img" aria-label={time?`Local time ${time.toLocaleTimeString([], {hour:'numeric',minute:'2-digit',hour12:true})}`:'Local clock'}>
 <div className="clock-module">{[...digits].map((digit,i)=><div key={i} className={`clock-digit digit-${i}`}>{SEGMENTS.map(segment=><i key={segment} className={`segment segment-${segment} ${DIGITS[digit].includes(segment)?'lit':''}`}/>)}</div>)}<span className={`clock-colon ${colon?'lit':''}`}/></div>
 </div>;
}