import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureTacticalFamiliarity,
  practicePattern,
  effectivePatternFamiliarity,
  coordinationTimingProfile,
  decayTacticalFamiliarity,
  pairFamiliarity,
  patternFamiliarity,
  conceptFamiliarity
} from '../tactical-familiarity-v1.js';

function state(){return{season:1,week:1,player:{id:'user',shooting:61,passing:64,vision:66,rating:58}};}

test('tactical familiarity initializes without touching football attributes',()=>{
  const s=state(),before={...s.player};
  ensureTacticalFamiliarity(s);
  assert.deepEqual(s.player,before);
  assert.deepEqual(s.tacticalFamiliarity,{concepts:{},pairs:{},patterns:{},lastDecayWeek:0});
});

test('pattern practice develops pattern pair and concept familiarity together',()=>{
  const s=state();
  const result=practicePattern(s,{patternId:'up-back-through',participants:['user','cm8','st9'],concepts:['third-man','timed-run'],quality:82,reps:5,week:4});
  assert.ok(result.patternGain>0);
  assert.ok(patternFamiliarity(s,'up-back-through')>0);
  assert.ok(pairFamiliarity(s,'user','cm8')>0);
  assert.equal(pairFamiliarity(s,'cm8','user'),pairFamiliarity(s,'user','cm8'));
  assert.ok(conceptFamiliarity(s,'st9','timed-run')>0);
  assert.equal(s.player.passing,64);
});

test('effective synchronization is limited by a replacement with no pair familiarity',()=>{
  const s=state();
  for(let i=0;i<7;i++)practicePattern(s,{patternId:'overlap-cross',participants:['user','rb2','st9'],concepts:['overlap','cutback'],quality:88,reps:6,week:i+1});
  const settled=effectivePatternFamiliarity(s,{patternId:'overlap-cross',participants:['user','rb2','st9'],concepts:['overlap','cutback']});
  const replacement=effectivePatternFamiliarity(s,{patternId:'overlap-cross',participants:['user','new-rb','st9'],concepts:['overlap','cutback']});
  assert.ok(settled.effective>replacement.effective);
  assert.ok(settled.pair>replacement.pair);
});

test('higher familiarity changes coordination timing rather than granting a stat buff',()=>{
  const low=coordinationTimingProfile(15),high=coordinationTimingProfile(85);
  assert.ok(high.anticipationDelayMs<low.anticipationDelayMs);
  assert.ok(high.branchRecognitionDelayMs<low.branchRecognitionDelayMs);
  assert.ok(high.runTimingToleranceMs>low.runTimingToleranceMs);
  assert.ok(high.duplicatedSpaceRisk<low.duplicatedSpaceRisk);
  assert.ok(high.orientationErrorRisk<low.orientationErrorRisk);
});

test('unused pair and pattern familiarity decay faster than concept memory',()=>{
  const s=state();
  practicePattern(s,{patternId:'third-man',participants:['user','cm8'],concepts:['third-man'],quality:90,reps:6,week:1});
  const conceptBefore=conceptFamiliarity(s,'user','third-man'),pairBefore=pairFamiliarity(s,'user','cm8'),patternBefore=patternFamiliarity(s,'third-man');
  decayTacticalFamiliarity(s,10);
  const conceptLoss=conceptBefore-conceptFamiliarity(s,'user','third-man');
  const pairLoss=pairBefore-pairFamiliarity(s,'user','cm8');
  const patternLoss=patternBefore-patternFamiliarity(s,'third-man');
  assert.ok(pairLoss>conceptLoss);
  assert.ok(patternLoss>conceptLoss);
});

test('decay is idempotent for the same career week',()=>{
  const s=state();
  practicePattern(s,{patternId:'press-trap',participants:['user','cm8'],concepts:['press-trigger'],quality:75,reps:4,week:2});
  decayTacticalFamiliarity(s,12);
  const once=JSON.stringify(s.tacticalFamiliarity);
  decayTacticalFamiliarity(s,12);
  assert.equal(JSON.stringify(s.tacticalFamiliarity),once);
});
