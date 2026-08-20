import {MatchEngine} from './engine.js';
import {FIELD,isOffsidePosition,secondLastDefenderLine} from './football-rules-v2.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
const deepKind=k=>k==='through'||k==='lob-through';

export function liveOffsideLine(engine,team,ballX=engine.ball.x){
  const defender=secondLastDefenderLine(engine,team);
  return team===0?Math.max(FIELD.centerX,ballX,defender):Math.min(FIELD.centerX,ballX,defender);
}

export function preRunHoldPoint(engine,p,receiveIntent=p?.receiveIntent){
  const dir=p.team===0?1:-1,line=liveOffsideLine(engine,p.team),forwardSpeed=Math.max(0,dir*Number(p.vx||0));
  const braking=clamp(8+forwardSpeed*5.5,8,25),x=line-dir*braking;
  const aimY=Number(receiveIntent?.aimY??p.y),y=clamp(p.y+(aimY-p.y)*.18,FIELD.top+p.r,FIELD.bottom-p.r);
  return{x:clamp(x,FIELD.left+p.r,FIELD.right-p.r),y,line,braking};
}

export function canReleaseTimedPass(engine,p,kickIntent=p?.kickIntent){
  if(!kickIntent||kickIntent.type!=='pass'||!deepKind(kickIntent.passKind)||!kickIntent.receiverId)return true;
  const receiver=engine.playerById(kickIntent.receiverId);return !receiver||!isOffsidePosition(engine,receiver,engine.ball.x);
}

const previousAiTarget=MatchEngine.prototype.aiTarget;
MatchEngine.prototype.aiTarget=function timedThroughRunTarget(p,pressers,actor,possession){
  const base=previousAiTarget.call(this,p,pressers,actor,possession);if(!p?.receiveIntent||this.restart?.active)return base;
  const r=p.receiveIntent;if(!r.waitForKick||!deepKind(r.kind))return base;
  const hold=preRunHoldPoint(this,p,r),dir=p.team===0?1:-1,toAim=unit((r.aimX??p.x)-p.x,(r.aimY??p.y)-p.y);
  p.preRunState={kind:r.kind,line:hold.line,holdX:hold.x,createdTick:r.createdTick};
  p.desiredFacingX=unit(dir*.82+toAim.x*.35,toAim.y*.35).x;p.desiredFacingY=unit(dir*.82+toAim.x*.35,toAim.y*.35).y;
  return{x:hold.x,y:hold.y};
};

const previousMovePlayer=MatchEngine.prototype.movePlayer;
MatchEngine.prototype.movePlayer=function brakeAtOffsideLine(p,target,dt,track){
  const r=p?.receiveIntent;
  if(r?.waitForKick&&deepKind(r.kind)&&!this.restart?.active){
    const dir=p.team===0?1:-1,line=liveOffsideLine(this,p.team),gap=dir*(line-p.x),forward=dir*Number(p.vx||0);
    if(gap<34&&forward>0){const cap=clamp((gap-4)*.055,.02,1.12);if(forward>cap)p.vx=dir*cap;}
  }
  return previousMovePlayer.call(this,p,target,dt,track);
};

const previousExecuteKick=MatchEngine.prototype.executeKick;
MatchEngine.prototype.executeKick=function waitForOnsideThroughRun(p,contactNormal){
  const k=p?.kickIntent;if(k&&k.type==='pass'&&deepKind(k.passKind)&&!canReleaseTimedPass(this,p,k)){
    const receiver=this.playerById(k.receiverId);if(receiver?.receiveIntent)receiver.receiveIntent.waitForKick=true;
    k.ttl=Math.max(Number(k.ttl)||0,.18);p.decisionCooldown=Math.max(Number(p.decisionCooldown)||0,.06);return false;
  }
  return previousExecuteKick.call(this,p,contactNormal);
};

export const __throughRunTimingV2={liveOffsideLine,preRunHoldPoint,canReleaseTimedPass};
