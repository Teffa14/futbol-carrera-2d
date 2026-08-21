import {TrainingMatchEngine as TrainingMatchEngineV13} from './training-match-engine-v13.js';

export const TRAINING_MATCH_ENGINE_VERSION=14;

const FIELD={right:1045,goalTop:295,goalBottom:405,centerY:350};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};

function stage(e,name){e.trainingQualityV6.customStage=name;e.trainingQualityV6.stageAt=e.time;}
function age(e){return Math.max(0,e.time-(e.trainingQualityV6.stageAt??e.repStart));}
function face(e,p,target,dt){if(!p||!target)return;const d=unit(target.x-p.x,target.y-p.y);e.turnPlayer(p,d,dt);}
function goalTarget(keeper,side=1){const keeperY=keeper?.y??FIELD.centerY;let y=side<0?330:370;if(Math.abs(keeperY-y)<28)y=side<0?372:328;return{x:FIELD.right+25,y};}
function terminal(e,success,text,reason=text){const q=e.trainingQualityV6;if(q.repTerminal)return;q.repSuccess=!!success;q.repTerminal=true;q.repTerminalAt=e.time;q.terminalReason=reason;e.flashTraining(text);}

function physicalKick(e,p,target,power,kind,dt,{direct=false,receiver=null}={}){
  const last=e.lastTrainingKick;
  if(last?.rep===e.rep&&last.by===p?.id&&last.kind===kind)return true;
  if(!p||!target)return false;
  const d=unit(target.x-e.ball.x,target.y-e.ball.y);
  const contact=p.r+e.ball.r-.55;
  const spot={x:e.ball.x-d.x*(contact+1.1),y:e.ball.y-d.y*(contact+1.1)};
  const facing=(p.facingX||0)*d.x+(p.facingY||0)*d.y;
  const type=(kind==='shot'||kind==='free-kick')?'shot':'pass';
  if(!p.kickIntent)e.armKick(p,target,power,type,{receiverId:receiver?.id||null,trainingKind:kind});
  if(direct)e.ball.trainingDirectPass=true;
  e.turnPlayer(p,d,dt);
  if(dist(p,spot)>4.2||facing<.93)e.move(p,spot,dt);
  else e.move(p,{x:e.ball.x+d.x*19,y:e.ball.y+d.y*19},dt);
  return false;
}

function markPhysicalShot(e,q){
  const k=e.lastTrainingKick;
  if(q.shotTick==null&&k?.rep===e.rep&&k.by===e.player.id&&k.kind==='shot'){
    q.shotTick=k.tick;q.shotTime=e.time;e.ball.trainingDirectPass=false;
    return true;
  }
  return q.shotTick!=null;
}

function profileFinish(e,dt){
  const q=e.trainingQualityV6,keeper=e.defenders[1];
  q.phase='Perfilar y definir';
  const target=goalTarget(keeper,q.side);
  physicalKick(e,e.player,target,6.55,'shot',dt);
  if(markPhysicalShot(e,q))terminal(e,true,'PERFIL + REMATE','profiled-shot-executed');
}

function oneTouchStrike(e,dt){
  const q=e.trainingQualityV6,keeper=e.defenders[1],target=goalTarget(keeper,q.side);
  q.phase='Rematar de primera';
  const intercept=e.projectedIntercept(e.player);
  const attack={x:clamp(intercept.x,q.strike.x-26,q.strike.x+48),y:clamp(intercept.y,q.strike.y-54,q.strike.y+54)};
  face(e,e.player,target,dt);
  if(!e.player.kickIntent)e.armKick(e.player,target,6.7,'shot',{trainingKind:'shot'});
  e.move(e.player,attack,dt);
  if(markPhysicalShot(e,q)){terminal(e,true,'REMATE DE PRIMERA','one-touch-shot-executed');return;}
  if(age(e)>2.8)terminal(e,false,'NO LLEGÓ','missed-service');
}

function runBehindAttack(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6;
  q.phase='Atacar la espalda';
  if(e.ball.x<q.lineX+18){
    e.move(e.player,{x:q.lineX+64,y:q.lead.y});
  }else{
    const intercept=e.projectedIntercept(e.player);
    e.move(e.player,{x:Math.max(q.lineX+22,intercept.x),y:clamp(intercept.y,245,455)},dt);
  }
  face(e,e.player,q.lead,dt);
  if(q.directReceiveTick>q.serviceTick&&q.directReceiveX>q.lineX){
    m.throughReceptions=Math.max(1,m.throughReceptions||0);
    terminal(e,true,'PASE FILTRADO RECIBIDO','through-received');
    return;
  }
  if(age(e)>3.5)terminal(e,false,'NO LLEGÓ','through-missed');
}

function wallLayoff(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,mate=e.mates[0];
  q.phase='Descargar de primera';
  face(e,e.player,mate,dt);
  if(physicalKick(e,e.player,{x:mate.x+8,y:mate.y},2.35,'wall',dt,{direct:true,receiver:mate})){
    q.wallTick=e.lastTrainingKick.tick;
    q.expectedDirectReceiverId=mate.id;
    q.directReceiveTick=-1;
    e.pending(e.player,mate,'wall');
    m.wallBeats=(m.wallBeats||0)+1;
    stage(e,'break');
    return;
  }
  if(age(e)>2.6)terminal(e,false,'NO DESCARGÓ','layoff-missed');
}

function wallBreak(e,dt){
  const q=e.trainingQualityV6,mate=e.mates[0];
  q.phase='Girar y romper';
  e.move(e.player,q.breakHold,dt);face(e,e.player,q.lead,dt);
  const mateIntercept=e.projectedIntercept(mate);
  e.move(mate,{x:clamp(mateIntercept.x,450,620),y:clamp(mateIntercept.y,220,480)},dt);
  face(e,mate,q.lead,dt);
  if(q.directReceiveTick>q.wallTick){
    if(physicalKick(e,mate,q.lead,2.8,'through',dt,{direct:true,receiver:e.player})){
      q.returnTick=e.lastTrainingKick.tick;
      q.expectedDirectReceiverId=e.player.id;
      q.directReceiveTick=-1;
      e.pending(mate,e.player,'through');
      stage(e,'attack-return');
      return;
    }
  }
  if(age(e)>3.0)terminal(e,false,'DEVOLUCIÓN TARDE','return-not-played');
}

function wallReturn(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6;
  q.phase='Atacar devolución al espacio';
  if(e.ball.x<q.lineX+12)e.move(e.player,{x:q.lineX+58,y:q.lead.y},dt);
  else{
    const intercept=e.projectedIntercept(e.player);
    e.move(e.player,{x:Math.max(q.lineX+18,intercept.x),y:clamp(intercept.y,245,455)},dt);
  }
  face(e,e.player,q.lead,dt);
  if(q.directReceiveTick>q.returnTick&&q.directReceiveX>q.lineX){
    m.throughReceptions=Math.max(1,m.throughReceptions||0);
    terminal(e,true,'DESCARGA + RUPTURA','wall-run-complete');
    return;
  }
  if(age(e)>3.5)terminal(e,false,'DEVOLUCIÓN PERDIDA','return-missed');
}

function boxFinish(e,dt){
  const q=e.trainingQualityV6,[def,keeper]=e.defenders;
  q.phase='Definir tras el giro';
  if(def)e.move(def,{x:e.player.x-42,y:e.player.y-q.side*38},dt);
  physicalKick(e,e.player,goalTarget(keeper,q.side),6.6,'shot',dt);
  if(markPhysicalShot(e,q))terminal(e,true,'GIRO + REMATE','box-shot-executed');
}

function pressWide(e,dt){
  const q=e.trainingQualityV6,[carrier,wide]=e.defenders;
  q.phase='2. Orientar a banda';
  e.move(e.player,{x:carrier.x-43,y:carrier.y-q.side*28},dt);face(e,e.player,carrier,dt);
  if(physicalKick(e,carrier,wide,2.45,'press-wide',dt,{direct:true,receiver:wide})){
    q.wideTick=e.lastTrainingKick.tick;
    q.expectedDirectReceiverId=wide.id;
    q.directReceiveTick=-1;
    e.pending(carrier,wide,'press-wide');
    stage(e,'jump');
  }
}

export class TrainingMatchEngine extends TrainingMatchEngineV13{
  constructor(drill,result,player){super(drill,result,player);this.trainingEngineVersion=14;}
  scenario(dt){
    const id=this.drill?.id,q=this.trainingQualityV6;
    if(id==='st-profile-finish'&&q?.customStage==='finish'&&!q.repTerminal){profileFinish(this,dt);return;}
    if(id==='st-one-touch'&&q?.customStage==='strike'&&!q.repTerminal){oneTouchStrike(this,dt);return;}
    if(id==='st-run-behind'&&q?.customStage==='attack'&&!q.repTerminal){runBehindAttack(this,dt);return;}
    if(id==='st-wall-run'&&!q.repTerminal){
      if(q.customStage==='layoff'){wallLayoff(this,dt);return;}
      if(q.customStage==='break'){wallBreak(this,dt);return;}
      if(q.customStage==='attack-return'){wallReturn(this,dt);return;}
    }
    if(id==='st-box-duel'&&!q.repTerminal){
      if(q.shotTick!=null){terminal(this,true,'GIRO + REMATE','box-shot-executed');return;}
      if(q.customStage==='finish'){boxFinish(this,dt);return;}
    }
    if(id==='st-press'&&q?.customStage==='force-wide'&&!q.repTerminal){pressWide(this,dt);return;}
    return super.scenario(dt);
  }
  sessionResult(){return{...super.sessionResult(),engineVersion:14};}
}

export const __trainingMatchEngineV14={physicalKick,profileFinish,oneTouchStrike,runBehindAttack,wallLayoff,wallBreak,wallReturn,boxFinish,pressWide};
