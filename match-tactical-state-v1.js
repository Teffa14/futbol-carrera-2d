import {MatchEngine} from './engine.js';
import {PHASES,attackProgress,attackingLane,thirdFor,detectTeamPhase} from './tactics.js';

export const DEFENSIVE_BLOCKS={HIGH_PRESS:'high-press',MID_BLOCK:'mid-block',LOW_BLOCK:'low-block'};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function effectivePossession(engine){
  const inferred=engine.inferPossessionTeam?.();
  if(inferred===0||inferred===1)return inferred;
  return engine.lastPossessionTeam===0||engine.lastPossessionTeam===1?engine.lastPossessionTeam:null;
}

export function defensiveBlockFor({team,ball,ownerTeam,tactics={}}){
  if(ownerTeam===team||ownerTeam===null||ownerTeam===undefined)return null;
  const progress=attackProgress(ball,team);
  const pressing=clamp(Number(tactics.pressing)||55,20,90);
  if(progress>=.68)return DEFENSIVE_BLOCKS.HIGH_PRESS;
  if(progress<=.32)return DEFENSIVE_BLOCKS.LOW_BLOCK;
  if(progress>=.55&&pressing>=72)return DEFENSIVE_BLOCKS.HIGH_PRESS;
  return DEFENSIVE_BLOCKS.MID_BLOCK;
}

export function deriveTeamTacticalState(engine,team,{ownerTeam=effectivePossession(engine),previousOwnerTeam=null,secondsSinceChange=99}={}){
  const ball=engine.ball;
  const phase=detectTeamPhase({team,ball,ownerTeam,previousOwnerTeam,secondsSinceChange});
  return {
    team,
    phase,
    inPossession:ownerTeam===team,
    ownerTeam,
    ballProgress:Number(attackProgress(ball,team).toFixed(3)),
    third:thirdFor(ball,team),
    lane:attackingLane(ball,team),
    defensiveBlock:defensiveBlockFor({team,ball,ownerTeam,tactics:engine.tactics?.[team]||{}}),
    transition:phase===PHASES.ATTACKING_TRANSITION||phase===PHASES.DEFENSIVE_TRANSITION,
  };
}

function ensureRuntime(engine){
  if(engine._tacticalStateRuntime)return engine._tacticalStateRuntime;
  const ownerTeam=effectivePossession(engine);
  engine._tacticalStateRuntime={ownerTeam,previousOwnerTeam:null,changedMinute:engine.minute||0};
  return engine._tacticalStateRuntime;
}

export function updateMatchTacticalState(engine){
  const runtime=ensureRuntime(engine);
  const nextOwner=effectivePossession(engine);
  if((nextOwner===0||nextOwner===1)&&nextOwner!==runtime.ownerTeam){
    runtime.previousOwnerTeam=runtime.ownerTeam;
    runtime.ownerTeam=nextOwner;
    runtime.changedMinute=engine.minute||0;
  }
  const secondsSinceChange=Math.max(0,((engine.minute||0)-runtime.changedMinute)*60);
  const ownerTeam=runtime.ownerTeam;
  const teams=[0,1].map(team=>deriveTeamTacticalState(engine,team,{ownerTeam,previousOwnerTeam:runtime.previousOwnerTeam,secondsSinceChange}));
  engine.tacticalState={
    ownerTeam,
    previousOwnerTeam:runtime.previousOwnerTeam,
    changedMinute:runtime.changedMinute,
    secondsSinceChange:Number(secondsSinceChange.toFixed(2)),
    teams,
  };
  return engine.tacticalState;
}

const originalResetPositions=MatchEngine.prototype.resetPositions;
MatchEngine.prototype.resetPositions=function resetPositionsWithTacticalState(...args){
  const result=originalResetPositions.apply(this,args);
  if(this._tacticalStateRuntime){
    this._tacticalStateRuntime.ownerTeam=null;
    this._tacticalStateRuntime.previousOwnerTeam=null;
    this._tacticalStateRuntime.changedMinute=this.minute||0;
  }
  updateMatchTacticalState(this);
  return result;
};

const originalStep=MatchEngine.prototype.step;
MatchEngine.prototype.step=function stepWithTacticalState(dt){
  const result=originalStep.call(this,dt);
  updateMatchTacticalState(this);
  return result;
};

MatchEngine.prototype.currentTacticalState=function currentTacticalState(team){
  if(!this.tacticalState)updateMatchTacticalState(this);
  return this.tacticalState.teams[team]||null;
};
