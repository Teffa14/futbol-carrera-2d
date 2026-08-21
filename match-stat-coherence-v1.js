import {MatchEngine} from './engine.js';

const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

const originalSkill=MatchEngine.prototype.attemptSkillMove;
MatchEngine.prototype.attemptSkillMove=function coherentSkillMove(p,defender){
  if(!p||!defender)return false;
  const contact=(p.r||7)+(this.ball?.r||4.35)+8;
  if(dist(p,this.ball)>contact)return false;
  if(this.ball.lastPlayerId!==p.id||this.tick-this.ball.lastTouchTick>1)this.registerPhysicalTouch(p,'touch');
  return originalSkill.call(this,p,defender);
};

const originalCheckGoal=MatchEngine.prototype.checkGoal;
MatchEngine.prototype.checkGoal=function coherentGoalStats(){
  const before=[...this.score],right=this.ball.x>1045+9,left=this.ball.x<55-9,mouth=this.ball.y>295&&this.ball.y<405;
  let scoring=null;if(mouth&&right)scoring=0;if(mouth&&left)scoring=1;
  const last=this.playerById(this.ball.lastPlayerId),shot=this.playerById(this.ball.shotById),attacker=shot?.team===scoring?shot:(last?.team===scoring?last:null),ownGoal=last&&scoring!==null&&last.team!==scoring;
  if(scoring!==null&&attacker){
    const teamShots=this.stats.shots[scoring]||0;
    if(!this.ball.shotById){attacker.perf.shots++;attacker.perf.shotsOnTarget++;this.stats.shots[scoring]=teamShots+1;this.stats.shotsOnTarget[scoring]=(this.stats.shotsOnTarget[scoring]||0)+1;this.ball.shotById=attacker.id;}
    else if(teamShots<1){this.stats.shots[scoring]=1;this.stats.shotsOnTarget[scoring]=Math.max(1,this.stats.shotsOnTarget[scoring]||0);}
  }
  const result=originalCheckGoal.call(this);
  if(ownGoal&&(this.score[scoring]||0)>(before[scoring]||0)){
    const event=this.events.find(e=>e.type==='goal'&&e.team===scoring);
    if(event)event.text=`GOL EN CONTRA — ${last.data?.name||'Defensor'}`;
  }
  return result;
};

const originalReport=MatchEngine.prototype.report;
MatchEngine.prototype.report=function coherentReport(){
  const r=originalReport.call(this);
  for(let team=0;team<2;team++)if(r.score[team]>0&&r.stats.shots[team]===0){
    const ownGoals=(r.events||[]).filter(e=>e.team===team&&/GOL EN CONTRA/i.test(e.text||'')).length;
    if(r.score[team]>ownGoals)r.stats.shots[team]=r.score[team]-ownGoals;
  }
  const u=r.userPerformance;
  if(u&&u.dribblesCompleted>0&&u.touches===0)u.touches=Math.max(1,u.dribblesCompleted);
  return r;
};

export const __matchStatCoherenceV1={};
