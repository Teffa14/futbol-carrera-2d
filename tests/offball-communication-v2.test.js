import test from 'node:test';
import assert from 'node:assert/strict';
import {callSignalFor} from '../offball-communication-v2.js';

test('through and progressive options ask for the ball ahead instead of only to feet',()=>{
  const p={team:0,x:600,y:350};
  assert.deepEqual(callSignalFor({kind:'through',aim:{x:720,y:350}},p),{label:'¡AL ESPACIO!',kind:'ahead'});
  assert.deepEqual(callSignalFor({kind:'progressive',aim:{x:680,y:330}},p),{label:'¡AL ESPACIO!',kind:'ahead'});
});

test('support and box deliveries use distinct visible communication',()=>{
  const p={team:0,x:700,y:350};
  assert.equal(callSignalFor({kind:'support',aim:{x:690,y:360}},p).kind,'feet');
  assert.equal(callSignalFor({kind:'cross',aim:{x:900,y:330}},p).kind,'box');
});
