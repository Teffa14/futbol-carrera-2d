import test from 'node:test';
import assert from 'node:assert/strict';

const {MatchEngine}=await import('../engine.js');
await import('../football-rules-v2.js');
await import('../locomotion-v2.js');
await import('../carry-intelligence-v1.js');

const mk=(name,id,role='ST',extra={})=>({name,instanceId:id,engineRole:role,position:role,pace:82,dribbling:82,ballControl:84,passing:72,shooting:76,vision:72,composure:76,physical:68,stamina:80,...extra});

function setup(){
  const e=new MatchEngine([mk('Carrier','carrier')],[mk('Defender','defender','CB')],{userId:'carrier',seed:'turn-micro'});e.restart=null;
  const p=e.playerById('carrier'),d=e.playerById('defender');
  p.x=220;p.y=350;p.vx=0;p.vy=0;p.facingX=1;p.facingY=0;d.x=900;d.y=100;
  Object.assign(e.ball,{x:p.x+p.r+e.ball.r-.4,y:p.y,vx:0,vy:0,lastTeam:0,lastPlayerId:p.id,lastTouchTick:e.tick});
  return{e,p};
}
function carry(e,p,target,frames){for(let i=0;i<frames;i++){e.updateFreeBall(1/60);p.dribbleIntent={targetX:target.x,targetY:target.y,ttl:1};e.movePlayer(p,target,1/60,false);e.resolveBallPlayerCollisions();}}

test('committed sharp turn uses softer touches and exits assist after confirmed contacts',()=>{
  const {e,p}=setup();carry(e,p,{x:500,y:350},70);const before={x:e.ball.x,y:e.ball.y};carry(e,p,{x:650,y:520},110);
  const dx=e.ball.x-before.x,dy=e.ball.y-before.y,gap=Math.hypot(e.ball.x-p.x,e.ball.y-p.y);
  assert.ok(dx>35,`turn lost forward progress dx=${dx.toFixed(1)}`);
  assert.ok(dy>35,`turn did not change lane dy=${dy.toFixed(1)}`);
  assert.ok(gap<42,`turn touch ran too far away gap=${gap.toFixed(1)}`);
  assert.ok((p.carryState?.turnTouches||0)>=3||p.carryState?.turnAssist===false,'turn assist should finish after physical contacts');
});
