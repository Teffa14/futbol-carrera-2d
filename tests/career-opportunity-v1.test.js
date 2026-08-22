import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureCareerOpportunity,recordCareerOpportunity,resolvePlayedMinutes,careerOpportunitySnapshot,opportunitySignals} from '../career-opportunity-v1.js';

test('opportunity ledger distinguishes starts bench reserve appearances and minutes',()=>{
  const state={season:1};
  ensureCareerOpportunity(state);
  recordCareerOpportunity(state,{fixtureId:'a',squadStatus:'starter',appeared:true,performance:{minutesPlayed:90}});
  recordCareerOpportunity(state,{fixtureId:'b',squadStatus:'bench',appeared:true,performance:{minutesPlayed:22}});
  recordCareerOpportunity(state,{fixtureId:'c',squadStatus:'reserve',appeared:false});
  const snap=careerOpportunitySnapshot(state);
  assert.equal(snap.season.fixtures,3);
  assert.equal(snap.season.starts,1);
  assert.equal(snap.season.benchSelections,1);
  assert.equal(snap.season.reserveSelections,1);
  assert.equal(snap.season.appearances,2);
  assert.equal(snap.season.minutes,112);
});

test('same fixture cannot be farmed twice',()=>{
  const state={season:1};
  recordCareerOpportunity(state,{fixtureId:'same',squadStatus:'starter',appeared:true,performance:{minutesPlayed:90}});
  recordCareerOpportunity(state,{fixtureId:'same',squadStatus:'starter',appeared:true,performance:{minutesPlayed:90}});
  assert.equal(state.opportunity.season.fixtures,1);
  assert.equal(state.opportunity.season.minutes,90);
});

test('explicit substitution timing produces real played minutes',()=>{
  assert.equal(resolvePlayedMinutes({enteredAtMinute:61,leftAtMinute:90},'bench'),29);
  assert.equal(resolvePlayedMinutes({subbedOffMinute:67},'starter'),67);
  assert.equal(resolvePlayedMinutes({minutesPlayed:104},'starter'),104);
});

test('injury absence is recorded separately from lack of sporting opportunity',()=>{
  const state={season:1};
  for(let i=0;i<4;i++)recordCareerOpportunity(state,{fixtureId:`inj-${i}`,squadStatus:'reserve',appeared:false,injured:true});
  const snap=careerOpportunitySnapshot(state);
  assert.equal(snap.season.unavailableInjured,4);
  assert.equal(snap.recentHealthyAppearanceRate,0);
});

test('sustained lack of minutes creates stronger loan and retirement opportunity signals',()=>{
  const blocked={season:1};
  const playing={season:1};
  for(let i=0;i<6;i++){
    recordCareerOpportunity(blocked,{fixtureId:`b-${i}`,squadStatus:'reserve',appeared:false});
    recordCareerOpportunity(playing,{fixtureId:`p-${i}`,squadStatus:'starter',appeared:true,performance:{minutesPlayed:90}});
  }
  const blockedSignals=opportunitySignals(blocked),playingSignals=opportunitySignals(playing);
  assert.ok(blockedSignals.loanNeed>playingSignals.loanNeed);
  assert.ok(blockedSignals.retirementOpportunityPressure>playingSignals.retirementOpportunityPressure);
  assert.ok(blockedSignals.marketPerformance<playingSignals.marketPerformance);
});

test('new season resets seasonal evidence while career totals persist',()=>{
  const state={season:1};
  recordCareerOpportunity(state,{fixtureId:'s1',squadStatus:'starter',appeared:true,performance:{minutesPlayed:90}});
  state.season=2;
  ensureCareerOpportunity(state);
  assert.equal(state.opportunity.season.season,2);
  assert.equal(state.opportunity.season.fixtures,0);
  assert.equal(state.opportunity.career.fixtures,1);
});

test('opportunity analysis never touches free-ball state',()=>{
  const state={season:1,ball:{x:4,y:8,vx:2,vy:-1}};
  const before=structuredClone(state.ball);
  recordCareerOpportunity(state,{fixtureId:'ball-safe',squadStatus:'starter',appeared:true,performance:{minutesPlayed:90}});
  assert.deepEqual(state.ball,before);
  assert.equal('ownerId' in state.ball,false);
});
