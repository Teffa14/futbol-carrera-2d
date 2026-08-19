import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveMass,shieldingLeverage,resolvePlayerContacts,steerAroundOpponent} from '../contacts.js';

function p(id,team,x,physical,vx=0,vy=0){return{id,team,x,y:350,vx,vy,r:10,data:{physical,dribbling:65,ballControl:65}};}

test('higher physical creates greater effective mass',()=>{
  assert.ok(effectiveMass(p('strong',0,0,92))>effectiveMass(p('weak',1,0,48)));
});

test('stronger player gives less ground and moves weaker opponent off the collision line',()=>{
  const strong=p('strong',0,300,94,2.4,0),weak=p('weak',1,317,42,-1.8,0);
  const sx=strong.x,wx=weak.x;
  const contacts=resolvePlayerContacts([strong,weak]);
  assert.equal(contacts.length,1);
  assert.ok(Math.abs(strong.x-sx)<Math.abs(weak.x-wx),'stronger player should be displaced less');
  assert.ok(weak.vx>strong.vx-2.5,'contact should transfer meaningful momentum instead of acting like an immovable wall');
});

test('head-on rivals receive opposite lateral escape so they cannot stay welded together',()=>{
  const a=p('a',0,300,70,2,0),b=p('b',1,318,70,-2,0);
  resolvePlayerContacts([a,b]);
  assert.notEqual(Math.sign(a.vy),Math.sign(b.vy));
  assert.ok(Math.abs(a.vy)+Math.abs(b.vy)>.35,'head-on contact must introduce a visible slide channel');
});

test('path steering routes two opponents to opposite sides before repeated head-on collision',()=>{
  const a=p('a',0,300,70),b=p('b',1,330,70),players=[a,b],ball={x:380,y:350};
  const ta=steerAroundOpponent(a,{x:420,y:350},players,ball);
  const tb=steerAroundOpponent(b,{x:220,y:350},players,ball);
  assert.notEqual(ta.y,350);
  assert.notEqual(tb.y,350);
  assert.ok((ta.y-350)*(tb.y-350)<0,'opponents should choose complementary escape sides');
});

test('a player between opponent and ball gains physical shielding leverage',()=>{
  const holder=p('holder',0,300,86),challenger=p('challenger',1,318,70),ball={x:284,y:350,vx:1.2,vy:0};
  const leverage=shieldingLeverage(holder,challenger,ball);
  assert.ok(leverage>.15,'body position plus strength should create meaningful leverage');
  assert.equal(shieldingLeverage(challenger,holder,ball),0,'the player on the wrong side of the ball should not receive shielding leverage');
});

test('shielding posture makes the body-line winner give less ground without moving the ball',()=>{
  const holder=p('holder',0,300,86,0,0),challenger=p('challenger',1,318,70,-1.6,0),ball={x:284,y:350,vx:1.2,vy:.25};
  const beforeBall={...ball};
  steerAroundOpponent(holder,{x:270,y:350},[holder,challenger],ball);
  steerAroundOpponent(challenger,{x:270,y:350},[holder,challenger],ball);
  const hx=holder.x,cx=challenger.x;
  const contacts=resolvePlayerContacts([holder,challenger]);
  assert.ok(contacts[0].leverageA>contacts[0].leverageB);
  assert.ok(Math.abs(holder.x-hx)<Math.abs(challenger.x-cx),'shielding player should resist displacement and force the challenger to give more ground');
  assert.deepEqual(ball,beforeBall,'player contact posture must never alter free-ball position or velocity');
});
