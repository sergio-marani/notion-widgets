const prefix='weather-api-v1:';
const pending=new Map();
let queue=Promise.resolve();
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function cached(key){
  try{
    const entry=JSON.parse(localStorage.getItem(key));
    if(entry && entry.expires>Date.now())return entry;
    localStorage.removeItem(key);
  }catch{/* Storage can be unavailable in embedded browsers. */}
  return null;
}

async function fetchJson(url,timeout){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),timeout);
  try{
    const response=await fetch(url,{signal:ctrl.signal,cache:'no-store'});
    if(!response.ok){
      let reason='';
      try{reason=(await response.json()).reason||''}catch{}
      const error=new Error('HTTP '+response.status+(reason?': '+reason:''));
      error.status=response.status;
      const header=response.headers.get('Retry-After');
      error.retryAfter=header===null?NaN:/^\d+$/.test(header)?Number(header)*1000:Date.parse(header)-Date.now();
      throw error;
    }
    return await response.json();
  }finally{clearTimeout(timer)}
}

export function requestJson(url,timeout=15000){
  const parsed=new URL(url);
  const meteo=parsed.protocol==='https:' && ['api.open-meteo.com','archive-api.open-meteo.com','geocoding-api.open-meteo.com'].includes(parsed.hostname);
  if(!meteo)return fetchJson(url,timeout);
  parsed.searchParams.sort();
  const key=prefix+parsed.toString();
  if(pending.has(key))return pending.get(key);
  const run=async()=>{
    // Recheck after acquiring the shared lock: another iframe may have cached it.
    const hit=cached(key);
    if(hit)return hit.data;
    for(let attempt=0;;attempt++){
      try{
        const data=await fetchJson(parsed.toString(),timeout);
        const ttl=parsed.hostname==='archive-api.open-meteo.com'?7*86400000:5*60000;
        try{localStorage.setItem(key,JSON.stringify({expires:Date.now()+ttl,data}))}catch{}
        return data;
      }catch(error){
        if(error.status!==429 || attempt>=3)throw error;
        const delay=Math.max(1000*2**attempt+Math.random()*500,error.retryAfter||0);
        // Do not retry earlier than a long server cooldown; surface the error instead.
        if(delay>60000)throw error;
        await pause(delay);
      }
    }
  };
  const locked=()=>globalThis.navigator?.locks?.request
    ?navigator.locks.request('weather-open-meteo',run):run();
  const result=queue.then(locked);
  queue=result.catch(()=>{});
  pending.set(key,result);
  const cleanup=()=>pending.delete(key);
  result.then(cleanup,cleanup);
  return result;
}
