import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareer,matchdaySelection,trainAttribute} from '../career.js';
import {careerMatchEligible,careerTrainingAvailability,applyCareerMatchInjuryExposure,advanceCareerInjuryDays} from '../career-injury-runtime-v1.js';

function career(){
  return createCareer({countryId:'AR',clubId:'newells',playerName:'Lesion Test',nationality:'AR',position:'ST',build:'finisher'});
}

function activeInjury(days=21,severity='minor'){
  return{id:'inj-runtime',kind:'muscle',severity,expectedDays:days,remainingDays:days,status:'active',exposureId:'test'};
}

test('active injury removes an otherwise fit user from matchday selection',()=>{
  const state=career();
  state.player.rating=99;
  state.player.fitness=100;
  state.player.injury=activeInjury();
  const rosterUser=state.world[state.clubId].roster.find(player=>player.isUser);
  Object.assign(rosterUser,state.player);
  const selection=matchdaySelection(state);
  assert.equal(careerMatchEligible(state.player),false);
  assert.equal(selection.starters.some(player=>player.isUser),false);
  assert.equal(selection.bench.some(player=>player.isUser),false);
  assert.equal(selection.status,'reserve');
});

test('injured NPCs are unavailable to the same coach selection logic',()=>{
  const state=career();
  const npc=state.world[state.clubId].roster.find(player=>!player.isUser&&player.position!=='GK');
  npc.rating=99;
  npc.fitness=100;
  npc.injury=activeInjury(35,'moderate');
  const selection=matchdaySelection(state);
  assert.equal(selection.starters.some(player=>player.instanceId===npc.instanceId),false);
  assert.equal(selection.bench.some(player=>player.instanceId===npc.instanceId),false);
});

test('medical availability blocks normal attribute training during a significant injury',()=>{
  const state=career();
  state.player.injury=activeInjury(14,'minor');
  const before=state.progress.trainingPoints;
  assert.equal(careerTrainingAvailability(state),false);
  const result=trainAttribute(state,'shooting');
  assert.equal(result.ok,false);
  assert.equal(state.progress.trainingPoints,before);
});

test('calendar recovery restores eligibility and stores one bounded injury history entry',()=>{
  const state=career();
  state.player.injury=activeInjury(10,'minor');
  const afterWeek=advanceCareerInjuryDays(state,7,{date:'2026-09-10'});
  assert.equal(afterWeek.remainingDays,3);
  assert.equal(careerMatchEligible(state.player),false);
  const recovered=advanceCareerInjuryDays(state,3,{date:'2026-09-13'});
  assert.equal(recovered.status,'recovered');
  assert.equal(careerMatchEligible(state.player),true);
  assert.equal(state.player.injuryHistory.length,1);
  advanceCareerInjuryDays(state,7,{date:'2026-09-20'});
  assert.equal(state.player.injuryHistory.length,1);
});

test('real match exposure can create a deterministic persistent injury without touching ball state',()=>{
  const state=career();
  const ball={x:420,y:250,vx:3,vy:-1};
  const before={...ball};
  const outcome=applyCareerMatchInjuryExposure(state,{
    fixtureId:'fixture-0',
    date:'2026-09-03',
    performance:{staminaUsed:100,bodyDuels:12,tackles:8,injuryExposure:{workload:100,liveFatigue:100,contactIntensity:100,sprintLoad:100,recoveryDays:0}},
  });
  assert.equal(outcome.occurred,true);
  assert.equal(state.player.injury?.id,outcome.injury.id);
  assert.deepEqual(ball,before);
  assert.equal(Object.hasOwn(outcome,'ownerId'),false);
  assert.equal(Object.hasOwn(state.player.injury,'ownerId'),false);
});
