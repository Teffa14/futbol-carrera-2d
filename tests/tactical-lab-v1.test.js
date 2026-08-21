import test from 'node:test';
import assert from 'node:assert/strict';
import {PHASES} from '../tactics.js';
import {createTacticalPlan,validateTacticalPlan,resolveTacticalPlan,phaseRules,tacticalLabCapabilities,TACTICAL_LAB_TEMPLATES} from '../tactical-lab-v1.js';

test('competitive Tactical Lab accepts full-team rule families while campaign authority stays player-centred',()=>{
  const competitive=tacticalLabCapabilities('competitive');
  const campaign=tacticalLabCapabilities('campaign');
  assert.ok(competitive.includes('shape'));
  assert.ok(competitive.includes('press'));
  assert.ok(competitive.includes('substitution'));
  assert.equal(campaign.includes('shape'),false);
  assert.equal(campaign.includes('press'),false);
  assert.ok(campaign.includes('role'));
  assert.ok(campaign.includes('pattern'));
});

test('phase rules activate only in their declared football phase',()=>{
  const plan=createTacticalPlan({rules:[
    {id:'build-width',kind:'shape',phase:PHASES.BUILD_UP,action:'occupy-five-lanes'},
    {id:'final-box',kind:'zone',phase:PHASES.FINAL_THIRD,action:'attack-box-five-lanes'},
  ]});
  const build=resolveTacticalPlan(plan,{phase:PHASES.BUILD_UP});
  assert.deepEqual(build.instructions.map(x=>x.ruleId),['build-width']);
  assert.deepEqual(phaseRules(plan,PHASES.FINAL_THIRD).map(x=>x.id),['final-box']);
});

test('pattern template branches from defender behavior instead of forcing a rigid sequence',()=>{
  const plan=createTacticalPlan({rules:[TACTICAL_LAB_TEMPLATES['overlap-branch']]});
  const free=resolveTacticalPlan(plan,{phase:PHASES.PROGRESSION,ballCarrierWide:true,outsideRunnerAvailable:true,fullbackTracksRunner:false,possessionLost:false});
  const tracked=resolveTacticalPlan(plan,{phase:PHASES.PROGRESSION,ballCarrierWide:true,outsideRunnerAvailable:true,fullbackTracksRunner:true,possessionLost:false});
  assert.equal(free.instructions[0].branchId,'runner-free');
  assert.equal(free.instructions[0].action,'release-overlap');
  assert.equal(tracked.instructions[0].branchId,'runner-tracked');
  assert.equal(tracked.instructions[0].action,'ball-carrier-drives-inside');
});

test('pattern abort conditions recover structure when the football situation breaks',()=>{
  const plan=createTacticalPlan({rules:[TACTICAL_LAB_TEMPLATES['overlap-branch']]});
  const result=resolveTacticalPlan(plan,{phase:PHASES.PROGRESSION,ballCarrierWide:true,outsideRunnerAvailable:true,fullbackTracksRunner:false,possessionLost:true});
  assert.equal(result.instructions[0].aborted,true);
  assert.equal(result.instructions[0].action,'recover-structure');
});

test('press rule respects both trigger and structural safety condition',()=>{
  const plan=createTacticalPlan({rules:[TACTICAL_LAB_TEMPLATES['bad-touch-press']]});
  const safe=resolveTacticalPlan(plan,{phase:PHASES.OUT_OF_POSSESSION,receiverTouchError:.8,restDefenceReady:true,firstPressLineBroken:false});
  const unsafe=resolveTacticalPlan(plan,{phase:PHASES.OUT_OF_POSSESSION,receiverTouchError:.8,restDefenceReady:false,firstPressLineBroken:false});
  assert.equal(safe.instructions[0].action,'nearest-access-player-presses-support-covers-centre');
  assert.equal(unsafe.instructions.length,0);
});

test('invalid pattern without an abort path is rejected',()=>{
  const validation=validateTacticalPlan({mode:'competitive',rules:[{id:'rigid',kind:'pattern',pattern:{id:'rigid',primaryAction:'a-to-b-to-c',abort:[]}}]});
  assert.equal(validation.valid,false);
  assert.ok(validation.errors.some(error=>error.includes('abort requires at least one abort condition')));
});

test('Tactical Lab resolution never requires or mutates ball ownership state',()=>{
  const plan=createTacticalPlan({rules:[TACTICAL_LAB_TEMPLATES['overlap-branch']]});
  const ball={x:400,y:300,vx:9,vy:-2};
  const before={...ball};
  const context={phase:PHASES.PROGRESSION,ballCarrierWide:true,outsideRunnerAvailable:true,fullbackTracksRunner:false,possessionLost:false,ball};
  resolveTacticalPlan(plan,context);
  assert.deepEqual(ball,before);
  assert.equal(Object.hasOwn(ball,'ownerId'),false);
});
