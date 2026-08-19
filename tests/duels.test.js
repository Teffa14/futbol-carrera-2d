import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPhysicalDuel,collectDuelEvents,createDuelLedger,duelPairId} from '../duels.js';

const p=(id,team)=>({id,team});

test('physical duel classification chooses the stronger contact edge',()=>{
  const a=p('a',0),b=p('b',1);
  const duel=classifyPhysicalDuel({a,b,edge:.42,headOn:true,leverageA:.03,leverageB:0});
  assert.equal(duel.winnerId,'a');
  assert.equal(duel.loserId,'b');
  assert.equal(duel.kind,'body');
  assert.equal(duel.headOn,true);
  assert.ok(duel.intensity>.3);
});

test('shielding leverage can win a body-line duel even when collision edge is nearly even',()=>{
  const a=p('holder',0),b=p('challenger',1);
  const duel=classifyPhysicalDuel({a,b,edge:.02,headOn:false,leverageA:.24,leverageB:.03});
  assert.equal(duel.winnerId,'holder');
  assert.equal(duel.kind,'shielding');
  assert.ok(duel.winnerLeverage>duel.loserLeverage);
});

test('ambiguous contact is not fabricated into a duel win',()=>{
  const a=p('a',0),b=p('b',1);
  assert.equal(classifyPhysicalDuel({a,b,edge:.025,headOn:false,leverageA:.04,leverageB:.02}),null);
});

test('continuous contact emits one duel event instead of one per frame',()=>{
  const a=p('a',0),b=p('b',1),ledger=createDuelLedger();
  const contact={a,b,edge:.3,headOn:true,leverageA:.1,leverageB:0};
  assert.equal(collectDuelEvents([contact],ledger,10).length,1);
  assert.equal(collectDuelEvents([contact],ledger,11).length,0);
  assert.equal(collectDuelEvents([contact],ledger,12).length,0);
  assert.equal(collectDuelEvents([contact],ledger,13).length,0);
});

test('a separated pair can create a new duel episode later',()=>{
  const a=p('a',0),b=p('b',1),ledger=createDuelLedger();
  const contact={a,b,edge:-.28,headOn:false,leverageA:0,leverageB:.12};
  assert.equal(collectDuelEvents([contact],ledger,5).length,1);
  collectDuelEvents([],ledger,6);
  collectDuelEvents([],ledger,7);
  collectDuelEvents([],ledger,8);
  collectDuelEvents([],ledger,9);
  const again=collectDuelEvents([contact],ledger,10);
  assert.equal(again.length,1);
  assert.equal(again[0].winnerId,'b');
});

test('pair ids are stable regardless of contact ordering',()=>{
  const a=p('left',0),b=p('right',1);
  assert.equal(duelPairId(a,b),duelPairId(b,a));
});
