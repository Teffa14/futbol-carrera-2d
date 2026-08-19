import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePlayerContacts,steerAroundOpponent} from '../contacts.js';

function player(id,team,x,physical=82){return{id,team,x,y:350,vx:0,vy:0,r:10,data:{physical,dribbling:72,ballControl:74}};}

test('shielding turn commits to the same lateral lane for several steering frames',()=>{
  const holder=player('holder',0,300,88),challenger=player('challenger',1,318,70),ball={x:284,y:350,vx:.7,vy:.1};
  const before={...ball};
  const first=steerAroundOpponent(holder,{x:260,y:350},[holder,challenger],ball);
  const firstSide=Math.sign(first.y-holder.y);
  assert.notEqual(firstSide,0);
  assert.ok(holder.contactShieldExitTicks>=6,'a real shielding win should create a short turn commitment');

  challenger.x=370;
  const second=steerAroundOpponent(holder,{x:420,y:350},[holder,challenger],ball);
  const third=steerAroundOpponent(holder,{x:420,y:350},[holder,challenger],ball);
  assert.equal(Math.sign(second.y-holder.y),firstSide,'temporary target changes must not flip the committed exit lane');
  assert.equal(Math.sign(third.y-holder.y),firstSide,'the same exit side should persist across multiple frames');
  assert.ok(holder.contactShieldExitTicks>=3);
  assert.deepEqual(ball,before,'committed body movement must never mutate the free ball');
});

test('losing a later body duel cancels a stale shielding exit commitment',()=>{
  const holder=player('holder',0,300,45),challenger=player('challenger',1,318,96),ball={x:284,y:350,vx:0,vy:0};
  steerAroundOpponent(holder,{x:260,y:350},[holder,challenger],ball);
  assert.ok(holder.contactShieldExitTicks>0);

  holder.contactLeverage=0;challenger.contactLeverage=0;
  holder.vx=.2;challenger.vx=-2.8;
  resolvePlayerContacts([holder,challenger]);
  assert.ok(holder.contactEscapeTicks>0,'clear loser should enter the existing disengagement state');
  assert.equal(Number(holder.contactShieldExitTicks)||0,0,'loser escape must override an obsolete shielding turn');
});
