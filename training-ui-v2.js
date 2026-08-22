import {loadCareer} from './career.js';
import {ensureTrainingMemory,trainingDevelopmentProgress} from './training-memory-v1.js';
import {trainingCatalogFor,primaryTrainingStats,recommendedTrainingDrills,trainingDifficulty,trainingFamily} from './training-framework-v2.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LABEL={pace:'Velocidad',shooting:'Remate',passing:'Pase',dribbling:'Gambeta',defense:'Defensa',physical:'Físico',ballControl:'Control',vision:'Visión',stamina:'Resistencia',composure:'Compostura'};
const FAMILY_NAME={ST:'DELANTERO',W:'EXTREMO',CAM:'ENGANCHE / MEDIAPUNTA',MID:'MEDIOCAMPISTA',DEF:'DEFENSOR',GK:'ARQUERO'};
function attrLabel(k){return LABEL[k]||k;}
function style(){if(document.querySelector('style[data-training-ui-v2]'))return;const s=document.createElement('style');s.dataset.trainingUiV2='1';s.textContent=`
#training-v2-home{max-width:1500px;margin:0 auto;display:grid;gap:12px}.tr2-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:end;padding:12px 15px;border-top:3px solid #76b4e3;border-bottom:1px solid #405764;background:#101d25}.tr2-head .eyebrow{margin-bottom:4px}.tr2-head h1{margin:0;font-size:clamp(27px,3vw,42px);color:#f3efe5}.tr2-head p{margin:4px 0 0;color:#9fb1ba;font-size:12px}.tr2-sessions{text-align:right}.tr2-sessions b{display:block;font-size:28px;color:#76b4e3}.tr2-sessions span{font-size:10px;color:#a9b7be;text-transform:uppercase;letter-spacing:.08em}.tr2-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}.tr2-stat{padding:8px 10px;background:#0d1a22;border-left:3px solid #405764}.tr2-stat.low{border-left-color:#d6b264}.tr2-stat span{display:block;color:#90a5b0;font-size:9px;text-transform:uppercase;letter-spacing:.07em}.tr2-stat b{font-size:18px;color:#f3efe5}.tr2-groups{display:grid;gap:14px}.tr2-group-head{display:flex;align-items:end;justify-content:space-between;gap:12px;border-bottom:1px solid #405764;padding-bottom:5px}.tr2-group-head h2{margin:0;color:#f3efe5;font-size:17px}.tr2-group-head span{font-size:10px;color:#8ea3ae}.tr2-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.tr2-card{position:relative;min-height:190px;padding:12px;text-align:left;color:#f3efe5;background:#13232d;border:1px solid #405764;border-radius:2px;cursor:pointer;display:flex;flex-direction:column;gap:8px}.tr2-card:hover{border-color:#76b4e3;background:#152a35}.tr2-card:disabled{opacity:.4;cursor:not-allowed}.tr2-card.recommended{border-top:3px solid #d6b264}.tr2-card .rec{position:absolute;right:8px;top:8px;color:#d6b264;font-size:8px;font-weight:900;letter-spacing:.08em}.tr2-card h3{margin:0;font-size:17px}.tr2-card p{margin:0;color:#aab9c1;font-size:11px;line-height:1.35;min-height:44px}.tr2-meta{display:flex;gap:5px;flex-wrap:wrap}.tr2-meta span{padding:3px 5px;background:#0d1a22;border-left:2px solid #76b4e3;color:#c8d4d9;font-size:9px}.tr2-attrs{display:grid;grid-template-columns:repeat(2,1fr);gap:4px;margin-top:auto}.tr2-attr{display:grid;grid-template-columns:1fr auto;gap:5px;align-items:center;padding:4px 5px;background:#0d1a22}.tr2-attr span{font-size:9px;color:#9eb0ba}.tr2-attr b{font-size:11px}.tr2-markers{display:flex;gap:5px;flex-wrap:wrap;border-top:1px solid #334b58;padding-top:7px}.tr2-markers span{font-size:8px;color:#d2dce0;text-transform:uppercase;letter-spacing:.04em}.tr2-progress{display:flex;justify-content:space-between;gap:8px;color:#8ea4af;font-size:9px}.tr2-progress b{color:#f3efe5}.tr2-note{padding:10px 12px;background:#0d1a22;border-left:3px solid #d6b264;color:#acbbc2;font-size:10px}.tr2-note b{color:#f3efe5}
@media(max-width:1100px){.tr2-grid{grid-template-columns:repeat(2,1fr)}.tr2-stats{grid-template-columns:repeat(3,1fr)}}@media(max-width:680px){.tr2-head{grid-template-columns:1fr}.tr2-sessions{text-align:left}.tr2-grid{grid-template-columns:1fr}.tr2-stats{grid-template-columns:repeat(2,1fr)}}
`;document.head.appendChild(s);}
function keyStats(player,catalog){const ids=[...new Set(catalog.flatMap(d=>primaryTrainingStats(d,3).map(x=>x.id)))];return ids.sort((a,b)=>(player[a]||50)-(player[b]||50)).slice(0,5);}
function card(state,d,recommended){
  const attrs=primaryTrainingStats(d,4),progress=trainingDevelopmentProgress(state.player,d),lead=progress[0],difficulty=trainingDifficulty(state.player,d);
  return `<button class="tr2-card ${recommended.has(d.id)?'recommended':''}" data-drill-sim="${d.id}" ${state.progress.trainingPoints<=0?'disabled':''}>${recommended.has(d.id)?'<span class="rec">RECOMENDADO</span>':''}<div><div class="tr2-meta"><span>${esc(d.category)}</span><span>${esc(difficulty)}</span></div><h3>${esc(d.name)}</h3></div><p>${esc(d.desc)}</p><div class="tr2-attrs">${attrs.map(({id})=>`<div class="tr2-attr"><span>${esc(attrLabel(id))}</span><b>${state.player[id]??'—'}</b></div>`).join('')}</div><div class="tr2-markers">${d.markers.map(m=>`<span>${esc(m.label)}</span>`).join('<span>·</span>')}</div><div class="tr2-progress"><span>${lead?`Progreso en ${esc(attrLabel(lead.attr))}`:'Sin progreso pendiente'}</span><b>${lead?lead.percent:0}%</b></div></button>`;
}
export function trainingHomeMarkup(state){
  ensureTrainingMemory(state);const catalog=trainingCatalogFor(state.player),recommended=new Set(recommendedTrainingDrills(state.player,3)),family=trainingFamily(state.player.position),stats=keyStats(state.player,catalog),groups=[...new Set(catalog.map(d=>d.category))];
  return `<div id="training-v2-home"><header class="tr2-head"><div><div class="eyebrow">ENTRENAMIENTO · ${FAMILY_NAME[family]}</div><h1>Semana de trabajo</h1><p>Elegí qué querés preparar para tu puesto. Cada ejercicio tiene una situación y una exigencia distinta.</p></div><div class="tr2-sessions"><b>${state.progress.trainingPoints}</b><span>sesiones disponibles</span></div></header><section class="tr2-stats">${stats.map(k=>`<div class="tr2-stat ${(state.player[k]||50)<60?'low':''}"><span>${esc(attrLabel(k))}</span><b>${state.player[k]??'—'}</b></div>`).join('')}</section><div class="tr2-note"><b>Antes de elegir:</b> mirá la consigna, las capacidades que trabaja y qué se va a observar durante las repeticiones.</div><div class="tr2-groups">${groups.map(g=>{const rows=catalog.filter(d=>d.category===g);return `<section><div class="tr2-group-head"><h2>${esc(g)}</h2><span>${rows.length} ejercicio(s)</span></div><div class="tr2-grid">${rows.map(d=>card(state,d,recommended)).join('')}</div></section>`;}).join('')}</div></div>`;
}
export function renderTrainingHomeNow(doc=globalThis.document){
  if(!doc)return false;style();const main=doc.querySelector('.main'),state=loadCareer();if(!main||!state)return false;
  for(const b of doc.querySelectorAll('.nav-btn[data-view]'))b.classList.toggle('on',b.dataset.view==='training');
  doc.body?.classList.remove('match-live-active','training-live-v5','training-live-active');
  main.innerHTML=trainingHomeMarkup(state);return true;
}
export function decorateTrainingHome(){
  if(typeof document==='undefined')return;const active=document.querySelector('.nav-btn.on[data-view="training"]');
  if(!active||document.querySelector('#trainingCanvas')||document.querySelector('#training-v2-home'))return;
  renderTrainingHomeNow(document);
}
export function interceptTrainingNavigation(event){
  const button=event?.target?.closest?.('[data-view="training"]');if(!button)return false;
  event.preventDefault?.();event.stopImmediatePropagation?.();return renderTrainingHomeNow(document);
}
if(typeof document!=='undefined'){
  document.addEventListener('click',interceptTrainingNavigation,true);
  queueMicrotask(()=>{if(document.querySelector('.nav-btn.on[data-view="training"]'))renderTrainingHomeNow(document);});
}
export const __trainingUiV2={trainingHomeMarkup,decorateTrainingHome,renderTrainingHomeNow,interceptTrainingNavigation,keyStats};
