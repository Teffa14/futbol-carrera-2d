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
import {FIELD,PLAYER_RADIUS,BALL_RADIUS,isOffsidePosition,onsideLimit} from '../football-rules-v2.js';
import {motionProfile,goalkeeperTarget} from '../locomotion-v2.js';
import {positionalIdentity,__agentBrainTest} from '../agent-brain-v2.js';
import {evaluatePassOptions,armIntentPass,__passingTest} from '../passing-intelligence-v2.js';

const roles=['GK','RB','CB','CB','LB','CDM','CM','CAM','RW','ST','LW'];
function player(prefix,role,i,overrides={}){return{instanceId:`${prefix}-${i}`,id:`${prefix}-${i}`,name:`${prefix} ${role} ${i}`,position:role,engineRole:role,rating:72,pace:70,shooting:66,passing:70,dribbling:70,defense:66,physical:68,ballControl:71,vision:70,stamina:72,composure:70,fitness:100,skills:[],instructions:{risk:50,shoot:50,dribble:55},...overrides};}
function lineup(prefix,overrides={}){return roles.map((r,i)=>player(prefix,r,i,typeof overrides==='function'?overrides(r,i):overrides));}
function engine(seed='brain'){const e=new MatchEngine(lineup('home'),lineup('away'),{seed,userId:'home-9'});return e;}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}

test('kickoff keeps every non-kicker inside its own half',()=>{
  const e=engine('kickoff-law'),kicker=e.playerById(e.restart.kickerId);
  assert.ok(kicker);
  for(const p of e.players){if(p.id===kicker.id)continue;if(p.team===0)assert.ok(p.x<FIELD.centerX,`home ${p.role} crossed halfway at ${p.x}`);else assert.ok(p.x>FIELD.centerX,`away ${p.role} crossed halfway at ${p.x}`);}
});

test('football footprint is smaller so 22 players have more usable space',()=>{
  const e=engine('footprint');
  assert.ok(e.players.every(p=>Math.abs(p.r-PLAYER_RADIUS)<.01));
  assert.ok(Math.abs(e.ball.r-BALL_RADIUS)<.01);
  assert.ok(PLAYER_RADIUS<8&&BALL_RADIUS<4.6);
});

test('pace produces visibly different acceleration and sprint behaviour',()=>{
  const e=new MatchEngine(lineup('home',(r,i)=>i===6?{pace:94,dribbling:82,ballControl:82,stamina:88}:i===7?{pace:52,dribbling:55,ballControl:56,stamina:60}:{}),lineup('away'),{seed:'speed-gap'});e.restart.active=false;
  const fast=e.players.find(p=>p.id==='home-6'),slow=e.players.find(p=>p.id==='home-7');fast.x=300;fast.y=230;slow.x=300;slow.y=470;fast.vx=fast.vy=slow.vx=slow.vy=0;
  const f0={x:fast.x,y:fast.y},s0={x:slow.x,y:slow.y};for(let i=0;i<45;i++){e.movePlayer(fast,{x:900,y:230},.016,false);e.movePlayer(slow,{x:900,y:470},.016,false);}
  const fd=distance(fast,f0),sd=distance(slow,s0),fs=Math.hypot(fast.vx,fast.vy),ss=Math.hypot(slow.vx,slow.vy);
  assert.ok(fd>sd*1.12,`fast distance ${fd} should materially exceed slow ${sd}`);assert.ok(fs>ss*1.08,`fast speed ${fs} should exceed slow ${ss}`);
});

test('goalkeeper does not charge to the penalty-area edge just because an attacker is nearby',()=>{
  const e=engine('keeper-discipline');e.restart.active=false;const gk=e.players.find(p=>p.team===0&&p.role==='GK');Object.assign(e.ball,{x:FIELD.left+155,y:FIELD.centerY,vx:0,vy:0});const target=goalkeeperTarget(e,gk);
  assert.ok(target.x<=FIELD.left+82,`keeper target too aggressive: ${target.x}`);assert.ok(target.y>=FIELD.goalTop&&target.y<=FIELD.goalBottom);
});

test('pass planner recognises through balls, switches, crosses and cutbacks',()=>{
  const e=engine('pass-kinds'),p=e.players.find(x=>x.team===0&&x.role==='CM'),m=e.players.find(x=>x.team===0&&x.role==='ST');e.restart.active=false;
  p.x=400;p.y=350;m.x=560;m.y=350;for(const o of e.players.filter(x=>x.team===1)){o.x=900;o.y=70+(o.slot%6)*95;}Object.assign(e.ball,{x:p.x+12,y:p.y});let option=evaluatePassOptions(e,p).find(x=>x.player.id===m.id);assert.ok(['through','lob-through'].includes(option?.kind),`expected through pass, got ${option?.kind}`);
  const kinds=__passingTest.passKindFor;
  assert.equal(kinds({team:0,x:500,y:80},{x:540,y:600},525,40,60),'switch');
  assert.equal(kinds({team:0,x:920,y:75},{x:955,y:350},280,35,60),'cross');
  assert.equal(kinds({team:0,x:980,y:80},{x:860,y:350},295,-120,60),'cutback');
});

test('offside is evaluated at the kick line, not ignored',()=>{
  const e=engine('offside-position');e.restart.active=false;const r=e.players.find(p=>p.team===0&&p.role==='ST');for(const o of e.players.filter(p=>p.team===1)){o.x=o.role==='GK'?1015:720;}e.ball.x=610;r.x=790;
  assert.equal(isOffsidePosition(e,r),true);r.x=690;assert.equal(isOffsidePosition(e,r),false);assert.ok(onsideLimit(e,0)<=720);
});

test('lofted through pass gains physical height and can travel above ground duels',()=>{
  const e=engine('loft'),p=e.players.find(x=>x.team===0&&x.role==='CM'),r=e.players.find(x=>x.team===0&&x.role==='ST');e.restart.active=false;p.x=400;p.y=350;r.x=570;r.y=350;Object.assign(e.ball,{x:p.x+p.r+e.ball.r-.4,y:p.y,vx:0,vy:0,z:0,vz:0});p.facingX=1;p.facingY=0;
  armIntentPass(e,p,{player:r,kind:'lob-through',aim:{x:650,y:350},distance:250,score:1,loft:true});const ok=e.executeKick(p,{x:1,y:0});assert.equal(ok,true);assert.ok(e.ball.vz>.4&&e.ball.z>0);for(let i=0;i<8;i++)e.updateFreeBall(.016);assert.ok(e.ball.z>2,'lob should still be airborne');
});

test('offside receiver touching the pass produces a defending free kick',()=>{
  const e=engine('offside-whistle');e.restart.active=false;const r=e.players.find(p=>p.team===0&&p.role==='ST');e.pendingOffside={attackingTeam:0,receiverId:r.id,kickTick:e.tick-1,x:r.x,y:r.y};e.registerPhysicalTouch(r,'touch');assert.equal(e.pendingOffside,null);assert.equal(e.restart.active,true);assert.equal(e.restart.kind,'free-kick');assert.equal(e.restart.team,1);assert.equal(e.events[0]?.text,'Offside');
});

test('same-role agents have distinct deterministic positional identities and decision cadence',()=>{
  const e=engine('identities'),cbs=e.players.filter(p=>p.team===0&&p.role==='CB');const a=positionalIdentity(cbs[0]),b=positionalIdentity(cbs[1]);assert.deepEqual(a,positionalIdentity(cbs[0]));const differences=Object.keys(a).filter(k=>Math.abs(a[k]-b[k])>.02);assert.ok(differences.length>=3,`identities insufficiently distinct: ${differences}`);
});

test('spatial scoring values arrival advantage instead of distance alone',()=>{
  const target={x:500,y:350};
  const runner={x:430,y:350,vx:3.4,vy:0,facingX:1,facingY:0,team:0,data:{pace:88,stamina:84,physical:72,dribbling:80,ballControl:80,vision:76,composure:74,defense:55,fitness:100}};
  const defenderReady={x:445,y:350,vx:0,vy:0,facingX:1,facingY:0,team:1,data:{pace:78,stamina:78,physical:74,dribbling:62,ballControl:66,vision:65,composure:68,defense:80,fitness:100}};
  const defenderWrongFooted={...defenderReady,vx:-3.1,facingX:-1};
  const tight=__agentBrainTest.dynamicSpaceAdvantage(runner,[defenderReady],target),open=__agentBrainTest.dynamicSpaceAdvantage(runner,[defenderWrongFooted],target);
  assert.ok(open>tight+.15,`wrong-footed defender should concede more dynamic space: ${open} vs ${tight}`);
});

test('full 90 minute simulation produces actual football actions instead of a dribble loop',()=>{
  const e=new MatchEngine(lineup('home',(r,i)=>({pace:62+(i*7)%28,passing:62+(i*9)%30,vision:60+(i*11)%32,dribbling:58+(i*13)%34,shooting:55+(i*8)%34,ballControl:60+(i*10)%31})),lineup('away',(r,i)=>({pace:60+(i*9)%31,passing:60+(i*8)%31,vision:58+(i*12)%34,dribbling:57+(i*11)%35,shooting:54+(i*10)%35,ballControl:59+(i*7)%33})),{seed:'full-football-sanity'});
  for(let i=0;i<7000&&!e.finished;i++)e.step(.016);assert.equal(e.finished,true);const s=e.stats,totalPasses=s.passes[0]+s.passes[1],totalShots=s.shots[0]+s.shots[1],totalDribbles=s.dribbles[0]+s.dribbles[1];assert.ok(totalPasses>=10,`too few passes: ${totalPasses}`);assert.ok(totalShots>=1,`no shots produced`);assert.ok(totalDribbles<=totalPasses*3+12,`dribble loop returned: ${totalDribbles} dribbles vs ${totalPasses} passes`);
});

test('motion profiles are not one shared speed preset',()=>{
  const a=motionProfile({id:'a',data:{pace:92,dribbling:85,ballControl:84,stamina:86,physical:72,vision:80,composure:78,defense:45}}),b=motionProfile({id:'b',data:{pace:58,dribbling:60,ballControl:62,stamina:65,physical:70,vision:64,composure:66,defense:68}});assert.ok(a.acceleration>b.acceleration+15);assert.ok(a.sprintSpeed>b.sprintSpeed+18);assert.notEqual(a.reaction,b.reaction);
});
