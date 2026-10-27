import {requestJson,escapeHTML,dayLabel,toDay} from '../weather-core.js';

const placeKey=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');

const validDate=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(toDay(value).getTime()) && toDay(value).toISOString().slice(0,10)===value;
const validPeriod=period=>period && ['start','peak','end'].every(key=>validDate(period[key]))
  && period.start<=period.peak && period.peak<=period.end && period.start<period.end;
const overlaps=(period,dates)=>validPeriod(period) && dates.start<=period.end && dates.end>=period.start;
const colors=new Set(['yellow','orange','red']);
const validTree=tree=>tree && typeof tree.name==='string' && tree.name.trim() && colors.has(tree.color);

export function findFoliage(data,place){
  if(!place || !/^[A-Z]{2}$/.test(place.country_code))return null;
  const name=placeKey(place.name);
  if(!name)return null;
  return Object.values(data?.cities||{}).find(record=>
    record?.countryCode===place.country_code && typeof record.placeName==='string'
    && [record.placeName,record.placeLocalName,...(Array.isArray(record.aliases)?record.aliases:[])]
      .some(alias=>placeKey(alias)===name)
  )||null;
}

function row(tree,dates){
  const start=toDay(tree.start).getTime(),end=toDay(tree.end).getTime();
  const visit=(toDay(dates.start).getTime()+toDay(dates.end).getTime())/2;
  const position=Math.max(1,Math.min(99,(visit-start)/(end-start)*100));
  return `<div class="folrow"><span class="kind"><i class="kind-dot ${tree.color}"></i><span class="kind-label">${escapeHTML(tree.name)}</span></span><div class="barwrap"><div class="bar ${tree.color}"><span class="dot" style="left:${position}%"></span></div></div><span class="fol-date">${dayLabel(tree.peak)}</span></div>`;
}

export function renderFoliage(data,{place,dates}){
  if(!dates)return '';
  const record=findFoliage(data,place);
  if(!record)return '';
  const trees=(Array.isArray(record.trees)?record.trees:[]).filter(tree=>validTree(tree) && overlaps(tree,dates));
  if(!trees.length)return '';
  const source=record.sourceUrl;
  let link='';
  try{
    if(new URL(source).protocol==='https:')link=`<a href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">Fonte ↗</a>`;
  }catch{}
  return `<section class="widget-section foliage-section" aria-label="Foliage previsto"><div class="fol-head"><span class="fol-title">Foliage previsto</span>${link}</div>`
    +trees.map(tree=>row(tree,dates)).join('')+'</section>';
}

export function createFoliageExtension(){
  let data=null,failed=false;
  const extraReady=requestJson(new URL('../../data/foliage/data.json',import.meta.url).toString())
    .then(result=>{
      if(result?.schemaVersion!==1 || !result.cities || typeof result.cities!=='object' || Array.isArray(result.cities))throw new Error('Invalid foliage dataset');
      data=result;
    }).catch(error=>{failed=true;console.warn('Foliage data:',error.message)});
  return {
    extraReady,
    renderExtra:context=>failed && context.place
      ?'<section class="widget-section foliage-section" aria-label="Foliage previsto"><div class="status-unknown">Impossibile caricare i dati del foliage.</div></section>'
      :renderFoliage(data,context),
    getPlaceLocalName:({place})=>findFoliage(data,place)?.placeLocalName||''
  };
}
