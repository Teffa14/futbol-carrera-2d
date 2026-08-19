import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchEngine} from '../engine.js';
import '../kick-direction.js';
import '../ball-priority.js';
import '../anti-cluster.js';
import '../positional-ai.js';
import {nearbyPlayableEdges,feasibleContactTarget,playerIdentity,__boundaryTest} from '../boundary-intelligence.js';

const roles=['GK','RB','CB','CB','LB','CDM','CM','CAM','RW','ST','LW'];
function lineup(prefix){return roles.map((role,i)=>({instanceId:`${prefix}-${i}`,id:`${prefix}-${i}`,name:`${prefix} ${role} ${i}`,position:role,engineRole:role,rating:72,pace:72,shooting:68,passing:72,dribbling:73,defense:68,physical:70,ballControl:74,vision:72,stamina:74,composure:71,fitness:100,skills:[],instructions:{risk:50,shoot:50,dribble:58}}));}
function engine(seed='boundary-test'){const e=new MatchEngine(lineup('home'),lineup('away'),{seed});e.restart.active=false;e.minute=1;return e;}
function near(a,b,t=1){assert.ok(Math.abs(a-b)<=t,`${a} not within ${t} of ${b}`);}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
const F=__boundaryTest.FIELD;

const boundaryCases=[
  ['top',{x:F.centerX,y:F.top+5},'top'],
  ['bottom',{x:F.centerX,y:F.bottom-5},'bottom'],
  ['left',{x:F.left+5,y:210},'left'],
  ['right',{x:F.right-5,y:490},'right'],
  ['top-left',{x:F.left+5,y:F.top+5},'top'],
  ['top-right',{x:F.right-5,y:F.top+5},'top'],
  ['bottom-left',{x:F.left+5,y:F.bottom-5},'bottom'],
  ['bottom-right',{x:F.right-5,y:F.bottom-5},'bottom']
];

test('all four closed boundaries are playable and goal mouths remain open',()=>{
  for(const [name,ball,expected] of boundaryCases){
    const edges=nearbyPlayableEdges({...ball,r:5},20).map(x=>x.edge);
    assert.ok(edges.includes(expected),`${name} should expose ${expected}`);
  }
  const leftGoal=nearbyPlayableEdges({x:F.left+5,y:F.centerY,r:5},20).map(x=>x.edge);
  const rightGoal=nearbyPlayableEdges({x:F.right-5,y:F.centerY,r:5},20).map(x=>x.edge);
  assert.equal(leftGoal.includes('left'),false,'left goal mouth must not be treated as a wall');
  assert.equal(rightGoal.includes('right'),false,'right goal mouth must not be treated as a wall');
});

test('boundary safety no longer creates an artificial 34px exclusion zone',()=>{
  const e=engine(),p=e.players.find(x=>x.team===0&&x.role==='RW');
  const r=p.r;
  assert.deepEqual(e.boundarySafeTarget(p,{x:F.left+r,y:F.top+r}),{x:F.left+r,y:F.top+r});
  assert.deepEqual(e.boundarySafeTarget(p,{x:F.right-r,y:F.bottom-r}),{x:F.right-r,y:F.bottom-r});
});

test('a feasible physical contact point exists on every wall and corner',()=>{
  for(const [name,ball] of boundaryCases){
    const e=engine(`contact-${name}`),p=e.players.find(x=>x.team===0&&x.role==='RW');
    Object.assign(e.ball,{...ball,vx:0,vy:0,r:5});
    p.x=clampForTest(ball.x-45,F.left+p.r,F.right-p.r);p.y=clampForTest(ball.y+45,F.top+p.r,F.bottom-p.r);
    const target=feasibleContactTarget(e,p,{x:e.ball.x+90,y:e.ball.y});
    const contact=p.r+e.ball.r-.7;
    near(distance(target,e.ball),contact,1.2);
    assert.ok(target.x>=F.left+p.r-.01&&target.x<=F.right-p.r+.01,`${name} contact x must be physical`);
    assert.ok(target.y>=F.top+p.r-.01&&target.y<=F.bottom-p.r+.01,`${name} contact y must be physical`);
  }
});

test('opposing actors do not mirror the same contact point at a touchline',()=>{
  const e=engine('opposite-wall-lanes'),a=e.players.find(x=>x.team===0&&x.role==='RW'),b=e.players.find(x=>x.team===1&&x.role==='RW');
  Object.assign(e.ball,{x:550,y:F.top+5,vx:0,vy:0,r:5});
  a.x=505;a.y=76;b.x=595;b.y=76;
  const ta=e.aiTarget(a,[],a,null),tb=e.aiTarget(b,[],b,null);
  assert.ok(ta.x<e.ball.x-2,`home actor should get behind ball for rightward attack: ${ta.x}`);
  assert.ok(tb.x>e.ball.x+2,`away actor should get behind ball for leftward attack: ${tb.x}`);
  assert.ok(distance(ta,tb)>12,'opponents must not select the same mirrored coordinate');
});

test('actors can physically reach left and right endlines outside the goal mouth',()=>{
  for(const side of ['left','right']){
    const e=engine(`endline-${side}`),team=side==='right'?0:1,p=e.players.find(x=>x.team===team&&x.role==='RW');
    const x=side==='right'?F.right-5:F.left+5;
    Object.assign(e.ball,{x,y:205,vx:0,vy:0,r:5,lastTeam:null,lastPlayerId:null});
    p.x=x+(side==='right'?-48:48);p.y=225;p.vx=p.vy=0;
    let best=999;
    for(let i=0;i<180;i++){const target=e.aiTarget(p,[],p,null);e.movePlayer(p,target,.016,false);best=Math.min(best,distance(p,e.ball));}
    assert.ok(best<=p.r+e.ball.r+3,`${side} endline actor stopped short: ${best}`);
  }
});

test('role-aware off-ball targets use touchline and byline as playable space',()=>{
  const e=engine('role-boundary-space');
  const rw=e.players.find(x=>x.team===0&&x.role==='RW'),cm=e.players.find(x=>x.team===0&&x.role==='CM'),cb=e.players.find(x=>x.team===0&&x.role==='CB');
  Object.assign(e.ball,{x:F.right-90,y:F.top+22,vx:0,vy:0,r:5,lastTeam:0,lastPlayerId:'home-9',lastTouchTick:e.tick});
  const actor=e.players.find(x=>x.team===0&&x.role==='ST');
  const trw=e.aiTarget(rw,[],actor,0),tcm=e.aiTarget(cm,[],actor,0),tcb=e.aiTarget(cb,[],actor,0);
  assert.ok(trw.y<120,`wide forward should be willing to hug the upper line: ${trw.y}`);
  assert.ok(trw.x>tcm.x+45,`wide forward should attack deeper byline space: ${trw.x} vs ${tcm.x}`);
  assert.ok(tcm.x>tcb.x+20,`midfielder and centre-back should not share depth: ${tcm.x} vs ${tcb.x}`);
  assert.ok(distance(trw,tcm)>45&&distance(tcm,tcb)>25,'role targets must remain distinct');
});

test('player positional identities are deterministic but multidimensional and individual',()=>{
  const e=engine('identity');
  const a=e.players.find(x=>x.team===0&&x.role==='CB'),b=e.players.filter(x=>x.team===0&&x.role==='CB')[1];
  const ia=playerIdentity(a),again=playerIdentity(a),ib=playerIdentity(b);
  assert.deepEqual(ia,again);
  const differing=Object.keys(ia).filter(k=>Math.abs(ia[k]-ib[k])>.02);
  assert.ok(differing.length>=3,`same-role players need independent identities, got ${differing}`);
});

test('a prolonged blocked edge sequence switches to a physical bank instead of endless REGATE',()=>{
  const e=engine('forced-bank'),p=e.players.find(x=>x.team===0&&x.role==='RW'),o=e.players.find(x=>x.team===1&&x.role==='LB');
  Object.assign(e.ball,{x:620,y:F.top+5,vx:0,vy:0,r:5,lastTeam:0,lastPlayerId:p.id,lastTouchTick:e.tick});
  p.x=606;p.y=F.top+p.r;p.vx=p.vy=0;p.decisionCooldown=0;p.dribbleIntent=null;p.kickIntent=null;
  o.x=626;o.y=F.top+o.r;o.vx=o.vy=0;
  p._edgeStall={key:'top',x:e.ball.x,y:e.ball.y,tick:e.tick-8,stuck:24};
  e.prepareBallAction(p);
  assert.equal(p.boundaryPlay?.kind,'bank');
  assert.equal(p.kickIntent?.type,'wall');
  assert.ok(p.kickIntent.aimY<F.top,'top-wall bank must aim physically into the wall');
  assert.equal(p.dribbleIntent,null,'wall plan must suppress another repeated dribble');
});

test('edge and corner stress scenarios resolve before they can become long stalls',()=>{
  for(const [name,ball] of boundaryCases){
    const e=engine(`stress-${name}`),a=e.players.find(x=>x.team===0&&x.role==='RW'),b=e.players.find(x=>x.team===1&&x.role==='RW');
    Object.assign(e.ball,{...ball,vx:0,vy:0,r:5,lastTeam:0,lastPlayerId:a.id,lastTouchTick:e.tick});
    const inwardX=ball.x<F.centerX?1:-1,inwardY=ball.y<F.centerY?1:-1;
    a.x=clampForTest(ball.x+inwardX*23,F.left+a.r,F.right-a.r);a.y=clampForTest(ball.y+inwardY*23,F.top+a.r,F.bottom-a.r);a.vx=a.vy=0;
    b.x=clampForTest(ball.x+inwardX*28+(ball.y<F.centerY?12:-12),F.left+b.r,F.right-b.r);b.y=clampForTest(ball.y+inwardY*27,F.top+b.r,F.bottom-b.r);b.vx=b.vy=0;
    let maxFrozen=0,frozen=0,maxTravel=0,start={x:e.ball.x,y:e.ball.y};
    for(let i=0;i<520&&!e.finished;i++){
      e.step(.016);
      const speed=Math.hypot(e.ball.vx,e.ball.vy),nearActors=Math.min(...e.players.filter(p=>p.role!=='GK').map(p=>distance(p,e.ball)));
      if(speed<.045&&nearActors<28)frozen++;else frozen=0;
      maxFrozen=Math.max(maxFrozen,frozen);maxTravel=Math.max(maxTravel,distance(e.ball,start));
    }
    assert.ok(maxFrozen<190,`${name} stayed locally frozen for ${maxFrozen} frames`);
    assert.ok(maxTravel>8,`${name} never produced meaningful ball movement: ${maxTravel}`);
  }
});

function clampForTest(v,a,b){return Math.max(a,Math.min(b,v));}
