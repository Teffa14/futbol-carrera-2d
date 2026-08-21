import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareer,nextFixture,completeCareerMatch} from '../career.js';

test('new careers initialize persistent Coach Trust separately from Tactical Influence',()=>{
  const state=createCareer({playerName:'Trust Prospect',nationality:'AR',position:'CM',build:'creator',countryId:'AR',clubId:'river'});
  assert.equal(state.authority.coachTrust,25);
  assert.equal(state.authority.tacticalInfluence,0);
  assert.deepEqual(state.authority.coachAssessments,[]);
});

test('career match feeds tactical breakdown into persistent Coach Trust',()=>{
  const state=createCareer({playerName:'Tactical Test',nationality:'AR',position:'CM',build:'creator',countryId:'AR',clubId:'river'});
  state.authority.coachTrust=55;
  const fixture=nextFixture(state);
  const result=completeCareerMatch(state,fixture.id,{score:[1,1],userPerformance:{rating:8.8,ratingBreakdown:{tactical:4,errors:0},goals:0,assists:0,shots:1,passesAttempted:12,passesCompleted:11,dribblesAttempted:1,dribblesCompleted:1,tackles:1,interceptions:1,staminaUsed:12}});
  assert.equal(result.ok,true);
  assert.ok(state.authority.coachTrust<55,'raw match rating must not hide poor tactical compliance');
  assert.equal(state.authority.tacticalInfluence,0);
  assert.equal(state.authority.coachAssessments.length,1);
  assert.equal(state.authority.coachAssessments[0].fixtureId,fixture.id);
  assert.match(state.authority.coachAssessments[0].assessment,/negative/);
  assert.equal(state.lastMatch.coachAssessment.delta,state.history.at(-1).coachTrustDelta);
  assert.equal(state.history.at(-1).coachAssessment,state.authority.coachAssessments[0].assessment);
});

test('non-appearance leaves Coach Trust unchanged and records no fake assessment',()=>{
  const state=createCareer({playerName:'Reserve Test',nationality:'AR',position:'CM',build:'creator',countryId:'AR',clubId:'river'});
  for(const p of state.world[state.clubId].roster){p.rating=p.isUser?30:90;p.fitness=100;p.form=0;}
  const before=state.authority.coachTrust;
  const fixture=nextFixture(state);
  const result=completeCareerMatch(state,fixture.id,{score:[0,0],userPerformance:null});
  assert.equal(result.ok,true);
  assert.equal(state.authority.coachTrust,before);
  assert.equal(state.authority.coachAssessments.length,0);
  assert.equal(state.lastMatch.coachAssessment.assessment,'not-assessed');
  assert.equal(state.history.at(-1).coachTrustDelta,0);
  assert.equal(state.history.at(-1).coachAssessment,'not-assessed');
});
