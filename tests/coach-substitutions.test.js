import test from 'node:test';
import assert from 'node:assert/strict';
import {planCoachSubstitutions,userBenchOpportunity} from '../coach-substitutions-v1.js';

const p=(id,position,rating,extra={})=>({id,instanceId:id,name:id,position,engineRole:extra.engineRole||position,rating,fitness:extra.fitness??100,form:extra.form??0,...extra});

test('coach does not make tactical substitutions before the second half window',()=>{
  const starters=[p('cm1','CM',72,{fitness:70})],bench=[p('cm2','CM',70)];
  assert.deepEqual(planCoachSubstitutions({starters,bench,minute:45,scoreDiff:0}),[]);
});

test('tired starter can be replaced by a fresh compatible bench player',()=>{
  const starters=[p('cm1','CM',74,{fitness:78})],bench=[p('cm2','CM',71,{fitness:100})];
  const changes=planCoachSubstitutions({starters,bench,minute:68,scoreDiff:0,fatigueById:{cm1:76}});
  assert.equal(changes.length,1);
  assert.equal(changes[0].outId,'cm1');
  assert.equal(changes[0].inId,'cm2');
  assert.equal(changes[0].role,'CM');
});

test('planner respects role families and does not replace a centre back with an unrelated striker',()=>{
  const starters=[p('cb1','CB',70,{fitness:68})],bench=[p('st1','ST',88,{fitness:100})];
  const changes=planCoachSubstitutions({starters,bench,minute:78,scoreDiff:1,fatigueById:{cb1:85}});
  assert.deepEqual(changes,[]);
});

test('losing state increases attacking substitution value',()=>{
  const starters=[p('st1','ST',75,{fitness:90})],bench=[p('st2','ST',69,{fitness:100})];
  const level=planCoachSubstitutions({starters,bench,minute:61,scoreDiff:0,fatigueById:{st1:40}});
  const losing=planCoachSubstitutions({starters,bench,minute:61,scoreDiff:-2,fatigueById:{st1:40}});
  assert.equal(level.length,0);
  assert.equal(losing.length,1);
  assert.equal(losing[0].inId,'st2');
});

test('bench user receives an opportunity only when the same coach logic selects him',()=>{
  const user=p('user-player','CM',70,{fitness:100,isUser:true});
  const selection={
    status:'bench',
    user,
    starters:[p('starter','CM',73,{fitness:72})],
    bench:[user,p('other','CM',61,{fitness:100})],
  };
  const opportunity=userBenchOpportunity(selection,{minute:70,scoreDiff:0,fatigueById:{starter:80}});
  assert.ok(opportunity);
  assert.equal(opportunity.inId,'user-player');
  assert.equal(opportunity.outId,'starter');
});

test('planner never schedules the same player twice in one decision window',()=>{
  const starters=[p('cm1','CM',70,{fitness:65}),p('cm2','CM',69,{fitness:62})];
  const bench=[p('cm3','CM',72),p('cm4','CM',71)];
  const changes=planCoachSubstitutions({starters,bench,minute:80,scoreDiff:0,fatigueById:{cm1:90,cm2:88},maxSubs:2});
  assert.equal(changes.length,2);
  assert.equal(new Set(changes.map(c=>c.outId)).size,2);
  assert.equal(new Set(changes.map(c=>c.inId)).size,2);
});

test('players already used in prior substitutions are excluded from later decision windows',()=>{
  const starters=[p('cm1','CM',68,{fitness:60}),p('cm2','CM',67,{fitness:62})];
  const bench=[p('cm3','CM',78),p('cm4','CM',74)];
  const changes=planCoachSubstitutions({starters,bench,minute:82,scoreDiff:0,fatigueById:{cm1:92,cm2:90},maxSubs:2,alreadyUsed:['cm3']});
  assert.ok(changes.length>=1);
  assert.equal(changes.some(change=>change.inId==='cm3'),false);
  assert.equal(changes.some(change=>change.inId==='cm4'),true);
});
