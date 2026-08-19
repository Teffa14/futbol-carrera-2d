import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareer,nextFixture,lineup11} from '../career.js';
import {MatchEngine} from '../engine.js';

function build(seed='touchline-deadlock'){
  const state=createCareer({playerName:'Test',nationality:'AR',position:'CM',build:'technician',countryId:'AR',clubId:'river'});
  const fixture=nextFixture(state);
  const engine=new MatchEngine(lineup11(state,fixture.home),lineup11(state,fixture.away),{
    homeName:fixture.home,awayName:fixture.away,
    homeTactics:state.world[fixture.home].tactics,awayTactics:state.world[fixture.away].tactics,
    userId:state.player.instanceId,seed
  });
  engine.restart.active=false;
  return engine;
}

test('touchline boundary kills outward velocity and redirects an outward target back into the field',()=>{
  const e=build('boundary-normal');
  const p=e.players.find(x=>x.role!=='GK');
  p.x=500;p.y=55;p.vx=0;p.vy=-2.4;
  e.resolvePlayerBoundary(p);
  assert.equal(p.y,55);
  assert.equal(p.vy,0,'top touchline must remove velocity that keeps pushing outside');
  const top=e.boundarySafeTarget(p,{x:500,y:5});
  assert.ok(top.y>p.y,'outward escape at the top line must be redirected inward');

  p.y=645;p.vy=2.4;e.resolvePlayerBoundary(p);
  assert.equal(p.vy,0,'bottom touchline must remove outward velocity');
  assert.ok(e.boundarySafeTarget(p,{x:500,y:690}).y<p.y);

  p.x=65;p.y=350;p.vx=-2.4;e.resolvePlayerBoundary(p);
  assert.equal(p.vx,0,'left boundary must remove outward velocity');
  assert.ok(e.boundarySafeTarget(p,{x:10,y:350}).x>p.x);

  p.x=1035;p.vx=2.4;e.resolvePlayerBoundary(p);
  assert.equal(p.vx,0,'right boundary must remove outward velocity');
  assert.ok(e.boundarySafeTarget(p,{x:1090,y:350}).x<p.x);
});

test('two rivals at the touchline are driven back into playable space instead of repeatedly clamping outside',()=>{
  const e=build('touchline-pair');
  const a=e.players.find(x=>x.team===0&&x.role!=='GK'),b=e.players.find(x=>x.team===1&&x.role!=='GK');
  a.x=490;a.y=55;a.vx=1.8;a.vy=-.8;
  b.x=508;b.y=55;b.vx=-1.8;b.vy=-.8;
  e.ball.x=499;e.ball.y=51;e.ball.vx=0;e.ball.vy=0;
  const startA={x:a.x,y:a.y},startB={x:b.x,y:b.y};
  for(let i=0;i<70;i++){
    e.movePlayer(a,{x:545,y:20},.05,false);
    e.movePlayer(b,{x:455,y:20},.05,false);
    e.resolvePlayerCollisions();
  }
  assert.ok(a.y>55||b.y>55,'at least one rival must obtain an inward lane instead of staying welded to the touchline');
  assert.ok(Math.hypot(a.x-startA.x,a.y-startA.y)>8||Math.hypot(b.x-startB.x,b.y-startB.y)>8,'the duel must make spatial progress');
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=19.5,'rivals must not remain overlapped');
});

test('five simulated minutes of a local deadlock awards a free kick to the team that had possession before it started',()=>{
  const e=build('five-minute-fallback');
  const a=e.players.find(x=>x.team===0&&x.role!=='GK'),b=e.players.find(x=>x.team===1&&x.role!=='GK');
  e.ball.x=520;e.ball.y=56;e.ball.vx=0;e.ball.vy=0;e.ball.lastTeam=1;
  a.x=511;a.y=56;a.vx=0;a.vy=0;
  b.x=529;b.y=56;b.vx=0;b.vy=0;
  e.lastPossessionTeam=0;
  e.minute=20;
  assert.equal(e.trackDeadlockFallback(0),false);
  assert.equal(e.deadlock.team,0,'deadlock must snapshot the pre-deadlock possession team');

  let awarded=false;
  for(let i=1;i<=101;i++){
    e.minute=20+i*.05;
    awarded=e.trackDeadlockFallback(null)||awarded;
  }
  assert.equal(awarded,true);
  assert.equal(e.restart.active,true);
  assert.equal(e.restart.kind,'free-kick');
  assert.equal(e.restart.team,0,'alternating contact metadata must not steal the fallback restart');
  assert.equal(e.stats.deadlockFreeKicks[0],1);
  assert.equal(e.stats.deadlockFreeKicks[1],0);
  assert.ok(e.ball.y>=99,'a touchline deadlock restart must be moved to a safe in-field free-kick point');
  assert.ok(e.events.some(x=>x.text.includes('Tiro libre')));
});

test('meaningful ball progress resets the five-minute deadlock clock while the duel remains contested',()=>{
  const e=build('deadlock-progress-reset');
  const a=e.players.find(x=>x.team===0&&x.role!=='GK'),b=e.players.find(x=>x.team===1&&x.role!=='GK');
  e.ball.x=500;e.ball.y=60;e.ball.vx=0;e.ball.vy=0;
  a.x=490;a.y=60;b.x=510;b.y=60;e.lastPossessionTeam=1;e.minute=12;
  e.trackDeadlockFallback(1);

  e.minute=16.9;e.ball.x=545;a.x=535;b.x=555;
  assert.equal(e.trackDeadlockFallback(null),false);
  assert.ok(e.deadlock,'continued opposing pressure should start a fresh deadlock episode at the new location');
  const resetAt=e.deadlock.startMinute;

  e.minute=17.2;
  assert.equal(e.trackDeadlockFallback(null),false);
  assert.equal(e.restart?.kind==='free-kick'&&e.restart.active,true,false);
  assert.equal(resetAt,16.9,'meaningful movement must restart the fallback timer');
});

test('deadlock free kick resumes as a physical kick instead of attaching the ball to the taker',()=>{
  const e=build('free-kick-release');
  e.ball.x=500;e.ball.y=60;e.ball.lastTeam=0;e.lastPossessionTeam=0;
  assert.equal(e.awardDeadlockFreeKick(0),true);
  assert.equal('ownerId' in e.ball,false);
  for(let i=0;i<30;i++)e.step(.05);
  assert.equal(e.restart.active,false);
  assert.equal('ownerId' in e.ball,false);
  assert.ok(Math.hypot(e.ball.vx,e.ball.vy)>0,'restart must leave through a real contact kick');
});
