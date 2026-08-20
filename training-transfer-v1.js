import {TrainingMatchEngine} from './training-match-engine-v1.js';
import {bestAttackingSpace,crossTrajectoryTarget} from './collective-space-play-v1.js';

const FIELD={left:55,right:1045,top:45,bottom:655,goalTop:295,goalBottom:405,centerX:550,centerY:350};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const PASS_KINDS=new Set(['pass','wall','third-man','through','cross','cutback','service']);

function goalTarget(engine,attacker){
  const keeper=engine.players.find(p=>p.team!==attacker.team&&p.role==='GK'),goalX=attacker.team===0?FIELD.right+28:FIELD.left-28;
  const y=keeper?.y<FIELD.centerY?FIELD.goalBottom-23:FIELD.goalTop+23;
  return{x:goalX,y};
}
function attackGoal(engine,holder,dt,power=7.35){
  if(!holder)return false;
  const dir=holder.team===0?1:-1,progress=holder.team===0?engine.ball.x:FIELD.right-engine.ball.x;
  if(progress<(holder.team===0?705:FIELD.right-705)){
    engine.dribbleTo(holder,{x:clamp(holder.x+dir*120,FIELD.left+24,FIELD.right-24),y:clamp(holder.y+(FIELD.centerY-holder.y)*.28,FIELD.top+24,FIELD.bottom-24)},dt);
    return false;
  }
  return engine.tryKick(holder,goalTarget(engine,holder),power,'shot',null,dt);
}
function markGoal(engine){
  const q=engine.trainingQualityV6,m=engine.trainingMetricsV6;if(!engine.goalScored())return false;
  if(!q.goal){q.goal=true;m.goals++;engine.flashTraining('GOL');}q.repSuccess=true;return true;
}

const originalResetActor=TrainingMatchEngine.prototype.resetActor;
TrainingMatchEngine.prototype.resetActor=function preserveTrainingFatigue(p,x,y,role=null){
  const fatigue=Number(p?.fatigue)||0,out=originalResetActor.call(this,p,x,y,role);if(p)p.fatigue=fatigue;return out;
};

TrainingMatchEngine.prototype.move=function staminaTrackedTrainingMove(p,target,dt){
  if(!p||!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))return;
  this._moved.add(p.id);this.movePlayer(p,target,dt,true);
};

const originalTryKick=TrainingMatchEngine.prototype.tryKick;
TrainingMatchEngine.prototype.tryKick=function weightedTrainingKick(p,target,power,kind='pass',receiver=null,dt=.016){
  let adjusted=power;
  if(PASS_KINDS.has(kind)){
    const distance=dist(this.ball,target),passing=Number(p?.data?.passing??65),control=Number(p?.data?.ballControl??65);
    adjusted=clamp(2.75+distance/105+(passing-60)*.011+(control-60)*.004,2.9,kind==='cross'?6.15:kind==='through'?6.0:5.65);
    if(kind==='cutback')adjusted=Math.min(adjusted,5.15);
    if(kind==='wall')adjusted=Math.min(adjusted,5.0);
  }
  return originalTryKick.call(this,p,target,adjusted,kind,receiver,dt);
};

const originalScenario=TrainingMatchEngine.prototype.scenario;
TrainingMatchEngine.prototype.scenario=function transferableTrainingScenario(dt){
  const k=this.drill?.kind,q=this.trainingQualityV6,m=this.trainingMetricsV6;

  if(k==='1v1'){
    const defender=this.defenders[0];
    if(defender&&q.branch&&!q.skillMoveAttempted&&dist(this.player,defender)<70){
      q.skillMoveAttempted=true;q.skillMoveSucceeded=this.attemptSkillMove(this.player,defender);
    }
    originalScenario.call(this,dt);
    if(q.beatDefender&&q.skillMoveSucceeded&&this.player.burstTimer<=0&&!q.postBeatBurstUsed){this.player.burstTimer=.34;q.postBeatBurstUsed=true;}
    return;
  }

  if(k==='2v2'||k==='3v3'){
    originalScenario.call(this,dt);
    if(markGoal(this))return;
    q.repSuccess=false;
    const attackers=[this.player,...this.mates],holder=attackers.find(p=>p.id===q.possessionId)||this.ballActor(0);
    const completed=this.smallSidedV8?this.stats.passesCompleted[0]-this.smallSidedV8.passStart[0]:m.passesCompleted;
    const ready=k==='2v2'?completed>=1:completed>=2;
    if(ready&&holder?.team===0&&!q.pendingPass){q.phase='Crear y terminar la jugada';if(!q.finishShot)q.finishShot=attackGoal(this,holder,dt,k==='2v2'?7.25:7.35);}
    return;
  }

  if(k==='finish'&&q.service&&q.pendingPass&&!q.finishShot&&!q.firstTimeArmed){
    const speed=Math.hypot(this.ball.vx,this.ball.vy),contact=this.player.r+this.ball.r+23;
    if(speed>.9&&dist(this.player,this.ball)<contact){
      const keeper=this.defenders.find(p=>p.role==='GK')||this.defenders.at(-1),target={x:FIELD.right+28,y:keeper?.y<FIELD.centerY?FIELD.goalBottom-22:FIELD.goalTop+22};
      this.armKick(this.player,target,7.45,'shot',{trainingKind:'shot',firstTime:true});q.firstTimeArmed=true;q.phase='Definir de primera';
    }
  }
  if(k==='finish'&&q.firstTimeArmed&&this.lastTrainingKick?.rep===this.rep&&this.lastTrainingKick?.by===this.player.id&&this.lastTrainingKick?.kind==='shot')q.finishShot=true;

  originalScenario.call(this,dt);

  if(k==='cross'){
    const [near,far,cutback]=this.mates;if(!near||!far||!cutback)return;
    if(!q.delivered){
      for(const mate of this.mates)this.move(mate,bestAttackingSpace(this,mate,this.player),dt);
    }else if(q.pendingPass){
      for(const mate of this.mates){const trajectory=crossTrajectoryTarget(this,mate)||this.projectedIntercept(mate);this.move(mate,trajectory,dt);}
      q.phase='Atacar la trayectoria del centro';
    }
  }
};

export const __trainingTransferTest={goalTarget,attackGoal,markGoal,PASS_KINDS};