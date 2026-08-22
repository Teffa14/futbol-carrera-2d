import {compileVisualPlay,createVisualAction,drawingPreview} from './tactical-drawing-v1.js';
import {PHASES} from './tactics.js';

const STORAGE_KEY='career-eleven:tactical-lab-draft-v1';
const TOOLS=[['run','Carrera'],['pass','Pase'],['cross','Centro'],['shot','Remate'],['position','Posición']];
const PLAYERS=Array.from({length:11},(_,i)=>({id:`P${i+1}`,label:`${i+1}`}));

export function pitchPointFromClient({clientX,clientY,rect}){
  const width=Math.max(1,Number(rect?.width)||1),height=Math.max(1,Number(rect?.height)||1);
  return{
    x:Math.max(0,Math.min(1,(Number(clientX)-Number(rect?.left||0))/width)),
    y:Math.max(0,Math.min(1,(Number(clientY)-Number(rect?.top||0))/height)),
  };
}

export function createEditorAction({id,type,actorId,start,end,phase=PHASES.PROGRESSION}){
  return createVisualAction({id,type,actorId,start,end,phase,label:`${actorId}: ${type}`});
}

export function editorMarkup(){
  return `<section class="tlab-shell">
    <div class="hero tlab-hero"><div><div class="eyebrow">PIZARRA</div><h1>Dibujá la jugada</h1><p>Marcá quién rompe, quién apoya y dónde querés terminar la jugada.</p></div><div class="actions"><button class="btn ghost" id="tlab-clear">Limpiar</button><button class="btn" id="tlab-save">Guardar jugada</button></div></div>
    <section class="tlab-layout">
      <aside class="card tlab-tools"><h3>Acción</h3><div class="tlab-toolgrid">${TOOLS.map(([id,label])=>`<button class="tlab-tool ${id==='run'?'on':''}" data-tlab-tool="${id}">${label}</button>`).join('')}</div><h3>Jugador</h3><div class="tlab-playergrid">${PLAYERS.map((p,i)=>`<button class="tlab-player ${i===0?'on':''}" data-tlab-player="${p.id}">${p.label}</button>`).join('')}</div><label class="tlab-phase">Fase<select id="tlab-phase"><option value="${PHASES.BUILD_UP}">Salida</option><option value="${PHASES.PROGRESSION}" selected>Progresión</option><option value="${PHASES.FINAL_THIRD}">Último tercio</option><option value="${PHASES.BOX_ATTACK}">Ataque de área</option><option value="${PHASES.ATTACKING_TRANSITION}">Transición</option></select></label><div class="tlab-help">Arrastrá sobre la cancha. En celular usá el dedo.</div></aside>
      <div class="card tlab-board-wrap"><div class="tlab-board" id="tlab-board" role="application" aria-label="Pizarra táctica"><svg class="tlab-svg" id="tlab-svg" viewBox="0 0 1000 640" preserveAspectRatio="none"><defs><marker id="tlab-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z"></path></marker></defs><line x1="500" y1="0" x2="500" y2="640" class="tlab-field-line"/><circle cx="500" cy="320" r="78" class="tlab-field-line"/><rect x="0" y="180" width="145" height="280" class="tlab-field-line"/><rect x="855" y="180" width="145" height="280" class="tlab-field-line"/><g id="tlab-actions"></g><g id="tlab-preview"></g></svg>${PLAYERS.map((p,i)=>{const col=i<4?0:i<8?1:2;const idx=col===0?i:col===1?i-4:i-8;const xs=[16,42,74],ys=[[18,38,62,82],[20,42,64,84],[30,50,70]];return `<button class="tlab-token" data-token="${p.id}" style="left:${xs[col]}%;top:${ys[col][idx]}%">${p.label}</button>`;}).join('')}</div><div class="tlab-status" id="tlab-status">Carrera · Jugador 1</div></div>
    </section>
  </section>`;
}

function css(){return `.tlab-shell{display:grid;gap:18px}.tlab-hero{margin-bottom:0}.tlab-layout{display:grid;grid-template-columns:minmax(210px,260px) minmax(0,1fr);gap:16px}.tlab-tools{display:grid;align-content:start;gap:12px}.tlab-toolgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tlab-tool,.tlab-player{border:1px solid rgba(255,255,255,.13);background:#0d1712;color:#dce8df;border-radius:10px;padding:10px;cursor:pointer}.tlab-tool.on,.tlab-player.on{background:#d7ff59;color:#09100c;border-color:#d7ff59;font-weight:800}.tlab-playergrid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.tlab-phase{display:grid;gap:6px;font-size:12px;color:#a7b5aa}.tlab-phase select{width:100%;background:#0d1712;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:10px}.tlab-help{font-size:12px;color:#91a097;line-height:1.4}.tlab-board-wrap{padding:12px}.tlab-board{position:relative;aspect-ratio:1000/640;max-height:70vh;width:100%;overflow:hidden;border-radius:16px;background:linear-gradient(90deg,#163b26 0 9.09%,#19432b 9.09% 18.18%,#163b26 18.18% 27.27%,#19432b 27.27% 36.36%,#163b26 36.36% 45.45%,#19432b 45.45% 54.54%,#163b26 54.54% 63.63%,#19432b 63.63% 72.72%,#163b26 72.72% 81.81%,#19432b 81.81% 90.9%,#163b26 90.9%);touch-action:none;user-select:none}.tlab-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.tlab-field-line{fill:none;stroke:rgba(255,255,255,.42);stroke-width:2}.tlab-action{fill:none;stroke:#f2ff9b;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;marker-end:url(#tlab-arrow)}.tlab-action.cross{stroke-dasharray:12 9}.tlab-action.shot{stroke:#ffcf66}.tlab-action.pass{stroke:#ffffff}.tlab-action.position{marker-end:none;stroke-width:3;stroke-dasharray:5 6}.tlab-preview{opacity:.55}.tlab-token{position:absolute;transform:translate(-50%,-50%);width:34px;height:34px;border-radius:50%;border:2px solid #fff;background:#0a4a8a;color:#fff;font-weight:900;box-shadow:0 2px 10px #0008;z-index:3}.tlab-token.selected{outline:3px solid #d7ff59;outline-offset:3px}.tlab-status{padding:10px 4px 2px;color:#a9b7ad;font-size:13px}.tlab-toast{color:#d7ff59;font-weight:700}@media(max-width:820px){.tlab-layout{grid-template-columns:1fr}.tlab-tools{grid-template-columns:1fr 1fr;align-items:start}.tlab-tools h3,.tlab-help,.tlab-phase{grid-column:1/-1}.tlab-playergrid{grid-column:1/-1}.tlab-board-wrap{padding:7px}.tlab-board{min-height:360px}.tlab-token{width:30px;height:30px}.tlab-toolgrid{grid-template-columns:repeat(5,1fr)}.tlab-tool{padding:9px 4px;font-size:11px}}`}

function loadDraft(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')||{actions:[]};}catch{return{actions:[]};}}
function saveDraft(draft){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(draft));}catch{}}

export function mountTacticalLab(doc=globalThis.document){
  const main=doc?.querySelector?.('.main');if(!main)return false;
  doc.body?.classList?.remove?.('match-live-active','matchday-v3-live','matchday-v3-preview','prematch-v2','training-live-v5');
  main.innerHTML=editorMarkup();
  if(!doc.getElementById('tlab-style')){const style=doc.createElement('style');style.id='tlab-style';style.textContent=css();doc.head.appendChild(style);}
  let tool='run',actorId='P1',start=null,pointerId=null,draft=loadDraft();
  const board=doc.getElementById('tlab-board'),actionsLayer=doc.getElementById('tlab-actions'),previewLayer=doc.getElementById('tlab-preview'),status=doc.getElementById('tlab-status');
  const phase=()=>doc.getElementById('tlab-phase')?.value||PHASES.PROGRESSION;
  const svgPoint=p=>({x:p.x*1000,y:p.y*640});
  function lineMarkup(action,preview=false){const p=drawingPreview(action),a=svgPoint(p.from),b=svgPoint(p.to);const cls=`tlab-action ${p.type}${preview?' tlab-preview':''}`;if(p.type==='position')return `<circle class="${cls}" cx="${b.x}" cy="${b.y}" r="22"></circle>`;return `<line class="${cls}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"></line>`;}
  function renderActions(){actionsLayer.innerHTML=draft.actions.map(a=>lineMarkup(a)).join('');saveDraft(draft);}
  function setStatus(extra=''){status.innerHTML=`${TOOLS.find(t=>t[0]===tool)?.[1]||tool} · Jugador ${actorId.slice(1)}${extra?` · <span class="tlab-toast">${extra}</span>`:''}`;}
  function selectActor(id){actorId=id;doc.querySelectorAll('.tlab-player').forEach(b=>b.classList.toggle('on',b.dataset.tlabPlayer===id));doc.querySelectorAll('.tlab-token').forEach(b=>b.classList.toggle('selected',b.dataset.token===id));setStatus();}
  doc.querySelectorAll('[data-tlab-tool]').forEach(b=>b.addEventListener('click',()=>{tool=b.dataset.tlabTool;doc.querySelectorAll('[data-tlab-tool]').forEach(x=>x.classList.toggle('on',x===b));setStatus();}));
  doc.querySelectorAll('[data-tlab-player]').forEach(b=>b.addEventListener('click',()=>selectActor(b.dataset.tlabPlayer)));
  doc.querySelectorAll('[data-token]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();selectActor(b.dataset.token);}));
  board.addEventListener('pointerdown',e=>{if(e.target?.closest?.('.tlab-token'))return;pointerId=e.pointerId;board.setPointerCapture?.(pointerId);start=pitchPointFromClient({clientX:e.clientX,clientY:e.clientY,rect:board.getBoundingClientRect()});});
  board.addEventListener('pointermove',e=>{if(start==null||e.pointerId!==pointerId)return;const end=pitchPointFromClient({clientX:e.clientX,clientY:e.clientY,rect:board.getBoundingClientRect()});const action=createEditorAction({id:'preview',type:tool,actorId,start,end,phase:phase()});previewLayer.innerHTML=lineMarkup(action,true);});
  board.addEventListener('pointerup',e=>{if(start==null||e.pointerId!==pointerId)return;const end=pitchPointFromClient({clientX:e.clientX,clientY:e.clientY,rect:board.getBoundingClientRect()});draft.actions.push(createEditorAction({id:`a${Date.now()}-${draft.actions.length}`,type:tool,actorId,start,end,phase:phase()}));start=null;pointerId=null;previewLayer.innerHTML='';renderActions();setStatus('agregado');});
  doc.getElementById('tlab-clear')?.addEventListener('click',()=>{draft={actions:[]};renderActions();setStatus('limpio');});
  doc.getElementById('tlab-save')?.addEventListener('click',()=>{const plan=compileVisualPlay({id:`play-${Date.now()}`,name:'Mi jugada',phase:phase(),actions:draft.actions});saveDraft({...draft,compiled:plan});setStatus(`${draft.actions.length} acciones guardadas`);});
  renderActions();selectActor(actorId);return true;
}

function ensureNav(){
  const nav=document.querySelector('.nav');if(!nav||nav.querySelector('[data-tlab-open]'))return;
  const reset=nav.querySelector('.reset');const button=document.createElement('button');button.className='nav-btn';button.dataset.tlabOpen='1';button.innerHTML='<span>↗</span>Pizarra';nav.insertBefore(button,reset||null);
}

if(typeof document!=='undefined'){
  document.addEventListener('click',e=>{const button=e.target?.closest?.('[data-tlab-open]');if(!button)return;e.preventDefault();e.stopImmediatePropagation();document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('on',b===button));mountTacticalLab(document);},true);
  const observer=new MutationObserver(ensureNav);observer.observe(document.documentElement,{childList:true,subtree:true});ensureNav();
}

export const __tacticalLabUiV1={TOOLS,PLAYERS,STORAGE_KEY};