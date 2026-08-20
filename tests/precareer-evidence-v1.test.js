import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreCareerState,preCareerReadiness} from '../precareer-v1.js';
import {recordTrainingEngineEvidence,recordTrialMatchEvidence,scoutingScoresFromTrainingEngine,scoutingScoresFromTrialMatch} from '../precareer-evidence-v1.js';
import {TrainingMatchEngine} from '../training-match-engine-v1.js';

const player={instanceId:'user-player',name:'Prospecto',position:'CM',age:17,rating:57,country:'Argentina',pace:62,shooting:55,passing:61,dribbling:60,defense:52,physical:55,ballControl:61,vision:62,stamina:60,composure:58};
const mockDrill=(id,kind,success=true)=>({drill:{id,kind},result:{reps:2,quality:72,successes:success?2:0},finished:true,trainingMetricsV6:{physicalTouches:18,passesAttempted:kind==='finish'?0:6,passesCompleted:success?5:1,shots:kind==='finish'?4:0,goals:kind==='finish'&&success?3:0,duelsBeaten:kind==='1v1'&&success?2:0,gatesCleared:kind==='cones'&&success?8:0,branches:new Set(success?['a','b']:['a']),receivers:new Set(success?['m1','m2']:[])},trainingQualityV6:{repResults:[{success},{success}]},userPerformance(){return{rating:success?7.4:5.3};}});
const trial=(rating,extra={})=>({userPerformance(){return{rating,engineRole:'CM',passPct:extra.passPct??75,dribblePct:extra.dribblePct??68,passesAttempted:25,dribblesAttempted:4,tackles:extra.tackles??2,interceptions:extra.interceptions??2,shots:extra.shots??1,goals:extra.goals??0,minutesPlayed:75,turnovers:extra.turnovers??2};}});

test('live TrainingMatchEngine evidence produces bounded scouting scores without changing player attributes',()=>{
  const before=structuredClone(player),engine=new TrainingMatchEngine({id:'live-2v2',name:'2v2',kind:'2v2'},{seed:'precareer-live',reps:1,quality:76,grade:'B',successes:0},player);
  for(let i=0;i<900&&!engine.finished;i++)engine.step(1/60);
  const scores=scoutingScoresFromTrainingEngine(engine);
  for(const value of Object.values(scores))assert.ok(value>=0&&value<=100);
  let state=createPreCareerState({player});state=recordTrainingEngineEvidence(state,engine);
  assert.equal(state.drills.length,1);assert.equal(state.drills[0].drillId,'live-2v2');assert.deepEqual(player,before);
});

test('actual drill outcomes matter more than the configured drill label',()=>{
  const good=scoutingScoresFromTrainingEngine(mockDrill('finish-good','finish',true));
  const poor=scoutingScoresFromTrainingEngine(mockDrill('finish-poor','finish',false));
  assert.ok(good.technical>poor.technical);assert.ok(good.mentality>poor.mentality);
});

test('trial scouting rewards a stronger causal match performance',()=>{
  const strong=scoutingScoresFromTrialMatch(trial(8.1,{passPct:88,dribblePct:80,tackles:3,interceptions:3,turnovers:1}));
  const weak=scoutingScoresFromTrialMatch(trial(5.2,{passPct:51,dribblePct:35,tackles:0,interceptions:0,turnovers:6}));
  assert.ok(strong.technical>weak.technical);assert.ok(strong.tactical>weak.tactical);assert.ok(strong.mentality>weak.mentality);
});

test('real-evidence adapters can carry an unsigned prospect through assessment to offers',()=>{
  let state=createPreCareerState({player});
  state=recordTrainingEngineEvidence(state,mockDrill('cones','cones',true));
  state=recordTrainingEngineEvidence(state,mockDrill('duel','1v1',true));
  state=recordTrainingEngineEvidence(state,mockDrill('combine','3v3',true));
  assert.equal(state.stage,'trial-matches');
  state=recordTrialMatchEvidence(state,trial(7.0),{matchId:'trial-1'});
  state=recordTrialMatchEvidence(state,trial(7.5,{passPct:82}),{matchId:'trial-2'});
  assert.equal(preCareerReadiness(state).readyForOffers,true);assert.equal(state.stage,'awaiting-offers');
});

test('trial adapter still respects the pre-career gate and cannot skip drills',()=>{
  const state=createPreCareerState({player});
  assert.throws(()=>recordTrialMatchEvidence(state,trial(8),{matchId:'too-early'}),/Required drills/);
});
