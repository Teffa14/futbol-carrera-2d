import {TrainingMatchEngine as TrainingMatchEngineV6} from './training-match-engine-v6.js';

export const TRAINING_MATCH_ENGINE_VERSION=7;
const FIELD={right:1045,goalTop:295,goalBottom:405,centerY:350};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function hold(e,p,x,y,dt){if(p)e.move(p,{x,y},dt);}
function markSuccess(e,text='RESUELTO'){
  const q=e.trainingQualityV6;if(q.repSuccess)return;q.repSuccess=true;e.flashTraining(text);
}

function finishCrossPhysically(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[,box,keeper]=e.defenders;
  const receiver=e.mates.find(p=>p.id===q.receiverId);
  if(!receiver)return true;

  q.phase='Perfilar y rematar la entrega';
  hold(e,box,clamp(receiver.x+58,850,925),FIELD.centerY,dt);
  hold(e,keeper,FIELD.right-28,clamp(e.ball.y,FIELD.goalTop+18,FIELD.goalBottom-18),dt);

  const target={x:FIELD.right+26,y:keeper?.y<FIELD.centerY?FIELD.goalBottom-20:FIELD.goalTop+20};
  const kicked=e.tryKick(receiver,target,6.6,'cross-finish',null,dt);
  const physicalKick=e.lastTrainingKick?.rep===e.rep&&e.lastTrainingKick?.by===receiver.id&&e.lastTrainingKick?.kind==='cross-finish';
  if(kicked&&physicalKick){
    if(!q.finishShot){m.shots=Math.max(1,m.shots||0);q.finishShot=true;q.finishTick=e.tick;}
    markSuccess(e,'CENTRO + REMATE');
  }
  return true;
}

function finishScanTurn(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[mate]=e.mates,[press,cover]=e.defenders,side=e.rep%2?1:-1;
  q.phase='Orientar y progresar';
  q.turnTouchStart??=m.physicalTouches||0;
  q.turnStartX??=q.receiveX??e.ball.x;

  hold(e,mate,430,FIELD.centerY-side*155,dt);
  hold(e,press,500,FIELD.centerY-side*175,dt);
  hold(e,cover,clamp((q.turnStartX||560)+92,660,745),clamp(e.ball.y-side*62,125,575),dt);

  const target={x:clamp((q.turnStartX||560)+88,625,735),y:clamp(e.ball.y+side*34,130,570)};
  e.dribbleTo(e.player,target,dt);

  const controlTouches=(m.physicalTouches||0)-(q.turnTouchStart||0);
  const progressed=e.ball.x>(q.turnStartX||560)+34;
  if(controlTouches>=2&&progressed&&e.ball.lastPlayerId===e.player.id){
    markSuccess(e,'RECEPCIÓN ORIENTADA');
  }
  return true;
}

export class TrainingMatchEngine extends TrainingMatchEngineV6{
  constructor(drill,result,player){super(drill,result,player);this.trainingEngineVersion=7;}
  resetRep(rep,initial=false){super.resetRep(rep,initial);}
  scenario(dt){
    const id=this.drill?.id,q=this.trainingQualityV6;
    if(id==='w-cross-choice'&&q?.customStage==='finish')return finishCrossPhysically(this,dt);
    if(id==='cam-scan-receive'&&q?.customStage==='turn')return finishScanTurn(this,dt);
    return super.scenario(dt);
  }
  sessionResult(){const out=super.sessionResult();return{...out,engineVersion:7};}
}

export const __trainingMatchEngineV7={finishCrossPhysically,finishScanTurn};
