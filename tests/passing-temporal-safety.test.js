import test from 'node:test';
import assert from 'node:assert/strict';
import {assessTemporalPass} from '../passing-intelligence-v2.js';

function passer(){return{id:'p',team:0,x:200,y:350,vx:0,vy:0,facingX:1,facingY:0,data:{passing:75,pace:70,stamina:75,ballControl:70,dribbling:68,vision:78,composure:74}};}
function receiver(){return{id:'r',team:0,x:600,y:350,vx:0,vy:0,facingX:1,facingY:0,data:{pace:78,stamina:78,ballControl:75,dribbling:72,vision:72,composure:72}};}
function defender({fast}){
  return fast
    ?{id:'d',team:1,x:400,y:350,vx:2,vy:0,facingX:1,facingY:0,fatigue:0,data:{pace:90,stamina:90,defense:85,vision:75,composure:75,ballControl:70,dribbling:70,fitness:100}}
    :{id:'d',team:1,x:400,y:350,vx:-2,vy:0,facingX:-1,facingY:0,fatigue:90,data:{pace:45,stamina:45,defense:45,vision:45,composure:45,ballControl:45,dribbling:45,fitness:60}};
}

test('temporal pass safety distinguishes interception ability despite identical geometry',()=>{
  const p=passer(),r=receiver(),aim={x:600,y:350};
  const fast=assessTemporalPass({players:[p,r,defender({fast:true})]},p,r,aim,{kind:'progressive'});
  const slow=assessTemporalPass({players:[p,r,defender({fast:false})]},p,r,aim,{kind:'progressive'});
  assert.equal(fast.interceptable,true);
  assert.equal(slow.interceptable,false);
  assert.ok(fast.interceptionRisk>slow.interceptionRisk);
  assert.ok(fast.worstMargin>slow.worstMargin);
});

test('temporal pass analysis never assigns ball ownership or steering state',()=>{
  const p=passer(),r=receiver(),d=defender({fast:true}),engine={players:[p,r,d],ball:{x:p.x,y:p.y,vx:0,vy:0}};
  assessTemporalPass(engine,p,r,{x:600,y:350},{kind:'through'});
  assert.equal('ownerId' in engine.ball,false);
  assert.deepEqual(engine.ball,{x:200,y:350,vx:0,vy:0});
});
