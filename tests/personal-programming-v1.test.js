import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateProgrammingRule,resolvePersonalProgramming,spatialProgrammingObservation,createMovementProgrammingIntent} from '../personal-programming-v1.js';

const pitch={width:100,height:60};
const obs=spatialProgrammingObservation({player:{x:70,y:10},ball:{x:55,y:20},roleReference:{x:65,y:12},pitch,attackDirection:1,phase:'FINAL_THIRD'});

test('WHEN IF AND UNLESS rules resolve from canonical spatial observation',()=>{
  const rule={
    id:'wing-hold-width',
    when:{source:'phase',value:'FINAL_THIRD'},
    if:[{path:'lane',value:'left-wide'}],
    and:[{path:'aheadOfBall',value:true}],
    unless:[{path:'relativeToBall.x',operator:'>',value:.4}],
    then:{type:'move-relative',dx:.05,dy:0},
    until:{source:'phase',value:'BOX_ATTACK'},
    priority:.7,
  };
  const result=evaluateProgrammingRule({rule,observation:obs});
  assert.equal(result.matched,true);
  assert.equal(result.action.type,'move-relative');
});

test('UNLESS blocks a personal rule when the forbidden context is present',()=>{
  const rule={unless:[{path:'aheadOfBall',value:true}],then:{type:'hold'}};
  assert.equal(evaluateProgrammingRule({rule,observation:obs}).matched,false);
});

test('specific and higher-priority programming wins without hard scripting execution',()=>{
  const rules=[
    {id:'generic',when:{source:'phase',value:'FINAL_THIRD'},priority:.3,then:{type:'hold'}},
    {id:'specific',when:{source:'phase',value:'FINAL_THIRD'},if:[{path:'lane',value:'left-wide'}],priority:.45,then:{type:'move-relative',dx:.08,dy:.02}},
  ];
  const chosen=resolvePersonalProgramming({rules,observation:obs,playerFreedom:.8});
  assert.equal(chosen.ruleId,'specific');
  const intent=createMovementProgrammingIntent(chosen,obs);
  assert.equal(intent.type,'move-relative');
  assert.ok(intent.target.x>obs.attack.x);
});

test('personal programming observes but never owns or steers the free ball',()=>{
  const rules=[{id:'safe',priority:1,then:{type:'hold'}}];
  const chosen=resolvePersonalProgramming({rules,observation:obs});
  const intent=createMovementProgrammingIntent(chosen,obs);
  assert.equal('ownerId' in obs,false);
  assert.equal('ownerId' in intent,false);
  assert.equal('ball' in intent,false);
});
