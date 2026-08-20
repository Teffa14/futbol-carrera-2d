import test from 'node:test';
import assert from 'node:assert/strict';
import {applyTrainingResult,trainingDevelopmentProgress,memoryLevel} from '../training-memory-v1.js';

function state(){return{
  season:1,week:1,clubId:'club',progress:{trainingPoints:12,xp:0},campaign:{coachTrust:50},
  player:{name:'Prospecto',position:'RW',rating:60,potential:86,dynamicPotential:86,fitness:100,form:0,
    pace:60,shooting:58,passing:59,dribbling:60,defense:45,physical:58,ballControl:60,vision:58,stamina:58,composure:59,
    trainingMemory:{},developmentWork:{},trainingLog:[],trainingSummary:{sessions:0,avgGrade:0,bestGrade:'—'}},
  world:{club:{roster:[]}},
};}

test('repeating a strong 1v1 session builds immediate memory and permanent stats over time',()=>{
  const s=state(),before=s.player.dribbling,result={drillId:'one-v-one',quality:92,grade:'S',reps:10,successes:9};
  const first=applyTrainingResult(s,result);assert.equal(first.ok,true);assert.ok(memoryLevel(s.player,'1v1')>0);
  assert.ok(trainingDevelopmentProgress(s.player,'one-v-one').find(x=>x.attr==='dribbling').work>0);
  for(let i=0;i<5;i++)applyTrainingResult(s,result);
  assert.ok(s.player.dribbling>before,'repeated good 1v1 work must eventually raise dribbling');
  assert.ok(s.player.ballControl>60,'repeated good 1v1 work must improve control too');
  assert.ok((s.player.developmentWork.stamina||0)>0||s.player.stamina>58,'1v1 acceleration work must train stamina');
});

test('successful small-sided work accumulates stamina development',()=>{
  const s=state(),result={drillId:'three-v-three',quality:84,grade:'A',reps:9,successes:8};
  applyTrainingResult(s,result);
  const stamina=trainingDevelopmentProgress(s.player,'three-v-three').find(x=>x.attr==='stamina');
  assert.ok(stamina.work>0);
  assert.ok(stamina.percent>0);
});
