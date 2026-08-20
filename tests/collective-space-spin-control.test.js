import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PLAYER_RADIUS} from '../football-rules-v2.js';
import {closeControlOrbitVelocity} from '../close-control-orbit-v1.js';
import {openPlaySpinPlan} from '../open-play-spin-v1.js';
import {predictBallPath} from '../trajectory-core-v1.js';
import {collectiveShapeTarget,bestAttackingSpace,postPassRunTarget,crossTrajectoryTarget,isPresser} from '../collective-space-play-v1.js';

const data=(extra={})=>({pace:74,shooting:72,passing:74,dribbling:72,ballControl:75,composure:74,stamina:74,physical:70,vision:72,...extra});
const player=(id,team,role,x,y,extra={})=>({id,team,role,x,y,vx:0,vy:0,r:PLAYER_RADIUS,data:data(extra),homeX:x,homeY:y});

test('close control can orbit a contacted ball tangentially instead of snapping or rebounding it straight back',()=>{
  const out=closeControlOrbitVelocity({ballVx:1.2,ballVy:0,playerVx:.7,playerVy:0,radialX:-1,radialY:0,exitX:1,exitY:0,quality:86});
  assert.ok(Math.abs(out.vy)>.08,'opposite-side control should create a tangential component');
  assert.ok(out.release<.2,'high control should keep the radial release small');
  assert.ok(out.needTurn>.9);
});

test('high-technique wide open-play shots can choose physical spin while weak technique does not force it',()=>{
  const ball={x:710,y:505},aim={x:1073,y:320},good=player('good',0,'RW',700,510,{shooting:86,ballControl:88,composure:84}),weak=player('weak',0,'RW',700,510,{shooting:38,ballControl:40,composure:42});
  const plan=openPlaySpinPlan(good,ball,aim,'shot',{}),none=openPlaySpinPlan(weak,ball,aim,'shot',{});assert.ok(plan);assert.ok(Math.abs(plan.spin)>.2);assert.notDeepEqual(plan.initialAim,aim);assert.equal(none,null);
});

test('trajectory prediction follows the same spin instead of sending runners to the old straight path',()=>{
  const straight=predictBallPath({x:650,y:500,vx:5.8,vy:-.35,r:4.35,spin:0},{horizonFrames:60,sampleEvery:2}),curved=predictBallPath({x:650,y:500,vx:5.8,vy:-.35,r:4.35,spin:-.55},{horizonFrames:60,sampleEvery:2});
  assert.ok(Math.abs(curved.at(-1).y-straight.at(-1).y)>18);
});

test('the whole block advances in possession and retreats together when defending danger',()=>{
  const cb=player('cb',0,'CB',300,350),st=player('st',0,'ST',680,350),defs=[player('d1',1,'CB',790,300),player('d2',1,'CB',820,400),player('gk',1,'GK',1015,350)],engine={ball:{x:780,y:330},players:[cb,st,...defs]};
  const attack=collectiveShapeTarget(engine,cb,{x:cb.x,y:cb.y},0);assert.ok(attack.x>cb.x+45,'centre back should squeeze forward with the attacking block');
  engine.ball.x=190;const defend=collectiveShapeTarget(engine,cb,{x:cb.x,y:cb.y},1);assert.ok(defend.x<cb.x-45,'centre back should retreat with the defending block');
});

test('off-ball attackers choose arrival-time space rather than a fixed positional cell',()=>{
  const p=player('runner',0,'ST',545,360),mate=player('mate',0,'CM',500,260),defs=[player('d1',1,'CB',760,300,{pace:62}),player('d2',1,'CB',805,420,{pace:68}),player('gk',1,'GK',1015,350)],engine={ball:{x:535,y:350},players:[p,mate,...defs]};
  const target=bestAttackingSpace(engine,p,mate);assert.ok(target.x>engine.ball.x);assert.ok(Number.isFinite(target.arrivalAdvantage));assert.ok(Math.abs(target.y-engine.ball.y)>20,'space search should consider diagonal lanes');
});

test('passer continues into a new lane after releasing the ball',()=>{
  const p=player('passer',0,'CM',430,390),receiver=player('receiver',0,'RW',565,310),engine={ball:{x:440,y:390},players:[p,receiver,player('d1',1,'CB',760,300),player('d2',1,'CB',800,400)]};const target=postPassRunTarget(engine,p,receiver,'wall');
  assert.ok(target.x>receiver.x+80);assert.ok(Math.abs(target.y-receiver.y)>50);
});

test('cross runners attack the predicted ball trajectory with different jobs',()=>{
  const st=player('st',0,'ST',720,345),wing=player('wing',0,'LW',700,245),cam=player('cam',0,'CAM',665,410),defs=[player('d1',1,'CB',855,320),player('d2',1,'CB',875,405),player('gk',1,'GK',1015,360)],engine={tick:60,ball:{x:760,y:535,vx:5.6,vy:-1.25,r:4.35,spin:-.32,flightKind:'cross',flightStartedTick:52,flightAttackingTeam:0,flightReceiverId:'st'},players:[st,wing,cam,...defs]};
  const a=crossTrajectoryTarget(engine,st),b=crossTrajectoryTarget(engine,wing),c=crossTrajectoryTarget(engine,cam);assert.ok(a&&b&&c);assert.notDeepEqual([a.x,a.y],[b.x,b.y]);assert.notDeepEqual([b.x,b.y],[c.x,c.y]);assert.ok(a.x>st.x);
});

test('presser detection preserves both id arrays and player-object arrays',()=>{const p=player('press',0,'CM',0,0);assert.equal(isPresser(p,['press']),true);assert.equal(isPresser(p,[{id:'press'}]),true);});

test('effective pitch scale gives players more usable football space and training consumes shared space logic',()=>{
  assert.ok(PLAYER_RADIUS<7.25);const small=fs.readFileSync(new URL('../training-small-sided-v8.js',import.meta.url),'utf8'),transfer=fs.readFileSync(new URL('../training-transfer-v1.js',import.meta.url),'utf8'),index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(small,/bestAttackingSpace/);assert.match(transfer,/crossTrajectoryTarget/);assert.ok(index.indexOf("./collective-space-play-v1.js")<index.indexOf("./app.js"));
});