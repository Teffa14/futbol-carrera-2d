import test from 'node:test';
import assert from 'node:assert/strict';
import {clearanceCandidate,__decisionValueV1} from '../decision-value-v1.js';
import {applyRoleDecisionPolicy,rankRoleAwareCandidates} from '../role-decision-policy-v1.js';

const FIELD={left:55,right:1045,top:45,bottom:655,centerX:550,centerY:350};
const defender=(role='CB',x=160,y=350)=>({id:`${role}-1`,role,team:0,x,y,r:7.25,data:{passing:65,ballControl:60,dribbling:58}});
function engineWithOpponent(player,opponent={id:'opp',team:1,x:player.x+20,y:player.y+8}){
  return{players:[player,opponent],ball:{x:player.x+8,y:player.y,r:4.35,vx:0,vy:0},tick:10,tactics:[{}],currentTacticalState:()=>({phase:'defensive-transition'})};
}

test('a pressured centre back in the defensive third can choose an emergency clearance',()=>{
  const p=defender('CB',155,350),engine=engineWithOpponent(p);
  const clearance=clearanceCandidate(engine,p);
  assert.ok(clearance);
  const ranked=rankRoleAwareCandidates({player:p,field:FIELD,pressure:.8,phase:'defensive-transition',candidates:[clearance,{type:'dribble',target:{x:220,y:350},value:.42},{type:'pass',kind:'support',aim:{x:210,y:350},value:.34}]});
  assert.equal(ranked[0].type,'clearance');
  assert.equal(ranked[0].roleReason,'centre-back-clears-danger');
});

test('clearance is unavailable when danger is not immediate',()=>{
  const p=defender('CB',180,350),engine=engineWithOpponent(p,{id:'opp',team:1,x:310,y:350});
  assert.equal(clearanceCandidate(engine,p),null);
  const calm=applyRoleDecisionPolicy({player:p,field:FIELD,pressure:.2,phase:'build-up',candidate:{type:'clearance',aim:{x:365,y:250},value:.4}});
  assert.ok(calm.value<.4);
});

test('attacking roles do not manufacture emergency clearances',()=>{
  const p=defender('ST',170,350),engine=engineWithOpponent(p);
  assert.equal(clearanceCandidate(engine,p),null);
});

test('clearance targets free space rather than a receiver',()=>{
  const p=defender('LB',170,170),engine=engineWithOpponent(p,{id:'opp',team:1,x:190,y:188});
  const clearance=clearanceCandidate(engine,p);
  assert.ok(clearance);
  assert.equal(typeof clearance.aim.x,'number');
  assert.equal(typeof clearance.aim.y,'number');
  assert.equal('player' in clearance,false);
  assert.equal('receiverId' in clearance,false);
  assert.equal('ownerId' in clearance,false);
});

test('executing a clearance only arms a physical kick and never owns or steers the ball',()=>{
  const p=defender('CB',160,350),ball={x:168,y:350,r:4.35,vx:.4,vy:-.1};
  const before=structuredClone(ball),calls=[];
  const engine={ball,tick:12,armKick:(player,aim,power,type,meta)=>calls.push({player,aim,power,type,meta}),flash:()=>{}};
  const choice={type:'clearance',aim:{x:345,y:245},distance:210,value:.5};
  assert.equal(__decisionValueV1.executeValueChoice(engine,p,choice),true);
  assert.deepEqual(ball,before);
  assert.equal(calls.length,1);
  assert.equal(calls[0].type,'clearance');
  assert.deepEqual(calls[0].aim,choice.aim);
  assert.equal('receiverId' in calls[0].meta,false);
  assert.equal('ownerId' in ball,false);
});
