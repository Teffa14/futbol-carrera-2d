import {MatchEngine} from './engine.js';
import {FIELD} from './football-rules-v2.js';
import {estimateArrivalTime} from './dynamic-space-control-v1.js';
import {runtimeModsFor} from './build-effects-v2.js';
import {SKILLS} from './data.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const mag=(x,y)=>Math.hypot(x||0,y||0);
function skill(p,key){let n=0;for(const id of p?.data?.skills||[]){const s=SKILLS.find(x=>x.id===id);n+=Number(s?.effects?.[key]||0);}return n;}
function ownGoalX(p){return p.team===0?FIELD.left:FIELD.right;}
function outDir(p){return p.team===0?1:-1;}
function towardOwnGoal(p,vx){return p.team===0?vx<-.18:vx>.18;}

export function goalkeeperProfile(p){
  const d=p?.data||{},mods=runtimeModsFor(p),def=Number(d.defense??65),composure=Number(d.composure??65),physical=Number(d.physical??65),control=Number(d.ballControl??60),vision=Number(d.vision??d.passing??60),pace=Number(d.pace??55);
  return{
    reflex:clamp(def*.54+composure*.20+pace*.10+physical*.08+control*.08+Number(mods.gkReflex||0)+skill(p,'gkReflex'),30,99),
    handling:clamp(def*.38+composure*.25+control*.20+physical*.17+Number(mods.gkHandling||0)+skill(p,'gkHandling'),30,99),
    sweeping:clamp(pace*.34+vision*.27+composure*.20+def*.19+Number(mods.gkSweep||0)+skill(p,'gkSweep'),30,99),
    distribution:clamp(Number(d.passing??55)*.48+vision*.32+control*.20+Number(mods.gkDistribution||0)+skill(p,'gkDistribution'),30,99),
  };
}

export function projectedGoalCross(engine,p){
  const vx=Number(engine.ball.vx||0);if(!towardOwnGoal(p,vx))return null;const gx=ownGoalX(p),frames=(gx-engine.ball.x)/vx;if(!Number.isFinite(frames)||frames<0||frames>180)return null;
  const damp=.993,scale=frames<=0?0:(1-Math.pow(damp,frames))/(1-damp),y=engine.ball.y+Number(engine.ball.vy||0)*scale;
  return{x:gx,y,frames,onTarget:y>FIELD.goalTop-18&&y<FIELD.goalBottom+18};
}

function nearestOpponentToBall(engine,p){return engine.players.filter(x=>x.team!==p.team&&x.role!=='GK').sort((a,b)=>dist(a,engine.ball)-dist(b,engine.ball))[0]||null;}
export function goalkeeperTarget(engine,p){
  const profile=goalkeeperProfile(p),goalX=ownGoalX(p),dir=outDir(p),ballDepth=p.team===0?engine.ball.x-FIELD.left:FIELD.right-engine.ball.x,cross=projectedGoalCross(engine,p),speed=mag(engine.ball.vx,engine.ball.vy);
  if(cross?.onTarget&&speed>1.6){const y=clamp(cross.y,FIELD.goalTop+8,FIELD.goalBottom-8),depth=clamp(14+(100-profile.reflex)*.08,12,22);return{x:goalX+dir*depth,y,reason:'shot-line'};}
  const angleY=clamp(FIELD.centerY+(engine.ball.y-FIELD.centerY)*.68,FIELD.goalTop+12,FIELD.goalBottom-12),baseDepth=clamp(24+(260-clamp(ballDepth,0,260))*.10,24,50);
  const rival=nearestOpponentToBall(engine,p),loose=speed<5.8&&ballDepth<185&&rival;
  if(loose){const keeperEta=estimateArrivalTime(p,engine.ball),rivalEta=estimateArrivalTime(rival,engine.ball),sweepBonus=(profile.sweeping-60)*.006;if(keeperEta+sweepBonus<rivalEta-.06){const maxSweep=clamp(76+(profile.sweeping-50)*1.15,76,132);return{x:clamp(engine.ball.x,goalX===FIELD.left?FIELD.left+18:FIELD.right-maxSweep,goalX===FIELD.left?FIELD.left+maxSweep:FIELD.right-18),y:clamp(engine.ball.y,FIELD.top+20,FIELD.bottom-20),reason:'sweep'};}}
  return{x:goalX+dir*baseDepth,y:angleY,reason:'set'};
}

const previousBallActor=MatchEngine.prototype.ballActor;
MatchEngine.prototype.ballActor=function predictiveGoalkeeperActor(team){
  const chosen=previousBallActor.call(this,team),gk=this.players.find(p=>p.team===team&&p.role==='GK');if(!gk||this.restart?.active)return chosen;
  const target=goalkeeperTarget(this,gk),rival=nearestOpponentToBall(this,gk);if(target.reason==='sweep'&&(!rival||estimateArrivalTime(gk,this.ball)<estimateArrivalTime(rival,this.ball)-.03))return gk;
  return chosen;
};

const previousAiTarget=MatchEngine.prototype.aiTarget;
MatchEngine.prototype.aiTarget=function predictiveGoalkeeperTarget(p,pressers,actor,possession){
  if(p?.role==='GK'&&!this.restart?.active){const target=goalkeeperTarget(this,p);p.goalkeeperReason=target.reason;if(actor?.id===p.id&&target.reason!=='shot-line')return{x:this.ball.x,y:this.ball.y};return{x:target.x,y:target.y};}
  return previousAiTarget.call(this,p,pressers,actor,possession);
};

const previousResolveBallPlayers=MatchEngine.prototype.resolveBallPlayerCollisions;
MatchEngine.prototype.resolveBallPlayerCollisions=function goalkeeperSaveContacts(){
  const incoming={vx:this.ball.vx,vy:this.ball.vy,speed:mag(this.ball.vx,this.ball.vy),shotById:this.ball.shotById,lastTouchTick:this.ball.lastTouchTick};
  const nearby=(this.players||[]).filter(p=>p.role==='GK'&&dist(p,this.ball)<=p.r+this.ball.r+2.5);
  const result=previousResolveBallPlayers.call(this);
  for(const gk of nearby){
    if(this.ball.lastPlayerId!==gk.id||this.ball.lastTouchTick!==this.tick||incoming.speed<1.8)continue;
    const shooter=this.playerById(incoming.shotById),wasOpponentShot=shooter&&shooter.team!==gk.team;if(!wasOpponentShot&&!towardOwnGoal(gk,incoming.vx))continue;
    const profile=goalkeeperProfile(gk),difficulty=clamp(42+incoming.speed*4.5+(Math.abs(this.ball.y-FIELD.centerY)/110)*8,45,91),secure=profile.handling-difficulty;
    const dir=outDir(gk),side=(this.ball.y<=FIELD.centerY?-1:1);
    if(secure>=3){const deaden=clamp(.10+(85-profile.handling)*.006,.10,.34);this.ball.vx=dir*Math.max(.18,incoming.speed*deaden);this.ball.vy*=deaden*.55;gk.decisionCooldown=0;this.flash(gk,'control');}
    else{const parry=clamp(.24+(profile.reflex-50)*.003,.24,.42);this.ball.vx=dir*Math.max(.8,incoming.speed*parry);this.ball.vy=side*Math.max(1.0,Math.abs(incoming.vy)*.35+incoming.speed*.17);this.flash(gk,'atajada');}
    if(wasOpponentShot){gk.perf.saves=(gk.perf.saves||0)+1;this.stats.saves[gk.team]=(this.stats.saves[gk.team]||0)+1;this.adjustRating(gk,.08+clamp((difficulty-55)/220,0,.12));if(gk.id===this.userId)this.pushEvent(secure>=3?'Atajada segura: amortiguaste el remate':'Atajada: desvío hacia afuera',gk.team,'user');else this.pushEvent(`${gk.data.name} ataja`,gk.team,'save');this.ball.shotById=null;}
  }
  return result;
};

export const __goalkeeperV2={goalkeeperProfile,goalkeeperTarget,projectedGoalCross};
