import {TrainingMatchEngine as TrainingMatchEngineV9} from './training-match-engine-v9.js';

export const TRAINING_MATCH_ENGINE_VERSION=10;
const FIELD={centerY:350};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function hold(e,p,target,dt){if(p&&target)e.move(p,target,dt);}
function markSuccess(e,text='RESUELTO'){
  const q=e.trainingQualityV6;if(q.repSuccess)return;q.repSuccess=true;e.flashTraining(text);
}

function finishScanReceive(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[mate]=e.mates,[press,cover]=e.defenders,side=e.rep%2?1:-1;
  q.phase=q.turnPhase==='carry'?'Progresar tras recibir':'Quedar detrás de la pelota';

  q.turnOriginX??=q.turnStartX??e.ball.x;
  // The physical reception is touch one. Require at least one additional user contact.
  q.turnTouchBaseline??=Math.max(0,(q.turnTouchStart??m.physicalTouches??0)-1);
  q.turnPhase??='recover';

  hold(e,mate,{x:455,y:FIELD.centerY-side*140},dt);
  hold(e,press,{x:495,y:FIELD.centerY-side*155},dt);
  hold(e,cover,{x:clamp(q.turnOriginX+125,700,770),y:clamp(e.ball.y-side*82,115,585)},dt);

  const contact=e.player.r+e.ball.r+1.4;
  const behind={x:e.ball.x-contact-2,y:clamp(e.ball.y+side*8,100,600)};
  const carryTarget={x:clamp(q.turnOriginX+88,650,760),y:clamp(e.ball.y+side*24,125,575)};

  if(q.turnPhase==='recover'){
    e.player.dribbleIntent=null;
    hold(e,e.player,behind,dt);
    e.turnPlayer(e.player,{x:1,y:side*.10},dt);
    if(dist(e.player,behind)<4.5||e.player.x<=e.ball.x-contact*.72){
      q.turnPhase='carry';
      e.flashTraining('PERFILADO');
    }
    return;
  }

  e.dribbleTo(e.player,carryTarget,dt);
  const userTouches=(m.physicalTouches||0)-q.turnTouchBaseline;
  const progressed=e.ball.x>q.turnOriginX+18;
  if(userTouches>=2&&progressed&&e.ball.lastPlayerId===e.player.id){
    markSuccess(e,'RECEPCIÓN + PROGRESIÓN');
  }
}

export class TrainingMatchEngine extends TrainingMatchEngineV9{
  constructor(drill,result,player){super(drill,result,player);this.trainingEngineVersion=10;}
  resetRep(rep,initial=false){super.resetRep(rep,initial);}
  scenario(dt){
    if(this.drill?.id==='cam-scan-receive'&&this.trainingQualityV6?.customStage==='turn'){
      return finishScanReceive(this,dt);
    }
    return super.scenario(dt);
  }
  sessionResult(){const out=super.sessionResult();return{...out,engineVersion:10};}
}

export const __trainingMatchEngineV10={finishScanReceive};
