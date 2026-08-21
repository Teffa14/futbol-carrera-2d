import test from 'node:test';
import assert from 'node:assert/strict';
import {retirementWindow,retirementAssessment,shouldAutoRetire,careerRetirementSnapshot} from '../career-retirement-v1.js';

function veteran(overrides={}){
  return{
    id:'user-player',instanceId:'user-player',name:'Veterano',age:34,rating:76,
    pace:68,physical:70,stamina:69,
    developmentProfile:{age:34,retirement:{eligibleFrom:34,retired:false,reason:null}},
    ...overrides,
  };
}

test('retirement window is deterministic and keeps a multi-season voluntary window before forced age retirement',()=>{
  const player=veteran();
  const a=retirementWindow(player),b=retirementWindow(player);
  assert.deepEqual(a,b);
  assert.equal(a.eligibleFrom,34);
  assert.ok(a.mandatoryFrom>=39&&a.mandatoryFrom<=42);
});

test('reaching retirement eligibility does not automatically end a healthy career',()=>{
  const assessment=retirementAssessment(veteran());
  assert.equal(assessment.eligible,true);
  assert.equal(assessment.forced,false);
  assert.equal(assessment.recommendation,'available');
  assert.ok(assessment.reasons.includes('age'));
  assert.equal(shouldAutoRetire(veteran()).retire,false);
});

test('advanced age eventually creates a deterministic hard career endpoint',()=>{
  const player=veteran();
  const {mandatoryFrom}=retirementWindow(player);
  player.age=mandatoryFrom;
  player.developmentProfile.age=mandatoryFrom;
  const result=shouldAutoRetire(player);
  assert.equal(result.retire,true);
  assert.equal(result.reason,'age');
  assert.equal(result.assessment.recommendation,'retire');
});

test('physical decline, severe injuries and missing club opportunities raise retirement pressure mechanically',()=>{
  const healthy=retirementAssessment(veteran());
  const struggling=retirementAssessment(veteran({age:37,pace:48,physical:52,stamina:50,developmentProfile:{age:37,retirement:{eligibleFrom:34}}}),{injuryBurden:78,clubOpportunityCount:0});
  assert.ok(struggling.pressure>healthy.pressure);
  assert.ok(struggling.reasons.includes('physical_decline'));
  assert.ok(struggling.reasons.includes('injuries'));
  assert.ok(struggling.reasons.includes('no_club_opportunities'));
  assert.ok(['strongly_consider','retire'].includes(struggling.recommendation));
});

test('retirement snapshot preserves a compact final career record without mutating match history',()=>{
  const history=[
    {appeared:true,goals:1,assists:0},
    {appeared:false,goals:0,assists:0},
    {appeared:true,goals:2,assists:1},
  ];
  const state={season:18,clubId:'rosario-club',clock:{currentDate:'2043-11-20'},player:veteran({age:35,rating:79}),history};
  const before=structuredClone(history),snapshot=careerRetirementSnapshot(state,{reason:'player_choice'});
  assert.equal(snapshot.status,'retired');
  assert.equal(snapshot.reason,'player_choice');
  assert.equal(snapshot.date,'2043-11-20');
  assert.equal(snapshot.season,18);
  assert.deepEqual(snapshot.totals,{appearances:2,goals:3,assists:1});
  assert.ok(snapshot.assessment.reasons.includes('player_choice'));
  assert.deepEqual(history,before);
});
