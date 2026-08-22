import test from 'node:test';
import assert from 'node:assert/strict';
import {assessLoanSuitability,createLoanAgreement,loanSnapshot,synchronizeCareerLoan} from '../career-loan-v1.js';

const club=(id,reputation)=>({id,reputation,prestige:reputation});
const player={id:'user-player',instanceId:'user-player',rating:63,age:19};
const contract={clubId:'parent',startDate:'2026-07-01',endDate:'2029-07-01',weeklyWage:900,status:'active'};

test('young blocked player can receive a useful loan pathway at a suitable level',()=>{
  const result=assessLoanSuitability({player,parentClub:club('parent',84),loanClub:club('loan',76),squadNeed:80,projectedMinutes:78});
  assert.equal(result.eligible,true);
  assert.equal(result.interested,true);
  assert.equal(result.pathway,'regular-starter');
  assert.ok(result.developmentNeed>0);
});

test('a loan cannot use playing time to erase a severe sporting mismatch',()=>{
  const result=assessLoanSuitability({player:{...player,rating:52},parentClub:club('parent',82),loanClub:club('elite',93),squadNeed:100,projectedMinutes:100});
  assert.equal(result.eligible,false);
  assert.equal(result.interested,false);
});

test('loan agreement preserves the parent contract and splits wages without transferring ownership of the career',()=>{
  const loan=createLoanAgreement({player,parentContract:contract,loanClubId:'loan',startDate:'2026-08-01',months:10,wageShareParent:35,projectedRole:'important'});
  assert.equal(loan.parentClubId,'parent');
  assert.equal(loan.loanClubId,'loan');
  assert.equal(loan.wageShareParent,35);
  assert.equal(loan.wageShareLoan,65);
  assert.equal(contract.clubId,'parent');
  assert.equal(contract.status,'active');
});

test('loan cannot outlast the permanent parent contract',()=>{
  assert.throws(()=>createLoanAgreement({player,parentContract:{...contract,endDate:'2027-01-01'},loanClubId:'loan',startDate:'2026-08-01',months:12}),/outlast parent contract/);
});

test('registration moves temporarily to the loan club and automatically returns on the end date',()=>{
  const loan=createLoanAgreement({player,parentContract:contract,loanClubId:'loan',startDate:'2026-08-01',months:6});
  const state={loan,clock:{currentDate:'2026-09-10'},registration:{clubId:'parent',parentClubId:'parent',onLoan:false}};
  let snapshot=synchronizeCareerLoan(state);
  assert.equal(snapshot.active,true);
  assert.deepEqual(state.registration,{clubId:'loan',parentClubId:'parent',onLoan:true});
  state.clock.currentDate=loan.endDate;
  snapshot=synchronizeCareerLoan(state);
  assert.equal(snapshot.status,'completed');
  assert.deepEqual(state.registration,{clubId:'parent',parentClubId:'parent',onLoan:false});
  assert.equal(state.loan.status,'returned');
});

test('loan lifecycle is pure with respect to free-ball invariants',()=>{
  const loan=createLoanAgreement({player,parentContract:contract,loanClubId:'loan',startDate:'2026-08-01',months:6});
  const ball={x:100,y:80,vx:4,vy:-2};
  const state={loan,clock:{currentDate:'2026-09-01'},ball:{...ball}};
  synchronizeCareerLoan(state);
  assert.deepEqual(state.ball,ball);
  assert.equal(Object.hasOwn(state.ball,'ownerId'),false);
});

test('loan snapshots are deterministic for the same agreement and date',()=>{
  const loan=createLoanAgreement({player,parentContract:contract,loanClubId:'loan',startDate:'2026-08-01',months:6});
  assert.deepEqual(loanSnapshot(loan,'2026-10-01'),loanSnapshot(loan,'2026-10-01'));
});
