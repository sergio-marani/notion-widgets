import {requestJson,escapeHTML,dayLabel,toDay,loadPlaceCatalog,catalogIdForPlace} from '../weather-core.js';

const validDate=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(toDay(value).getTime()) && toDay(value).toISOString().slice(0,10)===value;
const validPeriod=period=>period && ['start','peak','end'].every(key=>validDate(period[key]))
  && period.start<=period.peak && period.peak<=period.end && period.start<period.end;
const overlaps=(period,dates)=>validPeriod(period) && dates.start<=period.end && dates.end>=period.start;
const colors=new Set(['yellow','orange','red']);
const validTree=tree=>tree && typeof tree.name==='string' && tree.name.trim() && colors.has(tree.color);

export function findFoliage(data,place,catalog){
  const id=catalogIdForPlace(catalog,place);
  return id && Object.hasOwn(data?.places||{},id)?data.places[id]:null;
}

function row(tree,dates){
  const start=toDay(tree.start).getTime(),end=toDay(tree.end).getTime();
  const visit=(toDay(dates.start).getTime()+toDay(dates.end).getTime())/2;
  const position=Math.max(1,Math.min(99,(visit-start)/(end-start)*100));
  return `<div class="folrow"><span class="kind"><i class="kind-dot ${tree.color}"></i><span class="kind-label">${escapeHTML(tree.name)}</span></span><div class="barwrap"><div class="bar ${tree.color}"><span class="dot" style="left:${position}%"></span></div></div><span class="fol-date">${dayLabel(tree.peak)}</span></div>`;
}

export function renderFoliage(data,{place,dates},catalog){
  if(!dates)return '';
  const record=findFoliage(data,place,catalog);
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
  let data=null,catalog=null,failed=false;
  const extraReady=Promise.all([requestJson(new URL('../../data/foliage/data.json',import.meta.url).toString()),loadPlaceCatalog()])
    .then(([result,places])=>{
      if(result?.schemaVersion!==2 || !result.places || typeof result.places!=='object' || Array.isArray(result.places))throw new Error('Invalid foliage dataset');
      data=result;
      catalog=places;
    }).catch(error=>{failed=true;console.warn('Foliage data:',error.message)});
  return {
    extraReady,
    renderExtra:context=>failed && context.place
      ?'<section class="widget-section foliage-section" aria-label="Foliage previsto"><div class="status-unknown">Impossibile caricare i dati del foliage.</div></section>'
      :renderFoliage(data,context,catalog),
    getPlaceLocalName:({place})=>catalog?.places[catalogIdForPlace(catalog,place)]?.placeLocalName||''
  };
}
