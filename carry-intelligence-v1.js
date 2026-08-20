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
function intentDir(p,fallback){const d=p?.carryState?.intentDir;return d&&Number.isFinite(d.x)&&Number.isFinite(d.y)?unit(d.x,d.y):fallback;}
function facingDir(p,fallback){const d=p?.carryState?.faceDir;return d&&Number.isFinite(d.x)&&Number.isFinite(d.y)?unit(d.x,d.y):unit(p?.facingX??fallback.x,p?.facingY??fallback.y);}
function smoothFace(p,desired,dt){const stats=carryStats(p),current=facingDir(p,desired),delta=angle(current,desired),rate=3.1+stats.agility*.045,step=clamp(delta,-rate*dt,rate*dt),next=rotate(current,step);return unit(next.x,next.y);}
function predictedBall(ball,frames){
  const f=clamp(frames,0,12),damp=0.985,scale=f<=0?0:(1-Math.pow(damp,f))/(1-damp);
  return{x:ball.x+(ball.vx||0)*scale,y:ball.y+(ball.vy||0)*scale};
}
function catchLeadFrames(p,ball,physicalContact){
  const stats=carryStats(p),gap=Math.max(0,dist(p,ball)-physicalContact),ballSpeed=mag(ball.vx||0,ball.vy||0),runSpeed=2.65+stats.sprint/100*1.85,closing=Math.max(.55,runSpeed-Math.min(runSpeed-.3,ballSpeed*.78));
  return clamp(gap/closing,0,10);
}

export function carryPlan(engine,p,intentTarget,dt=.016){
  if(!engine?.ball||!p||!intentTarget)return null;
  const ball=engine.ball,stats=carryStats(p),raw=unit(intentTarget.x-ball.x,intentTarget.y-ball.y),previousIntent=intentDir(p,raw),intentDelta=angle(previousIntent,raw),actualGap=dist(p,ball),physicalContact=(p.r||7.25)+(ball.r||4.35),newTurn=Math.abs(intentDelta)>.28&&actualGap<34,state=p.carryState||{};
  // A strong change uses a brief, deliberately over-cut contact angle. This is not ball steering:
  // the player still has to reach that side of the free ball and collision normal supplies the turn.
  const cutAngle=clamp(intentDelta*.36,-.30,.30),newCutDir=newTurn?unit(...Object.values(rotate(raw,cutAngle))):null,turnTicks=newTurn?30:Math.max(0,(state.turnTicks||0)-1),activeTurn=turnTicks>0,carryDir=activeTurn?(newCutDir||(state.turnDir||raw)):raw,face=smoothFace(p,raw,dt),ballSpeed=mag(ball.vx||0,ball.vy||0),lead=catchLeadFrames(p,ball,physicalContact),future=predictedBall(ball,lead);
  const rel={x:ball.x-p.x,y:ball.y-p.y},perp={x:-carryDir.y,y:carryDir.x},forward=dot(rel.x,rel.y,carryDir.x,carryDir.y),lateral=dot(rel.x,rel.y,perp.x,perp.y),playerAround=actualGap>.01?unit(p.x-ball.x,p.y-ball.y):{x:-carryDir.x,y:-carryDir.y},behind={x:-carryDir.x,y:-carryDir.y},aroundError=angle(playerAround,behind);
  const near=actualGap<=physicalContact+4.2,correctSide=Math.abs(aroundError)<.50,ballAhead=forward>physicalContact*.04,aligned=near&&correctSide&&ballAhead;
  let phase,moveTarget;
  if(aligned){
    const stride=clamp(13+stats.pace*.055+ballSpeed*1.45,15,23)*(activeTurn?.68:1);
    moveTarget={x:ball.x+carryDir.x*stride,y:ball.y+carryDir.y*stride};phase='touch';
  }else{
    const radius=physicalContact-1.05,targetBall=activeTurn?predictedBall(ball,Math.min(lead,6.5)):future;
    moveTarget={x:targetBall.x-carryDir.x*radius,y:targetBall.y-carryDir.y*radius};phase=activeTurn?'turn':'recover';
  }
  const facingTarget={x:ball.x+face.x*95,y:ball.y+face.y*95};
  return{moveTarget,facingTarget,dir:face,faceDir:face,intentDir:raw,turnDir:newCutDir||(state.turnDir||raw),turnTicks,phase,aligned,activeTurn,intentDelta,aroundError,actualGap,lead};
}

function steerTurnVelocity(p,target,dt){
  const speed=mag(p.vx||0,p.vy||0);if(speed<.12)return;
  const stats=carryStats(p),desired=unit(target.x-p.x,target.y-p.y),current=unit(p.vx,p.vy),delta=angle(current,desired),rate=4.4+stats.agility*.055,step=clamp(delta,-rate*dt,rate*dt),next=rotate(current,step),retain=clamp(.955+(stats.agility-50)*.0003,.947,.970);
  p.vx=next.x*speed*retain;p.vy=next.y*speed*retain;
}

const previousMovePlayer=MatchEngine.prototype.movePlayer;
const previousDribbleTouchPower=MatchEngine.prototype.dribbleTouchPower;

MatchEngine.prototype.movePlayer=function continuousPhysicalCarry(p,target,dt,track){
  if(!p?.dribbleIntent||p.kickIntent||!this.ball)return previousMovePlayer.call(this,p,target,dt,track);
  const intended={x:p.dribbleIntent.targetX,y:p.dribbleIntent.targetY};
  if(!Number.isFinite(intended.x)||!Number.isFinite(intended.y))return previousMovePlayer.call(this,p,target,dt,track);
  const plan=carryPlan(this,p,intended,dt);if(!plan)return previousMovePlayer.call(this,p,target,dt,track);
  const intent=p.dribbleIntent,oldX=intent.targetX,oldY=intent.targetY;
  intent.targetX=plan.facingTarget.x;intent.targetY=plan.facingTarget.y;
  p.carryState={...(p.carryState||{}),intentDir:plan.intentDir,faceDir:plan.faceDir,turnDir:plan.turnDir,turnTicks:plan.turnTicks,phase:plan.phase,aligned:plan.aligned,lastTick:this.tick};
  if(plan.phase==='turn')steerTurnVelocity(p,plan.moveTarget,dt);
  const result=previousMovePlayer.call(this,p,plan.moveTarget,dt,track);
  if(p.dribbleIntent){p.dribbleIntent.targetX=oldX;p.dribbleIntent.targetY=oldY;}
  return result;
};

MatchEngine.prototype.dribbleTouchPower=function continuousCarryTouch(p){
  const base=previousDribbleTouchPower.call(this,p),state=p?.carryState;
  if(state?.phase==='turn'&&!state?.aligned)return Math.min(base,.07);
  if(state?.phase!=='touch')return base;
  const stats=carryStats(p),speed=mag(p.vx||0,p.vy||0),target=.16+speed*.105+(stats.control+stats.dribbling)*.00135,turnFactor=(state.turnTicks||0)>0?.78:1;
  return clamp(Math.max(base*.82,target)*turnFactor,.12,.62);
};

export const __carryIntelligenceV1={carryStats,intentDir,smoothFace,predictedBall,catchLeadFrames,steerTurnVelocity};
