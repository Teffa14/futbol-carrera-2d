import {MatchEngine} from './engine.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mag=(x,y)=>Math.hypot(x,y);
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;
const angle=(a,b)=>Math.atan2(a.x*b.y-a.y*b.x,dot(a.x,a.y,b.x,b.y));
const rotate=(v,r)=>({x:v.x*Math.cos(r)-v.y*Math.sin(r),y:v.x*Math.sin(r)+v.y*Math.cos(r)});

function carryStats(p){const d=p?.data||p||{};return{control:Number(d.ballControl??65),dribbling:Number(d.dribbling??65),pace:Number(d.pace??70)};}
function currentCarryDirection(p,fallback){const saved=p.carryState?.dir;if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))return unit(saved.x,saved.y);if(Number.isFinite(p.facingX)&&Number.isFinite(p.facingY))return unit(p.facingX,p.facingY);return fallback;}
function smoothedCarryDirection(p,desired,dt){const stats=carryStats(p),previous=currentCarryDirection(p,desired),delta=angle(previous,desired),turnRate=2.45+(stats.dribbling*.018)+(stats.control*.014),step=clamp(delta,-turnRate*dt,turnRate*dt),turned=rotate(previous,step);return unit(turned.x,turned.y);}

export function carryPlan(engine,p,intentTarget,dt=.016){
  if(!engine?.ball||!p||!intentTarget)return null;
  const ball=engine.ball,stats=carryStats(p),rawDesired=unit(intentTarget.x-ball.x,intentTarget.y-ball.y),previous=currentCarryDirection(p,rawDesired),rawTurn=Math.abs(angle(previous,rawDesired)),ballSpeed=mag(ball.vx||0,ball.vy||0),ballDir=ballSpeed>.05?unit(ball.vx,ball.vy):rawDesired,movingWithIntent=dot(ballDir.x,ballDir.y,rawDesired.x,rawDesired.y);
  let faceDesired=rawDesired;
  if(ballSpeed>.15&&movingWithIntent>.05){const baseMomentum=clamp(.12+ballSpeed*.04,.12,.34),turnRelease=1-clamp(rawTurn/1.05,0,.94),keepMomentum=baseMomentum*turnRelease;faceDesired=unit(rawDesired.x*(1-keepMomentum)+ballDir.x*keepMomentum,rawDesired.y*(1-keepMomentum)+ballDir.y*keepMomentum);}
  const facingDir=smoothedCarryDirection(p,faceDesired,dt),contactDir=rawDesired,perp={x:-contactDir.y,y:contactDir.x},physicalContact=(p.r||7.25)+(ball.r||4.35),contact=physicalContact-.45,rel={x:ball.x-p.x,y:ball.y-p.y};
  const forwardGap=dot(rel.x,rel.y,contactDir.x,contactDir.y),lateralGap=dot(rel.x,rel.y,perp.x,perp.y),idealBehind={x:ball.x-contactDir.x*contact,y:ball.y-contactDir.y*contact},behindError=dist(p,idealBehind),actualGap=dist(p,ball),lateralTolerance=Math.max(4.0,(p.r||7.25)*.66),aligned=Math.abs(lateralGap)<lateralTolerance&&forwardGap>contact*.42&&behindError<Math.max(6.6,contact*.58);
  // Once the runner is almost touching the ball and has it in the forward hemisphere,
  // stop orbiting around a mathematically perfect point. Driving through the collision
  // circle creates the next real touch and lets several contacts bend the carry naturally.
  const correctiveTouch=!aligned&&actualGap<=physicalContact+4.0&&forwardGap>physicalContact*.08&&Math.abs(lateralGap)<physicalContact*1.10;
  const touchReady=aligned||correctiveTouch,controlScale=clamp((stats.control+stats.dribbling-90)/110,.18,.92),stride=clamp(14+stats.pace*.055+ballSpeed*2.4,16,27)*(rawTurn>.48?.58:rawTurn>.25?.78:1);
  let moveTarget,phase;
  if(touchReady){
    const correctiveStride=correctiveTouch?clamp(stride*.72,11,19):stride;
    moveTarget={x:ball.x+contactDir.x*correctiveStride,y:ball.y+contactDir.y*correctiveStride};phase='touch';
  }else{
    const predictFrames=clamp(ballSpeed*.07,0,.38),future={x:ball.x+(ball.vx||0)*predictFrames,y:ball.y+(ball.vy||0)*predictFrames},brake=rawTurn>.34&&ballSpeed>.20,sideCorrection=clamp(lateralGap*.08,-2.5,2.5),penetration=clamp(2.5+ballSpeed*.22,2.5,3.5),recontactRadius=Math.max((p.r||7.25)*.72,contact-penetration);
    moveTarget={x:future.x-contactDir.x*recontactRadius-perp.x*sideCorrection,y:future.y-contactDir.y*recontactRadius-perp.y*sideCorrection};phase=brake?'cut':'recover';
  }
  const facingTarget={x:ball.x+facingDir.x*(70+controlScale*35),y:ball.y+facingDir.y*(70+controlScale*35)};
  return{moveTarget,facingTarget,dir:facingDir,contactDir,phase,aligned:touchReady,correctiveTouch,turnSharpness:rawTurn,forwardGap,lateralGap,behindError,ballSpeed,actualGap};
}

const previousMovePlayer=MatchEngine.prototype.movePlayer,previousDribbleTouchPower=MatchEngine.prototype.dribbleTouchPower;
MatchEngine.prototype.movePlayer=function continuousPhysicalCarry(p,target,dt,track){
  if(!p?.dribbleIntent||p.kickIntent||!this.ball)return previousMovePlayer.call(this,p,target,dt,track);
  const intended={x:p.dribbleIntent.targetX,y:p.dribbleIntent.targetY};if(!Number.isFinite(intended.x)||!Number.isFinite(intended.y))return previousMovePlayer.call(this,p,target,dt,track);
  const plan=carryPlan(this,p,intended,dt);if(!plan)return previousMovePlayer.call(this,p,target,dt,track);
  const intent=p.dribbleIntent,oldX=intent.targetX,oldY=intent.targetY;intent.targetX=plan.facingTarget.x;intent.targetY=plan.facingTarget.y;p.carryState={...(p.carryState||{}),dir:plan.dir,contactDir:plan.contactDir,phase:plan.phase,aligned:plan.aligned,correctiveTouch:plan.correctiveTouch,turnSharpness:plan.turnSharpness,lastTick:this.tick};
  if(plan.phase==='cut'){const control=carryStats(p).control,brake=clamp(.90+(control-50)*.0009,.90,.945);p.vx*=brake;p.vy*=brake;}
  const result=previousMovePlayer.call(this,p,plan.moveTarget,dt,track);if(p.dribbleIntent){p.dribbleIntent.targetX=oldX;p.dribbleIntent.targetY=oldY;}return result;
};
MatchEngine.prototype.dribbleTouchPower=function progressiveCarryTouch(p){const base=previousDribbleTouchPower.call(this,p),state=p?.carryState;if(state?.phase==='cut')return clamp(base*.62,.12,.42);if(!state?.aligned)return base;const stats=carryStats(p),speed=mag(p.vx||0,p.vy||0),control=(stats.control+stats.dribbling)/2,continuous=.20+speed*.145+control*.00205,turnFactor=state.correctiveTouch?.72:state.turnSharpness>.55?.68:state.turnSharpness>.30?.82:1;return clamp(Math.max(base,continuous*turnFactor),.14,.88);};

export const __carryIntelligenceV1={carryStats,currentCarryDirection,smoothedCarryDirection};
