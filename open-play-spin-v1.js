import {MatchEngine} from './engine.js';
import {FIELD} from './football-rules-v2.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};

export function openPlaySpinPlan(player,ball,aim,type='kick',meta={}){
  if(!player||!ball||!aim||meta?.curvePlan||meta?.setPieceKind)return null;
  const shot=type==='shot',pass=type==='pass'||type==='restart';if(!shot&&!pass)return null;
  const passKind=meta?.passKind||meta?.trainingKind||null;
  if(pass&&['support','wall','cutback','service'].includes(passKind))return null;
  const shooting=Number(player.data?.shooting??60),passing=Number(player.data?.passing??60),control=Number(player.data?.ballControl??60),composure=Number(player.data?.composure??65);
  const technique=clamp((shot?shooting*.46:passing*.48)+control*.31+composure*.23,30,99),dir=player.team===0?1:-1;
  const direct=unit(aim.x-ball.x,aim.y-ball.y),wide=Math.abs(player.y-FIELD.centerY)/((FIELD.bottom-FIELD.top)/2),lateral=Math.abs(direct.y);
  let context=0;if(shot)context=.18+wide*.34+lateral*.18;else if(passKind==='cross')context=.35+wide*.18;else if(passKind==='switch')context=.24+lateral*.22;else if(passKind==='through'||passKind==='lob-through')context=.10+lateral*.15;else context=lateral*.10;
  const strength=clamp((technique-58)/70+context,0,.72);if(strength<.18)return null;
  let side=Math.sign(FIELD.centerY-player.y)*dir;if(!side)side=Math.sign((aim.y??FIELD.centerY)-ball.y)*dir||1;
  const spin=side*clamp(.16+strength*.66,.16,.66),perp={x:-direct.y,y:direct.x},distance=Math.hypot(aim.x-ball.x,aim.y-ball.y),offset=clamp(distance*(.018+Math.abs(spin)*.018),6,shot?31:24);
  const initialAim={x:aim.x-perp.x*Math.sign(spin)*offset,y:aim.y-perp.y*Math.sign(spin)*offset};
  return{spin,technique,strength,initialAim,targetX:aim.x,targetY:aim.y,kind:shot?'finesse-shot':passKind||'curved-pass'};
}

const previousArmKick=MatchEngine.prototype.armKick;
MatchEngine.prototype.armKick=function contextualSpinArm(p,aim,power,type='kick',meta={}){
  if(meta?.curvePlan||meta?.setPieceKind)return previousArmKick.call(this,p,aim,power,type,meta);
  const plan=openPlaySpinPlan(p,this.ball,aim,type,meta);if(!plan)return previousArmKick.call(this,p,aim,power,type,meta);
  return previousArmKick.call(this,p,plan.initialAim,power,type,{...meta,openPlaySpin:plan,originalAimX:aim.x,originalAimY:aim.y});
};

const previousExecuteKick=MatchEngine.prototype.executeKick;
MatchEngine.prototype.executeKick=function contextualSpinContact(p,contactNormal){
  const intent=p?.kickIntent?{...p.kickIntent,openPlaySpin:p.kickIntent.openPlaySpin?{...p.kickIntent.openPlaySpin}:null}:null,result=previousExecuteKick.call(this,p,contactNormal);if(!result||!intent)return result;
  if(intent.openPlaySpin){this.ball.spin=intent.openPlaySpin.spin;this.ball.spinKind=intent.openPlaySpin.kind;this.ball.spinTechnique=intent.openPlaySpin.technique;p.lastOpenPlaySpin=intent.openPlaySpin;}
  if(intent.type==='pass'){this.ball.flightKind=intent.passKind||intent.trainingKind||'pass';this.ball.flightStartedTick=this.tick;this.ball.flightAttackingTeam=p.team;this.ball.flightReceiverId=intent.receiverId||null;}
  if(intent.type==='shot'){this.ball.flightKind='shot';this.ball.flightStartedTick=this.tick;this.ball.flightAttackingTeam=p.team;this.ball.flightReceiverId=null;}
  return result;
};

export const __openPlaySpinV1={openPlaySpinPlan};