import {TrainingMatchEngine as TrainingMatchEngineV5} from './training-match-engine-v5.js';

export const TRAINING_MATCH_ENGINE_VERSION=6;
const FIELD={right:1045,goalTop:295,goalBottom:405,centerY:350};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const profileStageIds=new Set(['w-cross-choice','cam-scan-receive','mid-support']);

function hold(e,p,x,y,dt){if(p)e.move(p,{x,y},dt);}
function physicalReception(e,p,kickTick=-1){return !!p&&e.ball.lastPlayerId===p.id&&e.ball.lastTouchTick>kickTick;}

function crossChoiceLeadIn(e,dt){
  const q=e.trainingQualityV6,[near,far,cut]=e.mates,[wide,box,keeper]=e.defenders,side=e.rep%2?1:-1;
  e.observeTouches();
  hold(e,near,840,FIELD.centerY-side*38,dt);hold(e,far,865,FIELD.centerY+side*54,dt);hold(e,cut,785,FIELD.centerY+side*112,dt);
  hold(e,box,875,FIELD.centerY,dt);hold(e,keeper,FIELD.right-28,FIELD.centerY-side*12,dt);

  if(q.customStage==='carry'){
    q.phase='Ganar línea y frenar';
    hold(e,wide,735,clamp(e.player.y-side*60,100,600),dt);
    e.dribbleTo(e.player,{x:735,y:e.player.y},dt);
    if(e.ball.x>=705){
      q.customStage='profile';
      q.receiverId=(e.rep%2?far:cut).id;
      e.player.dribbleIntent=null;
      e.player.vx*=.45;e.player.vy*=.45;
    }
    return true;
  }

  if(q.customStage==='profile'){
    q.phase='Perfilar antes del centro';
    hold(e,wide,735,clamp(e.player.y-side*60,100,600),dt);
    const receiver=e.mates.find(p=>p.id===q.receiverId);if(!receiver)return true;
    const kind=receiver===cut?'cutback':'cross';
    if(e.tryKick(e.player,receiver,1.72,'cross-choice',receiver,dt)){
      q.customStage='receive';q.kickTick=e.tick;
      e.trainingMetricsV6.deliveries=(e.trainingMetricsV6.deliveries||0)+1;
      e.trainingMetricsV6.deliveryChoices?.add?.(kind);
      e.pending(e.player,receiver,kind);
    }
    return true;
  }
  return false;
}

function scanLeadIn(e,dt){
  const q=e.trainingQualityV6,[mate]=e.mates,[press,cover]=e.defenders,side=e.rep%2?1:-1;
  e.observeTouches();hold(e,press,505,FIELD.centerY-side*170,dt);hold(e,cover,715,FIELD.centerY+side*22,dt);
  if(q.customStage==='offer'){
    q.phase='Escanear y aparecer entre líneas';e.move(e.player,{x:600,y:FIELD.centerY+side*75},dt);e.dribbleTo(mate,{x:455,y:mate.y},dt);
    if(e.repProgress()>.055||e.ball.x>448){q.customStage='profile';mate.dribbleIntent=null;mate.vx*=.4;mate.vy*=.4;}
    return true;
  }
  if(q.customStage==='profile'){
    q.phase='Perfilar el pase entre líneas';e.move(e.player,{x:600,y:FIELD.centerY+side*75},dt);
    const target={x:e.player.x+10,y:e.player.y};
    if(e.tryKick(mate,target,1.55,'scan-service',e.player,dt)){q.customStage='receive';q.kickTick=e.tick;e.pending(mate,e.player,'pass');}
    return true;
  }
  return false;
}

function supportLeadIn(e,dt){
  const q=e.trainingQualityV6,[mate]=e.mates,[press,cover]=e.defenders,side=e.rep%2?1:-1;
  e.observeTouches();hold(e,press,500,FIELD.centerY-side*165,dt);hold(e,cover,690,FIELD.centerY+side*55,dt);
  if(q.customStage==='offer'){
    q.phase='Crear un ángulo útil';e.move(e.player,{x:560,y:FIELD.centerY+side*92},dt);e.dribbleTo(mate,{x:452,y:mate.y},dt);
    if(e.repProgress()>.055||e.ball.x>448){q.customStage='profile';mate.dribbleIntent=null;mate.vx*=.4;mate.vy*=.4;}
    return true;
  }
  if(q.customStage==='profile'){
    q.phase='Perfilar hacia el apoyo';e.move(e.player,{x:560,y:FIELD.centerY+side*92},dt);
    if(e.tryKick(mate,e.player,1.5,'support-service',e.player,dt)){q.customStage='receive';q.kickTick=e.tick;e.pending(mate,e.player,'pass');}
    return true;
  }
  return false;
}

export class TrainingMatchEngine extends TrainingMatchEngineV5{
  constructor(drill,result,player){super(drill,result,player);this.trainingEngineVersion=6;}
  resetRep(rep,initial=false){super.resetRep(rep,initial);}
  scenario(dt){
    const id=this.drill?.id;
    if(id==='w-cross-choice'&&crossChoiceLeadIn(this,dt))return;
    if(id==='cam-scan-receive'&&scanLeadIn(this,dt))return;
    if(id==='mid-support'&&supportLeadIn(this,dt))return;
    return super.scenario(dt);
  }
  sessionResult(){const out=super.sessionResult();return{...out,engineVersion:6};}
}

export const __trainingMatchEngineV6={profileStageIds,physicalReception};
