import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveTacticalInfluence,authorityPermissions,careerAuthoritySnapshot} from '../career-authority-v1.js';
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
