import test from 'node:test';
import assert from 'node:assert/strict';
import {TrainingMatchEngine} from '../training-match-engine-v1.js';
import '../training-small-sided-v8.js';
import '../training-transfer-v1.js';
import '../training-competitive-v2.js';

const player={name:'Test',position:'CM',pace:72,shooting:70,passing:74,dribbling:72,defense:60,physical:68,ballControl:73,vision:74,stamina:75,composure:72};
const result={seed:'training-competitive-test',reps:1,quality:75};

test('2v2 and 3v3 require a real goal instead of pass-count success',()=>{
  for(const kind of ['2v2','3v3']){
    const e=new TrainingMatchEngine({id:kind,kind,name:kind},result,player);
    e.stats.passesCompleted[0]=8;e.trainingQualityV6.repSuccess=false;
    e.scenario(.016);
    assert.equal(e.trainingQualityV6.repSuccess,false,kind);
    assert.ok(e.players.some(p=>p.team===1&&p.role==='GK'),`${kind} includes a goalkeeper`);
    assert.match(e.trainingQualityV6.objective,/gol/i);
  }
});

test('1v1 is goal-oriented and includes a goalkeeper behind the defender',()=>{
  const e=new TrainingMatchEngine({id:'1v1',kind:'1v1',name:'1v1'},result,player);
  assert.ok(e.players.some(p=>p.team===1&&p.role==='GK'));
  assert.match(e.trainingQualityV6.objective,/terminá la jugada en gol/i);
  assert.equal(e.trainingQualityV6.repSuccess,false);
});

test('cross drill does not count reception alone as success',()=>{
  const e=new TrainingMatchEngine({id:'cross',kind:'cross',name:'Centro'},result,player);
  e.trainingQualityV6.delivered=true;e.trainingQualityV6.repSuccess=false;e.trainingQualityV6.possessionId=e.mates[0].id;
  e.ball.x=e.mates[0].x;e.ball.y=e.mates[0].y;e.ball.lastTeam=0;e.ball.lastPlayerId=e.mates[0].id;
  e.scenario(.016);
  assert.equal(e.trainingQualityV6.repSuccess,false);
  assert.match(e.trainingQualityV6.phase,/trayectoria|rematar/i);
});
