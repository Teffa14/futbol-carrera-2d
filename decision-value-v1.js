import {MatchEngine} from './engine.js';
import {FIELD,isOffsidePosition} from './football-rules-v2.js';
import {expectedRoleValue,passFootballValue} from './match-evaluation-v2.js';
import {perceivedTeammates,perceivedOpponents} from './perception-scanning-v1.js';
import {rankRoleAwareCandidates} from './role-decision-policy-v1.js';
import {createRoleContract} from './role-contract-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function family(role){if(role==='GK')return'GK';if(['CB','LB','RB'].includes(role))return'DEF';if(['CDM','CM'].includes(role))return'MID';if(role==='CAM')return'CAM';return'FWD';}
function segmentDistance(p,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,l=vx*vx+vy*vy||1,t=clamp((wx*vx+wy*vy)/l,0,1);return Math.hypot(p.x-(a.x+vx*t),p.y-(a.y+vy*t));}
function opponentKnowledge(engine,observer){return observer?perceivedOpponents(engine,observer):engine.players.filter(o=>o.team!==observer?.team);}
function laneOpen(engine,a,b,observer=null){let best=180;const opponents=observer?perceivedOpponents(engine,observer):engine.players.filter(o=>o.team!==a.team);for(const o of opponents)best=Math.min(best,segmentDistance(o,a,b));return best;}
function nearestOpponent(engine,point,team,observer=null){let best=null,bestD=180;const opponents=observer?perceivedOpponents(engine,observer):engine.players.filter(o=>o.team!==team);for(const o of opponents){const d=dist(o,point);if(d<bestD){best=o.player||o;bestD=d;}}return{player:best,distance:bestD};}
function nearestOpponentDistance(engine,point,team,observer=null){return nearestOpponent(engine,point,team,observer).distance;}
function attackProgress(p){return p.team===0?(p.x-FIELD.left)/(FIELD.right-FIELD.left):(FIELD.right-p.x)/(FIELD.right-FIELD.left);}
export function movingPassTarget(engine,p,m,kind='pass'){
  const d=dist(p,m),ballSpeed=kind==='through'||kind==='lob-through'?5.2:kind==='cross'?5.7:4.8,frames=clamp(d/ballSpeed,5,42),velocityScale=kind==='support'?.42:kind==='progressive'?.68:.82,dir=p.team===0?1:-1;
  let x=m.x+(m.vx||0)*frames*velocityScale,y=m.y+(m.vy||0)*frames*velocityScale;
  if(kind==='through'||kind==='lob-through')x+=dir*clamp(24+(m.player?.data?.pace??m.data?.pace??70)*.45,36,68);
  return{x:clamp(x,FIELD.left+18,FIELD.right-18),y:clamp(y,FIELD.top+16,FIELD.bottom-16)};
}
function passKind(p,m){const dir=p.team===0?1:-1,forward=(m.x-p.x)*dir,d=dist(p,m);if(forward>75&&d>100)return'through';if(forward>24)return'progressive';return'support';}
export function valuePassOptions(engine,p){const opts=[];for(const m of perceivedTeammates(engine,p)){if(!m.player||isOffsidePosition(engine,m.player,engine.ball.x))continue;const d=dist(p,m);if(d<28||d>380)continue;const kind=passKind(p,m),aim=movingPassTarget(engine,p,m,kind),lane=laneOpen(engine,p,aim,p),space=nearestOpponentDistance(engine,aim,p.team,p),base=passFootballValue(p,{x:p.x,y:p.y},aim),uncertainty=clamp(1-(m.confidence??1),0,1),risk=clamp((24-lane)/55,0,.42)+clamp((28-space)/70,0,.28)+uncertainty*.18,value=expectedRoleValue(engine,p,kind==='through'?'through':'progressive-pass',{base,threatGain:Math.max(0,base),turnoverRisk:risk})+clamp((lane-15)/160,-.06,.12)+clamp((space-24)/220,-.04,.10)-uncertainty*.08;opts.push({type:'pass',player:m.player,aim,kind,value,lane,space,distance:d,risk,perceptionConfidence:m.confidence??1,visible:m.visible!==false});}return opts.sort((a,b)=>b.value-a.value);}
function passPower(p,opt){const passing=p.data?.passing??65;let power=clamp(3+opt.distance/90+(passing-60)*.012,3,7.1);if(opt.kind==='support')power*=.84;return power;}
function shotCandidate(engine,p){if(p.role==='GK')return null;const goalX=p.team===0?FIELD.right:FIELD.left,goalDistance=Math.abs(goalX-p.x),progress=attackProgress(p),central=1-clamp(Math.abs(p.y-FIELD.centerY)/270,0,1),near=nearestOpponent(engine,p,p.team,p),pressure=clamp((48-near.distance)/48,0,1),shooting=Number(p.data?.shooting??55),composure=Number(p.data?.composure??65);if(progress<.54||goalDistance>455)return null;const shotQuality=clamp(progress*.38+central*.20+shooting/100*.25+composure/100*.17-pressure*.20-(goalDistance>330?.12:0),0,1),risk=.04+pressure*.11+(goalDistance>360?.08:0),value=expectedRoleValue(engine,p,'shot',{base:shotQuality*.12,shotQuality:shotQuality*.28,turnoverRisk:risk});return{type:'shot',value,shotQuality,goalDistance,risk};}
function dribbleCandidate(engine,p){if(p.role==='GK')return null;const dir=p.team===0?1:-1,near=nearestOpponent(engine,p,p.team,p),dribbling=Number(p.data?.dribbling??60),control=Number(p.data?.ballControl??60),pace=Number(p.data?.pace??65);if(dribbling<50||control<50)return null;const stride=clamp(38+(dribbling-50)*.45+(pace-60)*.22,38,76),lateral=clamp(24+(control-55)*.18,22,36),targets=[{x:p.x+dir*stride,y:p.y-lateral},{x:p.x+dir*stride,y:p.y+lateral},{x:p.x+dir*stride,y:p.y}].map(t=>({x:clamp(t.x,FIELD.left+p.r,FIELD.right-p.r),y:clamp(t.y,FIELD.top+p.r,FIELD.bottom-p.r)}));const ranked=targets.map(target=>({target,space:nearestOpponentDistance(engine,target,p.team,p),lane:laneOpen(engine,p,target,p)})).sort((a,b)=>(b.space+b.lane*.35)-(a.space+a.lane*.35)),best=ranked[0],pressure=clamp((46-near.distance)/46,0,1),spaceGain=clamp((best.space-18)/130,0,.30)+clamp((best.lane-10)/180,0,.12),risk=pressure*.20+clamp((20-best.lane)/55,0,.20)+(100-dribbling)*.0013,value=expectedRoleValue(engine,p,'dribble',{base:.04,spaceGain,turnoverRisk:risk});return{type:'dribble',value,target:best.target,space:best.space,lane:best.lane,risk,defender:near.player};}
export function clearanceCandidate(engine,p){
  if(!['GK','CB','LB','RB','LWB','RWB','CDM'].includes(p.role))return null;
  const progress=attackProgress(p),near=nearestOpponent(engine,p,p.team,p),pressure=clamp((58-near.distance)/58,0,1);
  if(progress>.38||pressure<.32)return null;
  const dir=p.team===0?1:-1,forward=p.role==='GK'?225:185,lateral=p.role==='CDM'?72:98;
  const side=near.player?(near.player.y>=p.y?-1:1):(p.y>=FIELD.centerY?-1:1);
  const aim={x:clamp(p.x+dir*forward,FIELD.left+28,FIELD.right-28),y:clamp(p.y+side*lateral,FIELD.top+24,FIELD.bottom-24)};
  const ownGoalDanger=clamp(1-progress,0,1),value=clamp(.14+pressure*.24+ownGoalDanger*.10,.14,.52);
  return{type:'clearance',aim,value,pressure,progress,distance:dist(p,aim),risk:clamp(.08+(1-pressure)*.10,0,.18)};
}
export function decisionRoleContext(engine,p){
  const tacticalState=engine.currentTacticalState?.(p.team)||engine.tacticalState?.teams?.[p.team]||null;
  const contract=createRoleContract({
    role:p.role,
    tactics:engine.tactics?.[p.team]||{},
    trust:p.data?.coachTrust??p.data?.trust??0,
    influence:p.data?.tacticalInfluence??p.data?.influence??0,
  });
  return{phase:tacticalState?.phase||null,contract,tacticalState};
}
export function scoreActionCandidates(engine,p){const candidates=[];const pass=valuePassOptions(engine,p)[0];if(pass)candidates.push(pass);const shot=shotCandidate(engine,p);if(shot)candidates.push(shot);const dribble=dribbleCandidate(engine,p);if(dribble)candidates.push(dribble);const clearance=clearanceCandidate(engine,p);if(clearance)candidates.push(clearance);const near=nearestOpponent(engine,p,p.team,p),pressure=clamp((52-near.distance)/52,0,1),roleContext=decisionRoleContext(engine,p);return rankRoleAwareCandidates({player:p,candidates,field:FIELD,pressure,phase:roleContext.phase,contract:roleContext.contract});}

const originalArmKick=MatchEngine.prototype.armKick;
MatchEngine.prototype.armKick=function leadMovingReceivers(p,aim,power,type='kick',meta={}){if(type==='pass'&&meta?.receiverId){const receiver=this.playerById(meta.receiverId);if(receiver){const kind=meta.passKind||passKind(p,receiver),pred=movingPassTarget(this,p,receiver,kind);aim=pred;meta={...meta,passKind:kind,plannedAimX:pred.x,plannedAimY:pred.y};receiver.receiveIntent={fromId:p.id,aimX:pred.x,aimY:pred.y,createdTick:this.tick,untilTick:this.tick+85,waitForKick:true,kind};}}return originalArmKick.call(this,p,aim,power,type,meta);};
function executeValueChoice(engine,p,choice){if(choice.type==='pass'){const power=passPower(p,choice);p.passIntent={kind:choice.kind,receiverId:choice.player.id,createdTick:engine.tick,value:choice.value};engine.armKick(p,choice.aim,power,'pass',{receiverId:choice.player.id,passKind:choice.kind,plannedDistance:choice.distance});p.decisionCooldown=.28;engine.flash(p,choice.kind==='through'?'profundo':'pase');return true;}if(choice.type==='shot'){engine.armShot(p,choice.goalDistance);p.decisionCooldown=.36;engine.flash(p,'remate');return true;}if(choice.type==='dribble'){p.dribbleIntent={targetX:choice.target.x,targetY:choice.target.y,ttl:.34+Number(p.data?.ballControl??65)/360};p.decisionCooldown=.24;if(choice.defender&&dist(p,choice.defender)<45)engine.attemptSkillMove(p,choice.defender);return true;}if(choice.type==='clearance'){const power=clamp(5.8+Number(p.data?.passing??60)*.008,5.8,6.6);engine.armKick(p,choice.aim,power,'clearance',{plannedDistance:choice.distance});p.decisionCooldown=.34;engine.flash(p,'despeje');return true;}return false;}
const previousPrepare=MatchEngine.prototype.prepareBallAction;
MatchEngine.prototype.prepareBallAction=function valueSeekingDecision(p){if(!p||p.decisionCooldown>0||p.kickIntent||p.dribbleIntent)return previousPrepare.call(this,p);const contact=(p.r||7.25)+(this.ball.r||4.35)+7;if(dist(p,this.ball)>contact)return previousPrepare.call(this,p);const choices=scoreActionCandidates(this,p),best=choices[0],fam=family(p.role),threshold=fam==='DEF'?.30:fam==='MID'?.32:fam==='CAM'?.34:fam==='FWD'?.34:.30;if(best&&best.value>threshold&&executeValueChoice(this,p,best)){p.lastDecisionValue={tick:this.tick,type:best.type,value:best.value,roleReason:best.roleReason,phaseReason:best.phaseReason,phase:best.roleContext?.phase||null};return true;}return previousPrepare.call(this,p);};

export const __decisionValueV1={laneOpen,nearestOpponentDistance,passKind,passPower,shotCandidate,dribbleCandidate,clearanceCandidate,executeValueChoice};
