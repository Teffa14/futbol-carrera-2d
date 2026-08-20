import test from 'node:test';
import assert from 'node:assert/strict';
import {shotQuality} from '../causal-rating-v3.js';

function player(team=0,overrides={}){return{team,role:'ST',x:850,y:350,data:{shooting:78,composure:76,...overrides}};}

test('a central close shot is valued above a distant wide shot even before a goal',()=>{
  const shooter=player(),keeper={team:1,role:'GK',x:1018,y:350,data:{}},defender={team:1,role:'CB',x:760,y:500,data:{}},engine={players:[shooter,keeper,defender]};
  const good=shotQuality(engine,shooter,{x:870,y:350});
  const poor=shotQuality(engine,shooter,{x:570,y:120});
  assert.ok(good>poor+.20,{good,poor});
  assert.ok(good>.5,{good});
});

test('pressure reduces shot value without making all non-goals worthless',()=>{
  const shooter=player(),keeper={team:1,role:'GK',x:1018,y:330,data:{}},far={team:1,role:'CB',x:700,y:350,data:{}},close={team:1,role:'CB',x:860,y:350,data:{}};
  const open=shotQuality({players:[shooter,keeper,far]},shooter,{x:850,y:350});
  const pressured=shotQuality({players:[shooter,keeper,close]},shooter,{x:850,y:350});
  assert.ok(open>pressured,{open,pressured});
  assert.ok(open>0);
});
