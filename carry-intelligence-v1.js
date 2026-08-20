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
  return{control:Number(d.ballControl??65),dribbling:Number(d.dribbling??65),pace:Number(d.pace??70),agility:Number(p?.motion?.agility??((d.dribbling??65)*.52+(d.ballControl??65)*.30+(d.pace??70)*.18)),sprint:Number(p?.motion?.sprintSpeed??d.pace??70)};
}
function intentDir(p,fallback){const d=p?.carryState?.intentDir||p?.carryState?.dir;return d&&Number.isFinite(d.x)&&Number.isFinite(d.y)?unit(d.x,d.y):fallback;}
function facingDir(p,fallback){const d=p?.carryState?.faceDir||p?.carryState?.dir;return d&&Number.isFinite(d.x)&&Number.isFinite(d.y)?unit(d.x,d.y):unit(p?.facingX??fallback.x,p?.facingY??fallback.y);}
function smoothFace(p,desired,dt){const stats=carryStats(p),current=facingDir(p,desired),delta=angle(current,desired),rate=3.1+stats.agility*.045,step=clamp(delta,-rate*dt,rate*dt),next=rotate(current,step);return unit(next.x,next.y);}
function predictedBall(ball,frames){const f=clamp(frames,0,12),damp=.985,scale=f<=0?0:(1-Math.pow(damp,f))/(1-damp);return{x:ball.x+(ball.vx||0)*scale,y:ball.y+(ball.vy||0)*scale};}
function catchLeadFrames(p,ball,physicalContact){const stats=carryStats(p),gap=Math.max(0,dist(p,ball)-physicalContact),ballSpeed=mag(ball.vx||0,ball.vy||0),runSpeed=2.65+stats.sprint/100*1.85,closing=Math.max(.55,runSpeed-Math.min(runSpeed-.3,ballSpeed*.78));return clamp(gap/closing,0,10);}
function touchInterceptTarget(p,ball,physicalContact){
  const excess=Math.max(0,dist(p,ball)-physicalContact),playerSpeed=mag(p.vx||0,p.vy||0),ballSpeed=mag(ball.vx||0,ball.vy||0),closingBudget=Math.max(.7,playerSpeed+.85-Math.min(playerSpeed-.15,ballSpeed*.70));
  const frames=clamp(.28+excess/closingBudget,.28,1.65);
  return predictedBall(ball,frames);
}

export function carryPlan(engine,p,intentTarget,dt=.016){
  if(!engine?.ball||!p||!intentTarget)return null;
  const ball=engine.ball,state=p.carryState||{},stats=carryStats(p),raw=unit(intentTarget.x-ball.x,intentTarget.y-ball.y),previousIntent=intentDir(p,raw),intentDelta=angle(previousIntent,raw),actualGap=dist(p,ball),physicalContact=(p.r||7.25)+(ball.r||4.35);
  const face=smoothFace(p,raw,dt),ballSpeed=mag(ball.vx||0,ball.vy||0),lead=catchLeadFrames(p,ball,physicalContact),future=predictedBall(ball,lead);
  const rel={x:ball.x-p.x,y:ball.y-p.y},forward=dot(rel.x,rel.y,raw.x,raw.y),playerAround=actualGap>.01?unit(p.x-ball.x,p.y-ball.y):{x:-raw.x,y:-raw.y},behind={x:-raw.x,y:-raw.y},aroundError=angle(playerAround,behind),near=actualGap<=physicalContact+5.0,correctSide=Math.abs(aroundError)<.24,ballAhead=forward>physicalContact*.01;
  const aligned=near&&correctSide&&ballAhead,touchAvailable=(p.touchCooldown||0)<=dt+1e-6;
  let moveTarget,phase,interceptTarget=null;
  if(aligned&&touchAvailable){
    const stride=clamp(13+stats.pace*.055+ballSpeed*1.45,15,23);
    interceptTarget=touchInterceptTarget(p,ball,physicalContact);
    moveTarget={x:ball.x+raw.x*stride,y:ball.y+raw.y*stride};phase='touch';
  }else if(aligned){
    const holdBall=predictedBall(ball,Math.min(lead,.30)),radius=physicalContact+1.45;
    moveTarget={x:holdBall.x-raw.x*radius,y:holdBall.y-raw.y*radius};phase='ready';
  }else{
    const radius=physicalContact+2.6;
    moveTarget={x:future.x-raw.x*radius,y:future.y-raw.y*radius};phase='recover';
  }
  const facingTarget={x:ball.x+face.x*95,y:ball.y+face.y*95};
  return{moveTarget,interceptTarget,facingTarget,dir:face,faceDir:face,intentDir:raw,turnBaseDir:previousIntent,turnSide:Math.sign(intentDelta)||state.turnSide||1,cutNormal:null,cutContacts:0,cutStage:'none',cutStageTicks:0,cutJustHit:false,turnTicks:0,phase,aligned,activeTurn:false,intentDelta,turnSharpness:Math.abs(intentDelta),actualGap,physicalContact,lead,aroundError,touchAvailable};
}

function steerCarryVelocity(p,target,dt,mode='recover'){
  const speed=mag(p.vx||0,p.vy||0);if(speed<.08)return;
  const desired=unit(target.x-p.x,target.y-p.y),current=unit(p.vx,p.vy),delta=angle(current,desired),stats=carryStats(p);
  const turnRate=mode==='touch'?7.5+stats.agility*.086:mode==='ready'?7.0+stats.agility*.082:7.4+stats.agility*.090;
  const step=clamp(delta,-turnRate*dt,turnRate*dt),next=rotate(current,step);
  const sharpLoss=mode==='recover'?Math.min(.12,Math.abs(delta)*.065):0,retention=mode==='ready'?.94:clamp(.985-sharpLoss+(stats.agility-50)*.00008,.88,.992);
  p.vx=next.x*speed*retention;p.vy=next.y*speed*retention;
}
function plantCarryTurn(p,target,sharpness){
  const speed=mag(p.vx||0,p.vy||0);if(speed<.12||sharpness<.28)return;
  const stats=carryStats(p),current=unit(p.vx,p.vy),desired=unit(target.x-p.x,target.y-p.y),delta=angle(current,desired),step=clamp(delta,-.55,.55),next=rotate(current,step),retain=clamp(.72+stats.agility*.0018,.76,.91);
  p.vx=next.x*speed*retain;p.vy=next.y*speed*retain;
}
function closeCarryContact(p,ball,target){
  if(!target)return;
  const n=unit(target.x-p.x,target.y-p.y),relative=dot((p.vx||0)-(ball.vx||0),(p.vy||0)-(ball.vy||0),n.x,n.y),stats=carryStats(p),desired=clamp(.82+stats.pace*.0045+stats.agility*.0035,.95,1.62);
  if(relative>=desired)return;
  const gain=clamp((desired-relative)*.56,0,.72);
  p.vx+=n.x*gain;p.vy+=n.y*gain;
}

const previousMovePlayer=MatchEngine.prototype.movePlayer;
const previousDribbleTouchPower=MatchEngine.prototype.dribbleTouchPower;
const previousResolveBallPlayerCollisions=MatchEngine.prototype.resolveBallPlayerCollisions;

MatchEngine.prototype.movePlayer=function continuousPhysicalCarry(p,target,dt,track){
  if(!p?.dribbleIntent||p.kickIntent||!this.ball)return previousMovePlayer.call(this,p,target,dt,track);
  const intended={x:p.dribbleIntent.targetX,y:p.dribbleIntent.targetY};if(!Number.isFinite(intended.x)||!Number.isFinite(intended.y))return previousMovePlayer.call(this,p,target,dt,track);
  const plan=carryPlan(this,p,intended,dt);if(!plan)return previousMovePlayer.call(this,p,target,dt,track);
  const intent=p.dribbleIntent,oldX=intent.targetX,oldY=intent.targetY;intent.targetX=plan.facingTarget.x;intent.targetY=plan.facingTarget.y;
  p.carryState={...(p.carryState||{}),dir:plan.faceDir,intentDir:plan.intentDir,faceDir:plan.faceDir,turnBaseDir:plan.turnBaseDir,turnSide:plan.turnSide,cutNormal:null,cutContacts:0,cutStage:'none',cutStageTicks:0,cutJustHit:false,turnTicks:0,phase:plan.phase,aligned:plan.aligned,aroundError:plan.aroundError,lastTick:this.tick};
  plantCarryTurn(p,plan.moveTarget,Math.abs(plan.intentDelta));
  const steerTarget=plan.phase==='touch'&&plan.interceptTarget?plan.interceptTarget:plan.moveTarget;
  steerCarryVelocity(p,steerTarget,dt,plan.phase);
  if(plan.phase==='touch')closeCarryContact(p,this.ball,plan.interceptTarget);
  const result=previousMovePlayer.call(this,p,plan.moveTarget,dt,track);if(p.dribbleIntent){p.dribbleIntent.targetX=oldX;p.dribbleIntent.targetY=oldY;}return result;
};

// Repositioning may still physically overlap the free ball, but it is not a dribble stride.
// Let the base resolver separate the circles/rebound them normally while preventing a dribble
// impulse from being consumed until the player is actually aligned for phase='touch'.
MatchEngine.prototype.resolveBallPlayerCollisions=function alignedCarryCollisions(){
  const suppressed=[];
  for(const p of this.players||[]){if(p?.dribbleIntent&&p.carryState?.phase!=='touch'&&(p.touchCooldown||0)<=0){suppressed.push(p);p.touchCooldown=Number.EPSILON;}}
  const result=previousResolveBallPlayerCollisions.call(this);
  for(const p of suppressed){if(p.touchCooldown===Number.EPSILON)p.touchCooldown=0;}
  return result;
};

MatchEngine.prototype.dribbleTouchPower=function continuousCarryTouch(p){
  const base=previousDribbleTouchPower.call(this,p),state=p?.carryState;
  if(state?.phase!=='touch')return base;
  const stats=carryStats(p),speed=mag(p.vx||0,p.vy||0),target=.16+speed*.105+(stats.control+stats.dribbling)*.00135;return clamp(Math.max(base*.82,target),.13,.62);
};

export const __carryIntelligenceV1={carryStats,intentDir,smoothFace,predictedBall,catchLeadFrames,touchInterceptTarget,steerCarryVelocity,plantCarryTurn,closeCarryContact};
