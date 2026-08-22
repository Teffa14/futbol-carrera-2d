import {TrainingMatchEngine} from './training-runtime-latest.js';
import {TRAINING_SPEED,rebuildTrainingResult,trainingPhase} from './training-session-v6.js';
import {trainingMarkerSnapshot} from './training-framework-v2.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const originalStep=TrainingMatchEngine.prototype.step;
TrainingMatchEngine.prototype.step=function trainingX4Step(dt){
  const scaled=clamp(Number(dt)||.016,.001,.05)*TRAINING_SPEED;
  const substeps=Math.max(1,Math.ceil(scaled/.025)),slice=scaled/substeps;
  for(let i=0;i<substeps&&!this.finished;i++)originalStep.call(this,slice);
  const q=this.trainingQualityV6;
  if(q)q.sessionPhase=trainingPhase(typeof this.progress==='function'?this.progress():0);
};

const originalSessionResult=TrainingMatchEngine.prototype.sessionResult;
TrainingMatchEngine.prototype.sessionResult=function rebuiltSessionResult(){
  const base=originalSessionResult.call(this),markers=trainingMarkerSnapshot(this,this.drill);
  return rebuildTrainingResult({...base,markers},markers);
};

export const __trainingOverhaulV1={TRAINING_SPEED};
