import {MatchEngine} from './engine.js';
import {__evaluationV2} from './match-evaluation-v2.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const defensiveRoles=new Set(['GK','CB','LB','RB','LWB','RWB','CDM']);
const attackingRoles=new Set(['ST','LW','RW','LM','RM','CAM']);

function add(engine,p,cat,value,label,key,cooldown){return __evaluationV2.add(engine,p,cat,value,label,key,cooldown);}

export function performanceReliability(p){
  const perf=p?.perf||{},touches=Math.max(1,Number(perf.touches)||0),passes=Number(perf.passesAttempted)||0,completed=Number(perf.passesCompleted)||0,duels=Number(perf.bodyDuels)||0,duelsWon=Number(perf.bodyDuelsWon)||0,turnovers=Number(perf.turnovers)||0;
  const passSignal=passes>=4?(completed/passes-.72)*.24:0;
  const duelSignal=duels>=3?(duelsWon/duels-.50)*.16:0;
  const errorSignal=-clamp(turnovers/touches,0,.35)*.65;
  return clamp(passSignal+duelSignal+errorSignal,-.24,.18);
}

export function balancedPlayerRating(engine,p){
  if(!engine||!p)return{rating:6,breakdown:{}};
  const causal=__evaluationV2.ratingFor(engine,p),reliability=performanceReliability(p);
  const minutes=clamp(Number(engine.minute)||0,0,90),sample=clamp(minutes/18,.28,1);
  const adjusted=6+(causal.rating-6)*(.78+.22*sample)+reliability*sample;
  return{...causal,rating:Math.round(clamp(adjusted,3,10)*100)/100,reliability:+reliability.toFixed(3)};
}

function evaluateRoleWork(engine){
  const possession=engine.inferPossessionTeam?.();
  if(possession!==0&&possession!==1)return;
  const actor=engine.ballActor?.(possession);
  if(!actor)return;
  for(const p of engine.players){
    if(p.role==='GK')continue;
    const ownBall=p.team===possession;
    if(ownBall&&p.id!==actor.id){
      const supportDistance=dist(p,actor);
      if(supportDistance>=62&&supportDistance<=178)add(engine,p,'offBall',.014,'Da una línea de apoyo',`support-${p.id}`,72);
      if(attackingRoles.has(p.role)){
        const ahead=(p.team===0?p.x-actor.x:actor.x-p.x);
        if(ahead>42&&supportDistance<235)add(engine,p,'tactical',.012,'Ocupa una altura útil',`height-${p.id}`,84);
      }
    }else if(!ownBall){
      const goalX=p.team===0?55:1045,ballGoalDistance=Math.abs(engine.ball.x-goalX),playerGoalDistance=Math.abs(p.x-goalX);
      if(playerGoalDistance<ballGoalDistance+120&&dist(p,engine.ball)<210){
        const value=defensiveRoles.has(p.role)?.020:.011;
        add(engine,p,'defending',value,'Sostiene la recuperación',`recovery-${p.id}`,78);
      }
    }
  }
}

const previousStep=MatchEngine.prototype.step;
MatchEngine.prototype.step=function balancedPerformanceStep(dt){const out=previousStep.call(this,dt);if(!this.finished&&!this.restart?.active&&this.tick%24===0)evaluateRoleWork(this);return out;};

const previousUserPerformance=MatchEngine.prototype.userPerformance;
MatchEngine.prototype.userPerformance=function balancedUserPerformance(){const base=previousUserPerformance.call(this);if(!base)return base;const p=this.playerById(this.userId),score=balancedPlayerRating(this,p);return{...base,rating:score.rating,ratingBreakdown:score.breakdown,ratingNotes:score.notes,reliability:score.reliability,staminaState:p?.staminaState||null};};

const previousReport=MatchEngine.prototype.report;
MatchEngine.prototype.report=function balancedReport(){const base=previousReport.call(this);return{...base,playerRatings:this.players.map(p=>({id:p.id,name:p.data?.name,team:p.team,role:p.role,...balancedPlayerRating(this,p),fatigue:Math.round(Number(p.fatigue)||0)}))};};

export const __playerPerformanceScoreV1={performanceReliability,balancedPlayerRating,evaluateRoleWork};
