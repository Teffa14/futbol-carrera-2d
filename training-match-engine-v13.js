import {TrainingMatchEngine as TrainingMatchEngineV12} from './training-match-engine-v12.js';

export const TRAINING_MATCH_ENGINE_VERSION=13;

const EXECUTION_DRILLS=new Set(['st-profile-finish','st-one-touch','st-run-behind','st-wall-run','st-box-duel','st-press','st-free-kick']);
const FIELD={right:1045,goalTop:295,goalBottom:405,centerY:350};
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};

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

function ensureBoxFinishContact(e,dt){
  const q=e.trainingQualityV6,[def,keeper]=e.defenders;
  if(q.customStage!=='finish'||q.shotTick!=null)return;
  if(def)e.move(def,{x:Math.max(790,e.player.x-56),y:e.player.y+(q.duelSide||1)*44},dt);
  const target={x:FIELD.right+26,y:(keeper?.y??FIELD.centerY)<FIELD.centerY?FIELD.goalBottom-20:FIELD.goalTop+20};
  const d=unit(target.x-e.ball.x,target.y-e.ball.y),contact=e.player.r+e.ball.r-.55;
  const spot={x:e.ball.x-d.x*(contact+1.2),y:e.ball.y-d.y*(contact+1.2)};
  e.turnPlayer(e.player,d,dt);
  if(!e.player.kickIntent&&dist(e.player,spot)<4.8)e.armKick(e.player,target,7.25,'shot',{trainingKind:'shot'});
  e.move(e.player,dist(e.player,spot)>4.8?spot:{x:e.ball.x+d.x*19,y:e.ball.y+d.y*19},dt);
  const kick=e.lastTrainingKick;
  if(kick?.rep===e.rep&&kick.by===e.player.id&&kick.kind==='shot'){
    q.shotTick=kick.tick;q.shotTime=e.time;q.shotStartX=e.ball.x;
  }
}

function reconcilePhysicalExecution(e,dt){
  const id=e.drill?.id,q=e.trainingQualityV6,m=e.trainingMetricsV6;
  if(!EXECUTION_DRILLS.has(id)||!q)return;

  if(id==='st-profile-finish'){
    if(q.shotTick!=null){forceSuccess(e,'PERFIL + REMATE','profiled-shot-executed');return;}
    if(q.receiveTick>=0&&q.customStage==='profile'&&stageAge(e)>.72&&e.ball.lastPlayerId===e.player.id){
      forceSuccess(e,'CONTROL ORIENTADO','profiled-reception-executed');
      return;
    }
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
      q.repTerminal=false;q.repTerminalAt=null;q.repSuccess=false;
      q.customStage='finish';q.stageAt=e.time;
      return;
    }
    ensureBoxFinishContact(e,dt);
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
  resetRep(rep,initial=false){return super.resetRep(rep,initial);}
  scenario(dt){
    const out=super.scenario(dt);
    reconcilePhysicalExecution(this,dt);
    return out;
  }
  sessionResult(){const out=super.sessionResult();return{...out,engineVersion:13};}
}

export const __trainingMatchEngineV13={reconcilePhysicalExecution,forceSuccess,ensureBoxFinishContact};
