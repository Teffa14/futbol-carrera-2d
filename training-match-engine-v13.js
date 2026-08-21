import {TrainingMatchEngine as TrainingMatchEngineV12} from './training-match-engine-v12.js';

export const TRAINING_MATCH_ENGINE_VERSION=13;

const EXECUTION_DRILLS=new Set(['st-profile-finish','st-one-touch','st-run-behind','st-wall-run','st-box-duel','st-press','st-free-kick']);

function stageAge(e){
  const q=e.trainingQualityV6;
  return Math.max(0,e.time-(q?.stageAt??e.repStart));
}

function forceSuccess(e,text,reason){
  const q=e.trainingQualityV6;
  if(!q)return;
  q.repSuccess=true;
  q.repTerminal=true;
  q.repTerminalAt=e.time;
  q.terminalReason=reason||text;
  e.flashTraining(text);
}

function reconcilePhysicalExecution(e){
  const id=e.drill?.id,q=e.trainingQualityV6,m=e.trainingMetricsV6;
  if(!EXECUTION_DRILLS.has(id)||!q)return;

  if(id==='st-profile-finish'&&q.shotTick!=null){
    forceSuccess(e,'PERFIL + REMATE','profiled-shot-executed');
    return;
  }

  if(id==='st-one-touch'&&q.shotTick!=null){
    forceSuccess(e,'REMATE DE PRIMERA','one-touch-shot-executed');
    return;
  }

  if(id==='st-run-behind'&&q.serviceTick>=0&&e.ball.lastPlayerId===e.player.id&&e.ball.lastTouchTick>q.serviceTick){
    m.throughReceptions=Math.max(1,m.throughReceptions||0);
    forceSuccess(e,'PASE FILTRADO RECIBIDO','through-ball-physically-received');
    return;
  }

  if(id==='st-wall-run'&&q.returnTick>=0&&e.ball.lastPlayerId===e.player.id&&e.ball.lastTouchTick>q.returnTick){
    m.throughReceptions=Math.max(1,m.throughReceptions||0);
    forceSuccess(e,'DESCARGA + RUPTURA','return-pass-physically-received');
    return;
  }

  if(id==='st-box-duel'){
    if(q.customStage==='turn'&&e.ball.lastPlayerId===e.player.id&&(e.ball.x>775||stageAge(e)>.95)){
      if(!q.turnComplete){q.turnComplete=true;m.duelsBeaten=(m.duelsBeaten||0)+1;e.flashTraining('GIRO LIMPIO');}
      q.customStage='finish';q.stageAt=e.time;
      return;
    }
    if(q.shotTick!=null){
      forceSuccess(e,'GIRO + REMATE','box-duel-shot-executed');
      return;
    }
  }

  if(id==='st-press'){
    if(q.forcedPassTick>=0){
      forceSuccess(e,'PASE ATRÁS FORZADO','forced-back-pass');
      return;
    }
    if(q.customStage==='trap'&&stageAge(e)>1.15&&e.ball.lastPlayerId===e.defenders?.[1]?.id){
      forceSuccess(e,'SALIDA ENCERRADA','wide-exit-contained');
      return;
    }
  }

  if(id==='st-free-kick'&&q.shotTick!=null){
    forceSuccess(e,'TIRO LIBRE EJECUTADO','free-kick-physically-executed');
  }
}

export class TrainingMatchEngine extends TrainingMatchEngineV12{
  constructor(drill,result,player){super(drill,result,player);this.trainingEngineVersion=13;}
  scenario(dt){
    const out=super.scenario(dt);
    reconcilePhysicalExecution(this);
    return out;
  }
  sessionResult(){const out=super.sessionResult();return{...out,engineVersion:13};}
}

export const __trainingMatchEngineV13={reconcilePhysicalExecution,forceSuccess};
