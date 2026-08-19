import test from 'node:test';
import assert from 'node:assert/strict';
import {PHASES,attackProgress,pitchLane,attackingLane,thirdFor,detectTeamPhase,resolvePersonalPlaybook,resolvePatternBranch,detectPressingTriggers,PATTERN_TEMPLATES,PERSONAL_RULE_EXAMPLES} from '../tactics.js';

test('field references are mirrored by attacking direction',()=>{
  assert.equal(attackProgress({x:253,y:350},0).toFixed(1),'0.2');
  assert.equal(attackProgress({x:253,y:350},1).toFixed(1),'0.8');
  assert.equal(thirdFor({x:253,y:350},0),'first-third');
  assert.equal(thirdFor({x:253,y:350},1),'final-third');
  assert.equal(pitchLane({x:550,y:90}),'wide-left');
  assert.equal(attackingLane({x:550,y:90},1),'wide-right');
});

test('possession phase distinguishes build-up, progression, final third and transition',()=>{
  assert.equal(detectTeamPhase({team:0,ball:{x:180,y:350},ownerTeam:0}),PHASES.BUILD_UP);
  assert.equal(detectTeamPhase({team:0,ball:{x:540,y:350},ownerTeam:0}),PHASES.PROGRESSION);
  assert.equal(detectTeamPhase({team:0,ball:{x:805,y:350},ownerTeam:0}),PHASES.FINAL_THIRD);
  assert.equal(detectTeamPhase({team:0,ball:{x:960,y:350},ownerTeam:0}),PHASES.BOX_ATTACK);
  assert.equal(detectTeamPhase({team:0,ball:{x:610,y:350},ownerTeam:1,previousOwnerTeam:0,secondsSinceChange:1.2}),PHASES.DEFENSIVE_TRANSITION);
  assert.equal(detectTeamPhase({team:0,ball:{x:610,y:350},ownerTeam:0,previousOwnerTeam:1,secondsSinceChange:1.2}),PHASES.ATTACKING_TRANSITION);
});

test('personal playbook resolves the most specific higher-priority winger behaviour',()=>{
  const base={phase:PHASES.PROGRESSION,sameFlankAsBall:true,fullbackOverlapping:false,opponentFullbackSteps:true,spaceBehind:.72,receivingBackToGoal:false,pressure:.2};
  const action=resolvePersonalPlaybook(PERSONAL_RULE_EXAMPLES,base);
  assert.equal(action.id,'winger-attack-depth');
  assert.equal(action.action,'attack-space-behind-fullback');
});

test('overlap branches according to the defending fullback decision',()=>{
  const overlap=PATTERN_TEMPLATES.overlap;
  const release=resolvePatternBranch(overlap,{ballCarrierWide:true,outsideRunnerAvailable:true,fullbackTracksRunner:false,coverMidfielderShiftsWide:false,possessionLost:false});
  assert.equal(release.branchId,'fullback-holds-carrier');
  assert.equal(release.action,'release-overlap');
  const drive=resolvePatternBranch(overlap,{ballCarrierWide:true,outsideRunnerAvailable:true,fullbackTracksRunner:true,coverMidfielderShiftsWide:false,possessionLost:false});
  assert.equal(drive.branchId,'fullback-follows-runner');
  assert.equal(drive.action,'ball-carrier-drives-inside');
});

test('overload-to-isolate only switches once the block moved and weak side is isolated',()=>{
  const pattern=PATTERN_TEMPLATES['overload-to-isolate'];
  const waiting=resolvePatternBranch(pattern,{strongSideOverload:true,weakSideWingerHoldingWidth:true,opponentHorizontalShift:.4,weakSideIsolation:.7,centralLaneOpen:false,restDefenceReady:true});
  assert.equal(waiting.branchId,'primary');
  assert.equal(waiting.action,'circulate-within-overload-to-attract-block');
  const switched=resolvePatternBranch(pattern,{strongSideOverload:true,weakSideWingerHoldingWidth:true,opponentHorizontalShift:.78,weakSideIsolation:.72,centralLaneOpen:false,restDefenceReady:true});
  assert.equal(switched.branchId,'block-shifted');
  assert.equal(switched.action,'switch-immediately-to-weak-side-winger');
});

test('pressing triggers recognise bad touches and touchline isolation instead of generic press intensity',()=>{
  const triggers=detectPressingTriggers({receiverTouchError:.72,receiverFacingOwnGoal:false,passSpeed:.8,passProgressDelta:.18,receiverLane:'wide-right',receiverSupportOptions:1});
  assert.deepEqual(triggers.map(t=>t.id),['bad-touch','touchline-isolation']);
  const press=resolvePatternBranch(PATTERN_TEMPLATES['wide-press-trap'],{teamOutOfPossession:true,pressTrigger:triggers[0].id,insideLaneClosed:true,firstPressLineBroken:false});
  assert.equal(press.branchId,'inside-pass-blocked');
  assert.equal(press.action,'fullback-jumps-eight-covers-half-space-six-protects-centre');
});

test('patterns expose explicit abort behaviour when the situation breaks',()=>{
  const result=resolvePatternBranch(PATTERN_TEMPLATES['third-man'],{phase:PHASES.PROGRESSION,setPlayerAvailable:true,thirdPlayerAvailable:true,thirdPlayerMarkerFollows:false,setPlayerCanTurn:false,possessionLost:true});
  assert.equal(result.aborted,true);
  assert.equal(result.action,'nearest-three-counterpress-rest-defence-protect-centre');
});
