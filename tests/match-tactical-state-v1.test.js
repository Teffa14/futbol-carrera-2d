import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchEngine} from '../engine.js';
import {PHASES} from '../tactics.js';
import {DEFENSIVE_BLOCKS,deriveTeamTacticalState,updateMatchTacticalState} from '../match-tactical-state-v1.js';

function stubEngine({x=550,y=350,ownerTeam=0,pressing=[55,55]}={}){
  return {
    ball:{x,y,vx:0,vy:0,r:5,lastTeam:ownerTeam,lastPlayerId:null,lastTouchTick:0},
    minute:10,
    lastPossessionTeam:ownerTeam,
    tactics:[{pressing:pressing[0]},{pressing:pressing[1]}],
    inferPossessionTeam(){return ownerTeam;},
  };
}

test('team phase follows attacking field progress',()=>{
  const build=deriveTeamTacticalState(stubEngine({x:150,ownerTeam:0}),0,{ownerTeam:0});
  const middle=deriveTeamTacticalState(stubEngine({x:550,ownerTeam:0}),0,{ownerTeam:0});
  const final=deriveTeamTacticalState(stubEngine({x:820,ownerTeam:0}),0,{ownerTeam:0});
  const box=deriveTeamTacticalState(stubEngine({x:950,ownerTeam:0}),0,{ownerTeam:0});
  assert.equal(build.phase,PHASES.BUILD_UP);
  assert.equal(middle.phase,PHASES.PROGRESSION);
  assert.equal(final.phase,PHASES.FINAL_THIRD);
  assert.equal(box.phase,PHASES.BOX_ATTACK);
});

test('out-of-possession block changes with ball territory and pressing',()=>{
  const high=deriveTeamTacticalState(stubEngine({x:900,ownerTeam:1}),0,{ownerTeam:1});
  const mid=deriveTeamTacticalState(stubEngine({x:520,ownerTeam:1}),0,{ownerTeam:1});
  const aggressive=deriveTeamTacticalState(stubEngine({x:620,ownerTeam:1,pressing:[80,55]}),0,{ownerTeam:1});
  const low=deriveTeamTacticalState(stubEngine({x:180,ownerTeam:1}),0,{ownerTeam:1});
  assert.equal(high.defensiveBlock,DEFENSIVE_BLOCKS.HIGH_PRESS);
  assert.equal(mid.defensiveBlock,DEFENSIVE_BLOCKS.MID_BLOCK);
  assert.equal(aggressive.defensiveBlock,DEFENSIVE_BLOCKS.HIGH_PRESS);
  assert.equal(low.defensiveBlock,DEFENSIVE_BLOCKS.LOW_BLOCK);
});

test('possession change creates explicit attacking and defensive transition states',()=>{
  let ownerTeam=0;
  const engine=stubEngine({x:620,ownerTeam});
  engine.inferPossessionTeam=()=>ownerTeam;
  updateMatchTacticalState(engine);
  ownerTeam=1;
  engine.lastPossessionTeam=1;
  engine.minute=10.02;
  const state=updateMatchTacticalState(engine);
  assert.equal(state.previousOwnerTeam,0);
  assert.equal(state.ownerTeam,1);
  assert.equal(state.teams[0].phase,PHASES.DEFENSIVE_TRANSITION);
  assert.equal(state.teams[1].phase,PHASES.ATTACKING_TRANSITION);
  assert.equal(state.teams[0].transition,true);
  assert.equal(state.teams[1].transition,true);
});

test('tactical state observation never mutates or owns the free ball',()=>{
  const engine=stubEngine({x:610,y:270,ownerTeam:0});
  const before={...engine.ball};
  updateMatchTacticalState(engine);
  assert.deepEqual(engine.ball,before);
  assert.equal('ownerId' in engine.ball,false);
});

test('MatchEngine exposes tactical state from construction onward',()=>{
  const engine=new MatchEngine([],[],{seed:'tactical-state-runtime'});
  assert.ok(engine.tacticalState);
  assert.equal(engine.tacticalState.teams.length,2);
  assert.equal(engine.currentTacticalState(0).team,0);
  const before={x:engine.ball.x,y:engine.ball.y,vx:engine.ball.vx,vy:engine.ball.vy};
  engine.step(.05);
  assert.deepEqual({x:engine.ball.x,y:engine.ball.y,vx:engine.ball.vx,vy:engine.ball.vy},before);
  assert.equal('ownerId' in engine.ball,false);
});
