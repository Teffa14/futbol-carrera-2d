import test from 'node:test';
import assert from 'node:assert/strict';
import {perceptionProfile,targetVisibility,updatePerception,perceivedPlayers} from '../perception-scanning-v1.js';
import {valuePassOptions} from '../decision-value-v1.js';

function player(id,team,x,y,{vision=60,composure=60,role='CM',facingX=1,facingY=0}={}){
  return{id,team,x,y,vx:0,vy:0,role,facingX,facingY,r:10,data:{instanceId:id,name:id,vision,composure,passing:65,dribbling:65,ballControl:65,pace:65,shooting:55}};
}
function engine(players,tick=0){return{players,tick,ball:{x:300,y:350},playerById(id){return this.players.find(p=>p.id===id)||null;}};}

test('vision increases scan reach, memory and scan frequency',()=>{
  const low=perceptionProfile(player('low',0,0,0,{vision:40,composure:50}));
  const high=perceptionProfile(player('high',0,0,0,{vision:90,composure:80}));
  assert.ok(high.range>low.range);
  assert.ok(high.memoryTicks>low.memoryTicks);
  assert.ok(high.scanIntervalTicks<low.scanIntervalTicks);
  assert.ok(high.halfConeRadians>low.halfConeRadians);
});

test('body orientation creates a real blind side outside close awareness',()=>{
  const p=player('p',0,300,350,{vision:65,facingX:1});
  const front=player('front',0,430,350);
  const behind=player('behind',0,170,350);
  assert.equal(targetVisibility(p,front).visible,true);
  assert.equal(targetVisibility(p,behind).visible,false);
  p.facingX=-1;
  assert.equal(targetVisibility(p,behind).visible,true);
});

test('a scanned player remains as degrading memory after moving to the blind side',()=>{
  const p=player('p',0,300,350,{vision:72,composure:70}),mate=player('mate',0,410,350),e=engine([p,mate],0);
  let seen=updatePerception(e,p,{force:true}).find(x=>x.id==='mate');
  assert.equal(seen.visible,true);
  mate.x=180;e.tick=12;
  seen=perceivedPlayers(e,p).find(x=>x.id==='mate');
  assert.equal(seen.visible,false);
  assert.ok(seen.confidence>0&&seen.confidence<1);
  e.tick=200;
  assert.equal(perceivedPlayers(e,p).some(x=>x.id==='mate'),false);
});

test('pass candidate generation cannot target a never-scanned blind-side teammate',()=>{
  const passer=player('passer',0,300,350,{vision:65,composure:65,role:'CM',facingX:1});
  const front=player('front',0,420,330,{role:'CM'}),blind=player('blind',0,170,370,{role:'CM'});
  const defenders=[player('d1',1,760,280,{role:'CB'}),player('d2',1,800,350,{role:'CB'}),player('d3',1,760,430,{role:'CB'})];
  const e=engine([passer,front,blind,...defenders],0);
  const first=valuePassOptions(e,passer);
  assert.equal(first.some(o=>o.player.id==='front'),true);
  assert.equal(first.some(o=>o.player.id==='blind'),false);
  passer.facingX=-1;e.tick=20;updatePerception(e,passer,{force:true});
  const afterScan=valuePassOptions(e,passer);
  assert.equal(afterScan.some(o=>o.player.id==='blind'),true);
});

test('remembered pass options carry uncertainty into turnover risk',()=>{
  const passer=player('passer',0,300,350,{vision:70,composure:65,role:'CM',facingX:1});
  const mate=player('mate',0,420,350,{role:'CM'}),defenders=[player('d1',1,850,250,{role:'CB'}),player('d2',1,870,350,{role:'CB'}),player('d3',1,850,450,{role:'CB'})],e=engine([passer,mate,...defenders],0);
  const visible=valuePassOptions(e,passer).find(o=>o.player.id==='mate');
  assert.ok(visible);
  mate.x=180;e.tick=18;
  const remembered=valuePassOptions(e,passer).find(o=>o.player.id==='mate');
  assert.ok(remembered);
  assert.ok(remembered.perceptionConfidence<visible.perceptionConfidence);
  assert.ok(remembered.risk>visible.risk);
});
