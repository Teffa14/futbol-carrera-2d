import test from 'node:test';
import assert from 'node:assert/strict';
import {predictBallPath,bestReachableTrajectoryPoint} from '../trajectory-core-v1.js';
import {DRILLS} from '../training-memory-v1.js';
import {TrainingEngine} from '../training-engine-v1.js';
import {MatchEngine} from '../engine.js';
import '../kick-direction.js';
import '../ball-priority.js';
import '../anti-cluster.js';
import '../positional-ai.js';
import '../boundary-intelligence.js';
import '../role-depth.js';
import '../kit-contrast.js';
import '../match-presentation.js';
import {FIELD} from '../football-rules-v2.js';
import '../locomotion-v2.js';
import '../agent-brain-v2.js';
import '../passing-intelligence-v2.js';
import '../striker-intelligence-v3.js';
import {__trajectoryIntelligenceTest} from '../trajectory-intelligence-v1.js';

const roles=['GK','RB','CB','CB','LB','CDM','CM','CAM','RW','ST','LW'];
function p(prefix,role,i,extra={}){return{instanceId:`${prefix}-${i}`,id:`${prefix}-${i}`,name:`${prefix} ${role} ${i}`,position:role,engineRole:role,rating:72,pace:70,shooting:68,passing:70,dribbling:70,defense:66,physical:68,ballControl:71,vision:70,stamina:72,composure:70,fitness:100,skills:[],instructions:{risk:50,shoot:55,dribble:55},trainingMemory:{},...extra};}
function lineup(prefix,fn=()=>({})){return roles.map((r,i)=>p(prefix,r,i,fn(r,i)));}
function engine(seed='trajectory'){const e=new MatchEngine(lineup('h'),lineup('a'),{seed,userId:'h-9'});e.restart.active=false;return e;}

test('trajectory predictor follows damping and a physical wall rebound',()=>{
  const path=predictBallPath({x:420,y:52,r:4.35,vx:2.8,vy:-4.2,z:0,vz:0},{field:{...FIELD,goalDepth:46},horizonFrames:80,sampleEvery:1});
  const bounce=path.find(x=>x.bounce);assert.ok(bounce,'expected a wall rebound');assert.ok(bounce.y>=FIELD.top+4.3);assert.ok(bounce.vy>0,'top-wall rebound must reverse vertical velocity');assert.ok(path.at(-1).x>path[0].x,'ball should continue travelling after the rebound');
});

test('faster reactive player reaches an earlier point on the same ball path',()=>{
  const path=Array.from({length:12},(_,i)=>({frame:45+i*12,x:250+i*18,y:300,z:0,vx:2,vy:0})),fast={x:160,y:300,vx:0,vy:0,data:{pace:94}},slow={x:160,y:300,vx:0,vy:0,data:{pace:52}};
  const a=bestReachableTrajectoryPoint(fast,path,{acceleration:94,sprintSpeed:94,reaction:90},{slackFrames:3}),b=bestReachableTrajectoryPoint(slow,path,{acceleration:52,sprintSpeed:52,reaction:48},{slackFrames:3});assert.ok(a&&b,`both players should eventually reach the path: fast=${a?.frame}, slow=${b?.frame}`);assert.ok(a.frame<b.frame,`fast ${a.frame} should beat slow ${b.frame}`);
});

test('recent physical carrier keeps the actor role instead of a striker collapsing onto him',()=>{
  const e=engine('carrier-stability'),cm=e.players.find(x=>x.team===0&&x.role==='CM'),st=e.players.find(x=>x.team===0&&x.role==='ST');e.tick=100;Object.assign(cm,{x:500,y:350});Object.assign(st,{x:516,y:350});Object.assign(e.ball,{x:521,y:350,vx:.35,vy:0,lastTeam:0,lastPlayerId:cm.id,lastTouchTick:96,intendedReceiverId:null,shotById:null});
  assert.equal(e.ballActor(0).id,cm.id,'the striker must not steal actor assignment from the current carrier');
});

test('an intended receiver attacks the physical intercept point instead of the old pass coordinate',()=>{
  const e=engine('receiver-anticipation'),passer=e.players.find(x=>x.team===0&&x.role==='CM'),st=e.players.find(x=>x.team===0&&x.role==='ST');Object.assign(passer,{x:410,y:350});Object.assign(st,{x:610,y:330});Object.assign(e.ball,{x:440,y:350,vx:4.2,vy:-.18,lastTeam:0,lastPlayerId:passer.id,lastTouchTick:e.tick,passerId:passer.id,intendedReceiverId:st.id,shotById:null});
  const actor=e.ballActor(0);assert.equal(actor.id,st.id);const target=e.aiTarget(st,[],actor,0);assert.ok(target.x>e.ball.x+55,`receiver target ${target.x} should lead moving ball ${e.ball.x}`);assert.ok(st.anticipationTarget?.frame>0);
});

test('striker anticipates a wide forward trajectory by attacking the box before the ball arrives',()=>{
  const e=engine('striker-box-arrival'),st=e.players.find(x=>x.team===0&&x.role==='ST');for(const o of e.players.filter(x=>x.team===1)){o.x=o.role==='GK'?1020:925;o.y=90+o.slot*48;}Object.assign(st,{x:650,y:350});Object.assign(e.ball,{x:620,y:95,vx:4.1,vy:.35,lastTeam:0,lastPlayerId:'h-6',lastTouchTick:e.tick,intendedReceiverId:'h-8',shotById:null});
  const path=__trajectoryIntelligenceTest.ballPath(e),target=__trajectoryIntelligenceTest.strikerArrivalTarget(e,st,path);assert.ok(target,'striker should read an advancing wide trajectory');assert.ok(target.x>st.x+80,`striker stayed too deep: ${target.x}`);assert.ok(target.y>FIELD.centerY,'top-side delivery should produce an opposite/far-post arrival lane');
});

test('every training drill runs to completion with finite free-ball physics',()=>{
  const player={name:'Alex',pace:78,shooting:76,passing:77,dribbling:79,defense:62,physical:70,ballControl:80,vision:79,stamina:78,composure:77};
  for(const drill of DRILLS){const result={drillId:drill.id,quality:82,grade:'A',reps:4,successes:3,seed:`physical-${drill.id}`},e=new TrainingEngine(drill,result,player);for(let i=0;i<5000&&!e.finished;i++)e.step(.016);assert.equal(e.finished,true,`${drill.id} did not finish`);for(const value of [e.player.x,e.player.y,e.ball.x,e.ball.y,e.ball.vx,e.ball.vy])assert.ok(Number.isFinite(value),`${drill.id} produced non-finite physics`);assert.ok(e.metrics.touches>0||e.metrics.kicks>0,`${drill.id} produced no physical interaction`);if(['2v2','3v3','through','cross','finish','free-kick'].includes(drill.kind))assert.ok(e.metrics.kicks>0,`${drill.id} never produced a real kick`);}
});

test('training ball cannot teleport during an active repetition',()=>{
  const drill=DRILLS.find(d=>d.id==='through-ball'),result={drillId:drill.id,quality:84,grade:'A',reps:3,successes:3,seed:'no-teleport'},e=new TrainingEngine(drill,result,{name:'Alex',pace:80,passing:82,vision:84,ballControl:78,composure:80,stamina:78,physical:68});let previous={x:e.ball.x,y:e.ball.y,rep:e.rep},sawKick=false,freeSeparation=false;
  for(let i=0;i<3000&&!e.finished;i++){e.step(.016);if(e.metrics.kicks>0)sawKick=true;if(sawKick&&dist2(e.player,e.ball)>28)freeSeparation=true;if(e.rep===previous.rep){const jump=Math.hypot(e.ball.x-previous.x,e.ball.y-previous.y);assert.ok(jump<18,`ball teleported ${jump.toFixed(1)}px inside rep ${e.rep}`);}previous={x:e.ball.x,y:e.ball.y,rep:e.rep};}
  assert.ok(sawKick,'through-ball drill never kicked the ball');assert.ok(freeSeparation,'ball remained effectively attached to the player after the kick');
});

function dist2(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
