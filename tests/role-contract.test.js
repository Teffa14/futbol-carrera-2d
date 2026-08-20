import test from 'node:test';
import assert from 'node:assert/strict';
import {PHASES} from '../tactics.js';
import {createRoleContract,responsibilitiesForPhase,primaryResponsibility,roleFamily} from '../role-contract-v1.js';

test('role contracts expose concrete responsibilities by match phase',()=>{
  const contract=createRoleContract({role:'RW',tactics:{width:68,pressing:70,directness:48,tempo:60}});
  assert.equal(contract.family,'winger');
  assert.ok(responsibilitiesForPhase(contract,PHASES.BUILD_UP).some(r=>r.action.includes('width')));
  assert.ok(responsibilitiesForPhase(contract,PHASES.FINAL_THIRD).some(r=>r.action.includes('fullback')));
  assert.ok(responsibilitiesForPhase(contract,PHASES.DEFENSIVE_TRANSITION).length>0);
});

test('coach width creates a specific winger obligation rather than a generic stat buff',()=>{
  const wide=createRoleContract({role:'LW',tactics:{width:72,pressing:45,directness:50}});
  const narrow=createRoleContract({role:'LW',tactics:{width:44,pressing:45,directness:50}});
  const wideRules=responsibilitiesForPhase(wide,PHASES.PROGRESSION);
  const narrowRules=responsibilitiesForPhase(narrow,PHASES.PROGRESSION);
  assert.ok(wideRules.some(r=>r.id==='coach-max-width'&&r.action==='stay-wide-until-opponent-fullback-commits'));
  assert.equal(narrowRules.some(r=>r.id==='coach-max-width'),false);
  assert.equal('attributeBonus' in wide,false);
});

test('direct coach model changes striker behaviour in progression',()=>{
  const direct=createRoleContract({role:'ST',tactics:{directness:78,pressing:52,width:50}});
  const patient=createRoleContract({role:'ST',tactics:{directness:38,pressing:52,width:50}});
  assert.ok(responsibilitiesForPhase(direct,PHASES.PROGRESSION).some(r=>r.id==='coach-direct-depth'));
  assert.equal(responsibilitiesForPhase(patient,PHASES.PROGRESSION).some(r=>r.id==='coach-direct-depth'),false);
});

test('high press becomes a phase-specific instruction for outfield roles',()=>{
  for(const role of ['CB','LB','CM','RW','ST']){
    const contract=createRoleContract({role,tactics:{pressing:76,width:50,directness:50}});
    assert.ok(responsibilitiesForPhase(contract,PHASES.OUT_OF_POSSESSION).some(r=>r.id==='coach-high-press'),role);
  }
  const keeper=createRoleContract({role:'GK',tactics:{pressing:76}});
  assert.equal(responsibilitiesForPhase(keeper,PHASES.OUT_OF_POSSESSION).some(r=>r.id==='coach-high-press'),false);
});

test('trust and influence increase interpretation room without turning the player into manager',()=>{
  const youth=createRoleContract({role:'CM',tactics:{},trust:5,influence:0});
  const leader=createRoleContract({role:'CM',tactics:{},trust:90,influence:80});
  assert.ok(leader.creativeFreedom>youth.creativeFreedom);
  assert.ok(leader.creativeFreedom<=88);
  assert.ok(youth.roleDiscipline>leader.roleDiscipline);
  assert.deepEqual(Object.keys(leader.coachModel).sort(),['directness','pressing','tempo','width']);
});

test('primary responsibility is deterministic and role families remain explicit',()=>{
  assert.equal(roleFamily('RB'),'fullback');
  assert.equal(roleFamily('CAM'),'midfielder');
  const contract=createRoleContract({role:'CB',tactics:{directness:35,pressing:40}});
  const primary=primaryResponsibility(contract,PHASES.BUILD_UP);
  assert.equal(primary.id,'coach-patient-build');
  assert.equal(primary.priority,94);
});
