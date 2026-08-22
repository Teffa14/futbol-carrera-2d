import test from 'node:test';
import assert from 'node:assert/strict';
import {assessInjuryRisk,createInjuryFromExposure,advanceInjuryRecovery,playerInjuryAvailability,injuryBurden} from '../career-injury-v1.js';
import {retirementAssessment} from '../career-retirement-v1.js';

const player={instanceId:'user-player',age:24,fitness:100,stamina:76,physical:72};

test('injury risk responds mechanically to load fatigue fitness recovery and contact',()=>{
  const fresh=assessInjuryRisk(player,{workload:35,liveFatigue:5,contactIntensity:5,sprintLoad:10,recoveryDays:7});
  const overloaded=assessInjuryRisk({...player,fitness:54},{workload:95,liveFatigue:85,contactIntensity:75,sprintLoad:90,recoveryDays:1,recentInjuries:2});
  assert.ok(overloaded.score>fresh.score+35);
  assert.equal(fresh.state,'normal');
  assert.ok(['high','critical'].includes(overloaded.state));
});

test('higher stamina and physical resilience reduce otherwise identical injury risk',()=>{
  const weak=assessInjuryRisk({...player,stamina:45,physical:45},{workload:80,liveFatigue:55,sprintLoad:70,recoveryDays:3});
  const resilient=assessInjuryRisk({...player,stamina:90,physical:90},{workload:80,liveFatigue:55,sprintLoad:70,recoveryDays:3});
  assert.ok(resilient.score<weak.score);
});

test('the same player and exposure produce the same deterministic injury outcome',()=>{
  const context={exposureId:'fixture-22:user:second-half',date:'2026-10-18',workload:100,liveFatigue:100,contactIntensity:100,sprintLoad:100,recoveryDays:0,recentInjuries:4};
  const a=createInjuryFromExposure(player,context);
  const b=createInjuryFromExposure(player,context);
  assert.deepEqual(a,b);
});

test('recovery counts down by calendar days and eventually restores match availability',()=>{
  const injury={id:'inj-test',kind:'muscle',severity:'minor',expectedDays:12,remainingDays:12,status:'active'};
  const afterWeek=advanceInjuryRecovery(injury,7);
  assert.equal(afterWeek.remainingDays,5);
  assert.equal(playerInjuryAvailability({injury:afterWeek}).match,false);
  const recovered=advanceInjuryRecovery(afterWeek,5);
  assert.equal(recovered.status,'recovered');
  assert.equal(playerInjuryAvailability({injury:recovered}).match,true);
});

test('injury burden composes active and historical damage for retirement pressure',()=>{
  const active={severity:'major',expectedDays:120,remainingDays:90,status:'active'};
  const history=[{severity:'moderate',expectedDays:42},{severity:'major',expectedDays:100}];
  const burden=injuryBurden({activeInjury:active,history});
  assert.ok(burden>=70);
  const assessment=retirementAssessment({...player,age:34,pace:54,physical:54,stamina:52},{injuryBurden:burden,clubOpportunityCount:0});
  assert.ok(assessment.pressure>=65);
  assert.ok(assessment.reasons.includes('injuries'));
});

test('injury lifecycle never creates ball ownership or mutates a supplied ball',()=>{
  const ball={x:320,y:180,vx:4,vy:-2};
  const before={...ball};
  const result=createInjuryFromExposure(player,{exposureId:'physics-invariant',workload:90,liveFatigue:90,contactIntensity:90,sprintLoad:90,recoveryDays:0});
  assert.deepEqual(ball,before);
  assert.equal(Object.hasOwn(result,'ownerId'),false);
  assert.equal(result.injury?Object.hasOwn(result.injury,'ownerId'):false,false);
});
