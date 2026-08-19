import test from 'node:test';
import assert from 'node:assert/strict';
import '../kick-direction.js';
import '../ball-priority.js';
import {createCareer,nextFixture,lineup11} from '../career.js';
import {MatchEngine} from '../engine.js';

function build(seed='wall-rebound'){
  const state=createCareer({playerName:'Test',nationality:'AR',position:'CM',build:'creator',countryId:'AR',clubId:'river'});
  const fixture=nextFixture(state);
  return new MatchEngine(lineup11(state,fixture.home),lineup11(state,fixture.away),{
    homeName:fixture.home,
    awayName:fixture.away,
    homeTactics:state.world[fixture.home].tactics,
    awayTactics:state.world[fixture.away].tactics,
    userId:state.player.instanceId,
    seed
  });
}

function clearOthers(engine,keep){for(const p of engine.players)if(!keep.includes(p.id)){p.x=920;p.y=610;p.vx=0;p.vy=0;}}

test('a blocked actor near the touchline chooses a short wall bank before another dribble',()=>{
  const engine=build('choose-wall-bank');engine.restart.active=false;
  const actor=engine.players.find(p=>p.team===0&&p.role!=='GK');
  const rival=engine.players.find(p=>p.team===1&&p.role!=='GK');
  clearOthers(engine,[actor.id,rival.id]);
  actor.x=300;actor.y=70;actor.vx=actor.vy=0;actor.decisionCooldown=0;actor.kickIntent=null;actor.dribbleIntent=null;
  rival.x=319;rival.y=70;rival.vx=rival.vy=0;
  engine.ball.x=306;engine.ball.y=57;engine.ball.vx=engine.ball.vy=0;
  engine.prepareBallAction(actor);
  assert.ok(actor.wallPlay,'the AI should create a committed wall-play plan');
  assert.equal(actor.wallPlay.side,'top');
  assert.equal(actor.kickIntent?.type,'wall');
  assert.equal(actor.dribbleIntent,null,'wall play must replace another immediate dribble attempt');
  assert.ok(actor.kickIntent.power<3,'the bank must be a controlled touch rather than a clearance');
  assert.ok(actor.kickIntent.aimY<45,'the kick must be aimed through the touchline so physics creates a rebound');
});

test('the wall-bank kick actually rebounds and remains a free physical ball',()=>{
  const engine=build('physical-wall-bank');engine.restart.active=false;
  const actor=engine.players.find(p=>p.team===0&&p.role!=='GK');
  const rival=engine.players.find(p=>p.team===1&&p.role!=='GK');
  clearOthers(engine,[actor.id,rival.id]);
  actor.x=300;actor.y=70;actor.vx=actor.vy=0;actor.decisionCooldown=0;
  rival.x=319;rival.y=70;rival.vx=rival.vy=0;
  engine.ball.x=304;engine.ball.y=55;engine.ball.vx=engine.ball.vy=0;
  engine.prepareBallAction(actor);
  const aim=actor.kickIntent;
  const dx=aim.aimX-actor.x,dy=aim.aimY-actor.y,l=Math.hypot(dx,dy)||1;
  actor.facingX=dx/l;actor.facingY=dy/l;actor.kickCooldown=0;
  engine.resolveBallPlayerCollisions();
  assert.equal(actor.kickIntent,null,'physical circle contact should execute the wall touch');
  assert.ok(engine.ball.vy<0,'the ball must initially travel into the top wall');
  let rebounded=false;
  for(let i=0;i<20;i++){engine.updateFreeBall(.05);if(engine.ball.vy>0){rebounded=true;break;}}
  assert.equal(rebounded,true,'the normal free-ball boundary physics must create the rebound');
  assert.equal('ownerId' in engine.ball,false);
});

test('after banking the ball the actor repositions for the rebound instead of restarting a dribble loop',()=>{
  const engine=build('attack-rebound');engine.restart.active=false;
  const actor=engine.players.find(p=>p.team===0&&p.role!=='GK');
  const rival=engine.players.find(p=>p.team===1&&p.role!=='GK');
  clearOthers(engine,[actor.id,rival.id]);
  actor.x=300;actor.y=72;actor.vx=actor.vy=0;actor.decisionCooldown=0;
  rival.x=319;rival.y=72;rival.vx=rival.vy=0;
  engine.ball.x=305;engine.ball.y=57;engine.ball.vx=engine.ball.vy=0;
  engine.prepareBallAction(actor);
  assert.ok(actor.wallPlay);
  actor.kickIntent=null;
  engine.ball.lastPlayerId=actor.id;engine.ball.lastTeam=actor.team;engine.ball.lastTouchTick=engine.tick;
  engine.ball.x=320;engine.ball.y=53;engine.ball.vx=1.2;engine.ball.vy=1.4;
  const target=engine.aiTarget(actor,[],actor,null);
  assert.equal(actor.wallPlay?.stage,'rebound');
  assert.ok(target.y>engine.ball.y,'the actor should move back inside the pitch to meet the rebound');
  actor.decisionCooldown=0;actor.dribbleIntent=null;
  engine.prepareBallAction(actor);
  assert.equal(actor.dribbleIntent,null,'an active rebound plan must suppress repeated REGATE decisions');
});

test('bottom touchline uses the same controlled rebound logic mirrored vertically',()=>{
  const engine=build('bottom-wall-bank');engine.restart.active=false;
  const actor=engine.players.find(p=>p.team===0&&p.role!=='GK');
  const rival=engine.players.find(p=>p.team===1&&p.role!=='GK');
  clearOthers(engine,[actor.id,rival.id]);
  actor.x=500;actor.y=630;actor.vx=actor.vy=0;actor.decisionCooldown=0;
  rival.x=519;rival.y=630;rival.vx=rival.vy=0;
  engine.ball.x=505;engine.ball.y=642;engine.ball.vx=engine.ball.vy=0;
  engine.prepareBallAction(actor);
  assert.equal(actor.wallPlay?.side,'bottom');
  assert.equal(actor.kickIntent?.type,'wall');
  assert.ok(actor.kickIntent.aimY>655);
  assert.ok(actor.wallPlay.reboundY<655,'the planned recovery point must be inside the field');
});
