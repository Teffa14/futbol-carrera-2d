import {MatchEngine} from './engine.js';
import {isOffsidePosition,awardOffside} from './football-rules-v2.js';

const speed=ball=>Math.hypot(ball?.vx||0,ball?.vy||0);

const previousExecuteKick=MatchEngine.prototype.executeKick;
MatchEngine.prototype.executeKick=function fullLaw11Kick(p,contactNormal){
  const intent=p?.kickIntent?{...p.kickIntent}:null,ballX=this.ball.x;
  const flagged=intent?.type==='pass'?this.players.filter(a=>a.team===p.team&&a.id!==p.id&&a.role!=='GK'&&isOffsidePosition(this,a,ballX)).map(a=>a.id):[];
  const result=previousExecuteKick.call(this,p,contactNormal);
  if(result&&intent?.type==='pass')this.pendingOffside=flagged.length?{attackingTeam:p.team,candidateIds:flagged,kickTick:this.tick,passerId:p.id}:null;
  return result;
};

const previousTouch=MatchEngine.prototype.registerPhysicalTouch;
MatchEngine.prototype.registerPhysicalTouch=function fullLaw11Involvement(p,type='touch'){
  const pending=this.pendingOffside;
  if(!pending||this.tick<=pending.kickTick)return previousTouch.call(this,p,type);
  const flagged=pending.candidateIds?.includes(p.id);
  if(p.team===pending.attackingTeam&&flagged){awardOffside(this,{...pending,receiverId:p.id,x:p.x,y:p.y});return;}
  if(p.team===pending.attackingTeam&&!flagged){this.pendingOffside=null;return previousTouch.call(this,p,type);}
  if(p.team!==pending.attackingTeam){
    const deliberate=type==='kick'||speed(this.ball)<4.8;
    if(deliberate){this.pendingOffside=null;return previousTouch.call(this,p,type);}
    // A high-speed block/deflection does not create a new phase. Older rule layers clear on every defender touch,
    // so restore the snapshot after they record the physical contact.
    const result=previousTouch.call(this,p,type);if(!this.pendingOffside)this.pendingOffside=pending;return result;
  }
  return previousTouch.call(this,p,type);
};

export function law11Snapshot(engine,team,ballX=engine.ball.x){return engine.players.filter(p=>p.team===team&&p.role!=='GK'&&isOffsidePosition(engine,p,ballX)).map(p=>p.id);}
export const __offsideLaw11V3={law11Snapshot};
