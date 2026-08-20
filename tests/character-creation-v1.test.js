import test from 'node:test';
import assert from 'node:assert/strict';
import {CREATION_ATTRIBUTE_CAP,applyCreationAllocation,createAllocationState,increaseFamily,decreaseFamily,allocationCost,allocationSummary,validateCreationAllocation,familyCap} from '../character-creation-v1.js';

function buy(state,family,times){let s=state;for(let i=0;i<times;i++){const result=increaseFamily(s,family);assert.equal(result.ok,true,`${family} rank ${i+1}`);s=result.state;}return s;}

test('allocation raises correlated football attributes instead of one isolated stat',()=>{
  let state=createAllocationState('CAM');state=buy(state,'technique',2);
  const base={pace:52,shooting:50,passing:54,dribbling:55,defense:42,physical:48,ballControl:55,vision:54,stamina:50,composure:51};
  const p=applyCreationAllocation(base,state);
  assert.equal(p.dribbling,61);assert.equal(p.ballControl,61);assert.equal(p.passing,56);assert.equal(p.composure,53);
  assert.equal(p.shooting,50);assert.equal(p.defense,42);
});

test('later family ranks cost more than early ranks',()=>{
  let state=createAllocationState('ST');
  const r1=increaseFamily(state,'finishing');assert.equal(r1.cost,1);state=r1.state;
  const r2=increaseFamily(state,'finishing');assert.equal(r2.cost,2);state=r2.state;
  const r3=increaseFamily(state,'finishing');assert.equal(r3.cost,2);state=r3.state;
  const r4=increaseFamily(state,'finishing');assert.equal(r4.cost,3);state=r4.state;
  assert.equal(allocationCost(state.ranks),8);
});

test('position caps prevent unrealistic specialization outside the role',()=>{
  let state=createAllocationState('CB');state=buy(state,'finishing',1);
  const blocked=increaseFamily(state,'finishing');
  assert.equal(familyCap('CB','finishing'),1);assert.equal(blocked.ok,false);assert.equal(blocked.reason,'position-cap');
});

test('juvenile creation has a hard individual attribute ceiling',()=>{
  let state=createAllocationState('LW',30);state=buy(state,'speed',4);state=buy(state,'technique',4);
  const base={pace:68,shooting:58,passing:60,dribbling:67,defense:40,physical:55,ballControl:67,vision:58,stamina:61,composure:59};
  const p=applyCreationAllocation(base,state);
  assert.equal(p.pace,CREATION_ATTRIBUTE_CAP);assert.equal(p.dribbling,CREATION_ATTRIBUTE_CAP);assert.equal(p.ballControl,CREATION_ATTRIBUTE_CAP);
  assert.ok(Object.values(p).every(v=>v<=CREATION_ATTRIBUTE_CAP));
});

test('creation cannot be finalized by dumping points into fewer than three families',()=>{
  let concentrated=createAllocationState('ST');concentrated=buy(concentrated,'finishing',4);concentrated=buy(concentrated,'speed',3);
  const invalid=validateCreationAllocation(concentrated);assert.equal(invalid.ok,false);assert.equal(invalid.reason,'too-concentrated');
  let balanced=concentrated;balanced=buy(balanced,'mentality',1);
  assert.equal(validateCreationAllocation(balanced).ok,true);
});

test('decreasing a family refunds the exact marginal cost and preserves budget accounting',()=>{
  let state=createAllocationState('CM');state=buy(state,'distribution',3);const before=allocationSummary(state);
  const down=decreaseFamily(state,'distribution');assert.equal(down.ok,true);assert.equal(down.refund,2);
  const after=allocationSummary(down.state);assert.equal(before.spent-after.spent,2);assert.equal(after.remaining-before.remaining,2);
});
