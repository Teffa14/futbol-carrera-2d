import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareer,syncLevelDevelopment,calculateOverall} from '../career.js';
import {applyNaturalLevelDevelopment} from '../career-development.js';

const ATTRS=['pace','shooting','passing','dribbling','defense','physical','ballControl','vision','stamina','composure'];
const snapshot=p=>Object.fromEntries(ATTRS.map(k=>[k,p[k]]));

test('a youth career at level 10 has real natural development instead of only perk points',()=>{
  const state=createCareer({playerName:'Ouros',nationality:'AR',position:'ST',build:'finisher',countryId:'AR',clubId:'river'});
  const beforeOverall=state.player.rating,beforeShooting=state.player.shooting;
  state.progress.level=10;
  delete state.progress.developmentLevelApplied; // legacy v4 save created before natural growth existed

  const gains=syncLevelDevelopment(state);

  assert.equal(state.progress.developmentLevelApplied,10);
  assert.ok(gains.length>=9,`expected meaningful level 1 -> 10 growth, got ${gains.length} attribute gains`);
  assert.ok(state.player.rating>beforeOverall,`expected OVR above ${beforeOverall}, got ${state.player.rating}`);
  assert.ok(state.player.rating<=beforeOverall+5,'nine levels should not create an arcade-style OVR jump');
  assert.ok(state.player.shooting>beforeShooting,'a finisher striker should develop a core finishing attribute');
  assert.equal(state.player.developmentProfile.development.experience,9);
});

test('legacy level development backfill is idempotent',()=>{
  const state=createCareer({playerName:'Ouros',nationality:'AR',position:'ST',build:'finisher',countryId:'AR',clubId:'river'});
  state.progress.level=10;
  delete state.progress.developmentLevelApplied;
  syncLevelDevelopment(state);
  const once=snapshot(state.player),overall=state.player.rating;

  const again=syncLevelDevelopment(state);

  assert.deepEqual(again,[]);
  assert.deepEqual(snapshot(state.player),once);
  assert.equal(state.player.rating,overall);
});

test('natural level growth stops when dynamic potential has no headroom',()=>{
  const state=createCareer({playerName:'Ceiling',nationality:'AR',position:'CM',build:'creator',countryId:'AR',clubId:'river'});
  const before=snapshot(state.player),overall=state.player.rating;
  state.player.potential=overall;
  state.player.dynamicPotential=overall;
  state.player.developmentProfile.potential=overall;
  state.player.developmentProfile.dynamicPotential=overall;
  state.progress.developmentLevelApplied=1;

  for(let level=2;level<=10;level++){
    state.progress.level=level;
    const beforeLevelRating=state.player.rating;
    const beforeCalculated=calculateOverall(state.player);
    const beforePotential=state.player.dynamicPotential;
    const gains=syncLevelDevelopment(state);
    assert.deepEqual(gains,[],`level ${level}: rating=${beforeLevelRating}, calculated=${beforeCalculated}, dynamicPotential=${beforePotential}, profilePotential=${state.player.developmentProfile.dynamicPotential}`);
  }

  assert.deepEqual(snapshot(state.player),before);
  assert.equal(state.player.rating,overall);
});

test('age curves keep decline-stage natural growth away from pace and physical qualities',()=>{
  const state=createCareer({playerName:'Veteran',nationality:'AR',position:'CM',build:'creator',countryId:'AR',clubId:'river'});
  const player=state.player;
  player.age=35;
  player.dynamicPotential=player.rating+8;
  player.developmentProfile.dynamicPotential=player.rating+8;

  const gains=applyNaturalLevelDevelopment(player,{level:12,currentOverall:player.rating,buildMods:{vision:8,passing:8}});

  assert.ok(gains.length>0);
  assert.equal(gains.some(g=>['pace','physical','stamina'].includes(g.attribute)),false);
});
