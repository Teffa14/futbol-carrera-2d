import test from 'node:test';
import assert from 'node:assert/strict';
import {applyTrainingResult,developmentWorkThreshold,developmentLearningEfficiency} from '../training-memory-v1.js';

function state(){return{season:1,week:1,clubId:'club',progress:{trainingPoints:10,xp:0},campaign:{coachTrust:50},player:{name:'Juvenil',position:'ST',rating:48,potential:88,dynamicPotential:88,fitness:100,form:0,pace:48,shooting:45,passing:46,dribbling:47,defense:35,physical:48,ballControl:46,vision:45,stamina:50,composure:46,trainingMemory:{},developmentWork:{},trainingLog:[],trainingSummary:{sessions:0,avgGrade:0,bestGrade:'—'}},world:{club:{roster:[]}}};}

test('low attributes have lower work thresholds and higher learning efficiency',()=>{
  assert.ok(developmentWorkThreshold(45)<developmentWorkThreshold(75));
  assert.ok(developmentLearningEfficiency(45)>developmentLearningEfficiency(75));
  assert.ok(developmentLearningEfficiency(85)<1);
});

test('a poor young finisher can gain a shooting point after roughly four bad sessions',()=>{
  const s=state(),result={drillId:'finishing',quality:38,grade:'E',reps:8,successes:2};
  for(let i=0;i<4;i++)applyTrainingResult(s,result);
  assert.ok(s.player.shooting>=46,`expected foundational learning to move shooting, got ${s.player.shooting}`);
});
