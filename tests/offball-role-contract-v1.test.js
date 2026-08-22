import test from 'node:test';
import assert from 'node:assert/strict';
import {PHASES} from '../tactics.js';
import {applyOffBallRoleContract,resolveOffBallRoleInstruction} from '../offball-role-contract-v1.js';

const field={left:55,right:1045,top:45,bottom:655};
const ball={x:620,y:350,vx:0,vy:0,r:5};

function player(role,overrides={}){
  return {id:`p-${role}`,role,team:0,x:400,y:350,homeX:400,homeY:350,r:10,...overrides};
}

test('winger holds materially more width in progression under a wide coach',()=>{
  const p=player('RW',{homeY:560,y:520});
  const base={x:520,y:500};
  const normal=applyOffBallRoleContract({target:base,player:p,ball,tacticalState:{phase:PHASES.PROGRESSION},tactics:{width:50},field});
  const wide=applyOffBallRoleContract({target:base,player:p,ball,tacticalState:{phase:PHASES.PROGRESSION},tactics:{width:75},field});
  assert.ok(wide.y>normal.y);
  assert.ok(wide.y>530);
});

test('striker preserves depth in build-up instead of collapsing toward a midfield ball',()=>{
  const p=player('ST',{x:650,homeX:650});
  const target=applyOffBallRoleContract({target:{x:600,y:345},player:p,ball:{...ball,x:480},tacticalState:{phase:PHASES.BUILD_UP},tactics:{directness:55},field});
  assert.ok(target.x>620);
});

test('centre-back final-third responsibility keeps a rest-defence position behind the ball',()=>{
  const p=player('CB',{x:390,homeX:390});
  const attackingBall={...ball,x:850};
  const target=applyOffBallRoleContract({target:{x:520,y:330},player:p,ball:attackingBall,tacticalState:{phase:PHASES.FINAL_THIRD},tactics:{},field});
  assert.ok(target.x<520);
  assert.ok(target.x<attackingBall.x-100);
});

test('defensive winger recovers toward his wide midfield reference',()=>{
  const p=player('LW',{x:620,y:250,homeX:430,homeY:140});
  const target=applyOffBallRoleContract({target:{x:590,y:300},player:p,ball,tacticalState:{phase:PHASES.OUT_OF_POSSESSION},tactics:{},field});
  assert.ok(target.x<590);
  assert.ok(target.y<300);
});

test('phase resolution is deterministic and exposes the actual Role Contract responsibility',()=>{
  const p=player('CM');
  const a=resolveOffBallRoleInstruction({player:p,tacticalState:{phase:PHASES.PROGRESSION},tactics:{}});
  const b=resolveOffBallRoleInstruction({player:p,tacticalState:{phase:PHASES.PROGRESSION},tactics:{}});
  assert.deepEqual(a,b);
  assert.equal(a.id,'mid-line-break');
});

test('off-ball contract movement cannot mutate or acquire the free ball',()=>{
  const p=player('RB',{homeY:560});
  const freeBall={x:600,y:300,vx:7,vy:-2,r:5};
  const before=structuredClone(freeBall);
  const target=applyOffBallRoleContract({target:{x:500,y:520},player:p,ball:freeBall,tacticalState:{phase:PHASES.PROGRESSION},tactics:{width:72},field});
  assert.deepEqual(freeBall,before);
  assert.equal('ownerId' in freeBall,false);
  assert.ok(Number.isFinite(target.x)&&Number.isFinite(target.y));
});
