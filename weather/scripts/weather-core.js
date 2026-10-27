'use strict';

/**
 * Shared weather logic for the reusable weather widget and optional extensions.
 * URL:
 *   ?city=Kyoto&country=JP&start=2026-11-15&end=2026-11-19
 *
 * start/end are optional (single day: ?date=2026-11-15). Historical values
 * are the AVERAGE of each day's high/low during the same dates in the previous year.
 */
const $ = (id) => document.getElementById(id);
const formatTemp = (value) => Number.isFinite(value) ? Math.round(value) + '°' : '—';
const toDay = (date) => new Date(date + 'T12:00:00Z');
const dayLabel = (date) => new Intl.DateTimeFormat('it-IT', {day:'numeric',month:'short',timeZone:'UTC'}).format(toDay(date));
const shiftYear = (date, diff) => {
  const year = Number(date.slice(0,4)) + diff;
  const monthAndDay = date.slice(4);
  const candidate = String(year) + monthAndDay;
  if (monthAndDay === '-02-29' && toDay(candidate).toISOString().slice(0,10) !== candidate) return String(year) + '-02-28';
  return candidate;
};
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(toDay(value).getTime()) && toDay(value).toISOString().slice(0,10) === value;
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const icon = (code,isDay) => code==null?'·':code===0?(isDay?'☀️':'🌙'):code<=2?(isDay?'🌤️':'☁️'):code===3?'☁️':code<=48?'🌫️':code<=57?'🌦️':code<=67?'🌧️':code<=77?'❄️':code<=82?'🌦️':code<=86?'🌨️':code>=95?'⛈️':'☁️';
const description = code => code==null?'Dati non disponibili':code===0?'Sereno':code<=2?'Poco nuvoloso':code===3?'Nuvoloso':code<=48?'Nebbia':code<=57?'Pioviggine':code<=67?'Pioggia':code<=77?'Neve':code<=82?'Rovesci':code<=86?'Neve':code>=95?'Temporale':'Variabile';
const avg = xs => { const valid=xs.filter(Number.isFinite); return valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : null; };

export function readSettings(query = new URLSearchParams(location.search)) {
  const city = (query.get('city') || '').trim().slice(0,120);
  const country = (query.get('country') || '').trim().toUpperCase();
  const latParam=query.get('lat'), lonParam=query.get('lon');
  const hasCoordinates=latParam!==null||lonParam!==null;
  const latitude=latParam!==null && latParam.trim()!==''?Number(latParam):NaN;
  const longitude=lonParam!==null && lonParam.trim()!==''?Number(lonParam):NaN;
  const coordinates=hasCoordinates && Number.isFinite(latitude) && latitude>=-90 && latitude<=90
    && Number.isFinite(longitude) && longitude>=-180 && longitude<=180 ? {latitude,longitude}:null;
  if(hasCoordinates && !coordinates)return {city,country,dates:null,coordinates:null,error:'Coordinate non valide. Specifica lat e lon numerici nell’URL.'};
  const single = query.get('date');
  let start = query.get('start') || query.get('from') || single || '';
  let end = query.get('end') || query.get('to') || single || start;
  const hasDates = !!(start || end);
  if (hasDates && (!validDate(start) || !validDate(end) || start > end)) {
    return {city,country,dates:null,error:'Date non valide. Usa start=AAAA-MM-GG&end=AAAA-MM-GG.'};
  }
  if (hasDates && (toDay(end) - toDay(start)) / 86400000 > 366) {
    return {city,country,dates:null,error:'L’intervallo non può superare un anno.'};
  }
  return {city,country,coordinates,dates:hasDates?{start,end,historicalStart:shiftYear(start,-1),historicalEnd:shiftYear(end,-1)}:null,error:null};
}

export async function requestJson(url, timeout=15000) {
  const ctrl=new AbortController();
  const timeoutId=setTimeout(()=>ctrl.abort(),timeout);
  try {
    const res=await fetch(url,{signal:ctrl.signal,cache:'no-store'});
    if (!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  } finally {clearTimeout(timeoutId)}
}

const endpoint = (base,params) => {
  const url = new URL(base);
  Object.entries(params).forEach(([name,value]) => url.searchParams.set(name,String(value)));
  return url.toString();
};

export async function findCity(city,country='') {
  const params={name:city,count:10,language:'it',format:'json'};
  if (/^[A-Z]{2}$/.test(country)) params.countryCode=country;
  const data=await requestJson(endpoint('https://geocoding-api.open-meteo.com/v1/search',params));
  const matches=Array.isArray(data.results)?data.results:[];
  if (!matches.length) throw new Error('Città non trovata. Controlla il nome o il paese.');
  const exact=matches.find(item=>normalized(item.name)===normalized(city.split(',')[0]));
  return exact || matches[0];
}

async function currentWeather(place) {
  const data=await requestJson(endpoint('https://api.open-meteo.com/v1/forecast',{
    latitude:place.latitude,longitude:place.longitude,timezone:'auto',
    current:'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day'
  }));
  if (!data.current) throw new Error('Meteo attuale non disponibile');
  return data.current;
}
async function historicalWeather(place,dates) {
  const data=await requestJson(endpoint('https://archive-api.open-meteo.com/v1/archive',{
    latitude:place.latitude,longitude:place.longitude,timezone:'auto',
    start_date:dates.historicalStart,end_date:dates.historicalEnd,
    daily:'temperature_2m_max,temperature_2m_min'
  }));
  const daily=data.daily;
  if (!daily) throw new Error('Dati storici non disponibili');
  return {
    high:avg(daily.temperature_2m_max || []),
    low:avg(daily.temperature_2m_min || [])
  };
}
const rangeLabel = ({start,end}) => start === end ? dayLabel(start) : Number(start.slice(-2))+' – '+dayLabel(end);
const historyYear = dates => dates.historicalStart.slice(0,4) === dates.historicalEnd.slice(0,4)
  ? dates.historicalStart.slice(0,4)
  : dates.historicalStart.slice(0,4)+'–'+dates.historicalEnd.slice(0,4);

export function cardHTML({place, city, dates, weather=null, history=null, historyError=false, weatherError=false, extra='', placeLocalName=''}) {
  const isReady=!!place;
  const name=escapeHTML(place?.name || city || 'Meteo');
  const region=isReady ? [place.admin1,place.country].filter(Boolean).map(escapeHTML).join(' · ') : '';
  const visit=dates?rangeLabel(dates):'';
  const current=weather;
  const time=current?.time ? current.time.slice(11,16) : '';
  const condition=current?description(current.weather_code)+(time?' · '+time+' ora locale':''):(weatherError?'Meteo attuale non disponibile':'Caricamento meteo…');
  const historical=dates?`<section class="widget-section history" aria-label="Temperature storiche"><div class="history-title">Storico ${historyYear(dates)}<small>medie nelle tue stesse date</small></div><div class="history-num">${history?.high==null?'—':`<span class="high">↑ ${formatTemp(history.high)}</span>`}&nbsp; ${history?.low==null?'—':`<span class="low">↓ ${formatTemp(history.low)}</span>`}</div>${historyError?'<div class="status-unknown">Storico non disponibile per questo intervallo.</div>':''}</section>`:'';
  const stats=current?`<span class="now-extra"><span class="stat"><span class="stat-label">Percepita</span><span class="stat-value">${formatTemp(current.apparent_temperature)}</span></span><span class="stat"><span class="stat-label">Umidità</span><span class="stat-value">${Number.isFinite(current.relative_humidity_2m)?Math.round(current.relative_humidity_2m)+'%':'—'}</span></span></span>`:'';
  return `<article class="city"><section class="widget-section weather-section" aria-label="Meteo attuale"><div class="head"><span class="place"><span class="name">${name}</span><span class="place-local-name">${escapeHTML(placeLocalName)}</span></span><span class="visit">${escapeHTML(visit)}</span></div>
    <div class="nowrow"><span class="icon" aria-hidden="true">${icon(current?.weather_code,current?.is_day!==0)}</span><span class="temp">${formatTemp(current?.temperature_2m)}</span><span class="desc"><b>Meteo attuale</b>${escapeHTML(condition)}</span>${stats}</div></section>
    ${historical}${extra}
  </article>`;
}

/** Mount a single location's weather card. renderExtra receives {place, dates, settings}
 * and returns safe HTML for an optional extension rendered below the historical block.
 */
export async function mountWeatherWidget({root=document.getElementById('cards'),renderExtra=()=>'',getPlaceLocalName=()=>'',extraReady=Promise.resolve(),loadExtra=async()=>{}}={}) {
  if(!root) throw new Error('Widget root not found');
  const settings=readSettings();
  const {city,country,dates,error,coordinates}=settings;
  if(!city || city.length<2 || error){
    root.innerHTML=`<article class="city"><div class="head"><span class="place"><span class="name">Meteo</span></span></div><div class="status-unknown">${escapeHTML(error || 'Specifica una città nell’URL: ?city=Kyoto&start=2026-11-15&end=2026-11-19')}</div></article>`;
    return;
  }
  let place=null,weather=null,history=null,historyError=false,weatherError=false;
  const update=()=>{root.innerHTML=cardHTML({place,city,dates,weather,history,historyError,weatherError,extra:renderExtra({place,dates,settings}),placeLocalName:getPlaceLocalName({place,dates,settings})})};
  update();
  try {
    place=coordinates
      ? {name:city,latitude:coordinates.latitude,longitude:coordinates.longitude,
          country_code:country,country:country==='JP'?'Giappone':country}
      : await findCity(city,country);
  } catch(err) {
    root.innerHTML=`<article class="city"><div class="head"><span class="place"><span class="name">${escapeHTML(city)}</span></span></div><div class="status-unknown">${escapeHTML(err.message)}</div></article>`;
    return;
  }
  update();
  const jobs=[currentWeather(place).then(result=>{weather=result;weatherError=false;update()}).catch(err=>{weatherError=true;update();console.warn('Current weather:',err.message)})];
  if(dates)jobs.push(historicalWeather(place,dates).then(result=>{history=result;historyError=false;update()}).catch(err=>{historyError=true;update();console.warn('Historical weather:',err.message)}));
  jobs.push(extraReady.then(update));
  jobs.push(loadExtra({place,dates,settings},update));
  await Promise.all(jobs);
  let refreshing=false;
  setInterval(async()=>{if(document.hidden||refreshing)return;refreshing=true;try{weather=await currentWeather(place);weatherError=false;update()}catch(err){weatherError=true;update();console.warn('Weather refresh:',err.message)}finally{refreshing=false}},30*60*1000);
}

export {escapeHTML, normalized,dayLabel,toDay,formatTemp,shiftYear};
