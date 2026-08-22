import test from 'node:test';
import assert from 'node:assert/strict';
import {PHASES} from '../tactics.js';
import {createVisualAction,visualActionToTacticalRule,compileVisualPlay,drawingPreview,TACTICAL_DRAWING_ACTIONS} from '../tactical-drawing-v1.js';
import {validateTacticalPlan} from '../tactical-lab-v1.js';

test('visual editor supports the five requested football drawing actions',()=>{
  assert.deepEqual([...TACTICAL_DRAWING_ACTIONS].sort(),['cross','pass','position','run','shot']);
});

test('visual points are normalized and clamped to the pitch',()=>{
  const action=createVisualAction({id:'r1',type:'run',actorId:'rw',start:{x:-.2,y:.4},end:{x:1.4,y:.82}});
  assert.deepEqual(action.start,{x:0,y:.4});
  assert.deepEqual(action.end,{x:1,y:.82});
});

test('a drawn run compiles into a conditional Tactical Lab pattern with abort behavior',()=>{
  const rule=visualActionToTacticalRule({
    id:'overlap',type:'run',actorId:'rb',start:{x:.62,y:.86},end:{x:.86,y:.95},
    phase:PHASES.FINAL_THIRD,
    trigger:[{path:'ballCarrierWide',op:'truthy'}],
    unless:[{path:'restDefenceReady',op:'falsy'}],
  });
  assert.equal(rule.kind,'pattern');
  assert.equal(rule.pattern.primaryAction,'attack-drawn-space');
  assert.deepEqual(rule.pattern.spatialReferences.target.point,{x:.86,y:.95});
  assert.ok(rule.pattern.abort.length>0);
  assert.equal(rule.pattern.abortAction,'recover-structure');
});

test('pass cross and shot compile as intentions toward drawn space rather than target homing',()=>{
  const names={pass:'play-to-drawn-space',cross:'deliver-to-drawn-space',shot:'finish-toward-drawn-target'};
  for(const type of Object.keys(names)){
    const rule=visualActionToTacticalRule({id:type,type,actorId:'a',targetParticipantId:'b',start:{x:.5,y:.5},end:{x:.8,y:.4}});
    assert.equal(rule.pattern.primaryAction,names[type]);
    assert.equal('ownerId' in rule.pattern,false);
    assert.equal('targetPlayerId' in rule.pattern,false);
    assert.equal('velocity' in rule.pattern,false);
  }
});

test('position drawings become relative zone instructions instead of teleport commands',()=>{
  const rule=visualActionToTacticalRule({id:'hold',type:'position',actorId:'lw',start:{x:.5,y:.1},end:{x:.72,y:.05}});
  assert.equal(rule.kind,'zone');
  assert.equal(rule.action,'occupy-drawn-reference');
  assert.equal(rule.target.reference,'normalized-pitch');
  assert.deepEqual(rule.target.point,{x:.72,y:.05});
});

test('compiled visual play is a valid competitive Tactical Lab plan',()=>{
  const plan=compileVisualPlay({
    id:'right-overload',name:'Right overload',phase:PHASES.PROGRESSION,
    actions:[
      {id:'run1',type:'run',actorId:'rb',start:{x:.45,y:.86},end:{x:.73,y:.95}},
      {id:'pass1',type:'pass',actorId:'cm',targetParticipantId:'rw',start:{x:.48,y:.52},end:{x:.7,y:.82}},
      {id:'pos1',type:'position',actorId:'dm',start:{x:.42,y:.5},end:{x:.48,y:.5}},
    ],
  });
  const validation=validateTacticalPlan(plan);
  assert.equal(validation.valid,true,validation.errors.join('; '));
  assert.deepEqual(plan.participants.sort(),['cm','dm','rb','rw']);
});

test('drawing preview contains only visual geometry and never ball ownership state',()=>{
  const preview=drawingPreview({id:'c1',type:'cross',actorId:'rw',start:{x:.8,y:.9},end:{x:.92,y:.5}});
  assert.equal(preview.arrow,true);
  assert.equal('ball' in preview,false);
  assert.equal('ownerId' in preview,false);
});
