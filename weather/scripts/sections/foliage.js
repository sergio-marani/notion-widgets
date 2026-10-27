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

function foliageSection(content,source){
  let link='';
  try{
    if(new URL(source).protocol==='https:')link=`<a href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">Fonte ↗</a>`;
  }catch{}
  return `<section class="widget-section foliage-section" aria-label="Foliage"><div class="fol-head"><span class="fol-title">Foliage</span>${link}</div>${content}</section>`;
}

const foliageMessage=(message,source)=>foliageSection(`<div class="section-note">${message}</div>`,source);

function row(tree,dates){
  const start=toDay(tree.start).getTime(),end=toDay(tree.end).getTime();
  const visit=(toDay(dates.start).getTime()+toDay(dates.end).getTime())/2;
  const position=Math.max(1,Math.min(99,(visit-start)/(end-start)*100));
  return `<div class="folrow"><span class="kind"><i class="kind-dot ${tree.color}"></i><span class="kind-label">${escapeHTML(tree.name)}</span></span><div class="barwrap"><div class="bar ${tree.color}"><span class="dot" style="left:${position}%"></span></div></div><span class="fol-date">${dayLabel(tree.peak)}</span></div>`;
}

export function renderFoliage(data,{place,dates},catalog){
  if(!place || !dates)return '';
  const record=findFoliage(data,place,catalog);
  if(!record)return foliageMessage('Dati foliage non disponibili per questo luogo.');
  const validTrees=(Array.isArray(record.trees)?record.trees:[]).filter(tree=>validTree(tree) && validPeriod(tree));
  const trees=validTrees.filter(tree=>overlaps(tree,dates));
  if(trees.length)return foliageSection(trees.map(tree=>row(tree,dates)).join(''),record.sourceUrl);
  const season=validTrees.filter(tree=>tree.start.slice(0,4)<=dates.end.slice(0,4) && tree.end.slice(0,4)>=dates.start.slice(0,4));
  if(!season.length)return foliageMessage('Dati foliage non disponibili per l’anno del viaggio.',record.sourceUrl);
  if(season.every(tree=>dates.end<tree.start))return foliageMessage('Il foliage non è ancora iniziato per le tue date.',record.sourceUrl);
  if(season.every(tree=>dates.start>tree.end))return foliageMessage('Il foliage è terminato per le tue date.',record.sourceUrl);
  return foliageMessage('Nessun foliage previsto nelle tue date.',record.sourceUrl);
}

export function createFoliageExtension(){
  let data=null,catalog=null,failed=false,loading=true;
  const extraReady=Promise.all([requestJson(new URL('../../data/foliage/data.json',import.meta.url).toString()),loadPlaceCatalog()])
    .then(([result,places])=>{
      if(result?.schemaVersion!==2 || !result.places || typeof result.places!=='object' || Array.isArray(result.places))throw new Error('Invalid foliage dataset');
      data=result;
      catalog=places;
    }).catch(error=>{failed=true;console.warn('Foliage data:',error.message)}).finally(()=>{loading=false});
  return {
    extraReady,
    renderExtra:context=>!context.place || !context.dates?'':loading
      ?foliageMessage('Caricamento dati foliage…'):failed
      ?foliageMessage('Impossibile caricare i dati del foliage.')
      :renderFoliage(data,context,catalog),
    getPlaceLocalName:({place})=>catalog?.places[catalogIdForPlace(catalog,place)]?.placeLocalName||''
  };
}
