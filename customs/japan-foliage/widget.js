import {mountWeatherWidget,requestJson,normalized,escapeHTML,dayLabel,toDay} from '../../generics/weather/weather-core.js';

let foliageData=null;
let foliageError=false;
try {
  foliageData=await requestJson(new URL('./foliage.json',import.meta.url).toString());
  if(!foliageData || !foliageData.cities) throw new Error('Missing foliage data');
} catch(err){
  foliageError=true;
  console.warn('Foliage data:',err.message);
}

function findFoliage(place){
  if(!place || place.country_code!=='JP' || !foliageData?.cities)return null;
  const location=normalized(place.name);
  return Object.values(foliageData.cities).find(record=>
    [record.name,...(record.aliases||[])].some(name=>normalized(name)===location)
  ) || null;
}

const dayMs=86400000;
const shiftDays=(iso,days)=>new Date(toDay(iso).getTime()+days*dayMs).toISOString().slice(0,10);
function visitMidpoint({start,end}){
  const difference=Math.round((toDay(end)-toDay(start))/dayMs);
  return shiftDays(start,Math.floor(difference/2));
}
function progress(type,record){
  const peak=type==='ginkgo'?record.ginkgoPeak:record.maplePeak;
  const start=shiftDays(peak,type==='ginkgo'?-10:-12);
  const end=record[type+'Fallen']||shiftDays(peak,type==='ginkgo'?10:8);
  return {peak,start,end};
}
function dotPosition(model,date){
  const a=toDay(model.start).getTime(),b=toDay(model.end).getTime(),x=toDay(date).getTime();
  return Math.max(1,Math.min(99,(x-a)/(b-a)*100));
}
function row(type,record,visit){
  const info=progress(type,record);
  const label=type==='ginkgo'?'Ginkgo':'Acero';
  const left=dotPosition(info,visit);
  return `<div class="folrow"><span class="kind"><i class="kind-dot ${type}"></i>${label}</span><div class="barwrap"><div class="bar ${type}"><span class="dot" style="left:${left}%"></span></div></div><span class="fol-date">${dayLabel(info.peak)}</span></div>`;
}
function foliageHTML({place,dates}){
  const title='<div class="fol-head"><span class="fol-title">Foliage previsto</span></div>';
  if(foliageError)return title+'<div class="status-unknown">Impossibile caricare i dati del foliage.</div>';
  if(!place)return '';
  const record=findFoliage(place);
  if(!record)return title+'<div class="status-unknown">Dati sul foliage non disponibili per questa città.</div>';
  if(!dates)return title+'<div class="status-unknown">Specifica start ed end nell’URL per vedere il foliage nelle date del viaggio.</div>';
  if(!record.ginkgoPeak?.startsWith(dates.start.slice(0,4)) || !record.maplePeak?.startsWith(dates.start.slice(0,4)))return title+'<div class="status-unknown">Previsioni foliage non disponibili per l’anno del viaggio.</div>';
  const source=record.sourceUrl||foliageData.defaultSource;
  const sourceLink=typeof source==='string' && source.startsWith('https://')
    ?`<a href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">Fonte ↗</a>`:'';
  const header=`<div class="fol-head"><span class="fol-title">Foliage previsto</span>${sourceLink}</div>`;
  const visit=visitMidpoint(dates);
  return header+row('ginkgo',record,visit)+row('maple',record,visit);
}
mountWeatherWidget({
  renderExtra:foliageHTML,
  getKanji:({place})=>findFoliage(place)?.jp||''
});
