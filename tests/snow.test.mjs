import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {snowPeriods,readSnowPeriod,summarizeSnow,loadSnowHistory,renderSnow} from '../weather/scripts/sections/snow.js';

const dates={start:'2026-01-10',end:'2026-01-12'};
const place={name:'Takayama',country_code:'JP',latitude:36.146,longitude:137.252};
function response(period,values=[0,1,2]){
  const start=new Date(period.start+'T12:00:00Z');
  const count=Math.round((new Date(period.end+'T12:00:00Z')-start)/86400000)+1;
  const time=Array.from({length:count},(_,index)=>new Date(start.getTime()+index*86400000).toISOString().slice(0,10));
  return {daily_units:{snowfall_sum:'cm'},daily:{time,snowfall_sum:time.map((_,index)=>values[index%values.length])}};
}

test('previous three same-date periods handle leap days and cross-year trips',()=>{
  assert.deepEqual(snowPeriods(dates),[
    {start:'2025-01-10',end:'2025-01-12'},
    {start:'2024-01-10',end:'2024-01-12'},
    {start:'2023-01-10',end:'2023-01-12'}
  ]);
  assert.equal(snowPeriods({start:'2024-02-29',end:'2024-03-01'})[0].start,'2023-02-28');
  assert.deepEqual(snowPeriods({start:'2026-12-30',end:'2027-01-02'})[0],{start:'2025-12-30',end:'2026-01-02'});
});

test('only complete daily cm series count; no missing data becomes zero snow',()=>{
  const period=snowPeriods(dates)[0];
  const valid=readSnowPeriod(response(period,[0,0.09,0.1]),period);
  assert.equal(valid.snowDays,1);
  assert.ok(Math.abs(valid.totalCm-0.19)<0.00001);
  for(const values of [[0,null,1],[0,-1,1],[0,'1',1],[0,NaN,1]])assert.equal(readSnowPeriod(response(period,values),period),null);
  const incomplete=response(period);
  incomplete.daily.time.pop();
  assert.equal(readSnowPeriod(incomplete,period),null);
  const duplicate=response(period);
  duplicate.daily.time[1]=duplicate.daily.time[0];
  assert.equal(readSnowPeriod(duplicate,period),null);
  const wrongUnit=response(period);
  wrongUnit.daily_units.snowfall_sum='inch';
  assert.equal(readSnowPeriod(wrongUnit,period),null);
});

test('frequency is years with any snow, not the fraction of snow days',()=>{
  const periods=snowPeriods(dates);
  const samples=[readSnowPeriod(response(periods[0],[0,0,3]),periods[0]),readSnowPeriod(response(periods[1],[0]),periods[1]),readSnowPeriod(response(periods[2],[1,0,0]),periods[2])];
  const result=summarizeSnow(samples);
  assert.deepEqual(result,{availableYears:3,snowyYears:2,frequency:67,meanCm:4/3});
  assert.equal(summarizeSnow([samples[0],periods[1],samples[2]]).frequency,100);
  assert.deepEqual(summarizeSnow([periods[0],samples[1],periods[2]]),{availableYears:1,snowyYears:0,frequency:0,meanCm:0});
  assert.equal(summarizeSnow(periods),null);
  assert.match(renderSnow(samples),/67%/);
  assert.match(renderSnow(samples),/2\/3 anni/);
  assert.match(renderSnow(samples),/frequenza, non previsione/);
  assert.doesNotMatch(renderSnow(periods),/0%/);
});

test('archive requests independently fall back to 2 or 1 complete years',async()=>{
  const original=globalThis.fetch;
  let missing=new Set(['2024']);
  globalThis.fetch=async value=>{
    const url=new URL(value);
    assert.equal(url.searchParams.get('daily'),'snowfall_sum');
    assert.equal(url.searchParams.get('timezone'),'auto');
    const period={start:url.searchParams.get('start_date'),end:url.searchParams.get('end_date')};
    if(missing.has(period.start.slice(0,4)))throw new Error('Fixture: year unavailable');
    return {ok:true,json:async()=>response(period)};
  };
  try{
    let periods=await loadSnowHistory(place,dates,'2026-10-26');
    assert.equal(summarizeSnow(periods).availableYears,2);
    assert.match(renderSnow(periods),/n\/d/);
    missing=new Set(['2024','2023']);
    periods=await loadSnowHistory(place,dates,'2026-10-26');
    assert.equal(summarizeSnow(periods).availableYears,1);
    missing=new Set(['2025','2024','2023']);
    assert.equal(summarizeSnow(await loadSnowHistory(place,dates,'2026-10-26')),null);
  }finally{globalThis.fetch=original}
});

test('future and unfinished comparison periods are unavailable without API requests',async()=>{
  const original=globalThis.fetch;
  let requests=0;
  globalThis.fetch=async()=>{requests++;throw new Error('Unexpected request')};
  try{
    const periods=await loadSnowHistory(place,{start:'2030-01-10',end:'2030-01-12'},'2026-10-26');
    assert.equal(summarizeSnow(periods),null);
    assert.equal(requests,0);
  }finally{globalThis.fetch=original}
});

test('entry page opts into snow exactly; snow composes with foliage and weather',async()=>{
  const original={document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch,setInterval:globalThis.setInterval};
  const root={innerHTML:''};
  const calls=[];
  let failSnow=false;
  const foliage=JSON.parse(await readFile(new URL('../weather/data/foliage/data.json',import.meta.url),'utf8'));
  globalThis.document={getElementById:()=>root,hidden:false};
  globalThis.location={search:''};
  globalThis.setInterval=()=>0;
  globalThis.fetch=async value=>{
    const url=new URL(value);calls.push(url);
    let data;
    if(url.pathname.endsWith('/data/foliage/data.json'))data=foliage;
    else if(url.hostname.includes('geocoding-api'))data={results:[{...place,name:'Kyoto'}]};
    else if(url.searchParams.get('daily')==='snowfall_sum'){
      if(failSnow)throw new Error('Fixture: snow unavailable');
      data=response({start:url.searchParams.get('start_date'),end:url.searchParams.get('end_date')},[1]);
    }else if(url.hostname.includes('archive-api'))data={daily:{temperature_2m_max:[20],temperature_2m_min:[10]}};
    else data={current:{temperature_2m:22,apparent_temperature:20,relative_humidity_2m:60,weather_code:0,is_day:1}};
    return {ok:true,json:async()=>data};
  };
  let index=0;
  async function run(query){
    calls.length=0;location.search=query;
    await import(new URL('../weather/scripts/widget.js?snow-case='+index++,import.meta.url));
    assert.match(root.innerHTML,/22/);
  }
  try{
    for(const flag of ['', '&snow=false','&snow=1']){
      await run('?city=Kyoto&date=2026-12-01'+flag);
      assert.equal(calls.some(url=>url.searchParams.get('daily')==='snowfall_sum'),false);
      assert.doesNotMatch(root.innerHTML,/snow-section/);
    }
    await run('?city=Kyoto&snow=true');
    assert.equal(calls.some(url=>url.searchParams.get('daily')==='snowfall_sum'),false);
    assert.doesNotMatch(root.innerHTML,/snow-section/);
    await run('?city=Kyoto&date=2026-12-01&snow=true');
    assert.match(root.innerHTML,/100%/);
    assert.match(root.innerHTML,/3\/3 anni/);
    assert.match(root.innerHTML,/Storico 2025/);
    await run('?city=Kyoto&date=2026-12-01&foliage=true&snow=true');
    assert.match(root.innerHTML,/folrow/);
    assert.match(root.innerHTML,/snow-section/);
    failSnow=true;
    await run('?city=Kyoto&date=2026-12-01&foliage=true&snow=true');
    assert.match(root.innerHTML,/Dati neve non disponibili/);
    assert.match(root.innerHTML,/folrow/);
    assert.match(root.innerHTML,/Storico 2025/);
  }finally{Object.assign(globalThis,original)}
});
