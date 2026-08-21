import test from 'node:test';
import assert from 'node:assert/strict';
import {createIdentityState,applyTrainingEvidence,applyMatchEvidence,deriveAIProfile,identityMechanicalMods,branchProgress,syncIdentityFromCareer} from '../player-identity-progression-v1.js';

function career(){return{createdAt:1234,season:1,week:4,history:[],lastMatch:null,player:{name:'OUROS',birthDate:'2009-04-02',position:'ST',build:'finisher',trainingMemory:{'box-run':{familiarity:18},'timed-run':{familiarity:12}},trainingSummary:{sessions:0},trainingLog:[]}};}

test('created striker gets football branches instead of equipable perk slots',()=>{
  const id=createIdentityState(career());
  assert.deepEqual(Object.keys(id.branches),['finishing','movement','combination','duel']);
  assert.equal(id.position,'ST');
  assert.ok(id.branches.finishing.xp>id.branches.combination.xp,'finisher background should bias finishing without equipping a perk');
});

test('a bad training session still creates meaningful development',()=>{
  const poor=createIdentityState(career()),good=createIdentityState(career());
  const before=poor.branches.finishing.xp;
  applyTrainingEvidence(poor,{drillId:'finishing',grade:'E',quality:38,reps:8,successes:2});
  applyTrainingEvidence(good,{drillId:'finishing',grade:'A',quality:84,reps:8,successes:7});
  const poorGain=poor.branches.finishing.xp-before,goodGain=good.branches.finishing.xp-createIdentityState(career()).branches.finishing.xp;
  assert.ok(poorGain>=14,`poor session should still teach, got ${poorGain}`);
  assert.ok(goodGain>poorGain,'better execution should accelerate learning');
  assert.ok(goodGain<poorGain*2.4,'quality should accelerate identity growth without making poor sessions irrelevant');
});

test('match evidence develops the actions actually performed',()=>{
  const id=createIdentityState(career()),beforeFinish=id.branches.finishing.xp,beforeMove=id.branches.movement.xp;
  applyMatchEvidence(id,{rating:7.4,shots:3,shotsOnTarget:2,goals:1,passesCompleted:5,dribblesCompleted:1,ratingBreakdown:{shooting:7.5,offBall:7.2,tactical:6.7,passing:6.4,dribbling:6.3}});
  assert.ok(id.branches.finishing.xp>beforeFinish+25);
  assert.ok(id.branches.movement.xp>beforeMove+15);
  assert.match(id.log[0].text,/Partido/);
});

test('mastery changes AI policy and creates small real mechanical gains',()=>{
  const id=createIdentityState(career()),base=deriveAIProfile(id),mods0=identityMechanicalMods(id);
  id.branches.movement.xp=700;id.branches.finishing.xp=700;
  const evolved=deriveAIProfile(id),mods1=identityMechanicalMods(id);
  assert.ok(evolved.runBehind>base.runBehind);
  assert.ok(evolved.shootIntent>base.shootIntent);
  assert.ok(mods1.shooting>mods0.shooting);
  assert.ok(branchProgress(id.branches.finishing).level>=4);
});

test('career sync processes each new training session and match once',()=>{
  const c=career(),id=createIdentityState(c);c.player.trainingSummary.sessions=1;c.player.trainingLog=[{drillId:'one-v-one',grade:'D',quality:50,reps:8,successes:3}];
  c.history=[{season:1,week:4,date:'2026-08-20',fixtureId:'x'}];c.lastMatch={fixtureId:'x',date:'2026-08-20',userPerformance:{rating:6.8,shots:1,shotsOnTarget:1,passesCompleted:2,dribblesCompleted:1,ratingBreakdown:{shooting:6.5,offBall:6.4,tactical:6.2,passing:6.1,dribbling:6.4}}};
  const once=syncIdentityFromCareer(c,id),xp=once.branches.duel.xp,logCount=once.log.length;
  const twice=syncIdentityFromCareer(c,once);
  assert.equal(twice.branches.duel.xp,xp);
  assert.equal(twice.log.length,logCount);
});
