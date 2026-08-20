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

export function carryPlan(engine,p,intentTarget,dt=.016){
  if(!engine?.ball||!p||!intentTarget)return null;
  const ball=engine.ball,state=p.carryState||{},stats=carryStats(p),raw=unit(intentTarget.x-ball.x,intentTarget.y-ball.y),previousIntent=intentDir(p,raw),intentDelta=angle(previousIntent,raw),actualGap=dist(p,ball),physicalContact=(p.r||7.25)+(ball.r||4.35),newTurn=Math.abs(intentDelta)>.28&&actualGap<34;
  const turnBaseDir=newTurn?previousIntent:(state.turnBaseDir||previousIntent),turnSide=newTurn?(Math.sign(intentDelta)||1):(state.turnSide||1),sideDir=rotate(turnBaseDir,turnSide*Math.PI/2);
  // A sharp cut starts from a shallow rear-side entry. The player never orbits around an
  // attached ball: he closes on the free ball and then runs through it diagonally so the
  // actual circle-contact normal supplies the lateral change of direction.
  const cutNormal=unit(turnBaseDir.x*.66+sideDir.x*.78,turnBaseDir.y*.66+sideDir.y*.78),turnTicks=newTurn?34:Math.max(0,(state.turnTicks||0)-1),activeTurn=turnTicks>0,face=smoothFace(p,raw,dt),ballSpeed=mag(ball.vx||0,ball.vy||0),lead=catchLeadFrames(p,ball,physicalContact),future=predictedBall(ball,lead);

  let phase,moveTarget,aligned=false,nextTurnTicks=turnTicks;
  if(activeTurn){
    const rel={x:ball.x-p.x,y:ball.y-p.y},baseAhead=dot(rel.x,rel.y,turnBaseDir.x,turnBaseDir.y),sideAhead=dot(rel.x,rel.y,sideDir.x,sideDir.y);
    // Collision resolution happens after movement. Waiting until the pre-move position has a
    // large lateral offset creates an impossible one-frame gap: the offset appears only after
    // contact resolution. Enter the cut as soon as the player is physically close, behind the
    // ball and no longer on the wrong side. The following movement still has to create contact.
    const ready=actualGap<=physicalContact+6.2&&baseAhead>physicalContact*.28&&sideAhead>-physicalContact*.07;
    if(ready){
      aligned=true;phase='cut-touch';nextTurnTicks=Math.min(turnTicks,11);const stride=clamp(13+stats.pace*.05+ballSpeed*.95,14.5,20.5);moveTarget={x:ball.x+cutNormal.x*stride,y:ball.y+cutNormal.y*stride};
    }else{
      phase='turn';
      const targetBall=predictedBall(ball,Math.min(lead,2.2)),rear=physicalContact*.82,side=physicalContact*.27;
      moveTarget={x:targetBall.x-turnBaseDir.x*rear-sideDir.x*side,y:targetBall.y-turnBaseDir.y*rear-sideDir.y*side};
    }
  }else{
    const rel={x:ball.x-p.x,y:ball.y-p.y},forward=dot(rel.x,rel.y,raw.x,raw.y),playerAround=actualGap>.01?unit(p.x-ball.x,p.y-ball.y):{x:-raw.x,y:-raw.y},behind={x:-raw.x,y:-raw.y},aroundError=angle(playerAround,behind),near=actualGap<=physicalContact+4.2,correctSide=Math.abs(aroundError)<.47,ballAhead=forward>physicalContact*.05;
    aligned=near&&correctSide&&ballAhead;
    if(aligned){const stride=clamp(13+stats.pace*.055+ballSpeed*1.45,15,23);moveTarget={x:ball.x+raw.x*stride,y:ball.y+raw.y*stride};phase='touch';}
    else{const radius=physicalContact-.9;moveTarget={x:future.x-raw.x*radius,y:future.y-raw.y*radius};phase='recover';}
  }
  const facingTarget={x:ball.x+face.x*95,y:ball.y+face.y*95};
  return{moveTarget,facingTarget,dir:face,faceDir:face,intentDir:raw,turnBaseDir,turnSide,cutNormal,turnTicks:nextTurnTicks,phase,aligned,activeTurn,intentDelta,turnSharpness:Math.abs(intentDelta),actualGap,lead};
}

function steerTurnVelocity(p,target,dt){
  const speed=mag(p.vx||0,p.vy||0);if(speed<.12)return;
  const stats=carryStats(p),desired=unit(target.x-p.x,target.y-p.y),current=unit(p.vx,p.vy),delta=angle(current,desired),rate=5.5+stats.agility*.070,step=clamp(delta,-rate*dt,rate*dt),next=rotate(current,step),retain=clamp(.95+(stats.agility-50)*.0003,.942,.966);p.vx=next.x*speed*retain;p.vy=next.y*speed*retain;
}

const previousMovePlayer=MatchEngine.prototype.movePlayer;
const previousDribbleTouchPower=MatchEngine.prototype.dribbleTouchPower;

MatchEngine.prototype.movePlayer=function continuousPhysicalCarry(p,target,dt,track){
  if(!p?.dribbleIntent||p.kickIntent||!this.ball)return previousMovePlayer.call(this,p,target,dt,track);
  const intended={x:p.dribbleIntent.targetX,y:p.dribbleIntent.targetY};if(!Number.isFinite(intended.x)||!Number.isFinite(intended.y))return previousMovePlayer.call(this,p,target,dt,track);
  const plan=carryPlan(this,p,intended,dt);if(!plan)return previousMovePlayer.call(this,p,target,dt,track);
  const intent=p.dribbleIntent,oldX=intent.targetX,oldY=intent.targetY;intent.targetX=plan.facingTarget.x;intent.targetY=plan.facingTarget.y;
  p.carryState={...(p.carryState||{}),dir:plan.faceDir,intentDir:plan.intentDir,faceDir:plan.faceDir,turnBaseDir:plan.turnBaseDir,turnSide:plan.turnSide,cutNormal:plan.cutNormal,turnTicks:plan.turnTicks,phase:plan.phase,aligned:plan.aligned,lastTick:this.tick};
  if(plan.phase==='turn'||plan.phase==='cut-touch')steerTurnVelocity(p,plan.moveTarget,dt);
  const result=previousMovePlayer.call(this,p,plan.moveTarget,dt,track);if(p.dribbleIntent){p.dribbleIntent.targetX=oldX;p.dribbleIntent.targetY=oldY;}return result;
};

MatchEngine.prototype.dribbleTouchPower=function continuousCarryTouch(p){
  const base=previousDribbleTouchPower.call(this,p),state=p?.carryState;
  if(state?.phase==='turn')return Math.min(base,.03);
  if(state?.phase==='cut-touch'){const stats=carryStats(p),speed=mag(p.vx||0,p.vy||0);return clamp(.27+speed*.12+(stats.control+stats.dribbling)*.0013,.30,.64);}
  if(state?.phase!=='touch')return base;
  const stats=carryStats(p),speed=mag(p.vx||0,p.vy||0),target=.16+speed*.105+(stats.control+stats.dribbling)*.00135;return clamp(Math.max(base*.82,target),.13,.62);
};

export const __carryIntelligenceV1={carryStats,intentDir,smoothFace,predictedBall,catchLeadFrames,steerTurnVelocity};
