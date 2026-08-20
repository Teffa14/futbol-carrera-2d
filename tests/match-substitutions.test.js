import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchEngine} from '../engine.js';
import '../match-substitutions-v1.js';

const roles=['GK','RB','CB','CB','LB','CDM','CM','CAM','RW','ST','LW'];
function player(prefix,role,i,{user=false}={}){return{instanceId:user?'user-player':`${prefix}-${i}`,id:user?'user-player':`${prefix}-${i}`,name:user?'User Player':`${prefix} ${i}`,position:role,engineRole:role,rating:68,pace:68,shooting:62,passing:66,dribbling:65,defense:62,physical:66,ballControl:66,vision:65,stamina:70,composure:65,fitness:100,skills:[],isUser:user};}
function lineup(prefix,userIndex=-1){return roles.map((role,i)=>player(prefix,role,i,{user:i===userIndex}));}
function benchPlayer(id,role='CM'){return{instanceId:id,id,name:id,position:role,engineRole:role,rating:65,pace:67,shooting:61,passing:66,dribbling:64,defense:61,physical:64,ballControl:65,vision:65,stamina:76,composure:64,fitness:100,skills:[]};}
function engine(userIndex=-1){return new MatchEngine(lineup('home',userIndex),lineup('away'),{seed:'substitution-runtime',userId:'user-player'});}

test('physical substitution replaces one active circle without changing team size or role slot',()=>{
  const e=engine();
  const outgoing=e.players.find(p=>p.team===0&&p.role==='CM');
  outgoing.x=410;outgoing.y=280;outgoing.perf.touches=7;outgoing.fatigue=23;
  const beforeCount=e.players.length;
  const result=e.substitutePlayer(outgoing.id,benchPlayer('bench-cm'),{minute:67,reason:'fatigue_or_match_state'});
  assert.equal(result.ok,true);
  assert.equal(e.players.length,beforeCount);
  assert.equal(e.playerById(outgoing.id),null);
  const incoming=e.playerById('bench-cm');
  assert.ok(incoming);
  assert.equal(incoming.team,0);
  assert.equal(incoming.role,'CM');
  assert.equal(incoming.slot,outgoing.slot);
  assert.equal(incoming.x,410);assert.equal(incoming.y,280);
  assert.equal(incoming.fatigue,0);
  assert.equal(incoming.perf.touches,0);
  assert.equal(incoming.enteredMinute,67);
});

test('substitution never touches the free-ball state or introduces ownership',()=>{
  const e=engine();
  const outgoing=e.players.find(p=>p.team===0&&p.role==='RW');
  Object.assign(e.ball,{x:733,y:211,vx:4.2,vy:-1.7,lastPlayerId:'someone'});
  const snapshot={...e.ball};
  const result=e.substitutePlayer(outgoing.id,benchPlayer('bench-rw','RW'),{minute:72});
  assert.equal(result.ok,true);
  assert.deepEqual(e.ball,snapshot);
  assert.equal('ownerId' in e.ball,false);
});

test('a substituted-out user keeps only the performance accumulated before leaving',()=>{
  const e=engine(6);
  const user=e.playerById('user-player');
  user.perf.touches=19;user.perf.passesAttempted=11;user.perf.passesCompleted=9;user.perf.rating=7.24;user.fatigue=37;
  const result=e.substitutePlayer('user-player',benchPlayer('replacement-cm','CM'),{minute:63});
  assert.equal(result.ok,true);
  const perf=e.userPerformance();
  assert.equal(perf.touches,19);
  assert.equal(perf.passesAttempted,11);
  assert.equal(perf.rating,7.24);
  assert.equal(perf.staminaUsed,37);
  assert.equal(perf.exitedMinute,63);
});

test('a user entering from the bench starts a fresh performance window',()=>{
  const e=engine();
  const outgoing=e.players.find(p=>p.team===0&&p.role==='CAM');
  const user=benchPlayer('user-player','CAM');user.name='User Player';user.isUser=true;
  const result=e.substitutePlayer(outgoing.id,user,{minute:71});
  assert.equal(result.ok,true);
  const perf=e.userPerformance();
  assert.ok(perf);
  assert.equal(perf.touches,0);
  assert.equal(perf.rating,6);
  assert.equal(e.playerById('user-player').enteredMinute,71);
});

test('coach change application requires the named bench player and report exposes the change log',()=>{
  const e=engine();
  const outgoing=e.players.find(p=>p.team===1&&p.role==='ST');
  const bench=[benchPlayer('away-st','ST')];
  const missing=e.applyCoachSubstitution({outId:outgoing.id,inId:'not-there',minute:75},bench);
  assert.equal(missing.ok,false);
  const applied=e.applyCoachSubstitution({outId:outgoing.id,inId:'away-st',minute:75,reason:'freshness_and_role_fit'},bench);
  assert.equal(applied.ok,true);
  const report=e.report();
  assert.equal(report.substitutions.length,1);
  assert.deepEqual(report.substitutions[0],{
    minute:75,team:1,role:'ST',outId:outgoing.id,outName:outgoing.data.name,inId:'away-st',inName:'away-st',reason:'freshness_and_role_fit'
  });
});

test('used players cannot re-enter and goalkeeper role integrity is enforced',()=>{
  const e=engine();
  const cm=e.players.find(p=>p.team===0&&p.role==='CM');
  assert.equal(e.substitutePlayer(cm.id,benchPlayer('bench-one','CM'),{minute:60}).ok,true);
  assert.equal(e.substitutePlayer('bench-one',cm.data,{minute:80}).reason,'incoming_already_used');
  const keeper=e.players.find(p=>p.team===0&&p.role==='GK');
  assert.equal(e.substitutePlayer(keeper.id,benchPlayer('field-player','CM'),{minute:70}).reason,'keeper_role_mismatch');
});
