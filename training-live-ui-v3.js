import {loadCareer,saveCareer,calculateOverall} from './career.js';
import {drillById,ensureTrainingMemory,previewTrainingResult,applyTrainingResult} from './training-memory-v1.js';
import {TrainingEngine} from './training-engine-v1.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let raf=null;
let liveSession=null;

function stopLoop(){
  if(raf)cancelAnimationFrame(raf);
  raf=null;
}

function installStyle(){
  if(document.querySelector('style[data-training-live-v3]'))return;
  const style=document.createElement('style');
  style.dataset.trainingLiveV3='1';
  style.textContent=`
  #training-sim-shell[data-live-training="1"]{max-width:1180px;margin:0 auto}.training-live-progress{height:10px;background:#10281c;border:1px solid #294b39;border-radius:999px;overflow:hidden;margin:12px 0 6px}.training-live-progress i{display:block;height:100%;width:0;background:#d8ff4c;transition:width .12s linear}.training-live-meta{display:flex;justify-content:space-between;gap:12px;color:#91a49a;font-size:13px;margin-bottom:10px}.training-live-status{margin:10px 0 12px;padding:11px 13px;border:1px solid #315342;border-radius:12px;background:#0b1d14;color:#d7e4dc}.training-live-status.done{border-color:#d8ff4c;color:#f4f7f1}.training-live-actions{display:flex;gap:8px;flex-wrap:wrap}.training-live-actions button{border:0;border-radius:12px;padding:11px 15px;font-weight:800;cursor:pointer}.training-live-actions .cancel{background:#233b2e;color:#fff}.training-live-actions .back{background:#d8ff4c;color:#07110c}@media(max-width:650px){.training-live-meta{display:block}.training-live-meta span{display:block;margin-top:4px}}
  `;
  document.head.appendChild(style);
}

function returnToTraining(){
  stopLoop();
  liveSession=null;
  document.querySelector('.nav-btn[data-view="training"]')?.click();
}

function finishSession(){
  if(!liveSession||liveSession.committed)return;
  const latest=loadCareer();
  if(!latest)return;
  ensureTrainingMemory(latest);
  const out=applyTrainingResult(latest,liveSession.result,calculateOverall);
  if(out.ok)saveCareer(latest);
  liveSession.committed=true;

  const grade=document.querySelector('#drillGrade');
  const quality=document.querySelector('#drillQuality');
  const status=document.querySelector('#trainingLiveStatus');
  const pill=document.querySelector('#trainingLiveSessions');
  const progress=document.querySelector('#trainingLiveProgress');
  const progressText=document.querySelector('#trainingLiveProgressText');
  const actions=document.querySelector('#trainingLiveActions');
  if(grade)grade.textContent=liveSession.result.grade;
  if(quality)quality.textContent=liveSession.result.quality;
  if(progress)progress.style.width='100%';
  if(progressText)progressText.textContent='100%';
  if(pill)pill.textContent=`${latest.progress.trainingPoints} sesión(es) restantes`;
  if(status){status.classList.add('done');status.textContent=out.ok?(out.message||'Sesión completada y guardada.'):(out.message||'No se pudo guardar la sesión.');}
  if(actions){
    actions.innerHTML='<button class="back" id="trainingBack">Volver a entrenamientos</button>';
    document.querySelector('#trainingBack').onclick=returnToTraining;
  }
}

function startVisibleDrill(drillId){
  stopLoop();
  const state=loadCareer();
  if(!state)return;
  ensureTrainingMemory(state);
  if((state.progress.trainingPoints??0)<=0)return;
  const drill=drillById(drillId);
  if(!drill)return;
  const result=previewTrainingResult(state,drillId,0);
  const main=document.querySelector('.main');
  if(!main)return;

  installStyle();
  main.innerHTML=`<div id="training-sim-shell" data-live-training="1"><div class="training-sim-head"><div><div class="eyebrow">SESIÓN EN VIVO</div><h1>${esc(drill.name)}</h1><p>${esc(drill.desc)}</p></div><span class="session-pill" id="trainingLiveSessions">${state.progress.trainingPoints} sesión(es) · se consume al completar</span></div><div class="training-live-progress"><i id="trainingLiveProgress"></i></div><div class="training-live-meta"><span>Progreso <b id="trainingLiveProgressText">0%</b></span><span>La sesión se guarda automáticamente al llegar al 100%.</span></div><div class="training-stage"><canvas id="trainingCanvas" width="900" height="520"></canvas></div><div class="training-report"><div><span>NOTA</span><b id="drillGrade">—</b></div><div><span>CALIDAD</span><b id="drillQuality">—</b></div><div><span>REPETICIONES</span><b>${result.reps}</b></div><div><span>BUENAS</span><b>${result.successes}</b></div></div><div class="training-live-status" id="trainingLiveStatus">Entrenamiento en curso. Podés cancelar sin gastar la sesión.</div><div class="training-live-actions" id="trainingLiveActions"><button class="cancel" id="cancelTrainingLive">Cancelar sin consumir</button></div></div>`;

  const canvas=document.querySelector('#trainingCanvas');
  const ctx=canvas?.getContext('2d');
  if(!canvas||!ctx)return;
  const engine=new TrainingEngine(drill,result,state.player);
  liveSession={engine,result,committed:false};
  let last=performance.now();

  document.querySelector('#cancelTrainingLive').onclick=returnToTraining;
  main.scrollTo?.({top:0,behavior:'smooth'});

  const loop=ts=>{
    if(!liveSession||liveSession.engine!==engine)return;
    const dt=Math.min(.033,(ts-last)/1000||.016);
    last=ts;
    engine.step(dt);
    engine.draw(ctx,canvas.width,canvas.height);
    const pct=Math.min(100,Math.round(engine.progress()*100));
    const bar=document.querySelector('#trainingLiveProgress');
    const text=document.querySelector('#trainingLiveProgressText');
    if(bar)bar.style.width=`${pct}%`;
    if(text)text.textContent=`${pct}%`;
    if(engine.finished){
      raf=null;
      finishSession();
      return;
    }
    raf=requestAnimationFrame(loop);
  };
  engine.draw(ctx,canvas.width,canvas.height);
  raf=requestAnimationFrame(loop);
}

// Capture before career-experience-ui-v1's onclick. Its MutationObserver sees the
// same #training-sim-shell id and therefore leaves this live screen mounted.
document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-drill-sim]');
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(button.disabled)return;
  startVisibleDrill(button.dataset.drillSim);
},true);

window.addEventListener('beforeunload',stopLoop);

export const __trainingLiveUiV3={startVisibleDrill,finishSession,returnToTraining};
