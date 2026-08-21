import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerContract,contractSnapshot,expirePlayerContract,renewPlayerContract,ensureCareerContract} from '../career-contract-v1.js';

test('a new player contract has a bounded term and persistent sporting context',()=>{
  const contract=createPlayerContract({clubId:'rosario-central',startDate:'2026-01-15',seasons:3,weeklyWage:1250,squadRole:'rotation',shirtNumber:27});
  assert.equal(contract.clubId,'rosario-central');
  assert.equal(contract.startDate,'2026-01-15');
  assert.equal(contract.endDate,'2029-01-15');
  assert.equal(contract.weeklyWage,1250);
  assert.equal(contract.squadRole,'rotation');
  assert.equal(contract.shirtNumber,27);
  assert.equal(contract.status,'active');
});

test('contract status becomes negotiable inside the final six months without expiring early',()=>{
  const contract=createPlayerContract({clubId:'club-a',startDate:'2026-01-01',endDate:'2027-01-01'});
  const early=contractSnapshot(contract,'2026-05-01');
  const late=contractSnapshot(contract,'2026-08-01');
  assert.equal(early.status,'active');
  assert.equal(early.canNegotiate,false);
  assert.equal(late.status,'active');
  assert.equal(late.expiring,true);
  assert.equal(late.canNegotiate,true);
});

test('an expired contract creates a real free-agent state instead of silently keeping the club',()=>{
  const contract=createPlayerContract({clubId:'club-a',startDate:'2026-01-01',endDate:'2027-01-01'});
  const snapshot=contractSnapshot(contract,'2027-01-01');
  const expired=expirePlayerContract(contract,'2027-01-01');
  assert.equal(snapshot.status,'free-agent');
  assert.equal(snapshot.daysRemaining,0);
  assert.equal(expired.status,'expired');
  assert.equal(expired.expiredAt,'2027-01-01');
});

test('renewal preserves previous terms as career evidence and creates a fresh bounded deal',()=>{
  const oldDeal=createPlayerContract({clubId:'club-a',startDate:'2026-01-01',endDate:'2027-01-01',weeklyWage:800,squadRole:'prospect'});
  const renewed=renewPlayerContract(oldDeal,{startDate:'2027-01-01',seasons:2,weeklyWage:1800,squadRole:'starter'});
  assert.equal(renewed.clubId,'club-a');
  assert.equal(renewed.startDate,'2027-01-01');
  assert.equal(renewed.endDate,'2029-01-01');
  assert.equal(renewed.weeklyWage,1800);
  assert.equal(renewed.squadRole,'starter');
  assert.deepEqual(renewed.renewedFrom,{startDate:'2026-01-01',endDate:'2027-01-01',weeklyWage:800});
});

test('legacy careers can receive a deterministic initial contract without overwriting an existing one',()=>{
  const state={clubId:'club-a',currentDate:'2026-02-10'};
  const first=ensureCareerContract(state,{defaultSeasons:2,defaultWeeklyWage:500});
  const second=ensureCareerContract(state,{defaultSeasons:5,defaultWeeklyWage:9999});
  assert.equal(first,state.contract);
  assert.equal(second,state.contract);
  assert.equal(state.contract.startDate,'2026-02-10');
  assert.equal(state.contract.endDate,'2028-02-10');
  assert.equal(state.contract.weeklyWage,500);
});

test('invalid or backwards contract dates are rejected',()=>{
  assert.throws(()=>createPlayerContract({clubId:'club-a',startDate:'bad-date'}));
  assert.throws(()=>createPlayerContract({clubId:'club-a',startDate:'2027-01-01',endDate:'2026-12-31'}));
});
