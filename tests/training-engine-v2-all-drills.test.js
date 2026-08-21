import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLE_DRILLS,trainingFamily} from '../training-framework-v2.js';
import {TrainingMatchEngine,TRAINING_RUNTIME_VERSIONS} from '../training-runtime-latest.js';

const POS={ST:'ST',W:'RW',CAM:'CAM',MID:'CM',DEF:'CB',GK:'GK'};
function playerFor(drill,value=72){return{name:`Test ${drill.family}`,position:POS[drill.family],engineRole:POS[drill.family],instanceId:'training-test-user',pace:value,shooting:value,passing:value,dribbling:value,defense:value,physical:value,ballControl:value,vision:value,stamina:value,composure:value,fitness:100,skills:[],build:'creator'};}
function run(drill,value=72,reps=2){const player=playerFor(drill,value),result={drillId:drill.id,quality:value,reps,successes:0,grade:'B',seed:`v2-${drill.id}-${value}`},engine=new TrainingMatchEngine(drill,result,player);let frames=0;while(!engine.finished&&frames<3000){engine.step(.033);frames++;for(const p of engine.players){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y),`${drill.id}: posición inválida`);}assert.ok(Number.isFinite(engine.ball.x)&&Number.isFinite(engine.ball.y),`${drill.id}: pelota inválida`);}assert.ok(engine.finished,`${drill.id}: el ejercicio no termina`);return{engine,out:engine.sessionResult(),frames};}
function diagnostic(engine){const q=engine.trainingQualityV6||{},m=engine.trainingMetricsV6||{},r=n=>Math.round(Number(n)||0);return`fase=${q.phase||'-'} player=${r(engine.player?.x)},${r(engine.player?.y)} ball=${r(engine.ball?.x)},${r(engine.ball?.y)} last=${engine.ball?.lastPlayerId||'-'} possession=${q.possessionId||'-'} touches=${m.physicalTouches||0} passes=${m.passesCompleted||m.passes||0} shots=${m.shots||0} gates=${m.gatesCleared||0} duels=${m.duelsBeaten||0} wall=${m.wallBeats||0} deliveries=${m.deliveries||0} reps=${JSON.stringify(q.repResults||[])}`;}

test('production training runtime uses one isolated authoritative engine',()=>{assert.ok(TRAINING_RUNTIME_VERSIONS.matchEngine>=2);assert.equal(TRAINING_RUNTIME_VERSIONS.authoritativeScenarios,TRAINING_RUNTIME_VERSIONS.matchEngine);assert.equal(TRAINING_RUNTIME_VERSIONS.framework,2);});

test('every role drill executes on the player position it belongs to',()=>{
  const failures=[];
  for(const drill of ROLE_DRILLS){
    try{
      assert.equal(trainingFamily(playerFor(drill).position),drill.family,`${drill.id}: familia/posición`);
      const {out,engine}=run(drill);
      assert.equal(out.engineVersion,TRAINING_RUNTIME_VERSIONS.matchEngine,`${drill.id}: versión de motor`);
      assert.equal(out.reps,2,`${drill.id}: repeticiones`);
      assert.ok(Array.isArray(out.markers)&&out.markers.length===drill.markers.length,`${drill.id}: marcadores`);
      assert.ok(out.successes>=1,`${drill.id}: terminó ${out.successes}/2; ${diagnostic(engine)}`);
    }catch(error){
      failures.push(error?.message||String(error));
    }
  }
  assert.deepEqual(failures,[],`Fallaron ${failures.length} drills:\n${failures.join('\n')}`);
});

test('a weak striker can still execute fundamentals instead of failing every repetition',()=>{for(const id of ['st-profile-finish','st-run-behind','st-wall-run','st-box-duel']){const drill=ROLE_DRILLS.find(d=>d.id===id),{out,engine}=run(drill,46,3);assert.ok((engine.trainingMetricsV6.physicalTouches||0)>0,`${id}: sin contactos físicos`);assert.ok(out.successes>=1,`${id}: un juvenil 46 no pudo resolver ninguna de 3 repeticiones`);}});