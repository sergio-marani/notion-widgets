import {requestJson,escapeHTML,toDay,shiftYear} from '../weather-core.js';

const snowThreshold=0.1;
const dayMs=86400000;
const formatCm=value=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(value);
const yearLabel=period=>period.start.slice(0,4)===period.end.slice(0,4)
  ?period.start.slice(0,4):period.start.slice(0,4)+'–'+period.end.slice(2,4);

export function snowPeriods(dates){
  return [1,2,3].map(offset=>({start:shiftYear(dates.start,-offset),end:shiftYear(dates.end,-offset)}));
}

export function readSnowPeriod(response,period){
  const times=response?.daily?.time,values=response?.daily?.snowfall_sum;
  const count=Math.round((toDay(period.end)-toDay(period.start))/dayMs)+1;
  if(response?.daily_units?.snowfall_sum!=='cm' || !Array.isArray(times) || !Array.isArray(values)
    || times.length!==count || values.length!==count)return null;
  let totalCm=0,snowDays=0;
  for(let index=0;index<count;index++){
    const expected=new Date(toDay(period.start).getTime()+index*dayMs).toISOString().slice(0,10);
    const value=values[index];
    if(times[index]!==expected || !Number.isFinite(value) || value<0)return null;
    totalCm+=value;
    if(value>=snowThreshold)snowDays++;
  }
  return {...period,totalCm,snowDays};
}

export function summarizeSnow(periods){
  const available=periods.filter(period=>Number.isFinite(period.totalCm));
  if(!available.length)return null;
  const snowyYears=available.filter(period=>period.snowDays>0).length;
  return {
    availableYears:available.length,
    snowyYears,
    frequency:Math.round(snowyYears/available.length*100),
    meanCm:available.reduce((total,period)=>total+period.totalCm,0)/available.length
  };
}

export async function loadSnowHistory(place,dates,today=new Date().toISOString().slice(0,10)){
  return Promise.all(snowPeriods(dates).map(async period=>{
    // A future or still-running comparison period is never a complete historical sample.
    if(period.end>=today)return period;
    const url=new URL('https://archive-api.open-meteo.com/v1/archive');
    Object.entries({latitude:place.latitude,longitude:place.longitude,timezone:'auto',
      start_date:period.start,end_date:period.end,daily:'snowfall_sum',precipitation_unit:'mm'
    }).forEach(([key,value])=>url.searchParams.set(key,String(value)));
    try{
      const response=await requestJson(url.toString());
      return readSnowPeriod(response,period)||period;
    }catch(error){
      console.warn('Snow history '+yearLabel(period)+':',error.message);
      return period;
    }
  }));
}

export function renderSnow(periods,{loading=false}={}){
  const summary=summarizeSnow(periods);
  const heading='<span class="snow-title"><span class="snow-icon" aria-hidden="true">❄</span> Neve · storico</span>';
  if(loading)return `<section class="snow-section" aria-label="Storico neve">${heading}<div class="snow-note" role="status">Caricamento delle stesse date nei 3 anni precedenti…</div></section>`;
  if(!summary)return `<section class="snow-section" aria-label="Storico neve">${heading}<div class="snow-note">Dati neve non disponibili per queste date nei 3 anni precedenti.</div></section>`;
  const years=periods.map(period=>{
    const available=Number.isFinite(period.totalCm);
    const amount=available?formatCm(period.totalCm)+' cm':'n/d';
    const status=available?(period.snowDays?'snow-year snowy':'snow-year'):'snow-year missing';
    const detail=available?`${period.snowDays} giorni con almeno 0,1 cm`:'Dati incompleti o non disponibili';
    return `<span class="${status}" title="${escapeHTML(period.start+' → '+period.end+' · '+detail)}"><span>${escapeHTML(yearLabel(period))}</span><b>${amount}</b></span>`;
  }).join('');
  return `<section class="snow-section" aria-label="Storico neve"><div class="snow-head">${heading}<span class="snow-frequency" aria-label="Frequenza storica dei periodi con neve: ${summary.frequency}%">${summary.frequency}% <small>storico</small></span></div><div class="snow-summary">Neve in ${summary.snowyYears}/${summary.availableYears} anni · media ${formatCm(summary.meanCm)} cm</div><div class="snow-years">${years}</div><div class="snow-note">Stesse date · ≥0,1 cm/giorno · frequenza, non previsione</div></section>`;
}

export function createSnowExtension(){
  let periods=[],loading=true;
  return {
    renderExtra:({place,dates})=>place && dates?renderSnow(periods,{loading}):'',
    loadExtra:async({place,dates},update)=>{
      if(!place || !dates)return;
      periods=await loadSnowHistory(place,dates);
      loading=false;
      update();
    }
  };
}
