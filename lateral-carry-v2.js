import {MatchEngine} from './engine.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

export function lateralCarryProfile(p,target){
  const dir=unit((target?.x??p.x)-p.x,(target?.y??p.y)-p.y),attack=p.team===1?-1:1,lateral=clamp(Math.abs(dir.y)-Math.abs(dir.x)*.22,0,1),control=Number(p?.data?.ballControl??65),dribbling=Number(p?.data?.dribbling??65),pace=Number(p?.data?.pace??70);
  return{dir,lateral,control,dribbling,pace,contactTolerance:4.8+lateral*4.2,touchPower:clamp((.12+pace*.0012+(control+dribbling)*.0009)*(1-lateral*.16),.13,.38),bodyBias:attack*lateral*.34};
}

const previousMove=MatchEngine.prototype.movePlayer;
MatchEngine.prototype.movePlayer=function lateralPhysicalCarry(p,target,dt,track){
  if(!p?.dribbleIntent||p.kickIntent||!this.ball)return previousMove.call(this,p,target,dt,track);
  const intent={x:p.dribbleIntent.targetX,y:p.dribbleIntent.targetY},profile=lateralCarryProfile(p,intent),before={x:p.x,y:p.y},result=previousMove.call(this,p,target,dt,track);
  if(profile.lateral<.28||p.touchCooldown>0)return result;
  const contact=(p.r||7.25)+(this.ball.r||4.35),gap=dist(p,this.ball);if(gap>contact+profile.contactTolerance)return result;
  const toBall=unit(this.ball.x-p.x,this.ball.y-p.y),along=dot(toBall.x,toBall.y,profile.dir.x,profile.dir.y),side=Math.abs(dot(toBall.x,toBall.y,-profile.dir.y,profile.dir.x));
  if(along<-.58||side>.98)return result;
  // Side-foot nudge: still a free physical ball, but the carrier no longer has to orbit completely behind it.
  this.ball.vx+=profile.dir.x*profile.touchPower-profile.bodyBias*.012;
  this.ball.vy+=profile.dir.y*profile.touchPower;
  p.touchCooldown=Math.max(p.touchCooldown,.065);
  if(this.tick-this.ball.lastTouchTick>1||this.ball.lastPlayerId!==p.id)this.registerPhysicalTouch(p,'touch');
  p.lateralCarry={tick:this.tick,lateral:profile.lateral,fromX:before.x,fromY:before.y};return result;
};

const previousTouchPower=MatchEngine.prototype.dribbleTouchPower;
MatchEngine.prototype.dribbleTouchPower=function lateralAwareTouch(p){const base=previousTouchPower.call(this,p),intent=p?.dribbleIntent?{x:p.dribbleIntent.targetX,y:p.dribbleIntent.targetY}:null;if(!intent)return base;const profile=lateralCarryProfile(p,intent);return clamp(base*(1-profile.lateral*.18),.12,.88);};

export const __lateralCarryV2={lateralCarryProfile};
