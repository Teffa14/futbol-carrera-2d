import test from 'node:test';
import assert from 'node:assert/strict';
import '../kick-direction.js';
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

function fieldAwayFrom(player,engine){for(const p of engine.players)if(p.id!==player.id){p.x=900;p.y=620;p.vx=0;p.vy=0;}}

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
  fieldAwayFrom(player,engine);
  player.x=300;player.y=350;player.vx=1.1;player.vy=0;player.facingX=1;player.facingY=0;player.kickIntent=null;player.dribbleIntent={targetX:500,targetY:350,ttl:1};player.touchCooldown=0;
  engine.ball.x=315;engine.ball.y=350;engine.ball.vx=0;engine.ball.vy=0;engine.ball.lastTouchTick=-20;
  const before={x:engine.ball.x,y:engine.ball.y};
  engine.resolveBallPlayerCollisions();
  assert.ok(engine.ball.x>before.x,'circle separation must move the free ball away from the player');
  assert.ok(engine.ball.vx>0,'a dribble touch must transfer a small forward impulse');
  assert.ok(Math.hypot(engine.ball.vx,engine.ball.vy)<2,'a dribble touch must remain a microtouch, not become a pass');
  assert.equal(engine.ball.lastPlayerId,player.id);
});

test('a kick can fire from the full circumference but leaves in the direction the player faces',()=>{
  const engine=build('full-circle-facing-kick');
  engine.restart.active=false;
  const player=engine.players.find(p=>p.team===0&&p.role!=='GK');
  fieldAwayFrom(player,engine);
  player.x=300;player.y=350;player.vx=0;player.vy=0;player.facingX=1;player.facingY=0;player.kickCooldown=0;
  engine.ball.x=285;engine.ball.y=350;engine.ball.vx=0;engine.ball.vy=0;
  player.kickIntent={aimX:900,aimY:350,power:6,type:'pass',ttl:1,receiverId:null};
  engine.resolveBallPlayerCollisions();
  assert.equal(player.kickIntent,null,'contact anywhere on the circle must still execute the armed kick');
  assert.ok(engine.ball.vx>0,'rear-side contact must still kick in the player facing direction');
  assert.ok(Math.abs(engine.ball.vy)<1,'horizontal facing should keep the kick approximately horizontal');
});

test('kick direction follows facing rather than the radial contact normal',()=>{
  const engine=build('facing-over-normal');
  engine.restart.active=false;
  const player=engine.players.find(p=>p.team===0&&p.role!=='GK');
  fieldAwayFrom(player,engine);
  player.x=300;player.y=350;player.vx=0;player.vy=0;player.facingX=0;player.facingY=-1;player.kickCooldown=0;
  engine.ball.x=315;engine.ball.y=350;engine.ball.vx=0;engine.ball.vy=0;
  player.kickIntent={aimX:300,aimY:100,power:6,type:'pass',ttl:1,receiverId:null};
  engine.resolveBallPlayerCollisions();
  assert.ok(engine.ball.vy<0,'upward-facing player must kick upward');
  assert.ok(Math.abs(engine.ball.vy)>Math.abs(engine.ball.vx)*3,'facing must dominate the side contact normal');
});

test('a player can rotate in place without needing translational movement',()=>{
  const engine=build('stationary-turn');
  engine.restart.active=false;
  const player=engine.players.find(p=>p.team===0&&p.role!=='GK');
  fieldAwayFrom(player,engine);
  player.x=300;player.y=350;player.vx=0;player.vy=0;player.facingX=1;player.facingY=0;
  player.kickIntent={aimX:300,aimY:100,power:4,type:'pass',ttl:1};
  const before={x:player.x,y:player.y};
  engine.movePlayer(player,{x:player.x,y:player.y},.05,false);
  assert.ok(Math.abs(player.x-before.x)<1e-9&&Math.abs(player.y-before.y)<1e-9,'turning must not require the disc to translate');
  assert.ok(player.facingY<-.1,'facing direction must rotate toward the intent while stationary');
});

test('body/dribble touches are materially softer than an intentional pass kick',()=>{
  const engine=build('touch-strengths');
  engine.restart.active=false;
  const player=engine.players.find(p=>p.team===0&&p.role!=='GK');
  fieldAwayFrom(player,engine);
  player.x=300;player.y=350;player.vx=1;player.vy=0;player.facingX=1;player.facingY=0;player.touchCooldown=0;player.dribbleIntent={targetX:500,targetY:350,ttl:1};
  engine.ball.x=315;engine.ball.y=350;engine.ball.vx=0;engine.ball.vy=0;engine.ball.lastTouchTick=-50;
  engine.resolveBallPlayerCollisions();
  const touchSpeed=Math.hypot(engine.ball.vx,engine.ball.vy);

  player.touchCooldown=0;player.kickCooldown=0;player.dribbleIntent=null;player.kickIntent={aimX:900,aimY:350,power:6,type:'pass',ttl:1};
  player.facingX=1;player.facingY=0;
  engine.ball.x=315;engine.ball.y=350;engine.ball.vx=0;engine.ball.vy=0;engine.ball.lastTouchTick=-50;
  engine.resolveBallPlayerCollisions();
  const passSpeed=Math.hypot(engine.ball.vx,engine.ball.vy);
  assert.ok(passSpeed>touchSpeed*3,`pass ${passSpeed} should be much stronger than touch ${touchSpeed}`);
});

test('a blocked ball actor gets a tangential pivot target instead of re-entering the collision line',()=>{
  const engine=build('pivot-exit');
  engine.restart.active=false;
  const player=engine.players.find(p=>p.team===0&&p.role!=='GK');
  const opponent=engine.players.find(p=>p.team===1&&p.role!=='GK');
  for(const p of engine.players)if(p.id!==player.id&&p.id!==opponent.id){p.x=900;p.y=620;p.vx=0;p.vy=0;}
  player.x=300;player.y=350;player.vx=0;player.vy=0;
  opponent.x=282;opponent.y=350;opponent.vx=0;opponent.vy=0;
  engine.ball.x=316;engine.ball.y=350;engine.ball.vx=0;engine.ball.vy=0;
  const pivot=engine.pivotAroundBallTarget(player,{x:520,y:350});
  assert.ok(pivot,'close stationary body pressure around the ball must create a pivot');
  assert.notEqual(Math.round(pivot.y),350,'pivot must leave the straight duel line laterally');
});

test('an armed kick does nothing while the ball is outside physical contact',()=>{
  const engine=build('no-remote-kick');
  engine.restart.active=false;
  const player=engine.players.find(p=>p.team===0&&p.role!=='GK');
  fieldAwayFrom(player,engine);
  player.x=300;player.y=350;player.facingX=1;player.facingY=0;
  engine.ball.x=360;engine.ball.y=350;engine.ball.vx=0;engine.ball.vy=0;
  player.kickIntent={aimX:800,aimY:350,power:7,type:'shot',ttl:1};
  engine.resolveBallPlayerCollisions();
  assert.equal(engine.ball.vx,0);
  assert.equal(engine.ball.vy,0);
  assert.ok(player.kickIntent,'the intent stays armed until physical contact or timeout');
});

test('receiver movement cannot steer a free ball after the pass contact',()=>{
  const engine=build('ballistic-pass');
  engine.restart.active=false;
  const passer=engine.players.find(p=>p.team===0&&p.role!=='GK');
  const receiver=engine.players.find(p=>p.team===0&&p.role!=='GK'&&p.id!==passer.id);
  assert.ok(passer&&receiver);
  for(const p of engine.players)if(p.id!==passer.id&&p.id!==receiver.id){p.x=900;p.y=620;p.vx=0;p.vy=0;}
  passer.x=300;passer.y=350;passer.vx=0;passer.vy=0;passer.facingX=1;passer.facingY=0;
  receiver.x=500;receiver.y=350;receiver.vx=0;receiver.vy=0;
  engine.ball.x=315;engine.ball.y=350;engine.ball.vx=0;engine.ball.vy=0;
  engine.pass(passer,receiver);
  assert.equal(engine.ball.vx,0,'arming a pass must not remotely move the ball');
  engine.resolveBallPlayerCollisions();
  const initial={vx:engine.ball.vx,vy:engine.ball.vy};
  assert.ok(Math.hypot(initial.vx,initial.vy)>0,'physical contact should execute the pass');
  receiver.x=920;receiver.y=100;receiver.vx=-4;receiver.vy=3;
  engine.updateFreeBall(.05);
  const cross=initial.vx*engine.ball.vy-initial.vy*engine.ball.vx;
  assert.ok(Math.abs(cross)<1e-9,'free-flight direction may damp but must never home toward the receiver');
});

test('full match exits kickoff, produces dribble attempts and completes with the ball permanently free',()=>{
  const engine=build('full-facing-dribble-physics');
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
  assert.ok(engine.stats.dribbles[0]+engine.stats.dribbles[1]>0,'the AI must actually attempt 1v1 dribbles during a full match');
});
