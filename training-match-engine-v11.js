import {TrainingMatchEngine as TrainingMatchEngineV10} from './training-match-engine-v10.js';

export const TRAINING_MATCH_ENGINE_VERSION=11;
const FIELD={centerY:350};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function hold(e,p,target,dt){if(p&&target)e.move(p,target,dt);}
function markSuccess(e,text='RESUELTO'){
  const q=e.trainingQualityV6;if(q.repSuccess)return;q.repSuccess=true;e.flashTraining(text);
}

function physicalCarryAfterReception(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[mate]=e.mates,[press,cover]=e.defenders,side=e.rep%2?1:-1;
  q.turnOriginX??=q.turnStartX??e.ball.x;
  q.turnTouchBaseline??=Math.max(0,(q.turnTouchStart??m.physicalTouches??0)-1);
  q.turnPhase??='recover';

  hold(e,mate,{x:450,y:FIELD.centerY-side*145},dt);
  hold(e,press,{x:490,y:FIELD.centerY-side*165},dt);
  hold(e,cover,{x:clamp(q.turnOriginX+135,705,780),y:clamp(e.ball.y-side*92,110,590)},dt);

  const contact=e.player.r+e.ball.r;
  const behind={x:e.ball.x-contact-3,y:clamp(e.ball.y+side*6,95,605)};
  const safelyBehind=e.player.x<=e.ball.x-contact*.70;

  if(q.turnPhase==='recover'||!safelyBehind){
    q.phase='Quedar detrás de la pelota';
    q.turnPhase='recover';
    e.player.dribbleIntent=null;
    hold(e,e.player,behind,dt);
    e.turnPlayer(e.player,{x:1,y:side*.08},dt);
    if(dist(e.player,behind)<4||e.player.x<=e.ball.x-contact*.82){
      q.turnPhase='carry';e.flashTraining('PERFILADO');
    }
    return;
  }

  q.phase='Progresar tras recibir';
  e.player.dribbleIntent={targetX:q.turnOriginX+95,targetY:e.ball.y+side*18,ttl:.22};
  e.turnPlayer(e.player,{x:1,y:side*.08},dt);
  // Aim the player's body slightly into the back of the free ball. The ball itself
  // is never repositioned: progress can only come from circle-circle contact.
  const pushPoint={x:e.ball.x-contact+4.5,y:clamp(e.ball.y+side*3,95,605)};
  hold(e,e.player,pushPoint,dt);

  const userTouches=(m.physicalTouches||0)-q.turnTouchBaseline;
  const progressed=e.ball.x>q.turnOriginX+18;
  if(userTouches>=2&&progressed&&e.ball.lastPlayerId===e.player.id){
    markSuccess(e,'RECEPCIÓN + PROGRESIÓN');
  }
}

export class TrainingMatchEngine extends TrainingMatchEngineV10{
  constructor(drill,result,player){super(drill,result,player);this.trainingEngineVersion=11;}
  resetRep(rep,initial=false){super.resetRep(rep,initial);}
  scenario(dt){
    if(this.drill?.id==='cam-scan-receive'&&this.trainingQualityV6?.customStage==='turn'){
      return physicalCarryAfterReception(this,dt);
    }
    return super.scenario(dt);
  }
  sessionResult(){const out=super.sessionResult();return{...out,engineVersion:11};}
}

export const __trainingMatchEngineV11={physicalCarryAfterReception};
