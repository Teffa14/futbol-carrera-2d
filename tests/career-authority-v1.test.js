import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveTacticalInfluence,coachTrustAssessment,ensureCareerAuthority,applyCoachTrustToCareer,authorityPermissions,careerAuthoritySnapshot} from '../career-authority-v1.js';
import {createRoleContract} from '../role-contract-v1.js';

test('coach trust does not generate tactical influence by itself',()=>{
  const influence=deriveTacticalInfluence({reputation:0,tenureSeasons:0,leadership:0,captaincy:false,contractImportance:0,tacticalIQ:0,teamSuccess:0,sustainedPerformance:0,coachTrust:100});
  assert.equal(influence,0);
});

test('career stature builds influence without requiring coach trust',()=>{
  const rookie=deriveTacticalInfluence({reputation:15,tenureSeasons:0,leadership:20,tacticalIQ:30,sustainedPerformance:20});
  const senior=deriveTacticalInfluence({reputation:88,tenureSeasons:5,leadership:82,captaincy:true,contractImportance:85,tacticalIQ:90,teamSuccess:75,sustainedPerformance:88});
  assert.ok(senior>rookie+45);
  assert.ok(senior>=75);
});

test('coach rewards tactical compliance even without a standout box-score rating',()=>{
  const result=coachTrustAssessment({currentTrust:34,matchRating:6.2,tacticalRating:8,errorCost:0.1,appeared:true});
  assert.ok(result.delta>=2);
  assert.ok(result.after>34);
  assert.ok(result.tacticalSignal>result.performanceSignal);
});

test('strong individual rating cannot hide poor tactical compliance from the coach',()=>{
  const result=coachTrustAssessment({currentTrust:55,matchRating:8.8,tacticalRating:4,errorCost:0,appeared:true});
  assert.ok(result.delta<0);
  assert.ok(result.after<55);
  assert.match(result.assessment,/negative/);
});

test('coach trust changes are bounded and clamped to the career scale',()=>{
  const gain=coachTrustAssessment({currentTrust:99,matchRating:10,tacticalRating:10,errorCost:0,appeared:true});
  const loss=coachTrustAssessment({currentTrust:1,matchRating:3,tacticalRating:3,errorCost:2,appeared:true});
  assert.equal(gain.after,100);
  assert.equal(gain.delta,1);
  assert.equal(loss.after,0);
  assert.equal(loss.delta,-1);
});

test('a non-appearance does not fabricate a coach assessment',()=>{
  const result=coachTrustAssessment({currentTrust:47,matchRating:10,tacticalRating:10,errorCost:0,appeared:false});
  assert.equal(result.after,47);
  assert.equal(result.delta,0);
  assert.equal(result.assessment,'not-assessed');
});

test('career authority initializes legacy saves without erasing influence',()=>{
  const state={authority:{tacticalInfluence:42}};
  const authority=ensureCareerAuthority(state);
  assert.equal(authority.coachTrust,25);
  assert.equal(authority.tacticalInfluence,42);
  assert.deepEqual(authority.coachAssessments,[]);
});

test('post-match coach assessment persists trust and evidence without changing influence',()=>{
  const state={authority:{coachTrust:34,tacticalInfluence:51,coachAssessments:[]}};
  const result=applyCoachTrustToCareer(state,{fixtureId:'r1',date:'2026-08-21',matchRating:6.2,tacticalRating:8,errorCost:0.1,appeared:true});
  assert.equal(state.authority.coachTrust,result.after);
  assert.equal(state.authority.tacticalInfluence,51);
  assert.equal(state.authority.coachAssessments.length,1);
  assert.equal(state.authority.coachAssessments[0].fixtureId,'r1');
  assert.ok(result.delta>0);
});

test('career adapter does not record a fake assessment for a non-appearance',()=>{
  const state={authority:{coachTrust:47,tacticalInfluence:20,coachAssessments:[]}};
  const result=applyCoachTrustToCareer(state,{matchRating:10,tacticalRating:10,appeared:false});
  assert.equal(result.assessment,'not-assessed');
  assert.equal(state.authority.coachTrust,47);
  assert.equal(state.authority.coachAssessments.length,0);
});

test('career coach history stays bounded',()=>{
  const state={authority:{coachTrust:50,tacticalInfluence:0,coachAssessments:Array.from({length:30},(_,i)=>({fixtureId:`old-${i}`}))}};
  applyCoachTrustToCareer(state,{fixtureId:'new',matchRating:7,tacticalRating:7,appeared:true});
  assert.equal(state.authority.coachAssessments.length,30);
  assert.equal(state.authority.coachAssessments.at(-1).fixtureId,'new');
  assert.equal(state.authority.coachAssessments[0].fixtureId,'old-1');
});

test('high influence cannot bypass a coach who does not trust the player',()=>{
  const p=authorityPermissions({coachTrust:20,tacticalInfluence:92});
  assert.equal(p.canRequestPersonalAdjustment,false);
  assert.equal(p.canSuggestRelationshipPattern,false);
  assert.equal(p.canProposeStructuralAdjustment,false);
});

test('authority unlocks progressively from personal to structural suggestions',()=>{
  const personal=authorityPermissions({coachTrust:45,tacticalInfluence:30});
  assert.equal(personal.canRequestPersonalAdjustment,true);
  assert.equal(personal.canSuggestRelationshipPattern,false);
  const relationship=authorityPermissions({coachTrust:55,tacticalInfluence:52});
  assert.equal(relationship.canSuggestRelationshipPattern,true);
  assert.equal(relationship.canProposeStructuralAdjustment,false);
  const structural=authorityPermissions({coachTrust:78,tacticalInfluence:82});
  assert.equal(structural.canProposeStructuralAdjustment,true);
});

test('even maximum authority never grants manager powers',()=>{
  const p=authorityPermissions({coachTrust:100,tacticalInfluence:100});
  assert.equal(p.canControlLineup,false);
  assert.equal(p.canControlTransfers,false);
  assert.equal(p.canSetTeamFormation,false);
});

test('role contract exposes separated authority permissions',()=>{
  const contract=createRoleContract({role:'CM',trust:70,influence:74,tactics:{pressing:65,width:50,directness:50,tempo:55}});
  assert.equal(contract.authority.trust,70);
  assert.equal(contract.authority.influence,74);
  assert.equal(contract.authority.permissions.canProposeStructuralAdjustment,true);
  assert.equal(contract.authority.permissions.canControlLineup,false);
});

test('snapshot can derive influence from career evidence',()=>{
  const snapshot=careerAuthoritySnapshot({coachTrust:68,reputation:80,tenureSeasons:4,leadership:76,captaincy:true,contractImportance:72,tacticalIQ:82,teamSuccess:70,sustainedPerformance:80});
  assert.ok(snapshot.tacticalInfluence>=70);
  assert.equal(snapshot.canProposeStructuralAdjustment,true);
});
