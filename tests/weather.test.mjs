import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readSettings,mountWeatherWidget} from '../weather/scripts/weather-core.js';
import {findFoliage,renderFoliage,createFoliageExtension} from '../weather/scripts/sections/foliage.js';

const data=JSON.parse(await readFile(new URL('../weather/data/foliage/data.json',import.meta.url),'utf8'));
const place={name:'Kyoto',country_code:'JP',latitude:35,longitude:135};
const visit=(start,end=start)=>({start,end});
const render=(start,end=start)=>renderFoliage(data,{place,dates:visit(start,end)});

test('all city records have real, ordered seasonal dates and source URLs',()=>{
  assert.equal(data.schemaVersion,1);
  assert.equal(Object.hasOwn(data,"defaultSource"),false);
  assert.ok(Object.keys(data.cities).length>0);
  for(const city of Object.values(data.cities)){
    assert.match(city.countryCode,/^[A-Z]{2}$/);
    assert.deepEqual(Object.keys(city).slice(0,4),['countryCode','placeName','placeLocalName','sourceUrl']);
    assert.equal(new URL(city.sourceUrl).protocol,'https:');
    assert.ok(city.placeName && city.placeLocalName);
    assert.ok(Array.isArray(city.trees) && city.trees.length);
    for(const period of city.trees){
      assert.ok(period.name && ['yellow','orange','red'].includes(period.color));
      for(const value of [period.start,period.peak,period.end])assert.equal(new Date(value+'T12:00:00Z').toISOString().slice(0,10),value);
      assert.ok(period.start<=period.peak && period.peak<=period.end && period.start<period.end);
    }
  }
});

test('settings preserve leap-year history, aliases and invalid-date handling',()=>{
  const settings=query=>readSettings(new URLSearchParams(query));
  assert.equal(settings('city=Kyoto&date=2024-02-29').dates.historicalStart,'2023-02-28');
  assert.equal(settings('city=Kyoto&from=2026-11-15&to=2026-11-19').dates.end,'2026-11-19');
  assert.ok(settings('city=Kyoto&date=2026-02-30').error);
  assert.ok(settings('city=Kyoto&start=2026-11-19&end=2026-11-15').error);
});

test('foliage requires matching country/city, dates and overlapping season',()=>{
  assert.equal(render('2026-04-15'),'');
  assert.equal(render('2027-11-27'),'');
  assert.equal(renderFoliage(data,{place,dates:null}),'');
  assert.equal(renderFoliage(data,{place:{...place,country_code:'US'},dates:visit('2026-11-27')}),'');
  assert.equal(renderFoliage(data,{place:{...place,name:'Sapporo'},dates:visit('2026-11-27')}),'');
  assert.equal(findFoliage(data,{name:'Nikko',country_code:'JP'}),data.cities.nikko);
});

test('trees evaluated independently; inclusive boundaries and interval overlap',()=>{
  const fixture=structuredClone(data);
  fixture.cities.kyoto.trees=[
    {name:'Ginkgo',color:'yellow',start:'2026-11-17',peak:'2026-11-27',end:'2026-12-07'},
    {name:'Maple',color:'red',start:'2026-11-29',peak:'2026-12-11',end:'2026-12-19'}
  ];
  const render=(start,end=start)=>renderFoliage(fixture,{place,dates:visit(start,end)});
  assert.match(render('2026-11-17'),/bar yellow/);
  assert.doesNotMatch(render('2026-11-17'),/bar red/);
  assert.equal(render('2026-11-16'),'');
  assert.match(render('2026-12-19'),/bar red/);
  assert.doesNotMatch(render('2026-12-19'),/bar yellow/);
  assert.equal(render('2026-12-20'),'');
  const both=render('2026-11-01','2026-12-31');
  assert.equal((both.match(/class="folrow"/g)||[]).length,2);
  assert.doesNotMatch(both,/NaN|Infinity/);
  assert.match(render('2026-12-31','2027-01-02')||'hidden',/hidden/);
});

test('generic place fields support other countries and non-Latin local names',()=>{
  const extended=structuredClone(data);
  extended.cities.lyon={...extended.cities.kyoto,placeName:'Lyon',placeLocalName:'Lyon',countryCode:'FR',aliases:['Lyons']};
  const frenchPlace={...place,name:'Lyons',country_code:'FR'};
  assert.equal(findFoliage(extended,frenchPlace),extended.cities.lyon);
  assert.match(renderFoliage(extended,{place:frenchPlace,dates:visit('2026-12-01')}),/folrow/);
  assert.equal(findFoliage(extended,{...frenchPlace,country_code:'JP'}),null);
  assert.equal(findFoliage(data,{...place,name:data.cities.kyoto.placeLocalName}),data.cities.kyoto);
  assert.equal(findFoliage(data,{...place,name:data.cities.tokyo.placeLocalName}),data.cities.tokyo);
  assert.equal(findFoliage(data,{...place,name:'!!!'}),null);
});

test('tree list drives labels, order and all three fixed color palettes',()=>{
  const altered=structuredClone(data);
  const dates={start:'2026-10-01',peak:'2026-10-20',end:'2026-10-31'};
  altered.cities.kyoto.trees=[
    {name:'Larice',color:'yellow',...dates},
    {name:'Faggio',color:'orange',...dates},
    {name:'Albero <rosso>',color:'red',...dates}
  ];
  const html=renderFoliage(altered,{place,dates:visit('2026-10-20')});
  assert.equal((html.match(/class="folrow"/g)||[]).length,3);
  assert.match(html,/bar yellow/);
  assert.match(html,/bar orange/);
  assert.match(html,/bar red/);
  assert.match(html,/Albero &lt;rosso&gt;/);
  assert.ok(html.indexOf('Larice')<html.indexOf('Faggio'));
  assert.doesNotMatch(html,/Ginkgo|Maple/);
  altered.cities.kyoto.trees.push({name:'Bad color',color:'orange" onclick="alert(1)',...dates});
  altered.cities.kyoto.trees.push({name:'   ',color:'red',...dates});
  altered.cities.kyoto.trees.push(null);
  assert.equal(renderFoliage(altered,{place,dates:visit('2026-10-20')}),html);
  altered.cities.kyoto.trees=[];
  assert.equal(renderFoliage(altered,{place,dates:visit('2026-10-20')}),'');
});

test('invalid trees omitted without losing valid trees; source escaped',()=>{
  const altered=structuredClone(data);
  altered.cities.kyoto.trees[0].end=altered.cities.kyoto.trees[0].start;
  altered.cities.kyoto.sourceUrl='javascript:alert(1)';
  let html=renderFoliage(altered,{place,dates:visit('2026-12-01')});
  assert.doesNotMatch(html,/bar yellow|javascript:/);
  assert.match(html,/bar red/);
  altered.cities.kyoto.trees[0]={name:'Ginkgo',color:'yellow',start:'2026-02-30',peak:'2026-11-27',end:'2026-12-07'};
  html=renderFoliage(altered,{place,dates:visit('2026-12-01')});
  assert.doesNotMatch(html,/bar yellow/);
});

test('single entry page opts in exactly; weather survives unavailable foliage',async()=>{
  const original={document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch,setInterval:globalThis.setInterval};
  const root={innerHTML:''};
  const calls=[];
  let failed=false;
  globalThis.document={getElementById:()=>root,hidden:false};
  globalThis.location={search:''};
  globalThis.setInterval=()=>0;
  globalThis.fetch=async url=>{
    const value=String(url);
    calls.push(value);
    let result;
    if(value.endsWith('/data/foliage/data.json')){
      if(failed)throw new Error('Fixture: foliage unavailable');
      result=data;
    }else if(value.includes('geocoding-api'))result={results:[place]};
    else if(value.includes('archive-api'))result={daily:{temperature_2m_max:[20,22],temperature_2m_min:[10,12]}};
    else result={current:{temperature_2m:22,apparent_temperature:21,relative_humidity_2m:60,weather_code:2,is_day:1}};
    return {ok:true,json:async()=>result};
  };
  let number=0;
  async function run(query){
    calls.length=0;
    root.innerHTML='';
    location.search=query;
    await import(new URL('../weather/scripts/widget.js?case='+number++,import.meta.url));
    assert.match(root.innerHTML,/22/);
  }
  try{
    for(const flag of ['', '&foliage=false','&foliage=1']){
      await run('?city=Kyoto&date=2026-12-01'+flag);
      assert.doesNotMatch(root.innerHTML,/folrow/);
      assert.equal(calls.some(url=>url.endsWith('/data/foliage/data.json')),false);
    }
    await run('?city=Kyoto&foliage=true');
    assert.equal(calls.some(url=>url.endsWith('/data/foliage/data.json')),false);
    assert.doesNotMatch(root.innerHTML,/class="history"/);
    await run('?city=Kyoto&date=2026-12-01&foliage=true');
    assert.equal((root.innerHTML.match(/class="folrow"/g)||[]).length,2);
    assert.match(root.innerHTML,/Storico 2025/);
    assert.ok(root.innerHTML.includes(data.cities.kyoto.placeLocalName));
    await run('?city=Kyoto&date=2026-04-15&foliage=true');
    assert.doesNotMatch(root.innerHTML,/fol-head|folrow/);
    failed=true;
    await run('?city=Kyoto&date=2026-12-01&foliage=true');
    assert.match(root.innerHTML,/Impossibile caricare i dati/);
    assert.match(root.innerHTML,/Storico 2025/);
  }finally{
    Object.assign(globalThis,original);
  }
});

test('slow foliage does not block weather rendering',async()=>{
  const original={document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch,setInterval:globalThis.setInterval};
  const root={innerHTML:''};
  let resolveFoliage,weatherRendered;
  const weatherReady=new Promise(resolve=>weatherRendered=resolve);
  const pendingFoliage=new Promise(resolve=>resolveFoliage=resolve);
  let contents='';
  Object.defineProperty(root,'innerHTML',{get:()=>contents,set:value=>{contents=value;if(value.includes('22'))weatherRendered()}});
  globalThis.document={getElementById:()=>root,hidden:false};
  globalThis.location={search:'?city=Kyoto&date=2026-12-01'};
  globalThis.setInterval=()=>0;
  globalThis.fetch=async url=>{
    const value=String(url);
    if(value.endsWith('/data/foliage/data.json'))return pendingFoliage;
    const result=value.includes('geocoding-api')?{results:[place]}
      :value.includes('archive-api')?{daily:{temperature_2m_max:[20],temperature_2m_min:[10]}}
      :{current:{temperature_2m:22}};
    return {ok:true,json:async()=>result};
  };
  try{
    const mounted=mountWeatherWidget(createFoliageExtension());
    await weatherReady;
    assert.doesNotMatch(root.innerHTML,/folrow/);
    resolveFoliage({ok:true,json:async()=>data});
    await mounted;
    assert.match(root.innerHTML,/folrow/);
  }finally{
    Object.assign(globalThis,original);
  }
});
