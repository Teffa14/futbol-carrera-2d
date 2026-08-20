import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareer} from '../career.js';
import {eligibleNationalTeams,ensureInternationalCareer,evaluateUserCallUp,nationalCallUpScore,recordInternationalAppearance,selectNationalSquad} from '../national-team-v1.js';

function candidate(id,position,rating,{form=0,fitness=100,country='Argentina',apps=6,minutes=540,reputation=30}={}){
  return{player:{id,instanceId:id,name:id,position,rating,form,fitness,country,vision:70},context:{apps,minutes,reputation}};
}

test('created players resolve their national-team eligibility from career nationality',()=>{
  const state=createCareer({playerName:'Pibe',nationality:'AR',position:'CM',build:'creator',countryId:'AR',clubId:'river'});
  assert.deepEqual(eligibleNationalTeams(state.player),['AR']);
  const international=ensureInternationalCareer(state);
  assert.deepEqual(international.eligibleTeamIds,['AR']);
  assert.equal(international.caps,0);
});

test('dual eligibility remains open until an official appearance cap-ties the player',()=>{
  const state=createCareer({playerName:'Dual',nationality:'AR',position:'RW',build:'technician',countryId:'AR',clubId:'river'});
  state.player.nationalityIds=['AR','ES'];
  assert.deepEqual(eligibleNationalTeams(state.player),['AR','ES']);
  const result=recordInternationalAppearance(state,{teamId:'AR',competition:'qualifier',official:true,minutes:28});
  assert.equal(result.ok,true);
  assert.equal(state.international.capTiedTeamId,'AR');
  assert.deepEqual(state.international.eligibleTeamIds,['AR']);
  assert.equal(recordInternationalAppearance(state,{teamId:'ES',competition:'friendly',minutes:20}).ok,false);
});

test('call-up score rewards current football evidence rather than overall alone',()=>{
  const stale=candidate('stale','CM',72,{form:-4,fitness:66,apps:1,minutes:80,reputation:10});
  const active=candidate('active','CM',69,{form:4,fitness:96,apps:6,minutes:540,reputation:35});
  assert.ok(nationalCallUpScore(active)>nationalCallUpScore(stale));
});

test('national squad selection preserves positional competition with configurable quotas',()=>{
  const pool=[
    candidate('gk','GK',66),candidate('def','CB',67),candidate('mid-stale','CM',72,{form:-5,fitness:60,apps:1,minutes:70}),candidate('mid-active','CM',69,{form:5,fitness:100}),candidate('fwd','ST',68),
  ];
  const squad=selectNationalSquad('AR',pool,{squadSize:4,minimums:{GK:1,DEF:1,MID:1,FWD:1}});
  assert.equal(squad.selected.length,4);
  assert.deepEqual(Object.fromEntries(Object.entries(squad.byFamily).map(([key,value])=>[key,value.length])),{GK:1,DEF:1,MID:1,FWD:1});
  assert.equal(squad.selected.some(player=>player.id==='mid-active'),true);
  assert.equal(squad.selected.some(player=>player.id==='mid-stale'),false);
});

test('a user can miss a call-up when stronger competition owns the available role slot',()=>{
  const state=createCareer({playerName:'Juvenil',nationality:'AR',position:'CM',build:'creator',countryId:'AR',clubId:'river'});
  state.player.rating=61;state.player.form=-2;state.player.fitness=82;
  const pool=[candidate('gk','GK',68),candidate('def','CB',70),candidate('mid','CM',78,{form:4,fitness:100}),candidate('fwd','ST',73)];
  const result=evaluateUserCallUp(state,pool,{teamId:'AR',squadSize:4,minimums:{GK:1,DEF:1,MID:1,FWD:1},userContext:{apps:2,minutes:130,reputation:12},cycleId:'qualifier-1',competition:'qualifier'});
  assert.equal(result.ok,true);
  assert.equal(result.calledUp,false);
  assert.equal(result.reason,'competition');
  assert.equal(state.international.currentCallUp,null);
});

test('international appearances persist caps production and history without changing club career stats',()=>{
  const state=createCareer({playerName:'Seleccionado',nationality:'AR',position:'ST',build:'finisher',countryId:'AR',clubId:'river'});
  const clubApps=state.seasonStats.apps;
  const call=evaluateUserCallUp(state,[candidate('gk','GK',60),candidate('def','CB',60),candidate('mid','CM',60),candidate('fwd-other','ST',50)],{teamId:'AR',squadSize:5,minimums:{GK:1,DEF:1,MID:1,FWD:1},cycleId:'friendly-1'});
  assert.equal(call.calledUp,true);
  const result=recordInternationalAppearance(state,{teamId:'AR',competition:'friendly',official:false,goals:1,assists:1,minutes:74,date:'2026-09-05'});
  assert.equal(result.ok,true);
  assert.equal(state.international.caps,1);
  assert.equal(state.international.goals,1);
  assert.equal(state.international.assists,1);
  assert.equal(state.international.minutes,74);
  assert.equal(state.international.history.length,1);
  assert.equal(state.international.capTiedTeamId,null);
  assert.equal(state.seasonStats.apps,clubApps);
});
