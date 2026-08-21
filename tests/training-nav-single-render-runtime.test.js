import test from 'node:test';
import assert from 'node:assert/strict';
import {interceptTrainingNavigation} from '../training-ui-v2.js';

test('non-training clicks are ignored without side effects',()=>{
  let prevented=0,stopped=0;
  const event={target:{closest:()=>null},preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;}};
  assert.equal(interceptTrainingNavigation(event),false);
  assert.equal(prevented,0);
  assert.equal(stopped,0);
});
