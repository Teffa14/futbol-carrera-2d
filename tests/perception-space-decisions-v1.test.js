import test from 'node:test';
import assert from 'node:assert/strict';
import {perceivedOpponentStates,updatePerception} from '../perception-scanning-v1.js';
import {__agentBrainTest} from '../agent-brain-v2.js';

function player(id,team,x,y,{role='CM',vision=65,composure=65,facingX=1,facingY=0}={}){
  return{
    id,team,x,y,vx:0,vy:0,r:10,role,facingX,facingY,
    homeX:x,homeY:y,
    data:{instanceId:id,name:id,vision,composure,pace:65,stamina:70,tacticalIQ:65},
  };
}

function engine(players,tick=0){
  return{players,tick,ball:{x:600,y:350},restart:null};
}

test('perceived opponent states preserve the last scanned motion state instead of leaking live blind-side coordinates',()=>{
  const observer=player('observer',0,300,350,{vision:70,facingX:1});
  const opponent=player('opponent',1,430,350,{role:'ST'});
  const e=engine([observer,opponent],0);

  let perceived=perceivedOpponentStates(e,observer);
  assert.equal(perceived.length,1);
  assert.equal(perceived[0].x,430);
  assert.equal(perceived[0].perceptionVisible,true);

  opponent.x=170;
  opponent.vx=-4;
  e.tick=2;
  perceived=perceivedOpponentStates(e,observer);

  assert.equal(perceived[0].x,430);
  assert.equal(perceived[0].vx,0);
  assert.equal(perceived[0].perceptionVisible,false);
  assert.ok(perceived[0].perceptionConfidence<1);
  assert.equal(opponent.x,170);
});

test('spatial decisions remain based on remembered opponent position until a new scan updates that information',()=>{
  const observer=player('observer',0,360,350,{role:'CM',vision:70,facingX:1});
  const mate=player('mate',0,300,420,{role:'CM'});
  const opponent=player('opponent',1,470,350,{role:'CM'});
  const e=engine([observer,mate,opponent],0);
  const base={x:390,y:350};

  const visibleDecision=__agentBrainTest.spacingCandidate(e,observer,base,0);

  opponent.x=180;
  opponent.y=250;
  e.tick=2;
  const rememberedDecision=__agentBrainTest.spacingCandidate(e,observer,base,0);
  assert.deepEqual(rememberedDecision,visibleDecision);

  observer.facingX=-1;
  e.tick=20;
  updatePerception(e,observer,{force:true});
  const rescanned=perceivedOpponentStates(e,observer);
  assert.equal(rescanned[0].x,180);
  assert.equal(rescanned[0].y,250);
});
