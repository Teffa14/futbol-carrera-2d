import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateOverall} from '../career.js';
import {scaleAttributesToDevelopmentLevel} from '../career-development.js';

const BASE={pace:76,shooting:68,passing:74,dribbling:78,defense:42,physical:61,ballControl:77,vision:75,stamina:72,composure:70};

test('youth scaling reaches a requested sub-70 overall across representative roles',()=>{
  for(const [position,target] of [['RW',55],['CM',60],['CB',64]]){
    const attributes=scaleAttributesToDevelopmentLevel(BASE,target,position);
    const overall=calculateOverall({...attributes,position});
    assert.ok(Math.abs(overall-target)<=1,`${position}: expected ${target}, got ${overall}`);
    assert.ok(overall<70);
  }
});

test('scaling preserves meaningful archetype differences instead of flattening attributes',()=>{
  const scaled=scaleAttributesToDevelopmentLevel(BASE,56,'RW');
  assert.ok(scaled.dribbling>scaled.defense);
  assert.ok(scaled.ballControl>scaled.physical);
  assert.ok(scaled.pace>scaled.shooting);
  assert.ok(scaled.dribbling-scaled.defense>=20);
});

test('development scaling is deterministic and does not mutate the supplied template',()=>{
  const input={...BASE};
  const a=scaleAttributesToDevelopmentLevel(input,58,'CAM');
  const b=scaleAttributesToDevelopmentLevel(input,58,'CAM');
  assert.deepEqual(a,b);
  assert.deepEqual(input,BASE);
});

test('development level clamps career starts to the canonical youth range',()=>{
  const low=scaleAttributesToDevelopmentLevel(BASE,20,'CM');
  const high=scaleAttributesToDevelopmentLevel(BASE,95,'CM');
  assert.ok(Math.abs(calculateOverall({...low,position:'CM'})-45)<=1);
  assert.ok(Math.abs(calculateOverall({...high,position:'CM'})-68)<=1);
});
