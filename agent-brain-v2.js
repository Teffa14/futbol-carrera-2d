import {MatchEngine} from './engine.js';
import {FIELD,onsideLimit} from './football-rules-v2.js';
import {motionProfile} from './locomotion-v2.js';
import {classifyWideBehavior,defensiveResponseTarget,observeOpponentBehavior} from './opponent-adaptation-v1.js';
import {roleSpaceCandidateBias} from './role-space-decision-v1.js';
import {estimateArrivalTime} from './dynamic-space-control-v1.js';
import {tacticalSpaceBias} from './tactical-profile-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function hashString(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function noise(key,salt=''){let h=hashString(`${key}|${salt}`);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;return((h>>>0)%10000)/9999;}
function playerKey(p){return String(p?.id||p?.data?.instanceId||p?.data?.name||'player');}
function roleFamily(role){if(role==='GK')return'GK';if(['CB','LB','RB'].includes(role))return'DEF';if(['CDM','CM','CAM'].includes(role))return'MID';return'FWD';}
function tacticalIntelligence(p){return clamp(Number(p?.data?.tacticalIQ??p?.data?.vision??p?.data?.composure??65)||65,0,100);}
function wideContext(p){const half=(FIELD.bottom-FIELD.top)*.5;return Math.abs((Number(p?.y)||FIELD.centerY)-FIELD.centerY)>half*.54?'wide-isolation':'general';}

export function positionalIdentity(p){const key=playerKey(p);return{width:noise(key,'width')*2-1,depth:noise(key,'depth')*2-1,roam:noise(key,'roam')*2-1,support:noise(key,'support'),aggression:noise(key,'aggression'),risk:noise(key,'risk'),reaction:motionProfile(p).reaction};}

function dynamicSpaceAdvantage(player,opponents,target){
  const ownTime=estimateArrivalTime(player,target);
  if(!Number.isFinite(ownTime))return 0;
  let opponentTime=Infinity;
  for(const opponent of opponents||[]){const time=estimateArrivalTime(opponent,target);if(time<opponentTime)opponentTime=time;}
  if(!Number.isFinite(opponentTime))return .8;
  return clamp(opponentTime-ownTime,-1.5,1.5);
}

function spacingCandidate(engine,p,base,possession){
  const key=playerKey(p),id=positionalIdentity(p),dir=p.team===0?1:-1,our=possession===p.team,enemy=possession!==null&&possession!==p.team;
  const offsets=[{x:0,y:0},{x:22,y:0},{x:-22,y:0},{x:0,y:28},{x:0,y:-28},{x:30,y:24},{x:30,y:-24},{x:-30,y:24},{x:-30,y:-24},{x:46,y:0},{x:0,y:46},{x:0,y:-46}];
  const mates=engine.players.filter(q=>q.team===p.team&&q.id!==p.id),opps=engine.players.filter(q=>q.team!==p.team),wide=['LW','RW','LB','RB'].includes(p.role),limit=onsideLimit(engine,p.team);
  let best={x:base.x,y:base.y,score:-Infinity};
  for(let i=0;i<offsets.length;i++){
    const o=offsets[i],depthScale=roleFamily(p.role)==='FWD'?1:roleFamily(p.role)==='MID'?.72:.45;
    let x=base.x+o.x*dir*depthScale,y=base.y+o.y;
    if(our&&roleFamily(p.role)==='FWD'){if(dir>0)x=Math.min(x,limit);else x=Math.max(x,limit);}
    if(wide&&our){const laneSign=(p.homeY??p.y)<FIELD.centerY?-1:1;y+=laneSign*(16+id.width*12+id.support*18);}
    if(our&&p.role==='ST')x+=dir*(8+id.aggression*15);
    if(enemy&&['CB','LB','RB','CDM'].includes(p.role))x-=dir*(5+id.aggression*8);
    x=clamp(x,FIELD.left+p.r,FIELD.right-p.r);y=clamp(y,FIELD.top+p.r,FIELD.bottom-p.r);
    const nearestMate=Math.min(...mates.map(m=>Math.hypot(m.x-x,m.y-y)),180),nearestOpp=Math.min(...opps.map(m=>Math.hypot(m.x-x,m.y-y)),180),baseCost=Math.hypot(x-base.x,y-base.y);
    let score=nearestMate*.035+nearestOpp*.008-baseCost*.021+(noise(key,`candidate-${i}`)-.5)*.26;
    const anchor={x:p.homeX??p.x,y:p.homeY??p.y};
    score+=roleSpaceCandidateBias({role:p.role,attackDirection:dir,anchor,target:{x,y},field:FIELD,hasPossession:our,defending:enemy})*2.4;
    score+=tacticalSpaceBias({player:p,anchor,target:{x,y},field:FIELD,hasPossession:our,defending:enemy})*1.55;
    score+=dynamicSpaceAdvantage(p,opps,{x,y})*(our?.45:enemy?.35:.55);
    if(our)score+=dir*(x-base.x)*.011;if(enemy&&roleFamily(p.role)==='DEF')score-=dir*(x-base.x)*.008;
    if(score>best.score)best={x,y,score};
  }
  return{x:best.x,y:best.y};
}

function adaptivePrimaryPressure(engine,p,actor,base){
  if(!actor||actor.team===p.team)return base;
  const context=wideContext(actor),attackDirection=actor.team===0?1:-1,behavior=classifyWideBehavior({attacker:actor,attackDirection,centerY:FIELD.centerY});
  const samplePeriod=24,samplePhase=hashString(playerKey(actor))%samplePeriod;
  if(context==='wide-isolation'&&engine.tick%samplePeriod===samplePhase&&behavior){
    observeOpponentBehavior(engine,{opponentId:playerKey(actor),context,behavior,tick:engine.tick});
  }
  const response=defensiveResponseTarget(engine,{opponentId:playerKey(actor),context,defenderIntelligence:tacticalIntelligence(p),scoutingKnowledge:Number(engine.scoutingKnowledge)||0,defender:p,attacker:actor,attackDirection,centerY:FIELD.centerY});
  if(!response)return base;
  return{x:clamp(response.x,FIELD.left+p.r,FIELD.right-p.r),y:clamp(response.y,FIELD.top+p.r,FIELD.bottom-p.r)};
}

const originalAiTarget=MatchEngine.prototype.aiTarget;
MatchEngine.prototype.aiTarget=function independentFootballAgent(p,pressers,actor,possession){
  let base=originalAiTarget.call(this,p,pressers,actor,possession);
  if(!p||p.role==='GK'||this.restart?.active)return base;
  const isActor=actor?.id===p.id,primaryPresser=possession!==null&&possession!==p.team&&Array.isArray(pressers)&&pressers[0]===p.id;
  if(p.receiveIntent){
    const r=p.receiveIntent;if(this.tick>r.untilTick)p.receiveIntent=null;else{
      const kicked=this.ball.passerId===r.fromId&&this.ball.lastTouchTick>=r.createdTick;if(kicked)r.waitForKick=false;
      let tx=r.aimX,ty=r.aimY;
      if(r.waitForKick){const lim=onsideLimit(this,p.team);if(p.team===0)tx=Math.min(tx,lim);else tx=Math.max(tx,lim);}
      return{x:clamp(tx,FIELD.left+p.r,FIELD.right-p.r),y:clamp(ty,FIELD.top+p.r,FIELD.bottom-p.r)};
    }
  }
  if(isActor)return base;
  if(primaryPresser)return adaptivePrimaryPressure(this,p,actor,base);
  const state=possession===null?'loose':String(possession),reaction=(p.motion||motionProfile(p)).reaction,period=Math.round(clamp(12-reaction*.075+noise(playerKey(p),'cadence')*5,4,12));
  if(p.brainTarget&&p.brainPossession===state&&this.tick<p.brainUntil)return p.brainTarget;
  base=spacingCandidate(this,p,base,possession);p.brainTarget=base;p.brainPossession=state;p.brainUntil=this.tick+period;
  return base;
};

export const __agentBrainTest={spacingCandidate,adaptivePrimaryPressure,wideContext,dynamicSpaceAdvantage};
