import test from 'node:test';
import assert from 'node:assert/strict';

const {MatchEngine}=await import('../engine.js');
await import('../football-rules-v2.js');
await import('../locomotion-v2.js');
const {carryPlan}=await import('../carry-intelligence-v1.js');
const {TrainingMatchEngine}=await import('../training-match-engine-v1.js');
await import('../training-intelligence-v7.js');

const player=(name,id,role='ST',extra={})=>({name,instanceId:id,engineRole:role,position:role,pace:82,dribbling:82,ballControl:84,passing:72,shooting:76,vision:72,composure:76,physical:68,stamina:80,...extra});

function engineWithCarrier(){
  const engine=new MatchEngine([player('Carrier','carrier')],[player('Defender','defender','CB',{pace:60,defense:75})],{userId:'carrier',seed:'carry-test'});
  engine.restart=null;
  const p=engine.playerById('carrier'),d=engine.playerById('defender');
  p.x=220;p.y=350;p.vx=0;p.vy=0;p.facingX=1;p.facingY=0;
  d.x=900;d.y=120;d.vx=0;d.vy=0;
  Object.assign(engine.ball,{x:p.x+p.r+engine.ball.r-.4,y:p.y,vx:0,vy:0,z:0,vz:0,lastTeam:0,lastPlayerId:p.id,lastTouchTick:engine.tick});
  return{engine,p,d};
}

function simulateCarry(engine,p,target,frames){
  let lost=0,maxGap=0;
  for(let i=0;i<frames;i++){
    engine.updateFreeBall(1/60);
    p.dribbleIntent={targetX:target.x,targetY:target.y,ttl:1};
    engine.movePlayer(p,target,1/60,false);
    engine.resolveBallPlayerCollisions();
    const gap=Math.hypot(engine.ball.x-p.x,engine.ball.y-p.y);maxGap=Math.max(maxGap,gap);if(gap>36)lost++;
  }
  return{lost,maxGap};
}

test('aligned carrier accelerates through the ball instead of stopping at the behind-ball point',()=>{
  const {engine,p}=engineWithCarrier(),target={x:780,y:350};
  p.dribbleIntent={targetX:target.x,targetY:target.y,ttl:1};
  const plan=carryPlan(engine,p,target,1/60);
  assert.equal(plan.phase,'touch');
  assert.ok(plan.moveTarget.x>engine.ball.x,'movement target must continue through the ball');
  assert.ok(Math.abs(plan.moveTarget.y-engine.ball.y)<2,'straight carry should not create a lateral profile');
});

test('a sharp requested turn is introduced progressively instead of instantly profiling sideways',()=>{
  const {engine,p}=engineWithCarrier();
  p.carryState={dir:{x:1,y:0},phase:'touch',aligned:true,turnSharpness:0,lastTick:0};
  p.dribbleIntent={targetX:engine.ball.x,targetY:620,ttl:1};
  const plan=carryPlan(engine,p,{x:engine.ball.x,y:620},1/60);
  assert.ok(plan.dir.x>.94,'first steering frame should preserve forward body momentum');
  assert.ok(Math.abs(plan.dir.y)<.35,'player must not snap to a sideways profile in one frame');
  assert.ok(plan.turnSharpness>1,'the plan should recognise a genuinely sharp change');
});

test('straight physical carry advances through repeated contacts without losing the ball after the first nudge',()=>{
  const {engine,p}=engineWithCarrier(),startX=engine.ball.x;
  const run=simulateCarry(engine,p,{x:820,y:350},150);
  assert.ok(engine.ball.x>startX+95,`ball only advanced ${engine.ball.x-startX}`);
  assert.ok(p.x>startX+65,`player only advanced ${p.x-startX}`);
  assert.ok(run.lost<30,`carrier was detached from ball for ${run.lost} frames`);
  assert.ok(Math.abs(engine.ball.y-350)<18,'straight carry should stay in the same lane');
});

test('direction change keeps the carrier in the play while the free ball turns over several touches',()=>{
  const {engine,p}=engineWithCarrier();
  simulateCarry(engine,p,{x:500,y:350},70);
  const before={x:engine.ball.x,y:engine.ball.y};
  const turn=simulateCarry(engine,p,{x:650,y:520},110);
  assert.ok(engine.ball.x>before.x+35,'ball should keep progressing during the turn');
  assert.ok(engine.ball.y>before.y+35,'turn should eventually move the free ball into the new lane');
  assert.ok(turn.lost<45,`turn abandoned the ball for ${turn.lost} frames`);
  assert.ok(Math.hypot(engine.ball.x-p.x,engine.ball.y-p.y)<42,'player should finish close enough to continue the next touch');
});

test('training cones use the same continuous carry layer and still finish with finite free-ball physics',()=>{
  const drill={id:'cone-dribble',name:'Slalom de conos',kind:'cones'},result={seed:'carry-training',reps:2,quality:78,grade:'B',successes:0},data=player('Training User','training-user','CM');
  const engine=new TrainingMatchEngine(drill,result,data);
  let carryFrames=0;
  for(let i=0;i<1500&&!engine.finished;i++){
    engine.step(1/60);
    if(engine.player.carryState?.lastTick===engine.tick)carryFrames++;
    assert.ok(Number.isFinite(engine.ball.x)&&Number.isFinite(engine.ball.y));
  }
  assert.ok(engine.finished,'training session should finish');
  assert.ok(carryFrames>80,`continuous carry was active for only ${carryFrames} frames`);
  assert.ok(engine.trainingMetricsV6.gatesCleared>=4,'slalom should physically clear multiple gates');
  assert.equal(Object.hasOwn(engine.ball,'ownerId'),false);
});
