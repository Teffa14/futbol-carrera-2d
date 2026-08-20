import test from 'node:test';
import assert from 'node:assert/strict';
import {applyPreCareerDrillGrowth,applyPreCareerTrialGrowth,preCareerGrowthSummary} from '../precareer-growth-v1.js';

const player=()=>({position:'CM',rating:58,pace:58,shooting:55,passing:60,dribbling:59,defense:56,physical:57,ballControl:60,vision:60,stamina:59,composure:58});
const scores=value=>({technical:value,tactical:value,physical:value,mentality:value});

test('mediocre assessment evidence does not grant permanent stats',()=>{
  const p=player();
  const out=applyPreCareerDrillGrowth(p,{id:'passing',attrs:{passing:.5,vision:.5}},scores(70));
  assert.deepEqual(out.gained,[]);
  assert.equal(preCareerGrowthSummary(p).total,0);
});

test('strong drills and trials can improve a prospect but total pre-career growth is capped at four',()=>{
  const p=player();
  const drill={id:'passing',attrs:{passing:.5,vision:.3,ballControl:.2}};
  for(let i=0;i<4;i++)applyPreCareerDrillGrowth(p,drill,scores(94));
  for(let i=0;i<4;i++)applyPreCareerTrialGrowth(p,scores(96));
  const summary=preCareerGrowthSummary(p);
  assert.equal(summary.total,4);
  assert.ok(Object.values(summary.byAttribute).every(value=>value<=2));
});

test('good but not elite evidence only grants one point per event',()=>{
  const p=player();
  const drill=applyPreCareerDrillGrowth(p,{id:'control',attrs:{ballControl:.6,dribbling:.4}},scores(82));
  const trial=applyPreCareerTrialGrowth(p,scores(84));
  assert.equal(drill.gained.length,1);
  assert.equal(trial.gained.length,1);
  assert.equal(preCareerGrowthSummary(p).total,2);
});
