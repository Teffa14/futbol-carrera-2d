import {TrainingMatchEngine as TrainingMatchEngineV8} from './training-match-engine-v8.js';

export const TRAINING_MATCH_ENGINE_VERSION=9;
const FIELD={right:1045,goalTop:295,goalBottom:405,centerY:350};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function hold(e,p,target,dt){if(p&&target)e.move(p,target,dt);}
function resetFreeBall(e,x,y){
  e.resetBall(x,y);
  Object.assign(e.ball,{z:0,vz:0,spin:0,setPieceAerial:null,crossbarMissLogged:false});
}
function markSuccess(e,text='RESUELTO'){
  const q=e.trainingQualityV6;if(q.repSuccess)return;q.repSuccess=true;e.flashTraining(text);
}
function receivedAfterKick(e,p,q){return !!p&&e.ball.lastPlayerId===p.id&&e.ball.lastTouchTick>(q.kickTick??-1);}

function setupScanReceive(e,rep){
  const q=e.trainingQualityV6,[mate]=e.mates,[press,cover,keeper]=e.defenders,side=rep%2?1:-1;
  const mateY=FIELD.centerY-side*48;
  const receiveY=FIELD.centerY+side*34;

  e.resetActor(mate,430,mateY,'CM');
  e.resetActor(e.player,585,receiveY,e.playerData?.position||'CAM');
  e.resetActor(press,515,FIELD.centerY-side*118,'CM');
  e.resetActor(cover,705,FIELD.centerY+side*22,'CB');
  if(keeper)e.resetActor(keeper,FIELD.right-28,FIELD.centerY,'GK');
  resetFreeBall(e,mate.x+18,mate.y);

  Object.assign(q,{
    customStage:'scan-carry',
    possessionId:mate.id,
    kickTick:-1,
    receiveAnchor:{x:600,y:receiveY},
    receiveX:null,
    turnStartX:null,
    turnTouchStart:null,
    repSuccess:false,
    objective:'Escaneá, aparecé entre líneas, recibí de perfil y progresá con contactos físicos',
  });
  e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}

function scanReceiveScenario(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[mate]=e.mates,[press,cover,keeper]=e.defenders,side=e.rep%2?1:-1;
  e.observeTouches();
  hold(e,press,{x:510,y:FIELD.centerY-side*120},dt);
  hold(e,cover,{x:705,y:FIELD.centerY+side*22},dt);
  if(keeper)hold(e,keeper,{x:FIELD.right-28,y:FIELD.centerY},dt);

  if(q.customStage==='scan-carry'){
    q.phase='Escanear antes de aparecer';
    e.dribbleTo(mate,{x:465,y:mate.y},dt);
    hold(e,e.player,q.receiveAnchor,dt);
    e.turnPlayer(e.player,{x:1,y:side*.12},dt);
    if(e.repProgress()>.07||e.ball.x>452){
      q.customStage='profile-pass';
      mate.dribbleIntent=null;mate.vx*=.45;mate.vy*=.45;
    }
    return;
  }

  if(q.customStage==='profile-pass'){
    q.phase='Perfilar el pase entre líneas';
    hold(e,e.player,q.receiveAnchor,dt);
    e.turnPlayer(e.player,{x:1,y:side*.12},dt);
    const target={x:q.receiveAnchor.x+6,y:q.receiveAnchor.y};
    if(e.tryKick(mate,target,1.38,'scan-service',e.player,dt)){
      q.customStage='receive';q.kickTick=e.tick;e.pending(mate,e.player,'pass');
    }
    return;
  }

  if(q.customStage==='receive'){
    q.phase='Recibir de perfil';
    e.player.dribbleIntent=null;e.player.kickIntent=null;
    e.player.vx*=.72;e.player.vy*=.72;
    const yTarget=clamp(e.ball.y,q.receiveAnchor.y-34,q.receiveAnchor.y+34);
    hold(e,e.player,{x:q.receiveAnchor.x,y:yTarget},dt);
    e.turnPlayer(e.player,{x:1,y:side*.14},dt);
    if(receivedAfterKick(e,e.player,q)){
      q.customStage='turn';q.receiveX=e.ball.x;q.turnStartX=e.ball.x;q.turnTouchStart=m.physicalTouches||0;
      e.flashTraining('RECIBIDA DE PERFIL');
    }
    return;
  }

  q.phase='Orientar y progresar';
  hold(e,mate,{x:455,y:FIELD.centerY-side*135},dt);
  hold(e,press,{x:500,y:FIELD.centerY-side*150},dt);
  hold(e,cover,{x:clamp((q.turnStartX||590)+110,690,760),y:clamp(e.ball.y-side*72,120,580)},dt);
  const target={x:clamp((q.turnStartX||590)+82,640,750),y:clamp(e.ball.y+side*28,130,570)};
  e.dribbleTo(e.player,target,dt);
  const touches=(m.physicalTouches||0)-(q.turnTouchStart||0);
  if(touches>=2&&e.ball.lastPlayerId===e.player.id&&e.ball.x>(q.turnStartX||590)+26){
    markSuccess(e,'RECEPCIÓN ORIENTADA');
  }
}

export class TrainingMatchEngine extends TrainingMatchEngineV8{
  constructor(drill,result,player){super(drill,result,player);this.trainingEngineVersion=9;}
  resetRep(rep,initial=false){
    super.resetRep(rep,initial);
    if(this.drill?.id==='cam-scan-receive')setupScanReceive(this,rep);
  }
  scenario(dt){
    if(this.drill?.id==='cam-scan-receive')return scanReceiveScenario(this,dt);
    return super.scenario(dt);
  }
  sessionResult(){const out=super.sessionResult();return{...out,engineVersion:9};}
}

export const __trainingMatchEngineV9={setupScanReceive,scanReceiveScenario,receivedAfterKick};
