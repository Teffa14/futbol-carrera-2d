import test from 'node:test';
import assert from 'node:assert/strict';
import {roleSpaceDecisionProfile,roleSpaceCandidateBias} from '../role-space-decision-v1.js';

const field={left:55,right:1045,top:45,bottom:655,centerX:550,centerY:350};
const anchor={x:500,y:350};

function bias(role,target,options={}){
  return roleSpaceCandidateBias({role,attackDirection:1,anchor,target,field,hasPossession:true,...options});
}

test('every outfield position has a dedicated spatial profile',()=>{
  const roles=['CB','LB','RB','CDM','CM','CAM','LW','RW','ST'];
  for(const role of roles)assert.ok(roleSpaceDecisionProfile(role));
  assert.notDeepEqual(roleSpaceDecisionProfile('CB'),roleSpaceDecisionProfile('ST'));
  assert.notDeepEqual(roleSpaceDecisionProfile('CDM'),roleSpaceDecisionProfile('CAM'));
});

test('striker values depth more than centre-back in possession',()=>{
  const forward={x:690,y:350};
  assert.ok(bias('ST',forward)>bias('CB',forward));
});

test('wide roles prefer lane occupation more than central midfielders',()=>{
  const wide={x:545,y:105};
  assert.ok(bias('LW',wide)>bias('CM',wide));
  assert.ok(bias('LB',wide)>bias('CDM',wide));
});

test('defensive profiles penalize aggressive forward space while defending',()=>{
  const forward={x:690,y:350};
  const cb=roleSpaceCandidateBias({role:'CB',attackDirection:1,anchor,target:forward,field,defending:true});
  const cam=roleSpaceCandidateBias({role:'CAM',attackDirection:1,anchor,target:forward,field,defending:true});
  assert.ok(cb<cam);
});

test('spatial policy stays independent from ball ownership or steering fields',()=>{
  const source=JSON.stringify(roleSpaceDecisionProfile('ST'))+roleSpaceCandidateBias.toString();
  assert.doesNotMatch(source,/ownerId|targetPlayerId|capture|homing|ballVelocity/i);
});
