import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareer,nextFixture,lineup11} from '../career.js';
import {MatchEngine} from '../engine.js';

function build(seed='physics'){
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

test('the ball never has an owner or attachment state',()=>{
  const engine=build('no-owner');
  assert.equal('ownerId' in engine.ball,false);
  assert.equal(engine.owner(),null);
  engine.restart.active=false;
  for(let i=0;i<120;i++)engine.step(.05);
  assert.equal('ownerId' in engine.ball,false);
});

test('normal dribbling only moves the ball through physical circle contact',()=>{
  const engine=build('body-touch');
  engine.restart.active=false;
  const player=engine.players.find(p=>p.team===0&&p.role!=='GK');
  player.x=300;player.y=350;player.vx=2;player.vy=0;player.facingX=1;player.facingY=0;player.kickIntent=null;
  engine.ball.x=315;engine.ball.y=350;engine.ball.vx=0;engine.ball.vy=0;engine.ball.lastTouchTick=-20;
  const before={x:engine.ball.x,y:engine.ball.y};
  engine.resolveBallPlayerCollisions();
  assert.ok(engine.ball.x>before.x,'collision separation must move the free ball away from the player');
  assert.ok(engine.ball.vx>0,'the player body must transfer forward momentum to the ball');
  assert.equal(engine.ball.lastPlayerId,player.id);
});

test('a kick can only fire through contact in the direction the player faces',()=>{
  const engine=build('facing-kick');
  engine.restart.active=false;
  const player=engine.players.find(p=>p.team===0&&p.role!=='GK');
  player.x=300;player.y=350;player.vx=0;player.vy=0;player.facingX=0;player.facingY=-1;player.kickCooldown=0;
  engine.ball.x=300;engine.ball.y=335;engine.ball.vx=0;engine.ball.vy=0;
  player.kickIntent={aimX:300,aimY:100,power:6,type:'pass',ttl:1,receiverId:null};
  engine.resolveBallPlayerCollisions();
  assert.ok(engine.ball.vy<0,'the kick must go forward from the facing vector');
  assert.ok(Math.abs(engine.ball.vx)<Math.abs(engine.ball.vy)*.25,'the kick must not redirect to another target after contact');
});

test('an armed kick does nothing while the ball is outside physical contact',()=>{
  const engine=build('no-remote-kick');
  engine.restart.active=false;
  const player=engine.players.find(p=>p.team===0&&p.role!=='GK');
  player.x=300;player.y=350;player.facingX=1;player.facingY=0;
  engine.ball.x=360;engine.ball.y=350;engine.ball.vx=0;engine.ball.vy=0;
  player.kickIntent={aimX:800,aimY:350,power:7,type:'shot',ttl:1};
  engine.resolveBallPlayerCollisions();
  assert.equal(engine.ball.vx,0);
  assert.equal(engine.ball.vy,0);
  assert.ok(player.kickIntent,'the intent stays armed until contact or timeout');
});

test('pass intent only aims the player; receiver movement cannot steer the free ball',()=>{
  const engine=build('ballistic-pass');
  engine.restart.active=false;
  const passer=engine.players.find(p=>p.team===0&&p.role!=='GK');
  const receiver=engine.players.find(p=>p.team===0&&p.role!=='GK'&&p.id!==passer.id);
  assert.ok(passer&&receiver);
  passer.x=300;passer.y=350;passer.vx=0;passer.vy=0;
  receiver.x=500;receiver.y=360;receiver.vx=0;receiver.vy=0;
  engine.ball.x=315;engine.ball.y=350;engine.ball.vx=0;engine.ball.vy=0;
  engine.pass(passer,receiver);
  assert.equal(engine.ball.vx,0,'arming a pass must not remotely move the ball');
  engine.resolveBallPlayerCollisions();
  const initial={vx:engine.ball.vx,vy:engine.ball.vy};
  assert.ok(Math.hypot(initial.vx,initial.vy)>0,'contact should execute the kick');
  receiver.x=920;receiver.y=100;receiver.vx=-4;receiver.vy=3;
  engine.updateFreeBall(.05);
  const cross=initial.vx*engine.ball.vy-initial.vy*engine.ball.vx;
  assert.ok(Math.abs(cross)<1e-9,'free-flight direction may damp but must never home toward the receiver');
});

test('full match exits kickoff and completes with the ball permanently free',()=>{
  const engine=build('full-haxball-physics');
  let touched=false,freeFlight=false;
  for(let i=0;i<7000&&!engine.finished;i++){
    engine.step(.05);
    if(engine.ball.lastPlayerId)touched=true;
    if(Math.hypot(engine.ball.vx,engine.ball.vy)>1&&engine.tick-engine.ball.lastTouchTick>2)freeFlight=true;
    assert.equal('ownerId' in engine.ball,false);
  }
  assert.equal(engine.finished,true);
  assert.equal(engine.players.length,22);
  assert.equal(engine.restart?.active,false);
  assert.equal(touched,true);
  assert.equal(freeFlight,true);
  assert.ok(engine.stats.passes[0]+engine.stats.passes[1]>0);
});
