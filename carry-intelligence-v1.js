import {MatchEngine} from './engine.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mag=(x,y)=>Math.hypot(x,y);
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;
const angle=(a,b)=>Math.atan2(a.x*b.y-a.y*b.x,dot(a.x,a.y,b.x,b.y));
const rotate=(v,r)=>({x:v.x*Math.cos(r)-v.y*Math.sin(r),y:v.x*Math.sin(r)+v.y*Math.cos(r)});

function carryStats(p){
  const d=p?.data||p||{};
  return{
    control:Number(d.ballControl??65),
    dribbling:Number(d.dribbling??65),
    pace:Number(d.pace??70),
  };
}

function currentCarryDirection(p,fallback){
  const saved=p.carryState?.dir;
  if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))return unit(saved.x,saved.y);
  if(Number.isFinite(p.facingX)&&Number.isFinite(p.facingY))return unit(p.facingX,p.facingY);
  return fallback;
}

function smoothedCarryDirection(p,desired,dt){
  const stats=carryStats(p),previous=currentCarryDirection(p,desired),delta=angle(previous,desired),turnRate=2.45+(stats.dribbling*.018)+(stats.control*.014),step=clamp(delta,-turnRate*dt,turnRate*dt),turned=rotate(previous,step);
  return unit(turned.x,turned.y);
}

export function carryPlan(engine,p,intentTarget,dt=.016){
  if(!engine?.ball||!p||!intentTarget)return null;
  const ball=engine.ball,stats=carryStats(p),rawDesired=unit(intentTarget.x-ball.x,intentTarget.y-ball.y),previous=currentCarryDirection(p,rawDesired),rawTurn=Math.abs(angle(previous,rawDesired)),ballSpeed=mag(ball.vx||0,ball.vy||0),ballDir=ballSpeed>.05?unit(ball.vx,ball.vy):rawDesired;
  const movingWithIntent=dot(ballDir.x,ballDir.y,rawDesired.x,rawDesired.y);
  let desired=rawDesired;
  if(ballSpeed>.15&&movingWithIntent>.05){
    const baseMomentum=clamp(.16+ballSpeed*.05,.16,.42),turnRelease=1-clamp(rawTurn/1.25,0,.88),keepMomentum=baseMomentum*turnRelease;
    desired=unit(rawDesired.x*(1-keepMomentum)+ballDir.x*keepMomentum,rawDesired.y*(1-keepMomentum)+ballDir.y*keepMomentum);
  }
  desired=smoothedCarryDirection(p,desired,dt);
  const perp={x:-desired.y,y:desired.x},contact=(p.r||7.25)+(ball.r||4.35)-.45,rel={x:ball.x-p.x,y:ball.y-p.y},forwardGap=dot(rel.x,rel.y,desired.x,desired.y),lateralGap=dot(rel.x,rel.y,perp.x,perp.y),idealBehind={x:ball.x-desired.x*contact,y:ball.y-desired.y*contact};
  const behindError=dist(p,idealBehind),aligned=Math.abs(lateralGap)<Math.max(4.2,(p.r||7.25)*.72)&&forwardGap>contact*.35;
  const turnSharpness=rawTurn,controlScale=clamp((stats.control+stats.dribbling-90)/110,.18,.92),stride=clamp(14+stats.pace*.055+ballSpeed*2.4,16,27)*(turnSharpness>.48?.58:turnSharpness>.25?.78:1);
  const cutting=turnSharpness>.34&&ballSpeed>.20;
  let moveTarget,phase;
  if(cutting){
    const futureFrames=clamp(.45+ballSpeed*.16,.45,1.25),future={x:ball.x+(ball.vx||0)*futureFrames,y:ball.y+(ball.vy||0)*futureFrames},cutRadius=contact+clamp(ballSpeed*.72,0,3.5);
    moveTarget={x:future.x-desired.x*cutRadius-perp.x*lateralGap*.30,y:future.y-desired.y*cutRadius-perp.y*lateralGap*.30};
    phase='cut';
  }else if(!aligned||behindError>Math.max(7.5,contact*.68)){
    const predictFrames=clamp(1.4+ballSpeed*.7,1.4,4.8),future={x:ball.x+(ball.vx||0)*predictFrames,y:ball.y+(ball.vy||0)*predictFrames};
    moveTarget={x:future.x-desired.x*contact-perp.x*lateralGap*.18,y:future.y-desired.y*contact-perp.y*lateralGap*.18};
    phase='recover';
  }else{
    moveTarget={x:ball.x+desired.x*stride,y:ball.y+desired.y*stride};
    phase='touch';
  }
  const facingTarget={x:ball.x+desired.x*(70+controlScale*35),y:ball.y+desired.y*(70+controlScale*35)};
  return{moveTarget,facingTarget,dir:desired,phase,aligned,turnSharpness,forwardGap,lateralGap,behindError,ballSpeed};
}

const previousMovePlayer=MatchEngine.prototype.movePlayer;
const previousDribbleTouchPower=MatchEngine.prototype.dribbleTouchPower;

MatchEngine.prototype.movePlayer=function continuousPhysicalCarry(p,target,dt,track){
  if(!p?.dribbleIntent||p.kickIntent||!this.ball)return previousMovePlayer.call(this,p,target,dt,track);
  const intended={x:p.dribbleIntent.targetX,y:p.dribbleIntent.targetY};
  if(!Number.isFinite(intended.x)||!Number.isFinite(intended.y))return previousMovePlayer.call(this,p,target,dt,track);
  const plan=carryPlan(this,p,intended,dt);
  if(!plan)return previousMovePlayer.call(this,p,target,dt,track);
  const intent=p.dribbleIntent,oldX=intent.targetX,oldY=intent.targetY;
  intent.targetX=plan.facingTarget.x;intent.targetY=plan.facingTarget.y;
  p.carryState={...(p.carryState||{}),dir:plan.dir,phase:plan.phase,aligned:plan.aligned,turnSharpness:plan.turnSharpness,lastTick:this.tick};
  const result=previousMovePlayer.call(this,p,plan.moveTarget,dt,track);
  if(p.dribbleIntent){p.dribbleIntent.targetX=oldX;p.dribbleIntent.targetY=oldY;}
  return result;
};

MatchEngine.prototype.dribbleTouchPower=function progressiveCarryTouch(p){
  const base=previousDribbleTouchPower.call(this,p),state=p?.carryState;
  if(state?.phase==='cut')return clamp(base*.70,.14,.48);
  if(!state?.aligned)return base;
  const stats=carryStats(p),speed=mag(p.vx||0,p.vy||0),control=(stats.control+stats.dribbling)/2,continuous=.20+speed*.145+control*.00205,turnFactor=state.turnSharpness>.55?.68:state.turnSharpness>.30?.82:1;
  return clamp(Math.max(base,continuous*turnFactor),.14,.88);
};

export const __carryIntelligenceV1={carryStats,currentCarryDirection,smoothedCarryDirection};
