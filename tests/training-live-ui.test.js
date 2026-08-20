import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ensureTrainingMemory,previewTrainingResult,applyTrainingResult} from '../training-memory-v1.js';

test('live training screen uses the observer-safe shell and intercepts drill clicks',()=>{
  const src=fs.readFileSync(new URL('../training-live-ui-v3.js',import.meta.url),'utf8');
  assert.match(src,/id=\"training-sim-shell\" data-live-training=\"1\"/);
  assert.match(src,/stopImmediatePropagation\(\)/);
  assert.match(src,/engine\.finished[\s\S]*finishSession\(\)/);
  assert.match(src,/se consume al completar/);
});

test('completed visible training consumes exactly one weekly session',()=>{
  const state={
    season:1,
    week:1,
    clubId:'test-club',
    player:{
      name:'Test Player',
      pace:62,shooting:60,passing:64,dribbling:66,defense:50,physical:58,
      ballControl:65,vision:63,stamina:68,composure:61,fitness:100,form:0,
      potential:90,dynamicPotential:90
    },
    progress:{trainingPoints:2,xp:0},
    world:{'test-club':{roster:[{isUser:true}]}}
  };
  ensureTrainingMemory(state);
  const result=previewTrainingResult(state,'cone-dribble',0);
  const out=applyTrainingResult(state,result);
  assert.equal(out.ok,true);
  assert.equal(state.progress.trainingPoints,1);
  assert.equal(state.player.trainingSummary.sessions,1);
  assert.ok(state.player.trainingLog.length===1);
});
