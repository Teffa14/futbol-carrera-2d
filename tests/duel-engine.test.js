import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareer,nextFixture,lineup11} from '../career.js';
import {MatchEngine} from '../engine.js';

function build(seed='duel-runtime'){
  const state=createCareer({playerName:'Test',nationality:'AR',position:'CM',build:'creator',countryId:'AR',clubId:'river'});
  const fixture=nextFixture(state);
  const home=lineup11(state,fixture.home,{forceUser:fixture.home===state.clubId});
  const away=lineup11(state,fixture.away,{forceUser:fixture.away===state.clubId});
  return new MatchEngine(home,away,{
    homeName:fixture.home,
    awayName:fixture.away,
    homeTactics:state.world[fixture.home].tactics,
    awayTactics:state.world[fixture.away].tactics,
    userId:state.player.instanceId,
    seed
  });
}

test('a strength-won player collision records one body duel and changes rating without touching the ball',()=>{
  const engine=build('body-duel-runtime');
  engine.restart.active=false;
  const strong=engine.playerById(engine.userId);
  const weak=engine.players.find(p=>p.team!==strong.team&&p.role!=='GK');
  strong.data.physical=96;strong.data.balance=90;weak.data.physical=40;weak.data.balance=44;
  strong.x=300;strong.y=350;strong.vx=2.5;strong.vy=0;
  weak.x=318;weak.y=350;weak.vx=-1.2;weak.vy=0;
  const ballBefore={...engine.ball};
  const ratingBefore=strong.perf.rating;
  engine.resolvePlayerCollisions();
  assert.equal(strong.perf.bodyDuels,1);
  assert.equal(strong.perf.bodyDuelsWon,1);
  assert.equal(weak.perf.bodyDuels,1);
  assert.equal(engine.stats.bodyDuelsWon[strong.team],1);
  assert.ok(strong.perf.rating>ratingBefore);
  assert.deepEqual(engine.ball,ballBefore,'player-player duel accounting must never mutate the free ball');
  assert.ok(engine.events.some(e=>e.text.includes('gana el duelo físico')));
});

test('continuous overlap is debounced and does not inflate body duel totals every frame',()=>{
  const engine=build('duel-debounce-runtime');
  engine.restart.active=false;
  const a=engine.playerById(engine.userId),b=engine.players.find(p=>p.team!==a.team&&p.role!=='GK');
  a.data.physical=95;b.data.physical=42;
  a.x=300;a.y=350;a.vx=2;b.x=318;b.y=350;b.vx=-1;
  engine.resolvePlayerCollisions();
  assert.equal(a.perf.bodyDuels,1);
  a.x=300;b.x=318;a.vx=2;b.vx=-1;
  engine.tick++;
  engine.resolvePlayerCollisions();
  assert.equal(a.perf.bodyDuels,1,'same contact episode must remain one recorded duel');
});

test('shielding posture is tracked separately and still cannot move the ball',()=>{
  const engine=build('shielding-runtime');
  engine.restart.active=false;
  const holder=engine.playerById(engine.userId),challenger=engine.players.find(p=>p.team!==holder.team&&p.role!=='GK');
  holder.data.physical=78;challenger.data.physical=78;
  holder.x=300;holder.y=350;holder.vx=0;holder.vy=0;holder.contactLeverage=.25;
  challenger.x=318;challenger.y=350;challenger.vx=0;challenger.vy=0;challenger.contactLeverage=0;
  engine.ball.x=282;engine.ball.y=350;engine.ball.vx=1.4;engine.ball.vy=.2;
  const before={...engine.ball};
  engine.resolvePlayerCollisions();
  assert.equal(holder.perf.shieldingDuels,1);
  assert.equal(holder.perf.shieldingWins,1);
  assert.equal(engine.stats.shieldingWins[holder.team],1);
  assert.deepEqual(engine.ball,before);
  assert.ok(engine.events.some(e=>e.text.includes('protege la línea con el cuerpo')));
});
