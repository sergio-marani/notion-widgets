import {requestJson,escapeHTML,toDay,shiftYear} from '../weather-core.js';

const snowThreshold=0.1;
const dayMs=86400000;
const formatCm=value=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(value);
const yearLabel=period=>period.start.slice(0,4)===period.end.slice(0,4)
  ?period.start.slice(0,4):period.start.slice(0,4)+'–'+period.end.slice(2,4);

export function snowPeriods(dates){
  return [3,2,1].map(offset=>({start:shiftYear(dates.start,-offset),end:shiftYear(dates.end,-offset)}));
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

export function readSnowForecast(response,dates){
  const times=response?.daily?.time,values=response?.daily?.snowfall_sum;
  const requiredDays=Math.round((toDay(dates.end)-toDay(dates.start))/dayMs)+1;
  const unavailable={state:'unavailable',requiredDays,coveredDays:0,totalCm:0,snowDays:0,probability:null};
  if(response?.daily_units?.snowfall_sum!=='cm' || !Array.isArray(times) || !Array.isArray(values))return unavailable;
  let totalCm=0,snowDays=0,coveredDays=0;
  for(let day=toDay(dates.start).getTime();day<=toDay(dates.end).getTime();day+=dayMs){
    const iso=new Date(day).toISOString().slice(0,10),index=times.indexOf(iso);
    const value=values[index];
    if(index<0 || times.lastIndexOf(iso)!==index || !Number.isFinite(value) || value<0)continue;
    coveredDays++;
    totalCm+=value;
    if(value>=snowThreshold)snowDays++;
  }
  return {state:coveredDays===requiredDays?'complete':coveredDays?'partial':'unavailable',requiredDays,coveredDays,totalCm,snowDays,probability:null};
}

export function snowEnsembleProbability(response,dates){
  const members=Object.keys(response?.daily||{}).filter(key=>/^snowfall_sum(?:_member\d+)?$/.test(key));
  const complete=members.map(key=>readSnowForecast({daily_units:{snowfall_sum:response.daily_units?.[key]},
    daily:{time:response.daily.time,snowfall_sum:response.daily[key]}},dates)).filter(member=>member.state==='complete');
  if(complete.length<2)return null;
  return Math.round(complete.filter(member=>member.snowDays>0).length/complete.length*100);
}

function forecastUrl(base,place,extra={}){
  const url=new URL(base);
  Object.entries({latitude:place.latitude,longitude:place.longitude,timezone:'auto',
    daily:'snowfall_sum',forecast_days:16,precipitation_unit:'mm',...extra
  }).forEach(([key,value])=>url.searchParams.set(key,String(value)));
  return url.toString();
}

export async function loadSnowForecast(place,dates){
  let forecast;
  try{
    forecast=readSnowForecast(await requestJson(forecastUrl('https://api.open-meteo.com/v1/forecast',place)),dates);
  }catch(error){
    console.warn('Snow forecast:',error.message);
    return {state:'unavailable',probability:null};
  }
  if(forecast.state!=='complete')return forecast;
  if(!forecast.snowDays)return {...forecast,probability:0};
  try{
    const response=await requestJson(forecastUrl('https://ensemble-api.open-meteo.com/v1/ensemble',place,{models:'ecmwf_ifs025'}));
    const probability=snowEnsembleProbability(response,dates);
    // Do not label a positive snowfall forecast as 0% when the coarser ensemble disagrees.
    return {...forecast,probability:probability>0?probability:null};
  }catch(error){console.warn('Snow ensemble:',error.message);return forecast}
}

export function renderSnow(periods,{loading=false,forecastLoading=false,forecast={state:'unavailable'}}={}){
  const summary=summarizeSnow(periods);
  const heading='<span class="snow-title"><span class="snow-icon" aria-hidden="true">❄</span> Neve</span>';
  const predictedSnow=forecast.snowDays>0;
  const probability=forecastLoading?null:forecast.state==='complete'
    ?forecast.probability:predictedSnow?null:summary?.frequency;
  const basis=forecastLoading?'In attesa della previsione':forecast.state==='complete'
    ?'Previsione attuale':predictedSnow?'Probabilità non disponibile per tutto il periodo'
    :summary?'Stima storica, non previsione':'Probabilità non disponibile';
  let message='Il meteo per le tue date non è disponibile.';
  if(forecastLoading)message='Caricamento del meteo per le tue date…';
  else if(forecast.state==='complete')message=predictedSnow
    ?`Previsti ${formatCm(forecast.totalCm)} cm di neve nelle tue date.`
    :'Non è ancora prevista neve per le tue date.';
  else if(forecast.state==='partial')message=predictedSnow
    ?`Meteo parziale (${forecast.coveredDays}/${forecast.requiredDays} giorni): almeno ${formatCm(forecast.totalCm)} cm di neve previsti.`
    :`Il meteo è disponibile solo per ${forecast.coveredDays}/${forecast.requiredDays} giorni delle tue date.`;
  const years=[...periods].sort((a,b)=>a.start.localeCompare(b.start)).map(period=>{
    const available=Number.isFinite(period.totalCm);
    const amount=available?formatCm(period.totalCm)+' cm':'n/d';
    const status=available?(period.snowDays?'snow-year snowy':'snow-year'):'snow-year missing';
    const detail=available?`${period.snowDays} giorni con almeno 0,1 cm`:'Dati incompleti o non disponibili';
    return `<span class="${status}" title="${escapeHTML(period.start+' → '+period.end+' · '+detail)}"><span>${escapeHTML(yearLabel(period))}</span><b>${amount}</b></span>`;
  }).join('');
  const percent=Number.isFinite(probability)?probability+'%':'—';
  const history=loading?'<div class="snow-note" role="status">Caricamento dello storico…</div>'
    :`<div class="snow-history-head"><span>Negli anni precedenti:</span>${summary?`<span>media ${formatCm(summary.meanCm)} cm</span>`:''}</div><div class="snow-years">${years}</div><div class="snow-note">${summary?`Neve in ${summary.snowyYears}/${summary.availableYears} anni · ≥0,1 cm/giorno`:'Storico neve non disponibile per queste date.'}</div>`;
  return `<section class="widget-section snow-section" aria-label="Neve nelle date del viaggio"><div class="snow-head">${heading}<span class="snow-frequency" title="${escapeHTML(basis)}" aria-label="Probabilità neve: ${percent}. ${escapeHTML(basis)}"><small>probabilità </small>${percent}</span></div><div class="snow-forecast" role="status">${message}</div><div class="snow-basis">${basis}</div>${history}</section>`;
}

export function createSnowExtension(){
  let periods=[],loading=true,forecastLoading=true,forecast={state:'unavailable'};
  return {
    renderExtra:({place,dates})=>place && dates?renderSnow(periods,{loading,forecastLoading,forecast}):'',
    loadExtra:async({place,dates},update)=>{
      if(!place || !dates)return;
      await Promise.all([
        loadSnowHistory(place,dates).then(result=>{periods=result;loading=false;update()}),
        loadSnowForecast(place,dates).then(result=>{forecast=result;forecastLoading=false;update()})
      ]);
    }
  };
}
