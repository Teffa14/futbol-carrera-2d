import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../engine.js';

const make=(name,pos='ST',rating=80)=>({name,position:pos,rating,pace:rating,shooting:rating,passing:rating,dribbling:rating,defense:rating,physical:rating,contract:{fitness:100,morale:75}});
const team=(prefix)=>[make(`${prefix} Keeper`,'GK',80),make(`${prefix} Defender`,'CB',80),make(`${prefix} Mid A`,'CM',80),make(`${prefix} Mid B`,'CAM',80),make(`${prefix} Striker`,'ST',80)];

test('2D engine deterministically completes a physical match',()=>{
  const options={homeName:'A',awayName:'B',seed:'same-seed',homeTactics:{formation:'1-2-1',mentality:'Balanced',pressing:60,tempo:60,width:55,passing:'Balanced'},awayTactics:{formation:'2-1-1',mentality:'Balanced',pressing:55,tempo:55,width:55,passing:'Balanced'}};
  const a=new MatchEngine(team('A'),team('B'),options),b=new MatchEngine(team('A'),team('B'),options);
  for(let i=0;i<4000&&!a.finished;i++)a.step(1/30);
  for(let i=0;i<4000&&!b.finished;i++)b.step(1/30);
  assert.equal(a.finished,true);assert.equal(b.finished,true);assert.deepEqual(a.score,b.score);assert.deepEqual(a.report().stats,b.report().stats);
  assert.ok(a.stats.touches[0]+a.stats.touches[1]>0);
});
