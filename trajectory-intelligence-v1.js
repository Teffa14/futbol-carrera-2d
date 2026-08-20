import {MatchEngine} from './engine.js';
import {FIELD,onsideLimit} from './football-rules-v2.js';
import {motionProfile} from './locomotion-v2.js';
import {predictBallPath,bestReachableTrajectoryPoint,pathPointNearX,ballTravelDirection} from './trajectory-core-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const ROLE_WEIGHT={GK:-20,CB:4,LB:5,RB:5,CDM:7,CM:8,CAM:9,LW:10,RW:10,ST:11};

function memoryLevel(p,key){return clamp(Number(p?.data?.trainingMemory?.[key]?.familiarity)||0,0,100);}
function anticipationMemory(p){
  const values=['scan-before-receive','scan-runner','timed-run','through-ball','far-post-run','box-run'].map(k=>memoryLevel(p,k));
  return Math.max(0,...values)*.12+values.reduce((a,b)=>a+b,0)/Math.max(1,values.length)*.035;
}
function ballPath(engine){
  if(engine._ballTrajectoryTick===engine.tick&&engine._ballTrajectoryPath)return engine._ballTrajectoryPath;
  engine._ballTrajectoryTick=engine.tick;engine._ballTrajectoryPath=predictBallPath(engine.ball,{field:{...FIELD,goalDepth:46},horizonFrames:156,sampleEvery:3});return engine._ballTrajectoryPath;
}
function reach(engine,p,path=ballPath(engine)){
  const profile=p.motion||motionProfile(p),memoryBonus=anticipationMemory(p);return bestReachableTrajectoryPoint(p,path,profile,{memoryBonus,minFrame:3,maxFrame:150,slackFrames:3.2});
}
function candidateScore(engine,p,point){
  if(!point)return-Infinity;const intended=engine.ball.intendedReceiverId===p.id?36:0,lastTeam=engine.ball.lastTeam,ownPass=lastTeam===p.team?7:0,role=ROLE_WEIGHT[p.role]||0,memory=anticipationMemory(p)*.38,forward=(point.x-p.x)*(p.team===0?1:-1),forwardBonus=ownPass?clamp(forward/65,-2,7):0;
  return 70-point.frame+point.margin*1.8+intended+ownPass+role+memory+forwardBonus;
}
function computeTeamClaim(engine,team){
  engine._trajectoryClaimsTick??=-1;if(engine._trajectoryClaimsTick!==engine.tick){engine._trajectoryClaimsTick=engine.tick;engine._trajectoryClaims=[undefined,undefined];}
  if(engine._trajectoryClaims[team]!==undefined)return engine._trajectoryClaims[team];
  const direction=ballTravelDirection(engine.ball);if(direction.speed<.72||engine.restart?.active){engine._trajectoryClaims[team]=null;return null;}
  const path=ballPath(engine),players=engine.players.filter(p=>p.team===team&&p.role!=='GK'),intended=engine.ball.intendedReceiverId?engine.playerById(engine.ball.intendedReceiverId):null;
  let best=null;if(intended?.team===team){const point=reach(engine,intended,path);if(point)best={player:intended,point,score:candidateScore(engine,intended,point)};}
  for(const p of players){if(intended&&p.id===intended.id)continue;const point=reach(engine,p,path);if(!point)continue;const score=candidateScore(engine,p,point);if(!best||score>best.score)best={player:p,point,score};}
  engine._trajectoryClaims[team]=best;return best;
}

export function projectedInterception(engine,p){const claim=computeTeamClaim(engine,p.team);return claim?.player?.id===p.id?claim.point:null;}

function strikerArrivalTarget(engine,p,path){
  if(p.role!=='ST'||engine.ball.lastTeam!==p.team)return null;const dir=p.team===0?1:-1,travel=ballTravelDirection(engine.ball);if(travel.speed<1.05||travel.x*dir<.12)return null;
  const targetX=p.team===0?FIELD.right-145:FIELD.left+145,point=pathPointNearX(path,targetX,dir);if(!point)return null;
  const progress=p.team===0?(point.x-FIELD.left)/(FIELD.right-FIELD.left):(FIELD.right-point.x)/(FIELD.right-FIELD.left);if(progress<.66)return null;
  const wide=Math.abs(point.y-FIELD.centerY)>135||Math.abs(engine.ball.y-FIELD.centerY)>165,ballSide=Math.sign((point.y||engine.ball.y)-FIELD.centerY)||1,limit=onsideLimit(engine,p.team);
  let x=targetX;if(p.team===0)x=Math.min(x,limit);else x=Math.max(x,limit);
  let y;if(wide)y=FIELD.centerY-ballSide*clamp(24+memoryLevel(p,'far-post-run')*.34,24,58);else y=clamp(point.y,FIELD.goalTop-68,FIELD.goalBottom+68);
  return{x:clamp(x,FIELD.left+p.r,FIELD.right-p.r),y:clamp(y,FIELD.top+p.r,FIELD.bottom-p.r),reason:wide?'box-arrival':'trajectory-support'};
}

function secondaryForwardTarget(engine,p,path){
  if(!['LW','RW','CAM'].includes(p.role)||engine.ball.lastTeam!==p.team)return null;const dir=p.team===0?1:-1,travel=ballTravelDirection(engine.ball);if(travel.speed<1.35||travel.x*dir<.2)return null;
  const targetX=p.team===0?FIELD.right-205:FIELD.left+205,point=pathPointNearX(path,targetX,dir);if(!point)return null;const limit=onsideLimit(engine,p.team),side=Math.sign((p.homeY??p.y)-FIELD.centerY)||1;
  let x=targetX;if(p.team===0)x=Math.min(x,limit-5);else x=Math.max(x,limit+5);const y=clamp(point.y+side*34,FIELD.top+p.r,FIELD.bottom-p.r);return{x,y,reason:'support-next-ball'};
}

const previousBallActor=MatchEngine.prototype.ballActor;
MatchEngine.prototype.ballActor=function timeToArrivalBallActor(team){
  const fallback=previousBallActor.call(this,team),speed=Math.hypot(this.ball.vx||0,this.ball.vy||0);if(this.restart?.active||this.ball.shotById)return fallback;
  const recent=this.tick-this.ball.lastTouchTick<38&&this.ball.lastTeam===team?this.playerById(this.ball.lastPlayerId):null;
  if(recent?.team===team&&!this.ball.intendedReceiverId&&dist(recent,this.ball)<58&&speed<4.8)return recent;
  const intended=this.ball.intendedReceiverId?this.playerById(this.ball.intendedReceiverId):null;if(intended?.team===team&&speed>.72){const point=reach(this,intended);if(point)return intended;}
  if(speed<.72)return fallback;
  const claim=computeTeamClaim(this,team);if(!claim?.player)return fallback;
  const fallbackPoint=fallback?reach(this,fallback):null,fallbackScore=fallbackPoint?candidateScore(this,fallback,fallbackPoint):-Infinity;
  return claim.score>fallbackScore+2.5?claim.player:fallback;
};

const previousAiTarget=MatchEngine.prototype.aiTarget;
MatchEngine.prototype.aiTarget=function trajectoryAwareTarget(p,pressers,actor,possession){
  const base=previousAiTarget.call(this,p,pressers,actor,possession);if(!p||p.role==='GK'||this.restart?.active)return base;
  if(p.wallPlay||p.kickIntent||p.dribbleIntent)return base;
  const speed=Math.hypot(this.ball.vx||0,this.ball.vy||0);if(speed<.72)return base;const path=ballPath(this),claim=computeTeamClaim(this,p.team);
  if(claim?.player?.id===p.id){
    const point=claim.point,alreadyClose=dist(p,this.ball)<p.r+this.ball.r+12;if(!alreadyClose){p.anticipationTarget={x:point.x,y:point.y,frame:point.frame,reason:this.ball.intendedReceiverId===p.id?'receive-pass':possession===null?'loose-ball':'intercept'};return{x:clamp(point.x,FIELD.left+p.r,FIELD.right-p.r),y:clamp(point.y,FIELD.top+p.r,FIELD.bottom-p.r)};}
  }
  const striker=strikerArrivalTarget(this,p,path);if(striker){p.anticipationTarget=striker;return{x:striker.x,y:striker.y};}
  const secondary=secondaryForwardTarget(this,p,path);if(secondary){p.anticipationTarget=secondary;return{x:secondary.x,y:secondary.y};}
  p.anticipationTarget=null;return base;
};

export const __trajectoryIntelligenceTest={anticipationMemory,computeTeamClaim,strikerArrivalTarget,secondaryForwardTarget,ballPath,reach,candidateScore};
