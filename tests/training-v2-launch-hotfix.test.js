import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingCatalogFor} from '../training-framework-v2.js';
import {previewTrainingResult,applyTrainingResult,trainingDevelopmentProgress} from '../training-memory-v1.js';
import {TrainingMatchEngine} from '../training-runtime-latest.js';

function state(){
  const player={name:'OUROS',position:'ST',engineRole:'ST',pace:55,shooting:52,passing:48,dribbling:54,defense:38,physical:52,ballControl:51,vision:49,stamina:56,composure:50,fitness:100,form:0,potential:90,dynamicPotential:90,trainingMemory:{},developmentWork:{},trainingLog:[],trainingSummary:{sessions:0,avgGrade:0,bestGrade:'—'}};
  return{season:1,week:4,player,progress:{trainingPoints:2,xp:0},campaign:{coachTrust:50,lockerRoom:50,media:50,relationships:{},seenEvents:[],currentEvent:null},world:{club:{roster:[{...player,isUser:true}]}},clubId:'club'};
}

test('role-specific training ids can preview, run and commit without falling back to the legacy catalog',()=>{
  const s=state(),drill=trainingCatalogFor(s.player).find(d=>d.id==='st-profile-finish');
  assert.ok(drill);
  const preview=previewTrainingResult(s,drill.id,0,drill);
  assert.equal(preview.drillId,'st-profile-finish');
  const engine=new TrainingMatchEngine(drill,preview,s.player);
  for(let i=0;i<30;i++)engine.step(.016);
  assert.equal(engine.drill.id,'st-profile-finish');
  assert.ok(Number.isFinite(engine.ball.x)&&Number.isFinite(engine.ball.y));
  const before=s.progress.trainingPoints;
  const out=applyTrainingResult(s,{...preview,successes:Math.min(preview.reps,2)},null,drill);
  assert.equal(out.ok,true);
  assert.equal(s.progress.trainingPoints,before-1);
  assert.equal(s.player.trainingLog[0].drillId,'st-profile-finish');
});

test('development progress accepts the v2 drill object used by the training cards',()=>{
  const s=state(),drill=trainingCatalogFor(s.player)[0],progress=trainingDevelopmentProgress(s.player,drill);
  assert.ok(progress.length>=3);
  assert.ok(progress.every(row=>Number.isFinite(row.threshold)&&row.percent>=0));
});
