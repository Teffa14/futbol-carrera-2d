import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createOpponentAdaptationState,observeOpponentBehavior,expectationProfile,defenderAdaptation,deceptionWindow,classifyWideBehavior,defensiveResponseTarget,decayOpponentAdaptation} from '../opponent-adaptation-v1.js';

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

test('wide movement is classified from physical velocity rather than a scripted action label',()=>{
  assert.equal(classifyWideBehavior({attacker:{y:90,vx:1,vy:1},attackDirection:1,centerY:210}),'cut-inside');
  assert.equal(classifyWideBehavior({attacker:{y:90,vx:1,vy:-1},attackDirection:1,centerY:210}),'go-outside');
  assert.equal(classifyWideBehavior({attacker:{y:90,vx:1,vy:0},attackDirection:1,centerY:210}),'drive-forward');
});

test('learned inside tendency moves the primary defensive target into the inside lane',()=>{
  const state={opponentAdaptation:createOpponentAdaptationState()};
  for(let i=0;i<8;i++)observeOpponentBehavior(state,{opponentId:'rw-7',context:'wide-isolation',behavior:'cut-inside',tick:i+1});
  const attacker={x:700,y:90},defender={x:720,y:100};
  const response=defensiveResponseTarget(state,{opponentId:'rw-7',context:'wide-isolation',defenderIntelligence:82,defender,attacker,attackDirection:1,centerY:210});
  assert.equal(response.mode,'protect-inside');
  assert.ok(response.x>attacker.x,'defender should remain goal-side');
  assert.ok(response.y>attacker.y,'defender should close the inside lane toward field center');
});

test('learned outside tendency protects the touchline route instead of using the same target',()=>{
  const state={opponentAdaptation:createOpponentAdaptationState()};
  for(let i=0;i<8;i++)observeOpponentBehavior(state,{opponentId:'rw-7',context:'wide-isolation',behavior:'go-outside',tick:i+1});
  const attacker={x:700,y:90},defender={x:720,y:100};
  const response=defensiveResponseTarget(state,{opponentId:'rw-7',context:'wide-isolation',defenderIntelligence:82,defender,attacker,attackDirection:1,centerY:210});
  assert.equal(response.mode,'protect-outside');
  assert.ok(response.y<attacker.y);
});

test('insufficient evidence leaves the original pressure target untouched',()=>{
  const state={opponentAdaptation:createOpponentAdaptationState()};
  const response=defensiveResponseTarget(state,{opponentId:'rw-7',context:'wide-isolation',defenderIntelligence:82,defender:{x:720,y:100},attacker:{x:700,y:90},attackDirection:1,centerY:210});
  assert.equal(response,null);
});

test('agent brain wires contextual observation into primary pressure without touching ball state',()=>{
  const source=fs.readFileSync(new URL('../agent-brain-v2.js',import.meta.url),'utf8');
  assert.match(source,/observeOpponentBehavior\(engine/);
  assert.match(source,/defensiveResponseTarget\(engine/);
  assert.match(source,/if\(primaryPresser\)return adaptivePrimaryPressure/);
  assert.doesNotMatch(source,/ownerId|ball\.x\s*=|ball\.y\s*=/);
});

test('old match evidence decays rather than becoming permanent omniscience',()=>{
  const state={opponentAdaptation:createOpponentAdaptationState()};
  for(let i=0;i<6;i++)observeOpponentBehavior(state,{opponentId:'cam-10',context:'between-lines',behavior:'turn-forward',tick:i+1});
  const before=expectationProfile(state,{opponentId:'cam-10',context:'between-lines',defenderIntelligence:75}).confidence;
  decayOpponentAdaptation(state,{currentTick:3600,halfLifeTicks:600});
  const after=expectationProfile(state,{opponentId:'cam-10',context:'between-lines',defenderIntelligence:75}).confidence;
  assert.ok(after<before);
});
