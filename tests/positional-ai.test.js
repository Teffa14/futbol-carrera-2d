import test from 'node:test';
import assert from 'node:assert/strict';
import '../ball-priority.js';
import '../anti-cluster.js';
import '../positional-ai.js';
import {MatchEngine} from '../engine.js';

const roles=['GK','RB','CB','CB','LB','CDM','CM','CAM','RW','ST','LW'];
function lineup(prefix){return roles.map((role,i)=>({instanceId:`${prefix}-${i}`,id:`${prefix}-${i}`,name:`${prefix}-${role}-${i}`,position:role,engineRole:role,rating:72,pace:72,shooting:66,passing:70,dribbling:70,defense:68,physical:69,ballControl:72,vision:71,stamina:75,composure:70,fitness:100,instructions:{risk:50,shoot:50,dribble:50},skills:[]}));}
function engine(){const e=new MatchEngine(lineup('home'),lineup('away'),{seed:'positional-ai'});e.restart.active=false;return e;}
function player(e,team,role,index=0){return e.players.filter(p=>p.team===team&&p.role===role)[index];}

test('a ball actor can physically approach a ball resting on the bottom wall',()=>{
  const e=engine(),a=player(e,0,'CM');
  e.ball.x=520;e.ball.y=650;e.ball.vx=0;e.ball.vy=0;
  a.x=490;a.y=620;a.vx=0;a.vy=0;
  const target=e.aiTarget(a,[],a,null);
  assert.ok(target.y>=644,`actor target ${target.y} must reach physical wall-contact height`);
  const final=e.boundarySafeTarget(a,target);
  assert.ok(final.y>=644,`boundary solver must not eject the active ball actor from the wall: ${final.y}`);
});

test('opposing actors approach a wall ball from different football sides instead of mirrored coordinates',()=>{
  const e=engine(),home=player(e,0,'CM'),away=player(e,1,'CM');
  e.ball.x=540;e.ball.y=650;e.ball.vx=0;e.ball.vy=0;
  home.x=520;home.y=620;away.x=560;away.y=620;
  const ht=e.aiTarget(home,[],home,null),at=e.aiTarget(away,[],away,null);
  assert.ok(ht.x<e.ball.x,`home actor should get behind the ball on the left, got ${ht.x}`);
  assert.ok(at.x>e.ball.x,`away actor should get behind the ball on the right, got ${at.x}`);
  assert.ok(Math.abs(ht.x-at.x)>18,'opponents must not select the same mirrored wall target');
});

test('off-ball roles choose different positional jobs in possession',()=>{
  const e=engine(),actor=player(e,0,'CM'),cb=player(e,0,'CB'),st=player(e,0,'ST'),lb=player(e,0,'LB');
  e.ball.x=690;e.ball.y=220;
  const cbTarget=e.aiTarget(cb,[],actor,0),stTarget=e.aiTarget(st,[],actor,0),lbTarget=e.aiTarget(lb,[],actor,0);
  const cbAdvance=cbTarget.x-cb.homeX,stAdvance=stTarget.x-st.homeX;
  assert.ok(stAdvance>cbAdvance+35,`ST advance ${stAdvance} must materially exceed CB advance ${cbAdvance}`);
  assert.ok(Math.abs(lbTarget.y-350)>Math.abs(stTarget.y-350),'wide defender should preserve a wider lane than the striker');
});

test('non-actors keep role spacing instead of joining a loose wall-ball pile',()=>{
  const e=engine(),actor=player(e,0,'CM'),st=player(e,0,'ST'),cb=player(e,0,'CB');
  e.ball.x=500;e.ball.y=650;
  actor.x=480;actor.y=620;st.x=510;st.y=610;cb.x=530;cb.y=610;
  const stTarget=e.aiTarget(st,[],actor,null),cbTarget=e.aiTarget(cb,[],actor,null);
  assert.ok(Math.abs(stTarget.y-e.ball.y)>40,'off-ball striker must not collapse onto the wall ball');
  assert.ok(Math.abs(cbTarget.y-e.ball.y)>70,'off-ball centre-back must retain rest-defence spacing');
  assert.notDeepEqual([Math.round(stTarget.x),Math.round(stTarget.y)],[Math.round(cbTarget.x),Math.round(cbTarget.y)],'different roles must not mirror the same target');
});

test('ordinary off-ball boundary safety still keeps players away from an impossible wall target',()=>{
  const e=engine(),p=player(e,0,'ST');
  p.y=640;
  const target=e.boundarySafeTarget(p,{x:p.x,y:650});
  assert.ok(target.y<630,'only the active wall actor may bypass the tactical wall guard');
});
