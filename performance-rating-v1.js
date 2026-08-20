import {MatchEngine} from './engine.js';
import {FIELD} from './football-rules-v2.js';
import {createRoleContract,primaryResponsibility,roleFamily} from './role-contract-v1.js';
import {passFootballValue,shotFootballValue,defensiveFootballValue,ratingWeightFor} from './football-value-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const CATEGORIES=['universal','goalkeeping','defending','passing','possession','offBall','dribbling','shooting','errors'];

function ensureLedger(p){
  if(p._performanceLedgerV1)return p._performanceLedgerV1;
  const categories=Object.fromEntries(CATEGORIES.map(k=>[k,0]));
  p._performanceLedgerV1={categories,legacy:0,episodes:{},history:[]};
  return p._performanceLedgerV1;
}
function softCap(v,cap){return Math.tanh(v/Math.max(.001,cap))*cap;}
function recomputeRating(p){
  const ledger=ensureLedger(p);let semantic=0;
  for(const category of CATEGORIES){const cap=category==='universal'?2.2:category==='errors'?1.35:1.45;semantic+=softCap(ledger.categories[category]||0,cap);}
  const legacy=softCap(ledger.legacy,.48);p.perf.rating=clamp(6+semantic+legacy,3,10);return p.perf.rating;
}
function episodeBlocked(engine,ledger,key,window){
  if(!key||window<=0)return false;const last=ledger.episodes[key];if(!last)return false;
  return engine.minute-last.minute<window&&last.possessionTeam===engine.ball?.lastTeam;
}

export function recordPerformanceValue(engine,p,category,value,key=null,meta={},window=.08){
  if(!engine||!p||!CATEGORIES.includes(category)||!Number.isFinite(value)||value===0)return 0;
  const ledger=ensureLedger(p);if(episodeBlocked(engine,ledger,key,window))return 0;
  const weight=category==='universal'?1:ratingWeightFor(p.role,category),weighted=value*weight;
  ledger.categories[category]=(ledger.categories[category]||0)+weighted;
  if(key)ledger.episodes[key]={minute:engine.minute,possessionTeam:engine.ball?.lastTeam??null};
  ledger.history.unshift({minute:Number(engine.minute.toFixed(2)),category,value:Number(weighted.toFixed(3)),key,...meta});if(ledger.history.length>24)ledger.history.length=24;
  recomputeRating(p);return weighted;
}

export function performanceBreakdown(p){
  const ledger=ensureLedger(p);return{role:p.role,family:roleFamily(p.role),categories:Object.fromEntries(CATEGORIES.map(k=>[k,Number((ledger.categories[k]||0).toFixed(3))])),legacy:Number(ledger.legacy.toFixed(3)),recent:ledger.history.slice(0,8)};
}

function nearestOpponentDistance(engine,p){let best=999;for(const o of engine.players||[]){if(o.team!==p.team)best=Math.min(best,dist(p,o));}return best;}

export function positionalContribution(engine,p){
  if(!engine||!p||engine.restart?.active)return{category:'offBall',value:0,reason:'restart'};
  const state=engine.currentTacticalState?.(p.team)||engine.tacticalState?.teams?.[p.team]||null,ownPoss=state?state.inPossession:engine.lastPossessionTeam===p.team,family=roleFamily(p.role),dir=p.team===0?1:-1,ball=engine.ball,goalSide=(ball.x-p.x)*dir,phase=state?.phase||'unknown';let value=0,reason='shape';
  if(family==='keeper'){
    const ownX=p.team===0?FIELD.left:FIELD.right,depth=Math.abs(p.x-ownX),track=Math.abs(p.y-clamp(ball.y,FIELD.goalTop+18,FIELD.goalBottom-18));value=depth<115&&track<105?.014:depth>180?-.018:.002;reason='goal-support-position';
  }else if(family==='winger'){
    if(ownPoss){const width=Math.abs(p.y-FIELD.centerY)/((FIELD.bottom-FIELD.top)/2);value=width>.48?.018:width<.24?-.014:.006;reason='hold-useful-width';}
    else{const recovery=dist(p,{x:p.homeX,y:p.homeY});value=recovery<105?.012:recovery>220?-.012:.002;reason='wide-recovery';}
  }else if(family==='striker'){
    if(ownPoss){const depth=(p.x-ball.x)*dir;value=depth>48?.018:depth<-18?-.016:.004;reason='preserve-attacking-depth';}
    else{const pressDistance=dist(p,ball);value=pressDistance<155?.009:pressDistance>300?-.008:0;reason='screen-first-exit';}
  }else if(family==='midfielder'){
    if(ownPoss){const support=dist(p,ball);value=support>=52&&support<=190?.016:support<28?-.014:support>285?-.01:.003;reason='support-between-lines';}
    else{const central=Math.abs(p.y-FIELD.centerY);value=goalSide>18&&central<210?.014:goalSide<-18?-.016:.002;reason='screen-centre';}
  }else if(family==='centre-back'){
    value=goalSide>45?.016:goalSide<-12?-.022:.004;reason=ownPoss?'rest-defence':'protect-depth';
  }else if(family==='fullback'){
    const width=Math.abs(p.y-FIELD.centerY)/((FIELD.bottom-FIELD.top)/2);value=goalSide>22&&width>.32?.014:goalSide<-24?-.016:.003;reason=ownPoss?'balanced-width':'protect-wide-channel';
  }
  const contract=createRoleContract({role:p.role,tactics:engine.tactics?.[p.team]||{}}),responsibility=primaryResponsibility(contract,phase);
  return{category:'offBall',value,reason,responsibility:responsibility?.id||null,phase};
}

function semanticEventGroup(text,type){
  if(['goal','offside','end','restart','substitution','save','post'].includes(type))return null;
  const t=String(text||'').toLowerCase();if(/regate|dribl|cambio de direcci|frenado/.test(t))return'dribble';if(/duelo|forcejeo|cuerpo/.test(t))return'duel';if(/patea un pase/.test(t))return'pass-touch';return null;
}

const originalAdjustRating=MatchEngine.prototype.adjustRating;
const originalAttemptSkillMove=MatchEngine.prototype.attemptSkillMove;
const originalRegisterTouch=MatchEngine.prototype.registerPhysicalTouch;
const originalRegisterDuel=MatchEngine.prototype.registerDuelEvent;
const originalExecuteKick=MatchEngine.prototype.executeKick;
const originalCheckGoal=MatchEngine.prototype.checkGoal;
const originalPushEvent=MatchEngine.prototype.pushEvent;
const originalFlash=MatchEngine.prototype.flash;
const originalStep=MatchEngine.prototype.step;
const originalUserPerformance=MatchEngine.prototype.userPerformance;

MatchEngine.prototype.adjustRating=function roleAwareLegacyRating(p,delta){
  if(!p||!Number.isFinite(delta))return originalAdjustRating.call(this,p,delta);const ledger=ensureLedger(p);ledger.legacy+=delta*.22;return recomputeRating(p);
};

MatchEngine.prototype.attemptSkillMove=function semanticDribbleEpisode(p,defender){
  const result=originalAttemptSkillMove.call(this,p,defender);if(!p||!defender)return result;
  const key=`dribble:${p.id}:${defender.id}`;recordPerformanceValue(this,p,result?'dribbling':'errors',result?.065:-.014,key,{outcome:result?'beat-defender':'stopped',defenderId:defender.id},.11);return result;
};

MatchEngine.prototype.registerPhysicalTouch=function semanticPhysicalTouch(p,type='touch'){
  const passerId=this.ball.passerId,receiverId=this.ball.intendedReceiverId,passer=passerId?this.playerById(passerId):null,beforePass=passer?.perf?.passesCompleted||0,beforeInterceptions=p?.perf?.interceptions||0,beforeTackles=p?.perf?.tackles||0,beforeSaves=this.stats?.saves?.[p.team]||0,beforeTurnovers=passer?.perf?.turnovers||0;
  const result=originalRegisterTouch.call(this,p,type);
  if(passer&&receiverId===p.id&&passer.perf.passesCompleted>beforePass){const dir=passer.team===0?1:-1,forward=(p.x-passer.x)*dir,distance=dist(passer,p),space=nearestOpponentDistance(this,p),pressure=clamp((70-nearestOpponentDistance(this,passer))/70,0,1),utility=passFootballValue({role:passer.role,forward,distance,open:space,targetSpace:space,kind:passer.passIntent?.kind||'support',pressure});recordPerformanceValue(this,passer,'passing',.028+Math.max(-.015,utility*.055),`pass:${passer.id}:${this.tick}`,{utility:Number(utility.toFixed(3)),forward:Number(forward.toFixed(1))},0);}
  if((p?.perf?.interceptions||0)>beforeInterceptions)recordPerformanceValue(this,p,'defending',.062,`interception:${p.id}:${this.tick}`,{outcome:'interception'},0);
  if((p?.perf?.tackles||0)>beforeTackles)recordPerformanceValue(this,p,'defending',.042,`tackle:${p.id}:${this.tick}`,{outcome:'ball-won'},.03);
  if((this.stats?.saves?.[p.team]||0)>beforeSaves)recordPerformanceValue(this,p,'goalkeeping',.09,`save:${p.id}:${this.tick}`,{outcome:'save'},0);
  if(passer&&(passer?.perf?.turnovers||0)>beforeTurnovers)recordPerformanceValue(this,passer,'errors',-.07,`turnover:${passer.id}:${this.tick}`,{outcome:'turnover'},0);
  return result;
};

MatchEngine.prototype.registerDuelEvent=function semanticBodyDuel(duel){
  const result=originalRegisterDuel.call(this,duel),winner=this.playerById(duel?.winnerId),loser=this.playerById(duel?.loserId);if(!winner||!loser)return result;
  const value=defensiveFootballValue({role:winner.role,won:true,shielding:duel.kind==='shielding',intensity:duel.intensity});recordPerformanceValue(this,winner,duel.kind==='shielding'?'possession':'defending',.022+value*.035,`duel:${winner.id}:${loser.id}`,{kind:duel.kind,intensity:Number((duel.intensity||0).toFixed(2))},.08);recordPerformanceValue(this,loser,'errors',-.008,`duel-loss:${winner.id}:${loser.id}`,{kind:duel.kind},.08);return result;
};

MatchEngine.prototype.executeKick=function semanticShotValue(p,contactNormal=null){
  const before=p?.perf?.shots||0,goalX=p?.team===0?FIELD.right:FIELD.left,goalDistance=p?Math.abs(goalX-p.x):999,central=p?1-clamp(Math.abs(p.y-FIELD.centerY)/260,0,1):0,progress=p?(p.team===0?(p.x-FIELD.left)/(FIELD.right-FIELD.left):(FIELD.right-p.x)/(FIELD.right-FIELD.left)):0,pressure=p?clamp((58-nearestOpponentDistance(this,p))/58,0,1):0,shooting=Number(p?.data?.shooting??55);
  const result=originalExecuteKick.call(this,p,contactNormal);if(p&&(p.perf.shots||0)>before){const utility=shotFootballValue({role:p.role,progress,central,pressure,shooting,goalDistance}),onTarget=(p.perf.shotsOnTarget||0)>0;recordPerformanceValue(this,p,'shooting',.025+utility*.05+(onTarget?.018:0),`shot:${p.id}:${this.tick}`,{utility:Number(utility.toFixed(3)),goalDistance:Number(goalDistance.toFixed(1))},0);}return result;
};

MatchEngine.prototype.checkGoal=function semanticGoalValue(){
  const before=new Map((this.players||[]).map(p=>[p.id,{goals:p.perf.goals||0,assists:p.perf.assists||0}])),result=originalCheckGoal.call(this);
  for(const p of this.players||[]){const old=before.get(p.id);if(!old)continue;if((p.perf.goals||0)>old.goals)recordPerformanceValue(this,p,'universal',.68,`goal:${p.id}:${this.score.join('-')}`,{outcome:'goal'},0);if((p.perf.assists||0)>old.assists)recordPerformanceValue(this,p,'universal',.38,`assist:${p.id}:${this.score.join('-')}`,{outcome:'assist'},0);}return result;
};

MatchEngine.prototype.pushEvent=function episodeAwareEvent(text,team=null,type='info'){
  const group=semanticEventGroup(text,type);if(group){this._eventEpisodesV1??={};const key=`${team??'n'}:${group}:${type}`,last=this._eventEpisodesV1[key],samePossession=last?.possessionTeam===this.ball?.lastTeam;if(last&&samePossession&&this.minute-last.minute<.11){last.suppressed=(last.suppressed||0)+1;return false;}this._eventEpisodesV1[key]={minute:this.minute,possessionTeam:this.ball?.lastTeam??null,suppressed:0};}
  return originalPushEvent.call(this,text,team,type);
};

MatchEngine.prototype.flash=function episodeAwareFlash(p,action){if(p?.action===action&&(p.actionTimer||0)>.18)return false;return originalFlash.call(this,p,action);};

MatchEngine.prototype.step=function performanceAwareStep(dt){
  const result=originalStep.call(this,dt);if(!this.restart?.active&&this.tick%180===0){for(const p of this.players||[]){const contribution=positionalContribution(this,p);if(contribution.value)recordPerformanceValue(this,p,contribution.category,contribution.value,`position:${p.id}:${Math.floor(this.tick/180)}`,contribution,0);}}return result;
};

MatchEngine.prototype.userPerformance=function roleAwareUserPerformance(){const base=originalUserPerformance.call(this);if(!base)return base;const p=this.playerById(this.userId);return{...base,ratingBreakdown:performanceBreakdown(p)};};

export const __performanceRatingV1={ensureLedger,recomputeRating,semanticEventGroup,nearestOpponentDistance,CATEGORIES};
