import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {preRunHoldPoint,canReleaseTimedPass,liveOffsideLine} from '../through-run-timing-v2.js';
import {stageContinuousFreeKick} from '../restart-continuity-v1.js';
import {orientedReceptionVelocity} from '../oriented-reception-v2.js';
import {freeKickPlan,applySpinVelocity} from '../set-piece-curve-v1.js';
import {repairSecondDivisionCareer,hasForeignLeagueFixture} from '../competition-integrity-v1.js';

function throughEngine(){
  const runner={id:'runner',team:0,role:'ST',x:795,y:350,vx:3,vy:0,r:7.25,data:{},receiveIntent:{kind:'through',aimX:900,aimY:350,waitForKick:true,createdTick:20}};
  const players=[runner,{id:'d1',team:1,role:'CB',x:800,y:300,r:7.25,data:{}},{id:'d2',team:1,role:'CB',x:835,y:400,r:7.25,data:{}},{id:'gk',team:1,role:'GK',x:1020,y:350,r:7.25,data:{}}];
  return{ball:{x:620,y:350},players,playerById:id=>players.find(p=>p.id===id)};
}

test('through runner brakes behind the live offside line until the pass is physically struck',()=>{
  const e=throughEngine(),p=e.players[0],line=liveOffsideLine(e,0),hold=preRunHoldPoint(e,p,p.receiveIntent);assert.equal(line,835);assert.ok(hold.x<line-8);assert.ok(hold.x>p.x);
  const kick={type:'pass',passKind:'through',receiverId:'runner'};p.x=839;assert.equal(canReleaseTimedPass(e,{kickIntent:kick},kick),false);p.x=830;assert.equal(canReleaseTimedPass(e,{kickIntent:kick},kick),true);
});

test('offside restart stages the free kick without teleporting any defender',()=>{
  const players=[{id:'a',team:0,role:'ST',x:700,y:330,vx:1,vy:0,kickIntent:{},dribbleIntent:null,receiveIntent:null},{id:'d',team:1,role:'CB',x:760,y:360,vx:-1,vy:0,kickIntent:null,dribbleIntent:null,receiveIntent:null},{id:'d2',team:1,role:'CM',x:820,y:420,vx:0,vy:0,kickIntent:null,dribbleIntent:null,receiveIntent:null}];
  const e={players,ball:{x:705,y:330,vx:3,vy:0,r:4.35},tick:90,lastPossessionTeam:0,restart:null,pendingOffside:{},pushEvent(){}};const before=players.map(p=>[p.x,p.y]);assert.equal(stageContinuousFreeKick(e,1,705,330,{reason:'Offside'}),true);assert.deepEqual(players.map(p=>[p.x,p.y]),before);assert.equal(e.restart.kind,'free-kick');assert.equal(e.restart.continuous,true);
});

test('oriented reception routes a behind-body service around the player instead of knocking it backward',()=>{
  const out=orientedReceptionVelocity({ballVx:4.8,ballVy:0,playerVx:1.0,playerVy:0,normalX:-1,normalY:0,exitX:1,exitY:0,quality:84});assert.ok(out.vx>0);assert.ok(out.path.x>0);assert.ok(Math.abs(out.path.y)>.4);assert.ok(out.release<1.2);
});

test('free kick starts outside the wall and spin bends the velocity back toward the chosen corner',()=>{
  const p={team:0,role:'CAM',data:{shooting:82,ballControl:78,composure:80}},wall=[305,335,365,395].map((y,i)=>({id:`w${i}`,team:1,role:'CB',x:755,y,data:{}})),gk={id:'gk',team:1,role:'GK',x:1018,y:375,data:{}};const e={ball:{x:532,y:350},players:[p,...wall,gk]};const target={x:1073,y:319},plan=freeKickPlan(e,p,target);assert.ok(plan.initialAim.y<target.y,`${plan.initialAim.y} should start above ${target.y}`);assert.ok(plan.spin>0);
  const d=Math.hypot(plan.initialAim.x-e.ball.x,plan.initialAim.y-e.ball.y);let vx=(plan.initialAim.x-e.ball.x)/d*7.6,vy=(plan.initialAim.y-e.ball.y)/d*7.6,spin=plan.spin,initialVy=vy;for(let i=0;i<45;i++){const n=applySpinVelocity(vx,vy,spin,1/60);vx=n.vx;vy=n.vy;spin=n.spin;}assert.ok(vy>initialVy,'Magnus rotation must bend the shot back down toward the target');
});

test('a B career cannot keep Newells or any Primera club in its league schedule',()=>{
  const state={clubId:'b-nueva-chicago',countryId:'ARB',season:1,week:2,seasonComplete:false,schedule:[{week:1,fixtures:[{id:'bad',home:'b-nueva-chicago',away:'newells',played:false,score:null}]},{week:2,fixtures:[{id:'good',home:'b-nueva-chicago',away:'b-chacarita',played:true,score:[1,0]}]}],table:[]};assert.equal(hasForeignLeagueFixture(state),true);const out=repairSecondDivisionCareer(state);assert.equal(out.changed,true);assert.equal(hasForeignLeagueFixture(out.state),false);assert.equal(out.state.countryId,'ARB');const preserved=out.state.schedule.flatMap(r=>r.fixtures).find(f=>f.home==='b-nueva-chicago'&&f.away==='b-chacarita');assert.deepEqual(preserved?.score,[1,0]);assert.equal(preserved?.played,true);assert.equal(out.state.schedule.flatMap(r=>r.fixtures).some(f=>f.home==='newells'||f.away==='newells'),false);
});

test('potrero UI removes lime SaaS chips and keeps training pitch plus scores plus commentary in one grid',()=>{
  const css=fs.readFileSync(new URL('../potrero-ui-v2.js',import.meta.url),'utf8'),index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.equal(css.includes('#d8ff4c'),false);assert.match(css,/\.pill,.pc-pill,.session-pill,.training-engine-pill/);assert.match(css,/border-radius:0!important/);assert.match(css,/grid-template-areas:\"head head\" \"progress meta\" \"stage report\" \"stage status\" \"stage comments\"/);assert.match(css,/RELATO DEL ENTRENAMIENTO/);assert.match(css,/training-commentary/);assert.ok(index.indexOf("./potrero-ui-v2.js")>index.indexOf("./precareer-entry-ui-v2.js"));
});
