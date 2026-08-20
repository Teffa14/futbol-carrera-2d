import {MatchEngine} from './engine.js';
import {FIELD} from './football-rules-v2.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};

export function freeKickSpot(x,y){return{x:clamp(x,FIELD.left+60,FIELD.right-60),y:clamp(y,FIELD.top+40,FIELD.bottom-40)};}

export function stageContinuousFreeKick(engine,team,x,y,{reason='Tiro libre',attackingTeam=null}={}){
  const spot=freeKickSpot(x,y),kicker=engine.players.filter(p=>p.team===team&&p.role!=='GK').sort((a,b)=>dist(a,spot)-dist(b,spot))[0]||engine.players.find(p=>p.team===team);
  if(!kicker)return false;
  for(const p of engine.players){p.kickIntent=null;p.dribbleIntent=null;p.receiveIntent=null;p.vx*=.42;p.vy*=.42;}
  Object.assign(engine.ball,{x:spot.x,y:spot.y,z:0,vz:0,vx:0,vy:0,lastTeam:team,lastPlayerId:kicker.id,passerId:null,intendedReceiverId:null,shotById:null,assistCandidateId:null,lastTouchTick:engine.tick,spin:0});
  engine.lastPossessionTeam=team;engine.restart={active:true,kind:'free-kick',timer:0,team,kickerId:kicker.id,x:spot.x,y:spot.y,continuous:true,setupElapsed:0,readyHold:0};
  engine.pendingOffside=null;engine.pushEvent(reason,attackingTeam??team,'restart');return true;
}

const previousTouch=MatchEngine.prototype.registerPhysicalTouch;
MatchEngine.prototype.registerPhysicalTouch=function continuousOffsideRestart(p,type='touch'){
  const pending=this.pendingOffside,flagged=pending&&(pending.candidateIds?.includes(p.id)||pending.receiverId===p.id);
  if(pending&&this.tick>pending.kickTick&&p.team===pending.attackingTeam&&flagged){
    stageContinuousFreeKick(this,1-pending.attackingTeam,p.x,p.y,{reason:'Offside',attackingTeam:pending.attackingTeam});return;
  }
  return previousTouch.call(this,p,type);
};

MatchEngine.prototype.awardDeadlockFreeKick=function continuousDeadlockFreeKick(team){
  const ok=stageContinuousFreeKick(this,team,this.ball.x,this.ball.y,{reason:`Tiro libre para ${this.names[team]} por bloqueo prolongado`,attackingTeam:team});
  if(ok&&this.stats?.deadlockFreeKicks)this.stats.deadlockFreeKicks[team]++;return ok;
};

export function restartTargets(engine){
  const r=engine.restart,kicker=engine.playerById(r?.kickerId);if(!r?.active||r.kind!=='free-kick'||!kicker)return null;
  const dir=r.team===0?1:-1,contact=kicker.r+engine.ball.r-.7,kickSpot={x:r.x-dir*contact,y:r.y},targets=new Map([[kicker.id,kickSpot]]);
  for(const p of engine.players){
    if(p.id===kicker.id)continue;let target=engine.shapeTarget(p);
    if(p.team!==r.team){const dx=p.x-r.x,dy=p.y-r.y,d=Math.hypot(dx,dy);if(d<62){const n=d>.1?unit(dx,dy):{x:-dir,y:0};target={x:clamp(r.x+n.x*64,FIELD.left+p.r,FIELD.right-p.r),y:clamp(r.y+n.y*64,FIELD.top+p.r,FIELD.bottom-p.r)};}}
    targets.set(p.id,target);
  }
  return{kicker,kickSpot,targets};
}

const previousStep=MatchEngine.prototype.step;
MatchEngine.prototype.step=function continuousFreeKickStep(dt){
  if(!this.restart?.active||this.restart.kind!=='free-kick')return previousStep.call(this,dt);
  dt=Math.min(.05,Math.max(.001,dt));this.tick++;this.minute+=dt;if(this.minute>=90){this.minute=90;this.finished=true;this.restart.active=false;this.pushEvent('Final del partido',null,'end');return;}
  const r=this.restart;r.setupElapsed=(r.setupElapsed||0)+dt;const plan=restartTargets(this);if(!plan){r.active=false;return;}
  Object.assign(this.ball,{x:r.x,y:r.y,vx:0,vy:0,spin:0});
  for(const p of this.players)this.movePlayer(p,plan.targets.get(p.id)||{x:p.x,y:p.y},dt,false);
  this.resolvePlayerCollisions();
  const dir=r.team===0?1:-1;this.turnPlayer(plan.kicker,{x:dir,y:0},dt);
  const clearance=Math.min(...this.players.filter(p=>p.team!==r.team).map(p=>dist(p,this.ball)),999),ready=dist(plan.kicker,plan.kickSpot)<3.4&&clearance>=56;
  r.readyHold=ready?(r.readyHold||0)+dt:0;
  if(r.readyHold>.10||r.setupElapsed>1.75){const mate=this.bestPass(plan.kicker)?.player;if(mate)this.armPass(plan.kicker,mate,true);else this.armKick(plan.kicker,{x:r.team===0?FIELD.right:FIELD.left,y:FIELD.centerY},4.75,'restart');r.active=false;this.pushEvent('Se juega el tiro libre',r.team,'restart');}
};

export const __restartContinuityV1={freeKickSpot,stageContinuousFreeKick,restartTargets};
