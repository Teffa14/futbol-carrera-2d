import test from 'node:test';
import assert from 'node:assert/strict';
import {pressureTarget,rankPressers,selectPressureAssignments} from '../pressing-intelligence-v1.js';

function player(id,{x,y=350,vx=0,vy=0,facingX=1,facingY=0,pace=70,stamina=70,defense=65,fatigue=0,team=0,role='CM'}={}){
  return{id,team,role,x,y,vx,vy,facingX,facingY,fatigue,data:{pace,stamina,defense,vision:65,composure:65,ballControl:65,dribbling:65,fitness:100}};
}

test('pressing assignment prefers the defender who can arrive first, not the nearest defender',()=>{
  const ball={x:570,y:350,vx:0,vy:0,r:6};
  const nearestButWrongFooted=player('near',{x:510,facingX:-1,pace:58,stamina:55,defense:62,fatigue:35});
  const fartherButAlreadyClosing=player('closing',{x:455,vx:3.2,facingX:1,pace:88,stamina:84,defense:78,fatigue:3});
  const support=player('support',{x:390,y:430,pace:72});

  const ranked=rankPressers([nearestButWrongFooted,fartherButAlreadyClosing,support],ball,0,{limit:2,horizon:.2});

  assert.equal(ranked[0].player.id,'closing');
  assert.ok(ranked[0].arrivalTime<ranked[1].arrivalTime);
  assert.deepEqual(selectPressureAssignments([nearestButWrongFooted,fartherButAlreadyClosing,support],ball,0,{limit:2,horizon:.2}),['closing','near']);
});

test('fatigue and orientation can change pressure priority at similar distances',()=>{
  const ball={x:600,y:350,vx:0,vy:0};
  const tired=player('tired',{x:500,y:348,facingX:-1,pace:86,stamina:82,fatigue:58});
  const fresh=player('fresh',{x:492,y:354,facingX:1,pace:76,stamina:80,fatigue:2});

  const ranked=rankPressers([tired,fresh],ball,0,{limit:2,horizon:.18});
  assert.equal(ranked[0].player.id,'fresh');
});

test('pressure target predicts free-ball travel without mutating or owning the ball',()=>{
  const ball={x:550,y:350,vx:4,vy:-2,lastPlayerId:'p9'};
  const before=structuredClone(ball);
  const target=pressureTarget(ball,{horizon:.25});

  assert.ok(target.x>ball.x);
  assert.ok(target.y<ball.y);
  assert.deepEqual(ball,before);
  assert.equal('ownerId' in ball,false);
  assert.equal('ownerId' in target,false);
});

test('goalkeepers and the other team are excluded from pressing assignments',()=>{
  const ball={x:550,y:350,vx:0,vy:0};
  const ownKeeper=player('gk',{x:500,team:0,role:'GK',pace:99});
  const opponent=player('opp',{x:545,team:1,pace:99});
  const ownMid=player('mid',{x:430,team:0,role:'CM'});

  assert.deepEqual(selectPressureAssignments([ownKeeper,opponent,ownMid],ball,0,{limit:2}),['mid']);
});
