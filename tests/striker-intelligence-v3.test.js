import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchEngine} from '../engine.js';
import '../kick-direction.js';
import '../ball-priority.js';
import '../anti-cluster.js';
import '../positional-ai.js';
import '../boundary-intelligence.js';
import '../role-depth.js';
import '../match-presentation.js';
import '../football-rules-v2.js';
import '../locomotion-v2.js';
import '../agent-brain-v2.js';
import '../passing-intelligence-v2.js';
import {strikerLineTarget,shouldAttackOneVOne} from '../striker-intelligence-v3.js';
import {FIELD,onsideLimit} from '../football-rules-v2.js';

const roles=['GK','RB','CB','CB','LB','CDM','CM','CAM','RW','ST','LW'];
function player(prefix,role,i,overrides={}){return{instanceId:`${prefix}-${i}`,id:`${prefix}-${i}`,name:`${prefix} ${role} ${i}`,position:role,engineRole:role,rating:74,pace:72,shooting:68,passing:70,dribbling:70,defense:65,physical:68,ballControl:71,vision:70,stamina:74,composure:70,fitness:100,skills:[],instructions:{risk:52,shoot:58,dribble:60},...overrides};}
function lineup(prefix,overrides={}){return roles.map((r,i)=>player(prefix,r,i,typeof overrides==='function'?overrides(r,i):overrides));}
function engine(seed='striker'){return new MatchEngine(lineup('home',(r,i)=>r==='ST'?{pace:86,shooting:83,dribbling:82,ballControl:81,instructions:{risk:58,shoot:72,dribble:74}}:{}),lineup('away'),{seed,userId:'home-9'});}

function setAwayLine(e,x){for(const p of e.players.filter(p=>p.team===1)){if(p.role==='GK'){p.x=FIELD.right-28;continue;}p.x=x+(p.slot%3)*12;}}

test('striker references the defensive line instead of sitting behind a midfield ball',()=>{
  const e=engine('high-nine');e.restart.active=false;setAwayLine(e,790);const st=e.players.find(p=>p.team===0&&p.role==='ST');const mate=e.players.find(p=>p.team===0&&p.role==='CM');Object.assign(e.ball,{x:430,y:FIELD.centerY,vx:0,vy:0,lastTeam:0,lastPlayerId:mate.id,lastTouchTick:e.tick});
  const base={x:475,y:FIELD.centerY};const target=strikerLineTarget(e,st,base,0),limit=onsideLimit(e,0);
  assert.ok(target.x>650,`ST stayed too deep at ${target.x}`);
  assert.ok(target.x-e.ball.x>180,`ST is still ball-anchored: ball ${e.ball.x}, target ${target.x}`);
  assert.ok(target.x<=limit-2,`ST target ${target.x} crossed onside limit ${limit}`);
});

test('full aiTarget chain keeps a non-actor striker high during possession',()=>{
  const e=engine('chain-nine');e.restart.active=false;setAwayLine(e,810);const st=e.players.find(p=>p.team===0&&p.role==='ST'),cm=e.players.find(p=>p.team===0&&p.role==='CM');Object.assign(e.ball,{x:455,y:300,vx:0,vy:0,lastTeam:0,lastPlayerId:cm.id,lastTouchTick:e.tick});
  const actor=cm,pressers=e.selectPressers(0),target=e.aiTarget(st,pressers,actor,0);
  assert.ok(target.x>FIELD.centerX+90,`complete AI chain held ST near midfield: ${target.x}`);
  assert.ok(target.x-e.ball.x>150,`complete AI chain did not create depth: ${target.x-e.ball.x}`);
});

test('away striker behaviour mirrors correctly and remains advanced',()=>{
  const e=engine('mirror-nine');e.restart.active=false;for(const p of e.players.filter(p=>p.team===0)){if(p.role==='GK'){p.x=FIELD.left+28;continue;}p.x=310-(p.slot%3)*12;}const st=e.players.find(p=>p.team===1&&p.role==='ST'),cm=e.players.find(p=>p.team===1&&p.role==='CM');Object.assign(e.ball,{x:670,y:390,vx:0,vy:0,lastTeam:1,lastPlayerId:cm.id,lastTouchTick:e.tick});const target=e.aiTarget(st,e.selectPressers(1),cm,1),limit=onsideLimit(e,1);
  assert.ok(target.x<FIELD.centerX-90,`away ST stayed too deep: ${target.x}`);
  assert.ok(e.ball.x-target.x>150,`away ST did not attack depth: ${e.ball.x-target.x}`);
  assert.ok(target.x>=limit+2,`away ST crossed onside limit ${limit}: ${target.x}`);
});

test('high-dribbling attacker still has selective 1v1 appetite without making dribble the default',()=>{
  const e=engine('one-v-one');e.restart.active=false;const st=e.players.find(p=>p.team===0&&p.role==='ST'),def=e.players.find(p=>p.team===1&&p.role==='CB');st.x=690;st.y=350;def.x=686;def.y=384;for(const o of e.players.filter(p=>p.team===1&&p.id!==def.id)){o.x=900;o.y=80+(o.slot%6)*90;}Object.assign(e.ball,{x:st.x+st.r+e.ball.r-1,y:st.y,vx:0,vy:0,lastTeam:0,lastPlayerId:st.id,lastTouchTick:e.tick});st.decisionCooldown=0;st.kickIntent=null;st.dribbleIntent=null;
  let attempts=0;for(let block=0;block<12;block++){e.tick=block*28;st.decisionCooldown=0;st.kickIntent=null;st.dribbleIntent=null;if(shouldAttackOneVOne(e,st))attempts++;}
  assert.ok(attempts>=2,`attacker never chooses 1v1: ${attempts}/12`);
  assert.ok(attempts<=10,`dribble became automatic again: ${attempts}/12`);
});
