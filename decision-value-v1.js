import {MatchEngine} from './engine.js';
import {FIELD,isOffsidePosition} from './football-rules-v2.js';
import {expectedRoleValue,passFootballValue} from './match-evaluation-v2.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
function family(role){if(role==='GK')return'GK';if(['CB','LB','RB'].includes(role))return'DEF';if(['CDM','CM'].includes(role))return'MID';if(role==='CAM')return'CAM';return'FWD';}
function segmentDistance(p,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,l=vx*vx+vy*vy||1,t=clamp((wx*vx+wy*vy)/l,0,1);return Math.hypot(p.x-(a.x+vx*t),p.y-(a.y+vy*t));}
function laneOpen(engine,a,b){let best=180;for(const o of engine.players){if(o.team===a.team)continue;best=Math.min(best,segmentDistance(o,a,b));}return best;}
function nearestOpponentDistance(engine,point,team){let best=180;for(const o of engine.players){if(o.team===team)continue;best=Math.min(best,dist(o,point));}return best;}
export function movingPassTarget(engine,p,m,kind='pass'){
  const d=dist(p,m),ballSpeed=kind==='through'||kind==='lob-through'?5.2:kind==='cross'?5.7:4.8,frames=clamp(d/ballSpeed,5,42),velocityScale=kind==='support'?.42:kind==='progressive'?.68:.82,dir=p.team===0?1:-1;
  let x=m.x+(m.vx||0)*frames*velocityScale,y=m.y+(m.vy||0)*frames*velocityScale;
  if(kind==='through'||kind==='lob-through')x+=dir*clamp(24+(m.data?.pace??70)*.45,36,68);
  return{x:clamp(x,FIELD.left+18,FIELD.right-18),y:clamp(y,FIELD.top+16,FIELD.bottom-16)};
}
function passKind(p,m){const dir=p.team===0?1:-1,forward=(m.x-p.x)*dir,d=dist(p,m);if(forward>75&&d>100)return'through';if(forward>24)return'progressive';return'support';}
export function valuePassOptions(engine,p){const opts=[];for(const m of engine.players){if(m.team!==p.team||m.id===p.id||isOffsidePosition(engine,m,engine.ball.x))continue;const d=dist(p,m);if(d<28||d>380)continue;const kind=passKind(p,m),aim=movingPassTarget(engine,p,m,kind),lane=laneOpen(engine,p,aim),space=nearestOpponentDistance(engine,aim,p.team),base=passFootballValue(p,{x:p.x,y:p.y},aim),risk=clamp((24-lane)/55,0,.42)+clamp((28-space)/70,0,.28),value=expectedRoleValue(engine,p,kind==='through'?'through':'progressive-pass',{base,threatGain:Math.max(0,base),turnoverRisk:risk})+clamp((lane-15)/160,-.06,.12)+clamp((space-24)/220,-.04,.10);opts.push({player:m,aim,kind,value,lane,space,distance:d,risk});}return opts.sort((a,b)=>b.value-a.value);}
function passPower(p,opt){const passing=p.data?.passing??65;let power=clamp(3+opt.distance/90+(passing-60)*.012,3,7.1);if(opt.kind==='support')power*=.84;return power;}

const originalArmKick=MatchEngine.prototype.armKick;
MatchEngine.prototype.armKick=function leadMovingReceivers(p,aim,power,type='kick',meta={}){
  if(type==='pass'&&meta?.receiverId){const receiver=this.playerById(meta.receiverId);if(receiver){const kind=meta.passKind||passKind(p,receiver),pred=movingPassTarget(this,p,receiver,kind);aim=pred;meta={...meta,passKind:kind,plannedAimX:pred.x,plannedAimY:pred.y};receiver.receiveIntent={fromId:p.id,aimX:pred.x,aimY:pred.y,createdTick:this.tick,untilTick:this.tick+85,waitForKick:true,kind};}}
  return originalArmKick.call(this,p,aim,power,type,meta);
};

const previousPrepare=MatchEngine.prototype.prepareBallAction;
MatchEngine.prototype.prepareBallAction=function valueSeekingDecision(p){
  if(!p||p.decisionCooldown>0||p.kickIntent||p.dribbleIntent)return previousPrepare.call(this,p);const contact=(p.r||7.25)+(this.ball.r||4.35)+7;if(dist(p,this.ball)>contact)return previousPrepare.call(this,p);
  const best=valuePassOptions(this,p)[0],fam=family(p.role),threshold=fam==='DEF'?.34:fam==='MID'?.40:fam==='CAM'?.45:fam==='FWD'?.50:.43;
  if(best&&best.value>threshold&&best.lane>12){const power=passPower(p,best);p.passIntent={kind:best.kind,receiverId:best.player.id,createdTick:this.tick,value:best.value};this.armKick(p,best.aim,power,'pass',{receiverId:best.player.id,passKind:best.kind,plannedDistance:best.distance});p.decisionCooldown=.28;this.flash(p,best.kind==='through'?'profundo':'pase');return true;}
  return previousPrepare.call(this,p);
};

export const __decisionValueV1={laneOpen,nearestOpponentDistance,passKind,passPower};
