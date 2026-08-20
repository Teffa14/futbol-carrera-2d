import {MatchEngine} from './engine.js';
import {FIELD,onsideLimit} from './football-rules-v2.js';
import {motionProfile} from './locomotion-v2.js';
import {estimateArrivalFrames,predictBallPath,bestReachableTrajectoryPoint,pathPointNearX} from './trajectory-core-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
function roleFamily(role){if(role==='GK')return'GK';if(['CB','LB','RB'].includes(role))return'DEF';if(['CDM','CM','CAM'].includes(role))return'MID';return'FWD';}
function attackProgress(engine,team){return team===0?(engine.ball.x-FIELD.left)/(FIELD.right-FIELD.left):(FIELD.right-engine.ball.x)/(FIELD.right-FIELD.left);}
function attackDir(team){return team===0?1:-1;}
function clampTarget(p,t){return{x:clamp(t.x,FIELD.left+p.r,FIELD.right-p.r),y:clamp(t.y,FIELD.top+p.r,FIELD.bottom-p.r)};}
function roleWeight(p){return roleFamily(p.role)==='FWD'?.72:roleFamily(p.role)==='MID'?.52:.30;}

export function collectiveShapeTarget(engine,p,base,possession){
  if(!p||!base||p.role==='GK')return base;const dir=attackDir(p.team),progress=clamp(attackProgress(engine,p.team),0,1),ours=possession===p.team,theirs=possession!==null&&possession!==p.team,fam=roleFamily(p.role);
  let x=base.x,y=base.y;if(ours){const shift=(24+progress*92)*(fam==='DEF'?.82:fam==='MID'?.94:1);x+=dir*shift;const widthScale=1.08+progress*.12;y=FIELD.centerY+(y-FIELD.centerY)*widthScale;y=lerp(y,engine.ball.y,fam==='DEF'?.08:.13);}else if(theirs){const danger=1-progress,shift=(30+danger*86)*(fam==='FWD'?.72:fam==='MID'?.92:1);x-=dir*shift;const compact=.82-danger*.08;y=FIELD.centerY+(y-FIELD.centerY)*compact;y=lerp(y,engine.ball.y,.18+danger*.10);}else{x+=dir*(progress-.5)*22;y=lerp(y,engine.ball.y,.08);}
  return clampTarget(p,{x,y});
}

function candidateRoleFit(p,y){const offset=Math.abs(y-FIELD.centerY),fam=roleFamily(p.role);if(p.role==='LW'||p.role==='RW'||p.role==='LB'||p.role==='RB')return clamp(offset/220,0,1)*.42;if(p.role==='ST')return(1-clamp(offset/210,0,1))*.34;if(p.role==='CAM'||p.role==='CM')return(1-clamp(Math.abs(offset-85)/170,0,1))*.25;return fam==='DEF'?.03:.12;}
function spaceArrivalAdvantage(engine,p,target){const profile=p.motion||motionProfile(p),ours=estimateArrivalFrames(p,target,profile),opps=engine.players.filter(o=>o.team!==p.team&&o.role!=='GK');let enemy=Infinity;for(const o of opps)enemy=Math.min(enemy,estimateArrivalFrames(o,target,o.motion||motionProfile(o)));return clamp((enemy-ours)/18,-1.2,1.8);}

export function bestAttackingSpace(engine,p,actor=null){
  const dir=attackDir(p.team),limit=onsideLimit(engine,p.team),profile=roleFamily(p.role),forwardSteps=profile==='FWD'?[70,120,175,225]:profile==='MID'?[55,100,150]:[42,78],lateralSteps=[-165,-105,-55,0,55,105,165],mates=engine.players.filter(m=>m.team===p.team&&m.id!==p.id),opps=engine.players.filter(o=>o.team!==p.team);let best=null;
  for(const f of forwardSteps)for(const l of lateralSteps){let x=engine.ball.x+dir*f,y=engine.ball.y+l;if(profile==='FWD'){if(dir>0)x=Math.min(x,limit-7);else x=Math.max(x,limit+7);}const t=clampTarget(p,{x,y}),arrival=spaceArrivalAdvantage(engine,p,t),nearestOpp=Math.min(...opps.map(o=>dist(o,t)),190),nearestMate=Math.min(...mates.map(m=>dist(m,t)),190),forward=dir*(t.x-engine.ball.x),actorGap=actor?dist(actor,t):120;
    let score=arrival*.58+clamp(nearestOpp/120,0,1)*.34+clamp(nearestMate/105,0,1)*.22+clamp(forward/190,-.3,1)*.27+candidateRoleFit(p,t.y)+clamp(actorGap/130,0,1)*.09-dist(p,t)/1250;
    if(profile==='DEF'&&forward>95)score-=.24;if(profile==='FWD'&&forward<45)score-=.18;if(!best||score>best.score)best={...t,score,arrivalAdvantage:arrival};}
  return best||clampTarget(p,{x:p.x,y:p.y});
}

export function postPassRunTarget(engine,p,receiver,kind='pass'){
  if(!p||!receiver)return null;const dir=attackDir(p.team),pace=Number(p.data?.pace??70),forward=kind==='wall'?115:kind==='progressive'||kind==='through'?100:78,side=Math.sign(p.y-receiver.y)||Math.sign(p.y-FIELD.centerY)||1;
  let x=receiver.x+dir*(forward+(pace-60)*.45),y=receiver.y+side*(kind==='wall'?72:52);const limit=onsideLimit(engine,p.team);if(roleFamily(p.role)==='FWD'||p.role==='CAM'){if(dir>0)x=Math.min(x,limit-8);else x=Math.max(x,limit+8);}return clampTarget(p,{x,y});
}

export function crossTrajectoryTarget(engine,p){
  const kind=engine.ball?.flightKind;if(kind!=='cross'&&kind!=='cutback')return null;if(engine.ball.flightAttackingTeam!==p.team||engine.tick-(engine.ball.flightStartedTick??-999)>95||Math.hypot(engine.ball.vx||0,engine.ball.vy||0)<.55)return null;
  const fam=roleFamily(p.role);if(fam==='DEF'||p.role==='GK')return null;const path=predictBallPath(engine.ball,{horizonFrames:120,sampleEvery:2}),profile=p.motion||motionProfile(p),direct=bestReachableTrajectoryPoint(p,path,profile,{minFrame:2,maxFrame:110,slackFrames:4});if(engine.ball.flightReceiverId===p.id&&direct)return clampTarget(p,direct);
  const dir=attackDir(p.team),boxX=p.team===0?FIELD.right-92:FIELD.left+92,boxPoint=pathPointNearX(path,boxX,dir)||direct||path[Math.min(path.length-1,12)];if(!boxPoint)return null;
  const attackers=engine.players.filter(a=>a.team===p.team&&a.role!=='GK'&&roleFamily(a.role)!=='DEF').sort((a,b)=>{const rank=r=>r==='ST'?0:(r==='LW'||r==='RW')?1:r==='CAM'?2:3;return rank(a.role)-rank(b.role)||a.y-b.y;});const index=Math.max(0,attackers.findIndex(a=>a.id===p.id)),ballSide=Math.sign(boxPoint.y-FIELD.centerY)||1;
  if(index===0)return clampTarget(p,{x:boxPoint.x-dir*8,y:boxPoint.y-ballSide*24});
  if(index===1)return clampTarget(p,{x:boxPoint.x-dir*18,y:FIELD.centerY-ballSide*58});
  if(index===2)return clampTarget(p,{x:boxPoint.x-dir*92,y:FIELD.centerY+ballSide*18});
  return clampTarget(p,{x:boxPoint.x-dir*(115+index*12),y:FIELD.centerY+(index%2?82:-82)});
}

const previousExecuteKick=MatchEngine.prototype.executeKick;
MatchEngine.prototype.executeKick=function collectiveRunAfterPass(p,contactNormal){
  const intent=p?.kickIntent?{...p.kickIntent}:null,result=previousExecuteKick.call(this,p,contactNormal);if(!result||!intent||intent.type!=='pass')return result;
  const receiver=intent.receiverId?this.playerById(intent.receiverId):null;if(receiver&&p.role!=='GK'&&p.role!=='CB'){const target=postPassRunTarget(this,p,receiver,intent.passKind||'pass');if(target)p.postPassRun={...target,fromTick:this.tick,untilTick:this.tick+58,receiverId:receiver.id,kind:intent.passKind||'pass'};}
  return result;
};

const previousAiTarget=MatchEngine.prototype.aiTarget;
MatchEngine.prototype.aiTarget=function collectiveSpaceFootball(p,pressers,actor,possession){
  const base=previousAiTarget.call(this,p,pressers,actor,possession);if(!p||p.role==='GK'||this.restart?.active)return base;const primaryPresser=possession!==null&&possession!==p.team&&Array.isArray(pressers)&&pressers.some?.(x=>x?.id===p.id);
  if(actor?.id===p.id||primaryPresser||p.kickIntent||p.dribbleIntent)return base;
  const crossTarget=crossTrajectoryTarget(this,p);if(crossTarget){p.spaceRun={kind:'attack-cross-trajectory',x:crossTarget.x,y:crossTarget.y,untilTick:this.tick+8};return crossTarget;}
  if(p.receiveIntent&&p.receiveIntent.untilTick>=this.tick)return base;
  if(p.postPassRun&&this.tick<=p.postPassRun.untilTick){const target=clampTarget(p,p.postPassRun);if(dist(p,target)<20)p.postPassRun=null;else{p.spaceRun={kind:'pass-and-run',x:target.x,y:target.y,untilTick:this.tick+8};return target;}}
  if(p.postPassRun&&this.tick>p.postPassRun.untilTick)p.postPassRun=null;
  const collective=collectiveShapeTarget(this,p,base,possession);if(possession===p.team){const space=bestAttackingSpace(this,p,actor),w=roleWeight(p),target={x:lerp(collective.x,space.x,w),y:lerp(collective.y,space.y,w)};p.spaceRun={kind:'occupy-space',x:target.x,y:target.y,untilTick:this.tick+8};return clampTarget(p,target);}
  if(possession!==null&&possession!==p.team)return clampTarget(p,{x:lerp(base.x,collective.x,.68),y:lerp(base.y,collective.y,.68)});
  return clampTarget(p,{x:lerp(base.x,collective.x,.35),y:lerp(base.y,collective.y,.35)});
};

export const __collectiveSpacePlayV1={collectiveShapeTarget,bestAttackingSpace,postPassRunTarget,crossTrajectoryTarget,spaceArrivalAdvantage};