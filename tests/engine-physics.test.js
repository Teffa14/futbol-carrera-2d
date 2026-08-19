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

test('controlled dribbling applies discrete impulses without moving the ball to the player',()=>{
  const engine=build('touches');
  engine.restart.active=false;
  const player=engine.players.find(p=>p.team===0&&p.role!=='GK');
  player.x=300;player.y=350;player.vx=1.4;player.vy=.1;player.touchCooldown=0;
  engine.ball.x=318;engine.ball.y=352;engine.ball.vx=0;engine.ball.vy=0;engine.ball.ownerId=player.id;
  const before={x:engine.ball.x,y:engine.ball.y};
  engine.updateControlledBall(.016);
  assert.deepEqual({x:engine.ball.x,y:engine.ball.y},before,'a dribble touch must not teleport/interpolate ball position');
  assert.ok(Math.hypot(engine.ball.vx,engine.ball.vy)>0,'the touch must create a physical ball impulse');
  assert.ok(player.touchCooldown>0,'touches must be separated in time instead of applied every frame');
});

test('a pass is ballistic and never steers toward a receiver after the strike',()=>{
  const engine=build('ballistic-pass');
  engine.restart.active=false;
  const passer=engine.players.find(p=>p.team===0&&p.role!=='GK');
  const receiver=engine.players.find(p=>p.team===0&&p.role!=='GK'&&p.id!==passer.id);
  assert.ok(passer&&receiver);
  passer.x=300;passer.y=350;passer.vx=.8;passer.vy=0;
  receiver.x=500;receiver.y=360;receiver.vx=1.1;receiver.vy=.25;
  engine.ball.x=312;engine.ball.y=350;engine.ball.vx=0;engine.ball.vy=0;engine.ball.ownerId=passer.id;
  assert.equal(engine.pass(passer,receiver),true);
  const initial={vx:engine.ball.vx,vy:engine.ball.vy};
  receiver.x=920;receiver.y=100;receiver.vx=-4;receiver.vy=3;
  engine.updateFreeBall(.05);
  const cross=initial.vx*engine.ball.vy-initial.vy*engine.ball.vx;
  assert.ok(Math.abs(cross)<1e-9,'free-flight direction may damp but must not home toward the receiver');
  assert.equal(engine.ball.ownerId,null);
});

test('logical control breaks when player and ball separate',()=>{
  const engine=build('separation');
  engine.restart.active=false;
  const player=engine.players.find(p=>p.team===0&&p.role!=='GK');
  player.x=250;player.y=250;
  engine.ball.x=360;engine.ball.y=250;engine.ball.ownerId=player.id;
  assert.equal(engine.owner(),null);
  assert.equal(engine.ball.ownerId,null);
});

test('full match still exits kickoff, creates possession and completes with free-ball phases',()=>{
  const engine=build('full-free-ball');
  let hadOwner=false,hadFree=false;
  for(let i=0;i<7000&&!engine.finished;i++){
    engine.step(.05);
    if(engine.ball.ownerId)hadOwner=true;else hadFree=true;
  }
  assert.equal(engine.finished,true);
  assert.equal(engine.players.length,22);
  assert.equal(engine.restart?.active,false);
  assert.equal(hadOwner,true);
  assert.equal(hadFree,true);
  assert.ok(engine.stats.passes[0]+engine.stats.passes[1]>0);
});
