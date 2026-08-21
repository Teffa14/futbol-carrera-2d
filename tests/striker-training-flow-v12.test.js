import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLE_DRILLS} from '../training-framework-v2.js';
import {TrainingMatchEngine,TRAINING_RUNTIME_VERSIONS} from '../training-runtime-latest.js';

const IDS=['st-profile-finish','st-one-touch','st-run-behind','st-wall-run','st-box-duel','st-press','st-free-kick'];
const drill=id=>ROLE_DRILLS.find(d=>d.id===id);
const player=(value=72)=>({name:'Nueve test',position:'ST',engineRole:'ST',instanceId:'st-v12-test',pace:value,shooting:value,passing:value,dribbling:value,defense:value,physical:value,ballControl:value,vision:value,stamina:value,composure:value,fitness:100,skills:[],build:'finisher'});
function engineFor(id,{value=72,reps=2}={}){return new TrainingMatchEngine(drill(id),{drillId:id,quality:value,reps,successes:0,grade:'B',seed:`striker-v12-${id}-${value}-${reps}`},player(value));}
function run(id,options={}){const e=engineFor(id,options);let frames=0;while(!e.finished&&frames<2600){e.step(.033);frames++;}assert.ok(e.finished,`${id} no terminó`);return{e,out:e.sessionResult(),frames};}

test('striker feedback drills use the dedicated V12 runtime',()=>{
  assert.ok(TRAINING_RUNTIME_VERSIONS.matchEngine>=12);
  assert.equal(TRAINING_RUNTIME_VERSIONS.authoritativeScenarios,TRAINING_RUNTIME_VERSIONS.matchEngine);
  for(const id of IDS){const {out}=run(id);assert.equal(out.engineVersion,TRAINING_RUNTIME_VERSIONS.matchEngine,id);}
});

test('ruptura a la espalda actually releases and completes a filtered pass in front of the striker',()=>{
  const {e,out}=run('st-run-behind',{reps:3});
  assert.ok((e.trainingMetricsV6.passesAttempted||0)>=1,'nunca se ejecutó el pase filtrado');
  assert.ok((e.trainingMetricsV6.throughReceptions||0)>=1,'el nueve nunca recibió detrás de la línea');
  assert.ok(out.successes>=1,'ninguna ruptura quedó resuelta');
});

test('descarga y ruptura contains reception, layoff and a return pass into the run',()=>{
  const {e,out}=run('st-wall-run',{reps:3});
  assert.ok((e.trainingMetricsV6.passesAttempted||0)>=3,'faltan pases físicos en la secuencia');
  assert.ok((e.trainingMetricsV6.passesCompleted||0)>=2,'la descarga o la devolución no llegan');
  assert.ok((e.trainingMetricsV6.wallBeats||0)>=1,'nunca se registró la descarga');
  assert.ok((e.trainingMetricsV6.throughReceptions||0)>=1,'la devolución nunca encontró la ruptura');
  assert.ok(out.successes>=1,'ninguna descarga + ruptura terminó');
});

test('box duel and free kick advance attempts after the play resolves instead of burning the full timer',()=>{
  for(const id of ['st-box-duel','st-free-kick']){
    const {e}=run(id,{reps:3});
    assert.ok((e.trainingMetricsV6.earlyRepAdvances||0)>=2,`${id}: las repeticiones siguen esperando el cronómetro`);
  }
});

test('free kick profile always aims through a plausible goal-side corridor',()=>{
  const e=engineFor('st-free-kick',{reps:1});let frames=0;
  while(!e.lastTrainingKick&&frames<600){e.step(.016);frames++;}
  assert.ok(e.lastTrainingKick,'el tiro libre nunca se pateó');
  const plan=e.trainingQualityV6.freeKickPlan;
  assert.ok(plan,'falta el plan de tiro libre');
  assert.ok(plan.targetY>295&&plan.targetY<405,'el objetivo no está dentro del arco');
  assert.ok(plan.initialAim.y>=261&&plan.initialAim.y<=439,'la salida inicial apunta demasiado lejos del arco');
  assert.ok(e.ball.vx>0,'el tiro libre salió en dirección contraria al arco');
});

test('both finishing drills produce physical services and actual shots',()=>{
  for(const id of ['st-profile-finish','st-one-touch']){
    const {e,out}=run(id,{reps:3});
    assert.ok((e.trainingMetricsV6.passesAttempted||0)>=1,`${id}: no hubo servicio físico`);
    assert.ok((e.trainingMetricsV6.shots||0)>=1,`${id}: no hubo remate físico`);
    assert.ok(out.successes>=1,`${id}: ninguna repetición resolvió la definición`);
  }
});

test('pressing drill has a readable trigger and reaches either a recovery or a forced backward pass',()=>{
  const {e,out}=run('st-press',{reps:3});
  const reasons=(e.trainingQualityV6.repResults||[]).map(r=>r.phase);
  assert.ok(out.successes>=1,`presión del 9 nunca resolvió: ${reasons.join(', ')}`);
  assert.ok((e.trainingMetricsV6.passesAttempted||0)>=1,'la salida rival nunca fue orientada hacia un pase');
});
