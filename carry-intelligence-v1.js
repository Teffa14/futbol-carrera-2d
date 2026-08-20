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
  // Desired collision normal. For a turn the player must physically arrive on the opposite
  // rear-side of the free ball. The resolver then supplies the ball impulse along this normal.
  const cutNormal=unit(turnBaseDir.x*.50+sideDir.x*.87,turnBaseDir.y*.50+sideDir.y*.87);
  const inheritedContacts=newTurn?0:(state.cutContacts||0),turnTicks=newTurn?72:Math.max(0,(state.turnTicks||0)-1),completedCuts=inheritedContacts>=2,activeTurn=!completedCuts&&turnTicks>0;
  const face=smoothFace(p,raw,dt),ballSpeed=mag(ball.vx||0,ball.vy||0),lead=catchLeadFrames(p,ball,physicalContact),future=predictedBall(ball,lead);

  let phase,moveTarget,aligned=false,nextTurnTicks=turnTicks,cutStage=newTurn?'setup':(state.cutStage||'setup');
  if(activeTurn){
    const setupRadius=physicalContact+2.7,impactRadius=Math.max(physicalContact-1.6,physicalContact*.86);
    const setupTarget={x:ball.x-cutNormal.x*setupRadius,y:ball.y-cutNormal.y*setupRadius};
    const impactTarget={x:ball.x-cutNormal.x*impactRadius,y:ball.y-cutNormal.y*impactRadius};
    const setupError=dist(p,setupTarget),touchAvailable=(p.touchCooldown||0)<=dt+1e-6;

    // A confirmed hit always sends the next frame back to setup. This prevents the player from
    // crossing to the wrong side and applying cancelling contacts while the ball is still free.
    if(state.cutJustHit){cutStage='setup';}
    if(cutStage==='strike'&&!touchAvailable)cutStage='setup';
    if(cutStage==='setup'&&touchAvailable&&setupError<=7.2)cutStage='strike';

    if(cutStage==='strike'){
      phase='cut-approach';aligned=true;moveTarget=impactTarget;
    }else{
      phase='cut-setup';
      // Use very little future-ball prediction here. The purpose is to gain the exact physical
      // side of the current ball, not to chase a moving waypoint that can never be reached.
      const targetBall=predictedBall(ball,Math.min(lead,.55));
      moveTarget={x:targetBall.x-cutNormal.x*setupRadius,y:targetBall.y-cutNormal.y*setupRadius};
    }
  }else{
    nextTurnTicks=0;cutStage='setup';
    const rel={x:ball.x-p.x,y:ball.y-p.y},forward=dot(rel.x,rel.y,raw.x,raw.y),playerAround=actualGap>.01?unit(p.x-ball.x,p.y-ball.y):{x:-raw.x,y:-raw.y},behind={x:-raw.x,y:-raw.y},aroundError=angle(playerAround,behind),near=actualGap<=physicalContact+4.2,correctSide=Math.abs(aroundError)<.47,ballAhead=forward>physicalContact*.05;
    aligned=near&&correctSide&&ballAhead;
    if(aligned){const stride=clamp(13+stats.pace*.055+ballSpeed*1.45,15,23);moveTarget={x:ball.x+raw.x*stride,y:ball.y+raw.y*stride};phase='touch';}
    else{const radius=physicalContact-.9;moveTarget={x:future.x-raw.x*radius,y:future.y-raw.y*radius};phase='recover';}
  }
  const facingTarget={x:ball.x+face.x*95,y:ball.y+face.y*95};
  return{moveTarget,facingTarget,dir:face,faceDir:face,intentDir:raw,turnBaseDir,turnSide,cutNormal,cutContacts:inheritedContacts,cutStage,cutJustHit:false,turnTicks:nextTurnTicks,phase,aligned,activeTurn,intentDelta,turnSharpness:Math.abs(intentDelta),actualGap,lead};
}

function steerTurnVelocity(p,target,dt){
  const speed=mag(p.vx||0,p.vy||0);if(speed<.12)return;
  const stats=carryStats(p),desired=unit(target.x-p.x,target.y-p.y),current=unit(p.vx,p.vy),delta=angle(current,desired),rate=6.2+stats.agility*.078,step=clamp(delta,-rate*dt,rate*dt),next=rotate(current,step),retain=clamp(.948+(stats.agility-50)*.0003,.940,.965);p.vx=next.x*speed*retain;p.vy=next.y*speed*retain;
}

const previousMovePlayer=MatchEngine.prototype.movePlayer;
const previousDribbleTouchPower=MatchEngine.prototype.dribbleTouchPower;
const previousResolveBallPlayerCollisions=MatchEngine.prototype.resolveBallPlayerCollisions;

MatchEngine.prototype.movePlayer=function continuousPhysicalCarry(p,target,dt,track){
  if(!p?.dribbleIntent||p.kickIntent||!this.ball)return previousMovePlayer.call(this,p,target,dt,track);
  const intended={x:p.dribbleIntent.targetX,y:p.dribbleIntent.targetY};if(!Number.isFinite(intended.x)||!Number.isFinite(intended.y))return previousMovePlayer.call(this,p,target,dt,track);
  const plan=carryPlan(this,p,intended,dt);if(!plan)return previousMovePlayer.call(this,p,target,dt,track);
  const intent=p.dribbleIntent,oldX=intent.targetX,oldY=intent.targetY;intent.targetX=plan.facingTarget.x;intent.targetY=plan.facingTarget.y;
  p.carryState={...(p.carryState||{}),dir:plan.faceDir,intentDir:plan.intentDir,faceDir:plan.faceDir,turnBaseDir:plan.turnBaseDir,turnSide:plan.turnSide,cutNormal:plan.cutNormal,cutContacts:plan.cutContacts,cutStage:plan.cutStage,cutJustHit:plan.cutJustHit,turnTicks:plan.turnTicks,phase:plan.phase,aligned:plan.aligned,lastTick:this.tick};
  if(plan.phase==='cut-setup'||plan.phase==='cut-approach')steerTurnVelocity(p,plan.moveTarget,dt);
  const result=previousMovePlayer.call(this,p,plan.moveTarget,dt,track);if(p.dribbleIntent){p.dribbleIntent.targetX=oldX;p.dribbleIntent.targetY=oldY;}return result;
};

// Setup grazes may overlap because both objects are physical. They must still resolve overlap and
// rebound, but must not consume a dribble touch. A cut only advances when the base resolver proves
// that an eligible cut-approach collision actually applied an impulse by raising touchCooldown.
MatchEngine.prototype.resolveBallPlayerCollisions=function carryAwareBallCollisionResolution(){
  const suppressed=[],strikeBefore=[];
  for(const p of this.players||[]){
    const phase=p?.carryState?.phase;
    if(p?.dribbleIntent&&phase==='cut-setup'&&(p.touchCooldown||0)<=0){suppressed.push(p);p.touchCooldown=Number.EPSILON;}
    if(p?.dribbleIntent&&phase==='cut-approach')strikeBefore.push([p,p.touchCooldown||0]);
  }
  const result=previousResolveBallPlayerCollisions.call(this);
  for(const p of suppressed){if(p.touchCooldown===Number.EPSILON)p.touchCooldown=0;}
  for(const [p,before] of strikeBefore){
    if((p.touchCooldown||0)>before+.04){
      p.carryState={...(p.carryState||{}),cutContacts:(p.carryState?.cutContacts||0)+1,cutStage:'setup',cutJustHit:true,phase:'cut-hit'};
    }
  }
  return result;
};

MatchEngine.prototype.dribbleTouchPower=function continuousCarryTouch(p){
  const base=previousDribbleTouchPower.call(this,p),state=p?.carryState;
  if(state?.phase==='cut-setup')return 0;
  if(state?.phase==='cut-approach'){const stats=carryStats(p),speed=mag(p.vx||0,p.vy||0);return clamp(.30+speed*.13+(stats.control+stats.dribbling)*.0014,.34,.68);}
  if(state?.phase!=='touch')return base;
  const stats=carryStats(p),speed=mag(p.vx||0,p.vy||0),target=.16+speed*.105+(stats.control+stats.dribbling)*.00135;return clamp(Math.max(base*.82,target),.13,.62);
};

export const __carryIntelligenceV1={carryStats,intentDir,smoothFace,predictedBall,catchLeadFrames,steerTurnVelocity};
