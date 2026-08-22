import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRoleDecisionPolicy,rankRoleAwareCandidates} from '../role-decision-policy-v1.js';
import {createRoleContract} from '../role-contract-v1.js';
import {decisionRoleContext} from '../decision-value-v1.js';

const FIELD={left:55,right:1045,top:45,bottom:655,centerX:550,centerY:350};
const player=(role,x=300,y=350,data={})=>({id:`${role}-phase`,role,team:0,x,y,data});
const pass=(kind='progressive',value=.4,x=440,y=350)=>({type:'pass',kind,value,aim:{x,y}});
const dribble=(value=.4,x=360,y=350)=>({type:'dribble',value,target:{x,y}});
const shot=(value=.4)=>({type:'shot',value});

test('the same midfielder values progression differently in build-up and progression phases',()=>{
  const p=player('CM');
  const contract=createRoleContract({role:'CM',tactics:{directness:50}});
  const candidate=pass('progressive',.4);
  const build=applyRoleDecisionPolicy({player:p,candidate,field:FIELD,pressure:.2,phase:'build-up',contract});
  const progression=applyRoleDecisionPolicy({player:p,candidate,field:FIELD,pressure:.2,phase:'progression',contract});
  assert.ok(progression.value>build.value);
  assert.equal(progression.activeResponsibility?.id,'mid-line-break');
});

test('centre-back build-up security can veto a pressured carry before physical execution',()=>{
  const p=player('CB',180,350);
  const contract=createRoleContract({role:'CB',tactics:{directness:40}});
  const result=applyRoleDecisionPolicy({player:p,candidate:dribble(.9,245,350),field:FIELD,pressure:.6,phase:'build-up',contract});
  assert.equal(result.allowed,false);
  assert.equal(result.phaseReason,'role-contract:build-up-security');
});

test('coach width instruction changes winger ranking mechanically in progression',()=>{
  const p=player('RW',470,590);
  const wideContract=createRoleContract({role:'RW',tactics:{width:75}});
  const neutralContract=createRoleContract({role:'RW',tactics:{width:50}});
  const candidate=dribble(.4,535,595);
  const wide=applyRoleDecisionPolicy({player:p,candidate,field:FIELD,pressure:.25,phase:'progression',contract:wideContract});
  const neutral=applyRoleDecisionPolicy({player:p,candidate,field:FIELD,pressure:.25,phase:'progression',contract:neutralContract});
  assert.ok(wide.value>neutral.value);
  assert.equal(wide.activeResponsibility?.id,'coach-max-width');
});

test('box attack makes a striker prefer a viable finish over an equal support action',()=>{
  const p=player('ST',850,350);
  const contract=createRoleContract({role:'ST',tactics:{directness:55}});
  const ranked=rankRoleAwareCandidates({player:p,candidates:[shot(.4),pass('support',.4,790,350)],field:FIELD,pressure:.2,phase:'box-attack',contract});
  assert.equal(ranked[0].type,'shot');
  assert.ok(ranked[0].phaseDelta>0);
});

test('decision runtime derives phase and Role Contract without granting manager authority',()=>{
  const p=player('RW',600,580,{coachTrust:65,tacticalInfluence:35});
  const engine={
    tactics:[{width:70,pressing:55,directness:50,tempo:55}],
    currentTacticalState:()=>({phase:'progression',inPossession:true}),
  };
  const context=decisionRoleContext(engine,p);
  assert.equal(context.phase,'progression');
  assert.equal(context.contract.role,'RW');
  assert.equal(context.contract.responsibilities.progression.some(r=>r.id==='coach-max-width'),true);
  assert.equal(context.contract.authority.permissions.canSetFormation,false);
});

test('phase-aware tactical ranking never mutates or owns the free ball',()=>{
  const ball={x:550,y:350,vx:2.4,vy:-.3,lastTeam:0};
  const before=structuredClone(ball);
  const p=player('CM');
  const contract=createRoleContract({role:'CM',tactics:{directness:38}});
  rankRoleAwareCandidates({player:p,candidates:[pass('support'),dribble()],field:FIELD,pressure:.4,phase:'build-up',contract});
  assert.deepEqual(ball,before);
  assert.equal('ownerId' in ball,false);
});
