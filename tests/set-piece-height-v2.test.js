import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchEngine} from '../engine.js';
import '../football-rules-v2.js';
import '../set-piece-curve-v1.js';
import {WALL_DISTANCE_PX,CROSSBAR_HEIGHT,wallPositions,aerialFreeKickPlan} from '../set-piece-height-v2.js';

function data(name,role){return{name,instanceId:name,engineRole:role,position:role,pace:70,shooting:76,passing:70,dribbling:70,defense:65,physical:70,ballControl:76,vision:72,stamina:72,composure:78};}

test('wall sits about 9.15m away and does not span the whole goal',()=>{
  const ball={x:780,y:350},target={x:1073,y:320},wall=wallPositions(ball,target,4),center=wall.reduce((s,p)=>({x:s.x+p.x/4,y:s.y+p.y/4}),{x:0,y:0}),distance=Math.hypot(center.x-ball.x,center.y-ball.y),span=Math.hypot(wall.at(-1).x-wall[0].x,wall.at(-1).y-wall[0].y);
  assert.ok(Math.abs(distance-WALL_DISTANCE_PX)<1.5,{distance});
  assert.ok(span<60,{span});
});

test('free kick plan combines lateral curve with positive launch height',()=>{
  const p={team:0,data:{shooting:82,ballControl:80,composure:80}},engine={ball:{x:780,y:350},players:[]},target={x:1073,y:315},plan=aerialFreeKickPlan(engine,p,target);
  assert.ok(plan.launchVz>.43);
  assert.ok(Math.abs(plan.spin)>.45);
  assert.notEqual(plan.initialAim.y,target.y);
});

test('ball above crossbar height cannot score',()=>{
  const home=[data('h1','ST')],away=[data('a1','GK')],e=new MatchEngine(home,away,{seed:'crossbar'});
  e.restart=null;e.ball.x=1058;e.ball.y=350;e.ball.z=CROSSBAR_HEIGHT+1;e.ball.vx=5;e.ball.vy=0;e.ball.lastTeam=0;
  e.checkGoal();
  assert.deepEqual(e.score,[0,0]);
  assert.ok(e.ball.x<1045);
});
