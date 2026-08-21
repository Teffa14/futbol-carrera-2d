import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpponentAdaptationState,observeOpponentBehavior,expectationProfile,defenderAdaptation,deceptionWindow,decayOpponentAdaptation} from '../opponent-adaptation-v1.js';

test('repeated behavior creates a bounded contextual expectation',()=>{
  const state={opponentAdaptation:createOpponentAdaptationState()};
  for(let i=0;i<6;i++)observeOpponentBehavior(state,{opponentId:'rw-7',context:'right-wing-1v1',behavior:'cut-inside',tick:i+1});
  observeOpponentBehavior(state,{opponentId:'rw-7',context:'right-wing-1v1',behavior:'go-outside',tick:7});
  const profile=expectationProfile(state,{opponentId:'rw-7',context:'right-wing-1v1',defenderIntelligence:82,scoutingKnowledge:55});
  assert.equal(profile.expected,'cut-inside');
  assert.ok(profile.confidence>0.45&&profile.confidence<0.96);
  assert.equal(profile.total,7);
  assert.ok(profile.distribution['cut-inside']>profile.distribution['go-outside']);
});

test('adaptation is contextual instead of becoming one global player tendency',()=>{
  const state={opponentAdaptation:createOpponentAdaptationState()};
  for(let i=0;i<5;i++)observeOpponentBehavior(state,{opponentId:'rw-7',context:'right-wing-1v1',behavior:'cut-inside'});
  for(let i=0;i<4;i++)observeOpponentBehavior(state,{opponentId:'rw-7',context:'final-third-support',behavior:'layoff'});
  assert.equal(expectationProfile(state,{opponentId:'rw-7',context:'right-wing-1v1'}).expected,'cut-inside');
  assert.equal(expectationProfile(state,{opponentId:'rw-7',context:'final-third-support'}).expected,'layoff');
});

test('higher intelligence converts the same evidence into earlier anticipation without perfect knowledge',()=>{
  const state={opponentAdaptation:createOpponentAdaptationState()};
  for(let i=0;i<7;i++)observeOpponentBehavior(state,{opponentId:'st-9',context:'box-reception',behavior:'turn-inside'});
  const low=defenderAdaptation(state,{opponentId:'st-9',context:'box-reception',defenderIntelligence:35});
  const high=defenderAdaptation(state,{opponentId:'st-9',context:'box-reception',defenderIntelligence:90});
  assert.ok(high.anticipationMs>low.anticipationMs);
  assert.ok(high.commitment>low.commitment);
  assert.ok(high.commitment<1);
});

test('showing one action repeatedly creates a mechanical deception window for a rare alternative',()=>{
  const state={opponentAdaptation:createOpponentAdaptationState()};
  for(let i=0;i<8;i++)observeOpponentBehavior(state,{opponentId:'lw-11',context:'wide-isolation',behavior:'cut-inside'});
  const surprise=deceptionWindow(state,{opponentId:'lw-11',context:'wide-isolation',actualBehavior:'go-outside',defenderIntelligence:78});
  assert.equal(surprise.expected,'cut-inside');
  assert.equal(surprise.actual,'go-outside');
  assert.ok(surprise.surprise>0.4);
  assert.ok(surprise.reactionDelayMs>70);
});

test('matching the expected action never receives a deception bonus',()=>{
  const state={opponentAdaptation:createOpponentAdaptationState()};
  for(let i=0;i<8;i++)observeOpponentBehavior(state,{opponentId:'lw-11',context:'wide-isolation',behavior:'cut-inside'});
  const surprise=deceptionWindow(state,{opponentId:'lw-11',context:'wide-isolation',actualBehavior:'cut-inside',defenderIntelligence:78});
  assert.equal(surprise.surprise,0);
  assert.equal(surprise.reactionDelayMs,0);
});

test('old match evidence decays rather than becoming permanent omniscience',()=>{
  const state={opponentAdaptation:createOpponentAdaptationState()};
  for(let i=0;i<6;i++)observeOpponentBehavior(state,{opponentId:'cam-10',context:'between-lines',behavior:'turn-forward',tick:i+1});
  const before=expectationProfile(state,{opponentId:'cam-10',context:'between-lines',defenderIntelligence:75}).confidence;
  decayOpponentAdaptation(state,{currentTick:3600,halfLifeTicks:600});
  const after=expectationProfile(state,{opponentId:'cam-10',context:'between-lines',defenderIntelligence:75}).confidence;
  assert.ok(after<before);
});
