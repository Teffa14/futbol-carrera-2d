import test from 'node:test';
import assert from 'node:assert/strict';
import {colorDistance,resolveKitColors} from '../kit-contrast.js';

test('home keeps primary while same-color visitor switches to secondary',()=>{
  const [home,away]=resolveKitColors('River Plate','Independiente','#d71920','#d71920');
  assert.equal(home,'#d71920');
  assert.notEqual(away,'#d71920');
  assert.ok(colorDistance(home,away)>105);
});

test('visitor keeps primary when kits already have clear contrast',()=>{
  const [home,away]=resolveKitColors('Liverpool','Chelsea','#c8102e','#034694');
  assert.equal(home,'#c8102e');
  assert.equal(away,'#034694');
});

test('two light primary kits force a dark visitor alternate',()=>{
  const [home,away]=resolveKitColors('Real Madrid','Leeds United','#f3f3f3','#ffffff');
  assert.equal(home,'#f3f3f3');
  assert.ok(colorDistance(home,away)>105);
});
