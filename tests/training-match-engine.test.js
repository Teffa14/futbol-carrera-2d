import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchEngine} from '../engine.js';
import {DRILLS} from '../training-memory-v1.js';
import {TrainingMatchEngine} from '../training-match-engine-v1.js';

const player={name:'Alex',position:'CM',pace:82,shooting:80,passing:82,dribbling:84,defense:66,physical:74,ballControl:84,vision:83,stamina:82,composure:82};
function make(drill,reps=2){return new TrainingMatchEngine(drill,{drillId:drill.id,quality:84,grade:'A',reps,successes:0,seed:`match-engine-${drill.id}`},player);}

test('live training is a MatchEngine specialization instead of an independent physics engine',()=>{
  const engine=make(DRILLS[0],1);
  assert.ok(engine instanceof MatchEngine);
  assert.equal(Object.getPrototypeOf(TrainingMatchEngine.prototype),MatchEngine.prototype);
  assert.equal(engine.updateFreeBall,MatchEngine.prototype.updateFreeBall);
  assert.equal(engine.resolvePlayerCollisions,MatchEngine.prototype.resolvePlayerCollisions);
  assert.equal(engine.resolveBallPlayerCollisions,MatchEngine.prototype.resolveBallPlayerCollisions);
  assert.equal(engine.executeKick,MatchEngine.prototype.executeKick);
  assert.equal(engine.movePlayer,MatchEngine.prototype.movePlayer);
  assert.equal(engine.ball.r,6);
  assert.equal(engine.player.r,10);
  assert.equal(engine.owner(),null);
});

test('all live drills run on match-sized free-ball physics without non-finite state',()=>{
  for(const drill of DRILLS){
    const engine=make(drill,2);
    for(let i=0;i<14000&&!engine.finished;i++){
      engine.step(.016);
      assert.ok(Number.isFinite(engine.ball.x)&&Number.isFinite(engine.ball.y),`${drill.id}: non-finite ball`);
      for(const p of engine.players)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y),`${drill.id}: non-finite player`);
      assert.equal(engine.owner(),null,`${drill.id}: ball acquired an owner`);
    }
    assert.equal(engine.finished,true,`${drill.id}: did not finish`);
    assert.equal(engine.sessionResult().repResults.length,2,`${drill.id}: did not score both repetitions`);
    assert.ok(engine.trainingMetricsV6.physicalTouches>0,`${drill.id}: no physical ball contact happened`);
  }
});

test('training draw path is inherited match presentation plus drill overlays',()=>{
  const source=TrainingMatchEngine.prototype.draw.toString();
  assert.match(source,/super\.draw\(/);
  assert.doesNotMatch(source,/fillRect\(55,45,990,610\)/);
});