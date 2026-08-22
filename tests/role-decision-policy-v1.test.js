import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRoleDecisionPolicy,rankRoleAwareCandidates} from '../role-decision-policy-v1.js';

const FIELD={left:55,right:1045,top:45,bottom:655,centerX:550,centerY:350};
const player=(role,x=220,y=350)=>({id:`${role}-1`,role,team:0,x,y});
const pass=(kind='progressive',x=360,y=350,value=.4)=>({type:'pass',kind,aim:{x,y},value});
const dribble=(x=280,y=350,value=.4)=>({type:'dribble',target:{x,y},value});
const shot=(value=.4)=>({type:'shot',value});

test('centre back refuses a pressured defensive-third dribble instead of using one generic action ranking',()=>{
  const out=applyRoleDecisionPolicy({player:player('CB',180,350),candidate:dribble(240,350,.8),field:FIELD,pressure:.8});
  assert.equal(out.allowed,false);
  assert.equal(out.roleReason,'centre-back-protects-central-loss');
});

test('centre back still allows progression when the passing lane advances play',()=>{
  const out=applyRoleDecisionPolicy({player:player('CB',180,350),candidate:pass('progressive',300,350,.36),field:FIELD,pressure:.35});
  assert.equal(out.allowed,true);
  assert.ok(out.value>.36);
  assert.equal(out.roleReason,'centre-back-progress-or-secure');
});

test('holding midfielder prefers line-breaking distribution and devalues pressured central carries',()=>{
  const p=player('CDM',500,350);
  const ranked=rankRoleAwareCandidates({player:p,field:FIELD,pressure:.68,candidates:[pass('progressive',620,350,.40),dribble(560,350,.48)]});
  assert.equal(ranked[0].type,'pass');
  assert.equal(ranked[0].roleReason,'pivot-connects-lines');
  assert.ok(ranked.find(x=>x.type==='dribble').value<.48);
});

test('fullback values a wide forward carry differently from the same central carry',()=>{
  const p=player('LB',610,140);
  const wide=applyRoleDecisionPolicy({player:p,candidate:dribble(680,110,.35),field:FIELD,pressure:.3});
  const central=applyRoleDecisionPolicy({player:p,candidate:dribble(680,350,.35),field:FIELD,pressure:.3});
  assert.ok(wide.value>central.value);
  assert.equal(wide.roleReason,'fullback-uses-wide-lane');
});

test('creator and striker receive different final-third priorities from identical raw values',()=>{
  const cam=player('CAM',790,350),st=player('ST',790,350);
  const candidates=[pass('through',900,350,.43),shot(.43)];
  const camRank=rankRoleAwareCandidates({player:cam,candidates,field:FIELD,pressure:.3});
  const stRank=rankRoleAwareCandidates({player:st,candidates,field:FIELD,pressure:.3});
  assert.equal(camRank[0].type,'pass');
  assert.equal(stRank[0].type,'shot');
});

test('wide attacker rewards isolation only in a real wide final-third context',()=>{
  const winger=player('LW',790,120);
  const wide=applyRoleDecisionPolicy({player:winger,candidate:dribble(850,100,.38),field:FIELD,pressure:.4});
  const inside=applyRoleDecisionPolicy({player:winger,candidate:dribble(850,350,.38),field:FIELD,pressure:.4});
  assert.ok(wide.value>inside.value);
  assert.equal(wide.roleReason,'winger-isolation');
});

test('role policy remains analytical and cannot attach or steer the free ball',()=>{
  const ball={x:500,y:350,vx:2.4,vy:-.3};
  const before=structuredClone(ball);
  rankRoleAwareCandidates({player:player('CM',520,350),candidates:[pass('progressive',650,350,.4),dribble(580,330,.4)],field:FIELD,pressure:.4,ball});
  assert.deepEqual(ball,before);
  assert.equal('ownerId' in ball,false);
});
