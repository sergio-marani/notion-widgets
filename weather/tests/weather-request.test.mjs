import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../scripts/weather-request.js',import.meta.url),'utf8')
  .replace('export function requestJson','function requestJson')+'\nthis.request=requestJson;';
const url='https://archive-api.open-meteo.com/v1/archive?latitude=1';
const response=(status=200,data={daily:{time:['2025-11-13']}},retry=null)=>({
  ok:status===200,status,headers:{get:()=>retry},json:async()=>data
});
function setup(fetch,{storage=new Map(),locks,delays=[]}={}){
  const context={URL,AbortController,Date,Math,fetch,navigator:{locks},
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    setTimeout:(fn,ms)=>{if(ms===15000)return setTimeout(fn,ms);delays.push(ms);return setTimeout(fn,0)},clearTimeout};
  vm.runInNewContext(source,context);
  return context.request;
}

test('independent iframe contexts share a queue and recheck persistent cache',async()=>{
  let tail=Promise.resolve(),active=0,max=0,calls=0;
  const locks={request:(_name,fn)=>{const next=tail.then(fn);tail=next.catch(()=>{});return next}};
  const storage=new Map();
  const fetch=async()=>{calls++;max=Math.max(max,++active);await new Promise(r=>setTimeout(r,5));active--;return response()};
  const a=setup(fetch,{locks,storage}),b=setup(fetch,{locks,storage});
  await Promise.all([a(url),b(url),b(url+'&longitude=2'),a(url)]);
  assert.equal(max,1);
  assert.equal(calls,2);
  await setup(fetch,{locks,storage})(url);
  assert.equal(calls,2,'cache survives a fresh context');
  for(const [key,value] of storage)storage.set(key,JSON.stringify({...JSON.parse(value),expires:0}));
  await a(url);
  assert.equal(calls,3,'expired cache is fetched again');
});

test('429 retries respect Retry-After, then cache success',async()=>{
  let calls=0;const delays=[];
  const request=setup(async()=>++calls===1?response(429,{reason:'Too many concurrent requests'},'2'):response(),{delays});
  await request(url);await request(url);
  assert.equal(calls,2);assert.ok(delays[0]>=2000);
});

test('retry exhaustion preserves reason and releases fallback queue',async()=>{
  let calls=0;
  const request=setup(async()=>{calls++;return response(429,{reason:'Too many concurrent requests'})});
  await assert.rejects(request(url),/HTTP 429: Too many concurrent requests/);
  assert.equal(calls,4);
  await assert.rejects(request(url),/HTTP 429/);
  assert.equal(calls,8,'failed requests are not cached or left pending');
});

test('non-429 errors and long Retry-After are not retried',async()=>{
  for(const [status,retry] of [[400,null],[429,'120']]){
    let calls=0;
    const request=setup(async()=>{calls++;return response(status,{reason:'unavailable'},retry)});
    await assert.rejects(request(url),/unavailable/);assert.equal(calls,1);
  }
});

test('blocked storage still serializes local requests; static JSON bypasses cache',async()=>{
  let active=0,max=0,calls=0;
  const request=setup(async()=>{calls++;max=Math.max(max,++active);await new Promise(r=>setTimeout(r,2));active--;return response()},
    {storage:{get(){throw new Error('blocked')},set(){throw new Error('blocked')}}});
  await Promise.all([request(url),request(url+'&longitude=2')]);
  assert.equal(max,1);
  await request('https://example.com/data.json');await request('https://example.com/data.json');
  assert.equal(calls,4);
});
