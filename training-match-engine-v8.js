import {TrainingMatchEngine as TrainingMatchEngineV7} from './training-match-engine-v7.js';

export const TRAINING_MATCH_ENGINE_VERSION=8;
const FIELD={centerY:350};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function holdReceivingShape(e,p,anchor,side,dt){
  if(!p||!anchor)return;
  p.dribbleIntent=null;
  p.kickIntent=null;
  p.vx*=.58;
  p.vy*=.58;
  const yError=anchor.y-p.y;
  const xError=anchor.x-p.x;
  if(Math.abs(xError)>3||Math.abs(yError)>3){
    e.move(p,{x:anchor.x,y:anchor.y},dt);
  }
  e.turnPlayer(p,{x:1,y:side*.16},dt);
}

function receiveScanSideOn(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[mate]=e.mates,[press,cover]=e.defenders,side=e.rep%2?1:-1;
  e.observeTouches();
  q.phase='Perfilar y recibir entre líneas';

  if(!q.receiveAnchor){
    q.receiveAnchor={x:e.player.x,y:e.player.y};
    q.receiveEntryTouch=m.physicalTouches||0;
  }

  if(mate)e.move(mate,{x:430,y:FIELD.centerY-side*155},dt);
  if(press)e.move(press,{x:500,y:FIELD.centerY-side*175},dt);
  if(cover)e.move(cover,{x:690,y:clamp(q.receiveAnchor.y-side*58,125,575)},dt);

  holdReceivingShape(e,e.player,q.receiveAnchor,side,dt);

  const received=e.ball.lastPlayerId===e.player.id&&e.ball.lastTouchTick>(q.kickTick??-1);
  if(received){
    q.customStage='turn';
    q.receiveX=e.ball.x;
    q.turnStartX=e.ball.x;
    q.turnTouchStart=m.physicalTouches||0;
    e.flashTraining('RECIBIDA DE PERFIL');
  }
  return true;
}

export class TrainingMatchEngine extends TrainingMatchEngineV7{
  constructor(drill,result,player){super(drill,result,player);this.trainingEngineVersion=8;}
  resetRep(rep,initial=false){super.resetRep(rep,initial);}
  scenario(dt){
    if(this.drill?.id==='cam-scan-receive'&&this.trainingQualityV6?.customStage==='receive'){
      return receiveScanSideOn(this,dt);
    }
    return super.scenario(dt);
  }
  sessionResult(){const out=super.sessionResult();return{...out,engineVersion:8};}
}

export const __trainingMatchEngineV8={holdReceivingShape,receiveScanSideOn};
