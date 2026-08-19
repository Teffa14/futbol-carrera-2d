import test from 'node:test';
import assert from 'node:assert/strict';
import '../kick-direction.js';
import '../ball-priority.js';
import '../anti-cluster.js';
import {MatchEngine} from '../engine.js';

const roles=['GK','RB','CB','CB','LB','CDM','CM','CAM','RW','ST','LW'];
function lineup(prefix){return roles.map((role,i)=>({instanceId:`${prefix}-${i}`,id:`${prefix}-${i}`,name:`${prefix}${i}`,engineRole:role,position:role,rating:70,pace:70,shooting:65,passing:70,dribbling:70,defense:65,physical:70,ballControl:70,vision:70,stamina:75,composure:70,fitness:100,skills:[],instructions:{risk:50,shoot:50,dribble:50},build:'creator'}));}
function build(seed='anti-cluster'){const e=new MatchEngine(lineup('a'),lineup('b'),{seed});e.restart.active=false;return e;}
function isolate(engine,keep){for(const p of engine.players)if(!keep.includes(p)){p.x=p.team===0?100:1000;p.y=620;p.homeX=p.x;p.homeY=p.y;p.vx=0;p.vy=0;}}
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('opposing loose-ball actors in body contact take opposite lanes toward the ball',()=>{
  const e=build('opposite-lanes'),a=e.players.find(p=>p.team===0&&p.role!=='GK'),b=e.players.find(p=>p.team===1&&p.role!=='GK');
  isolate(e,[a,b]);
  a.x=500;a.y=350;a.homeX=420;a.homeY=350;b.x=518;b.y=350;b.homeX=680;b.homeY=350;
  e.ball.x=509;e.ball.y=270;e.ball.vx=0;e.ball.vy=0;
  const ta=e.aiTarget(a,[a.id],a,null),tb=e.aiTarget(b,[b.id],b,null);
  assert.ok(d(ta,e.ball)<d(a,e.ball),'team 0 actor must make progress toward the free ball');
  assert.ok(d(tb,e.ball)<d(b,e.ball),'team 1 actor must make progress toward the free ball');
  assert.ok((ta.x-a.x)*(tb.x-b.x)<0,'contacted rivals must choose opposite lateral lanes instead of running together');
});

test('a non-actor near a divided ball keeps support spacing instead of joining the same chase point',()=>{
  const e=build('support-spacing'),actor=e.players.find(p=>p.team===0&&p.role==='CM'),mate=e.players.find(p=>p.team===0&&p.role==='CAM'),opp=e.players.find(p=>p.team===1&&p.role==='CM');
  isolate(e,[actor,mate,opp]);
  e.ball.x=520;e.ball.y=350;actor.x=500;actor.y=350;mate.x=565;mate.y=350;mate.homeX=720;mate.homeY=470;opp.x=530;opp.y=410;
  const target=e.aiTarget(mate,[actor.id,mate.id],actor,null);
  assert.ok(d(target,e.ball)>d(mate,e.ball),'off-ball teammate must open away rather than collapse onto the divided ball');
});

test('ball action logic cannot announce dribble before physical-touch range',()=>{
  const e=build('no-remote-regate'),p=e.players.find(x=>x.team===0&&x.role==='CM'),opp=e.players.find(x=>x.team===1&&x.role==='CM');
  isolate(e,[p,opp]);
  p.x=400;p.y=350;opp.x=420;opp.y=350;e.ball.x=444;e.ball.y=350;e.ball.vx=0;e.ball.vy=0;p.decisionCooldown=0;
  const before=e.stats.dribbles[p.team];
  e.prepareBallAction(p);
  assert.equal(p.dribbleIntent,null);
  assert.equal(p.kickIntent,null);
  assert.equal(e.stats.dribbles[p.team],before,'REGATE must not be counted from 40+ px away');
});

test('the same defender cannot trigger infinite repeated skill-move attempts',()=>{
  const e=build('repeat-regate'),p=e.players.find(x=>x.team===0&&x.role==='CM'),opp=e.players.find(x=>x.team===1&&x.role==='CM');
  isolate(e,[p,opp]);
  p.x=400;p.y=350;opp.x=420;opp.y=350;e.ball.x=414;e.ball.y=350;
  e.startDribble(p,opp);
  const first=e.stats.dribbles[p.team];
  p.dribbleIntent=null;p.kickIntent=null;p.action='';e.tick+=8;
  e.startDribble(p,opp);
  assert.equal(e.stats.dribbles[p.team],first,'repeating the same blocked 1v1 must switch plan instead of counting another REGATE');
  assert.notEqual(p.action,'regate');
});
