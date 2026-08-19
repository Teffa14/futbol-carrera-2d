import test from 'node:test';
import assert from 'node:assert/strict';
import '../kick-direction.js';
import '../ball-priority.js';
import {createCareer,nextFixture,lineup11} from '../career.js';
import {MatchEngine} from '../engine.js';

function build(seed='ball-first'){
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

function clearOthers(engine,keep){
  for(const p of engine.players)if(!keep.includes(p.id)){p.x=920;p.y=610;p.vx=0;p.vy=0;}
}

function d(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}

test('the loose-ball actor breaks body contact toward the ball instead of continuing into the opponent',()=>{
  const engine=build('actor-breaks-to-ball');
  engine.restart.active=false;
  const actor=engine.players.find(p=>p.team===0&&p.role!=='GK');
  const rival=engine.players.find(p=>p.team===1&&p.role!=='GK');
  clearOthers(engine,[actor.id,rival.id]);
  actor.x=300;actor.y=350;actor.vx=actor.vy=0;
  rival.x=319;rival.y=350;rival.vx=rival.vy=0;
  engine.ball.x=365;engine.ball.y=350;engine.ball.vx=engine.ball.vy=0;
  const target=engine.aiTarget(actor,[],actor,null);
  const toBall={x:engine.ball.x-actor.x,y:engine.ball.y-actor.y};
  const toTarget={x:target.x-actor.x,y:target.y-actor.y};
  assert.ok(toTarget.x*toBall.x+toTarget.y*toBall.y>0,'the actor must make progress toward the loose ball');
  assert.ok((actor.contactEscapeTicks||0)>=9,'contact must create a committed escape path, not a one-frame correction');
});

test('an off-ball player disengages from an opponent instead of using the opponent as a movement destination',()=>{
  const engine=build('off-ball-disengage');
  engine.restart.active=false;
  const p=engine.players.find(x=>x.team===0&&x.role!=='GK');
  const rival=engine.players.find(x=>x.team===1&&x.role!=='GK');
  const actor=engine.players.find(x=>x.team===0&&x.id!==p.id&&x.role!=='GK');
  clearOthers(engine,[p.id,rival.id,actor.id]);
  p.x=400;p.y=350;p.vx=p.vy=0;p.homeX=360;p.homeY=330;
  rival.x=419;rival.y=350;rival.vx=rival.vy=0;
  actor.x=600;actor.y=350;
  engine.ball.x=650;engine.ball.y=350;engine.ball.vx=engine.ball.vy=0;
  const target=engine.aiTarget(p,[],actor,1);
  const towardRival={x:rival.x-p.x,y:rival.y-p.y};
  const move={x:target.x-p.x,y:target.y-p.y};
  assert.ok(move.x*towardRival.x+move.y*towardRival.y<=0,'off-ball contact must be broken instead of walking farther into the rival');
  assert.ok((p.contactEscapeTicks||0)>=7);
});

test('a photographed-style kiss lock separates while the nearest actor gets closer to the ball',()=>{
  const engine=build('photo-kiss-lock');
  engine.restart.active=false;
  const actor=engine.players.find(p=>p.team===0&&p.role!=='GK');
  const rival=engine.players.find(p=>p.team===1&&p.role!=='GK');
  clearOthers(engine,[actor.id,rival.id]);
  actor.x=500;actor.y=420;actor.vx=actor.vy=0;
  rival.x=519;rival.y=420;rival.vx=rival.vy=0;
  engine.ball.x=455;engine.ball.y=385;engine.ball.vx=engine.ball.vy=0;
  const beforeBall=d(actor,engine.ball),beforePair=d(actor,rival);
  for(let i=0;i<24;i++){
    const targetA=engine.aiTarget(actor,[],actor,null);
    const targetB=engine.aiTarget(rival,[],rival,null);
    engine.movePlayer(actor,targetA,.05,false);
    engine.movePlayer(rival,targetB,.05,false);
    engine.resolvePlayerCollisions();
  }
  assert.ok(d(actor,engine.ball)<beforeBall,'the actor must progress toward the loose ball');
  assert.ok(d(actor,rival)>beforePair+2,'the rival pair must separate rather than remain face-to-face');
});
