const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const TRAINING_SPEED=4;

export function stepTrainingX4(engine,dt){
  if(!engine||typeof engine.step!=='function')return 0;
  const scaled=clamp(Number(dt)||.016,.001,.05)*TRAINING_SPEED;
  const steps=Math.max(1,Math.ceil(scaled/.025)),slice=scaled/steps;
  for(let i=0;i<steps&&!engine.finished;i++)engine.step(slice);
  return steps;
}

export function trainingPhase(progress=0){
  const p=clamp(Number(progress)||0,0,1);
  if(p<.24)return'Lectura';
  if(p<.50)return'Técnica';
  if(p<.76)return'Decisión';
  return'Ejecución';
}

function gradeFor(q){return q>=91?'S':q>=82?'A':q>=72?'B':q>=62?'C':q>=52?'D':'E';}

export function rebuildTrainingResult(base,markers=[]){
  const raw={...(base||{})},reps=Math.max(1,Number(raw.reps)||1),successes=clamp(Number(raw.successes)||0,0,reps),successRate=successes/reps;
  const values=(markers||[]).map(m=>clamp(Number(m?.value)||0,0,100));
  const markerAverage=values.length?values.reduce((a,b)=>a+b,0)/values.length:Number(raw.quality)||50;
  const markerFloor=values.length?Math.min(...values):markerAverage;
  const execution=clamp(Number(raw.quality)||50,0,100);
  const quality=clamp(Math.round(execution*.46+markerAverage*.29+markerFloor*.10+successRate*100*.15),30,99);
  return{...raw,quality,grade:gradeFor(quality),markerAverage:Math.round(markerAverage),markerFloor:Math.round(markerFloor),successRate:+successRate.toFixed(3),trainingSpeed:TRAINING_SPEED};
}

export const __trainingSessionV6={stepTrainingX4,trainingPhase,rebuildTrainingResult};
