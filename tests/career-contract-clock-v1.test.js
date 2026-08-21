import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeCareerTime,advanceCareerDays,rollCareerToSeasonStart} from '../career-time-v1.js';
import {createPlayerContract,synchronizeCareerContract} from '../career-contract-v1.js';

function careerState(overrides={}){
  const player={id:'user',instanceId:'user',name:'User',age:17,birthDate:'2009-12-20'};
  return{countryId:'AR',clubId:'club-a',season:1,player,world:{'club-a':{roster:[player]}},...overrides};
}

test('career initialization creates an active contract anchored to the football clock',()=>{
  const state=careerState();
  initializeCareerTime(state,{startDate:'2026-02-01'});
  assert.equal(state.contract.clubId,'club-a');
  assert.equal(state.contract.startDate,'2026-02-01');
  assert.equal(state.contract.endDate,'2028-02-01');
  assert.equal(state.contract.status,'active');
  assert.deepEqual(state.contractStatus,{status:'active',daysRemaining:730,expiring:false,canNegotiate:false,clubId:'club-a'});
});

test('weekly career time opens the negotiation window without expiring a contract early',()=>{
  const state=careerState({
    contract:createPlayerContract({clubId:'club-a',startDate:'2026-02-01',endDate:'2027-02-01'}),
    clock:{currentDate:'2026-07-20',startedAt:'2026-02-01',elapsedDays:169,lastAdvanceDays:7},
  });
  advanceCareerDays(state,14);
  assert.equal(state.clock.currentDate,'2026-08-03');
  assert.equal(state.contract.status,'active');
  assert.equal(state.contractStatus.status,'active');
  assert.equal(state.contractStatus.expiring,true);
  assert.equal(state.contractStatus.canNegotiate,true);
  assert.equal(state.contractStatus.clubId,'club-a');
});

test('crossing the end date through the career clock produces persistent free agency',()=>{
  const state=careerState({
    contract:createPlayerContract({clubId:'club-a',startDate:'2026-02-01',endDate:'2026-02-15'}),
    clock:{currentDate:'2026-02-08',startedAt:'2026-02-01',elapsedDays:7,lastAdvanceDays:7},
  });
  advanceCareerDays(state,7);
  assert.equal(state.clock.currentDate,'2026-02-15');
  assert.equal(state.contract.status,'expired');
  assert.equal(state.contract.expiredAt,'2026-02-15');
  assert.deepEqual(state.contractStatus,{status:'free-agent',daysRemaining:0,expiring:false,canNegotiate:true,clubId:null});
  advanceCareerDays(state,7);
  assert.equal(state.contract.status,'expired');
  assert.equal(state.contract.expiredAt,'2026-02-15');
  assert.equal(state.contractStatus.clubId,null);
});

test('season rollover also synchronizes contract expiry',()=>{
  const state=careerState({
    season:2,
    contract:createPlayerContract({clubId:'club-a',startDate:'2026-02-01',endDate:'2027-01-15'}),
    clock:{currentDate:'2027-01-01',startedAt:'2026-02-01',elapsedDays:334,lastAdvanceDays:7},
  });
  rollCareerToSeasonStart(state,2);
  assert.equal(state.clock.currentDate,'2027-02-01');
  assert.equal(state.contract.status,'expired');
  assert.equal(state.contract.expiredAt,'2027-02-01');
  assert.equal(state.contractStatus.status,'free-agent');
});

test('synchronizing a career without club registration stays free-agent and does not fabricate a contract',()=>{
  const state={clock:{currentDate:'2027-02-01'}};
  const status=synchronizeCareerContract(state);
  assert.equal(state.contract,undefined);
  assert.deepEqual(status,{status:'free-agent',clubId:null,daysRemaining:0,expiring:false,canNegotiate:true});
});
