import {MatchEngine} from './engine.js';
import {FIELD} from './football-rules-v2.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function nearestOpponent(engine,p){return engine.players.filter(o=>o.team!==p.team).sort((a,b)=>dist(a,p)-dist(b,p))[0]||null;}

export function receptionExitVector(engine,p,ballPosition=engine.ball){
  const dir=p.team===0?1:-1,opp=nearestOpponent(engine,p),pressure=opp?clamp((68-dist(opp,p))/68,0,1):0,away=opp?unit(p.x-opp.x,p.y-opp.y):{x:0,y:0};
  const boxProgress=p.team===0?(p.x-FIELD.left)/(FIELD.right-FIELD.left):(FIELD.right-p.x)/(FIELD.right-FIELD.left),centrePull=clamp((FIELD.centerY-p.y)/180,-1,1);
  let x=dir*(.82+boxProgress*.18)+away.x*(.18+.52*pressure),y=centrePull*.16+away.y*(.18+.58*pressure);
  if(p.role==='LW'||p.role==='RW')y+=Math.sign((p.homeY??p.y)-FIELD.centerY)*.10;
  return unit(x,y);
}

export function orientedReceptionVelocity({ballVx=0,ballVy=0,playerVx=0,playerVy=0,normalX=1,normalY=0,exitX=1,exitY=0,quality=70}={}){
  const normal=unit(normalX,normalY),desired=unit(exitX,exitY),incoming=Math.hypot(ballVx-playerVx,ballVy-playerVy),q=clamp(Number(quality)||70,20,99);
  let path=desired;
  if(dot(normal.x,normal.y,desired.x,desired.y)<-.08){const a={x:-normal.y,y:normal.x},b={x:normal.y,y:-normal.x},t=dot(a.x,a.y,desired.x,desired.y)>=dot(b.x,b.y,desired.x,desired.y)?a:b;path=unit(t.x*.84+desired.x*.38,t.y*.84+desired.y*.38);}
  const release=clamp(.30+(100-q)*.011+incoming*.025,.30,1.55),carry=.22+q*.0032,target={x:playerVx*carry+path.x*release,y:playerVy*carry+path.y*release},blend=clamp(.46+(q-50)*.009,.46,.88);
  return{vx:lerp(ballVx,target.x,blend),vy:lerp(ballVy,target.y,blend),path,release,blend};
}

const previousCollisions=MatchEngine.prototype.resolveBallPlayerCollisions;
MatchEngine.prototype.resolveBallPlayerCollisions=function orientedReceptionContacts(){
  if(!this.ball||!Array.isArray(this.players))return previousCollisions.call(this);
  const incoming={x:this.ball.x,y:this.ball.y,vx:this.ball.vx,vy:this.ball.vy,intendedReceiverId:this.ball.intendedReceiverId,passerId:this.ball.passerId,lastTeam:this.ball.lastTeam};
  const result=previousCollisions.call(this);
  for(const p of this.players){
    if(p.lastReceptionControlTick!==this.tick)continue;
    const intended=incoming.intendedReceiverId===p.id,ownPass=!!incoming.passerId&&incoming.lastTeam===p.team;if(!intended&&!ownPass)continue;
    const dx=incoming.x-p.x,dy=incoming.y-p.y,n=unit(dx,dy),exit=receptionExitVector(this,p,incoming),touch=orientedReceptionVelocity({ballVx:incoming.vx,ballVy:incoming.vy,playerVx:p.vx,playerVy:p.vy,normalX:n.x,normalY:n.y,exitX:exit.x,exitY:exit.y,quality:p.lastControlQuality??65});
    this.ball.vx=touch.vx;this.ball.vy=touch.vy;p.receptionPlan={x:exit.x,y:exit.y,untilTick:this.tick+22,quality:p.lastControlQuality??65};
    p.action=(p.lastControlQuality??65)>=76?'control orientado':'acomoda';p.actionTimer=Math.max(p.actionTimer||0,.42);
  }
  return result;
};

const previousAiTarget=MatchEngine.prototype.aiTarget;
MatchEngine.prototype.aiTarget=function receptionRecoveryTarget(p,pressers,actor,possession){
  const base=previousAiTarget.call(this,p,pressers,actor,possession),plan=p?.receptionPlan;if(!plan||this.tick>plan.untilTick||this.restart?.active||p.kickIntent)return base;
  if(actor?.id!==p.id)return base;const attackDir=p.team===0?1:-1,relX=(this.ball.x-p.x)*attackDir,ballGap=dist(p,this.ball);
  if(relX<-1.5&&ballGap<46){const exit=unit(plan.x,plan.y),contact=p.r+this.ball.r-.7;return{x:clamp(this.ball.x-exit.x*contact,FIELD.left+p.r,FIELD.right-p.r),y:clamp(this.ball.y-exit.y*contact,FIELD.top+p.r,FIELD.bottom-p.r)};}
  return base;
};

export const __orientedReceptionV2={receptionExitVector,orientedReceptionVelocity};
