import test from 'node:test';
import assert from 'node:assert/strict';
import {createAllocationState,increaseFamily} from '../character-creation-v1.js';
import {creationIdentitySeed,creationReadiness,previewCreatedPlayer,createCareerFromCharacter} from '../character-creation-flow-v1.js';

function buy(state,family,times){let current=state;for(let i=0;i<times;i++){const result=increaseFamily(current,family);assert.equal(result.ok,true);current=result.state;}return current;}
function completeCM(){let state=createAllocationState('CM');state=buy(state,'distribution',4);state=buy(state,'mentality',3);state=buy(state,'technique',2);state=buy(state,'athleticism',1);return state;}

test('creation identity is independent from the club selected later',()=>{
  const base={playerName:'Lautaro Test',nationality:'AR',position:'CM',build:'creator',age:17,entryLevel:'reserve',background:'local_academy'};
  assert.equal(creationIdentitySeed({...base,clubId:'river'}),creationIdentitySeed({...base,clubId:'central'}));
});

test('preview applies the exact correlated allocation to the stable youth profile',()=>{
  const allocation=completeCM(),base={playerName:'Lautaro Test',nationality:'AR',position:'CM',build:'creator',creationAllocation:allocation};
  const plain=previewCreatedPlayer({...base,creationAllocation:createAllocationState('CM')});
  const built=previewCreatedPlayer(base);
  assert.ok(built.passing>plain.passing);assert.ok(built.vision>plain.vision);assert.ok(built.ballControl>plain.ballControl);
  assert.deepEqual(built.creationAllocation.ranks,allocation.ranks);
});

test('creation cannot continue while points remain unspent',()=>{
  let allocation=createAllocationState('ST');allocation=buy(allocation,'finishing',1);allocation=buy(allocation,'speed',1);allocation=buy(allocation,'mentality',1);
  const result=creationReadiness(allocation);assert.equal(result.ok,false);assert.equal(result.reason,'unspent-points');
});

test('career receives exactly the same player shown in pre-career preview',()=>{
  const allocation=completeCM();
  const input={playerName:'Lautaro Test',nationality:'AR',position:'CM',build:'creator',countryId:'AR',clubId:'river',creationAllocation:allocation};
  const preview=previewCreatedPlayer(input),career=createCareerFromCharacter(input);
  for(const key of ['pace','shooting','passing','dribbling','defense','physical','ballControl','vision','stamina','composure','rating','potential'])assert.equal(career.player[key],preview[key],key);
  assert.equal(career.player.team,'River Plate');
  assert.equal(career.creation.completed,true);
  assert.deepEqual(career.creation.allocation.ranks,allocation.ranks);
  assert.equal(career.world.river.roster.find(p=>p.isUser).rating,preview.rating);
});

test('same created footballer keeps his attributes when the eventual club changes',()=>{
  const allocation=completeCM();
  const common={playerName:'Lautaro Test',nationality:'AR',position:'CM',build:'creator',countryId:'AR',creationAllocation:allocation};
  const river=createCareerFromCharacter({...common,clubId:'river'}).player;
  const central=createCareerFromCharacter({...common,clubId:'central'}).player;
  for(const key of ['pace','shooting','passing','dribbling','defense','physical','ballControl','vision','stamina','composure','rating','potential'])assert.equal(river[key],central[key],key);
});
