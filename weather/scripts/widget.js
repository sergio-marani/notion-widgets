import {mountWeatherWidget,readSettings} from './weather-core.js';
import {createFoliageExtension} from './sections/foliage.js';
import {createSnowExtension} from './sections/snow.js';

const settings=readSettings();
const query=new URLSearchParams(location.search);
const sections=[];
if((settings.placeId || settings.city.length>=2) && settings.dates && !settings.error){
  if(query.get('foliage')==='true')sections.push(createFoliageExtension());
  if(query.get('snow')==='true')sections.push(createSnowExtension());
}

await mountWeatherWidget({
  renderExtra:context=>sections.map(section=>section.renderExtra(context)).join(''),
  getPlaceLocalName:context=>sections.map(section=>section.getPlaceLocalName?.(context)).find(Boolean)||'',
  extraReady:Promise.all(sections.map(section=>section.extraReady)),
  loadExtra:(context,update)=>Promise.all(sections.map(section=>section.loadExtra?.(context,update)))
});
