import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MatchEngine} from '../engine.js';
import {DRILLS} from '../training-memory-v1.js';
import {TrainingMatchEngine,TRAINING_RUNTIME_VERSIONS} from '../training-runtime-latest.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=fs.readdirSync(root);
function latest(prefix){const versions=files.map(name=>new RegExp(`^${prefix}-v(\\d+)\\.js$`).exec(name)).filter(Boolean).map(m=>Number(m[1]));return Math.max(...versions);}

test('canonical training runtime manifest always matches newest checked-in modules',()=>{
  assert.equal(TRAINING_RUNTIME_VERSIONS.matchEngine,latest('training-match-engine'));
  assert.equal(TRAINING_RUNTIME_VERSIONS.intelligence,latest('training-intelligence'));
  assert.equal(TRAINING_RUNTIME_VERSIONS.smallSided,latest('training-small-sided'));
  assert.equal(TRAINING_RUNTIME_VERSIONS.transfer,latest('training-transfer'));
  assert.equal(TRAINING_RUNTIME_VERSIONS.competitive,latest('training-competitive'));
  assert.equal(TRAINING_RUNTIME_VERSIONS.liveUi,latest('training-live-ui'));
});

test('canonical training runtime still specializes the current 11v11 MatchEngine',()=>{
  const player={name:'Runtime Test',position:'CM',pace:72,shooting:66,passing:74,dribbling:72,defense:64,physical:68,ballControl:73,vision:72,stamina:75,composure:70};
  const drill=DRILLS[0],engine=new TrainingMatchEngine(drill,{drillId:drill.id,quality:75,grade:'B',reps:1,successes:0,seed:'latest-runtime'},player);
  assert.ok(engine instanceof MatchEngine);
  assert.equal(engine.trainingUsesMatchEngine,true);
  assert.equal(engine.owner(),null);
  assert.equal('ownerId' in engine.ball,false);
});
