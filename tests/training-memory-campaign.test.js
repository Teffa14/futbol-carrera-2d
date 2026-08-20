import test from 'node:test';
import assert from 'node:assert/strict';
import {DRILLS,ensureTrainingMemory,previewTrainingResult,applyTrainingResult,memoryLevel} from '../training-memory-v1.js';
import {TrainingEngine} from '../training-engine-v1.js';
import {ensureCampaignState,getWeeklyInteraction,resolveInteraction} from '../campaign-events-v1.js';
import {MatchEngine} from '../engine.js';
import '../coach-adjustments-v1.js';
import '../combination-play-v1.js';

const roles=['GK','RB','CB','CB','LB','CDM','CM','CAM','RW','ST','LW'];
function p(prefix,role,i,extra={}){return{instanceId:`${prefix}-${i}`,id:`${prefix}-${i}`,name:`${prefix} ${role} ${i}`,position:role,engineRole:role,rating:70,pace:70,shooting:68,passing:70,dribbling:70,defense:65,physical:68,ballControl:70,vision:70,stamina:72,composure:70,fitness:100,skills:[],trainingMemory:{},...extra};}
function lineup(prefix){return roles.map((r,i)=>p(prefix,r,i));}
function state(){const user=p('user','ST',9,{id:'user-player',instanceId:'user-player',name:'Alex',isUser:true,position:'ST',engineRole:'ST',dynamicPotential:92,potential:94,form:0,instructions:{risk:55,shoot:55,dribble:60}});return{season:1,week:1,clubId:'club',player:user,progress:{trainingPoints:20,xp:0,fans:1000,reputation:10},world:{club:{roster:[user]}},campaign:null};}

test('one training session builds memory but does not hand out an automatic attribute point',()=>{
  const s=state();ensureTrainingMemory(s);const before=s.player.dribbling,result={drillId:'cone-dribble',quality:74,grade:'B',reps:8,successes:6};const out=applyTrainingResult(s,result);assert.equal(out.ok,true);assert.equal(s.player.dribbling,before,'one click must not automatically add a stat point');assert.ok(memoryLevel(s.player,'carry')>0);assert.ok((s.player.developmentWork.dribbling||0)>0);assert.equal(s.progress.trainingPoints,19);
});

test('repeated quality work eventually produces development while preserving accumulated memory',()=>{
  const s=state();ensureTrainingMemory(s);const start=s.player.dribbling;for(let i=0;i<9;i++)applyTrainingResult(s,{drillId:'cone-dribble',quality:84,grade:'A',reps:10,successes:8});assert.ok(s.player.dribbling>start,'repeated good sessions should eventually improve capacity');assert.ok(memoryLevel(s.player,'close-control')>=35);assert.ok(s.player.trainingSummary.sessions===9);
});

test('training preview is deterministic for the same career week and drill',()=>{
  const s=state(),a=previewTrainingResult(s,'through-ball',0),b=previewTrainingResult(s,'through-ball',0);assert.deepEqual(a,b);assert.ok(DRILLS.some(d=>d.id==='free-kick')&&DRILLS.some(d=>d.id==='three-v-three'));
});

test('visible training engine completes a drill and moves player and ball through the exercise',()=>{
  const s=state(),drill=DRILLS.find(d=>d.id==='crossing'),result={drillId:drill.id,quality:80,grade:'A',reps:8,successes:6,seed:'visual'},e=new TrainingEngine(drill,result,s.player),start={x:e.player.x,y:e.player.y,bx:e.ball.x,by:e.ball.y};for(let i=0;i<2000&&!e.finished;i++)e.step(.016);assert.equal(e.finished,true);assert.ok(Math.hypot(e.player.x-start.x,e.player.y-start.y)>80);assert.ok(Math.hypot(e.ball.x-start.bx,e.ball.y-start.by)>80);
});

test('career interaction changes coach/locker-room state and can teach football memory',()=>{
  const s=state(),c=ensureCampaignState(s),before=c.coachTrust,event=getWeeklyInteraction(s);assert.ok(event.choices.length>=2);const choice=event.choices.find(x=>Object.keys(x.effects?.memories||{}).length)||event.choices[0],out=resolveInteraction(s,choice.id);assert.equal(out.ok,true);assert.equal(s.campaign.currentEvent,null);assert.notEqual(s.campaign.coachTrust,before);if(Object.keys(choice.effects?.memories||{}).length)assert.ok(Object.keys(choice.effects.memories).some(k=>memoryLevel(s.player,k)>0));
});

test('coach performs a visible tactical adjustment when a deadlocked match reaches the checkpoint',()=>{
  const e=new MatchEngine(lineup('home'),lineup('away'),{seed:'coach-change',homeName:'Home',awayName:'Away',homeTactics:{tempo:50,width:50,directness:50,pressing:50},awayTactics:{tempo:50,width:50,directness:50,pressing:50}});e.restart.active=false;e.minute=29.99;e.stats.shots=[0,0];const before=e.tactics[0].width;e.step(.02);assert.ok(e.tactics[0].width>before);assert.ok(e.events.some(x=>String(x.text||'').includes('DT')||String(x.text||'').includes('ajuste táctico')));
});

test('prepared up-back-through pattern becomes two coordinated physical pass intentions',()=>{
  const home=lineup('h'),away=lineup('a'),e=new MatchEngine(home,away,{seed:'pattern'});e.restart.active=false;e.rng=()=>0;const source=e.players.find(x=>x.team===0&&x.role==='CM'),set=e.players.find(x=>x.team===0&&x.role==='CAM'),runner=e.players.find(x=>x.team===0&&x.role==='ST');source.data.trainingMemory={'third-man':{familiarity:90},'through-ball':{familiarity:90}};Object.assign(source,{x:400,y:350});Object.assign(set,{x:475,y:335});Object.assign(runner,{x:620,y:350});for(const o of e.players.filter(x=>x.team===1)){o.x=850;o.y=80+(o.slot%6)*85;}Object.assign(e.ball,{x:source.x+source.r+e.ball.r-1,y:source.y,vx:0,vy:0});source.decisionCooldown=0;e.prepareBallAction(source);assert.equal(e.teamSequences?.[0]?.type,'up-back-through');assert.equal(source.kickIntent?.receiverId,set.id);Object.assign(e.ball,{x:set.x+set.r+e.ball.r-1,y:set.y});set.decisionCooldown=0;e.registerPhysicalTouch(set,'touch');e.prepareBallAction(set);assert.equal(set.kickIntent?.receiverId,runner.id);assert.equal(set.kickIntent?.passKind,'through');assert.ok(e.events.some(x=>String(x.text||'').includes('pase en profundidad')));
});
