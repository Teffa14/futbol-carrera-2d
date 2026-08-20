import {MatchEngine} from './engine.js';
import {TrainingMatchEngine} from './training-match-engine-v1.js';
import {FIELD} from './football-rules-v2.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};

function wallCandidates(engine,p){
  const dir=p.team===0?1:-1;
  return engine.players.filter(o=>o.team!==p.team&&o.role!=='GK')
    .filter(o=>{const forward=(o.x-engine.ball.x)*dir;return forward>70&&forward<360&&Math.abs(o.y-engine.ball.y)<145;});
}

export function freeKickPlan(engine,p,target){
  const dir=p.team===0?1:-1,side=(target.y??FIELD.centerY)<engine.ball.y?-1:1,wall=wallCandidates(engine,p);
  const technique=clamp((Number(p.data?.shooting??65)*.48+Number(p.data?.ballControl??65)*.27+Number(p.data?.composure??65)*.25),35,99);
  let wallX=engine.ball.x+dir*220,outsideY=engine.ball.y+side*92;
  if(wall.length){const xs=wall.map(o=>o.x).sort((a,b)=>a-b),ys=wall.map(o=>o.y);wallX=xs[Math.floor(xs.length/2)];outsideY=side<0?Math.min(...ys)-25:Math.max(...ys)+25;}
  const dxWall=Math.max(70,Math.abs(wallX-engine.ball.x)),dxTarget=Math.max(dxWall+80,Math.abs((target.x??(p.team===0?FIELD.right:FIELD.left))-engine.ball.x));
  let initialAimY=engine.ball.y+(outsideY-engine.ball.y)*(dxTarget/dxWall);initialAimY=clamp(initialAimY,FIELD.top+30,FIELD.bottom-30);
  const targetX=target.x??(p.team===0?FIELD.right+28:FIELD.left-28),spin=-side*clamp(.72+(technique-55)*.008,.58,1.08);
  return{targetX,targetY:target.y??FIELD.centerY,initialAim:{x:targetX,y:initialAimY},side,spin,technique,wallX,outsideY};
}

export function applySpinVelocity(vx,vy,spin,dt){
  const speed=Math.hypot(vx,vy);if(!spin||speed<.35)return{vx,vy,spin};
  const frame=clamp(dt,0,.05)*60,theta=spin*.0068*frame*clamp(speed/5,.42,1.18),c=Math.cos(theta),s=Math.sin(theta),nextSpin=spin*Math.pow(.994,frame);
  return{vx:vx*c-vy*s,vy:vx*s+vy*c,spin:Math.abs(nextSpin)<.025?0:nextSpin};
}

const previousArmKick=MatchEngine.prototype.armKick;
MatchEngine.prototype.armKick=function curvedSetPieceArm(p,aim,power,type='kick',meta={}){
  const freeKick=meta?.trainingKind==='free-kick'||type==='free-kick'||meta?.setPieceKind==='free-kick';
  if(!freeKick&&!meta?.curvePlan)return previousArmKick.call(this,p,aim,power,type,meta);
  const plan=meta.curvePlan||freeKickPlan(this,p,aim);return previousArmKick.call(this,p,plan.initialAim,power,type,{...meta,curvePlan:plan,setPieceKind:'free-kick'});
};

const previousExecuteKick=MatchEngine.prototype.executeKick;
MatchEngine.prototype.executeKick=function curvedSetPieceContact(p,contactNormal){
  const plan=p?.kickIntent?.curvePlan?{...p.kickIntent.curvePlan}:null,result=previousExecuteKick.call(this,p,contactNormal);
  if(result&&plan){this.ball.spin=plan.spin;this.ball.setPieceCurve={targetX:plan.targetX,targetY:plan.targetY,startedTick:this.tick,technique:plan.technique};p.lastSetPieceProfile=plan;}
  return result;
};

const previousUpdateFreeBall=MatchEngine.prototype.updateFreeBall;
MatchEngine.prototype.updateFreeBall=function spinAwareFreeBall(dt){
  if(this.ball?.spin){const spun=applySpinVelocity(this.ball.vx,this.ball.vy,this.ball.spin,dt);this.ball.vx=spun.vx;this.ball.vy=spun.vy;this.ball.spin=spun.spin;}
  const result=previousUpdateFreeBall.call(this,dt);if(Math.hypot(this.ball.vx||0,this.ball.vy||0)<.28)this.ball.spin=0;return result;
};

const previousTrainingTryKick=TrainingMatchEngine.prototype.tryKick;
TrainingMatchEngine.prototype.tryKick=function profiledTrainingFreeKick(p,target,power,kind='pass',receiver=null,dt=.016){
  if(kind!=='free-kick')return previousTrainingTryKick.call(this,p,target,power,kind,receiver,dt);
  if(this.lastTrainingKick?.rep===this.rep&&this.lastTrainingKick.by===p.id&&this.lastTrainingKick.kind==='free-kick')return true;
  const plan=freeKickPlan(this,p,target),initial=unit(plan.initialAim.x-this.ball.x,plan.initialAim.y-this.ball.y),tangent={x:-initial.y,y:initial.x},contact=p.r+this.ball.r-.6;
  const profile={x:this.ball.x-initial.x*(contact+5)+tangent.x*plan.side*11,y:this.ball.y-initial.y*(contact+5)+tangent.y*plan.side*11};
  if(!p.kickIntent&&dist(p,profile)>4.5){this.move(p,profile,dt);p.action='perfil';p.actionTimer=.2;return false;}
  if(!p.kickIntent)this.armKick(p,target,power,'shot',{trainingKind:'free-kick'});
  const spot={x:this.ball.x-initial.x*contact,y:this.ball.y-initial.y*contact};this.move(p,spot,dt);p.action='rosca';p.actionTimer=.25;return false;
};

export const __setPieceCurveV1={freeKickPlan,applySpinVelocity};
