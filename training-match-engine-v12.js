import {TrainingMatchEngine as TrainingMatchEngineV11} from './training-match-engine-v11.js';
import {wallPositions,CROSSBAR_HEIGHT} from './set-piece-height-v2.js';

export const TRAINING_MATCH_ENGINE_VERSION=12;

const FIELD={left:55,right:1045,top:45,bottom:655,goalTop:295,goalBottom:405,centerX:550,centerY:350};
const STRIKER_REWORK=new Set(['st-profile-finish','st-one-touch','st-run-behind','st-wall-run','st-box-duel','st-press','st-free-kick']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
const speed=b=>Math.hypot(b?.vx||0,b?.vy||0);

function resetFreeBall(e,x,y){
  e.resetBall(x,y);
  Object.assign(e.ball,{z:0,vz:0,spin:0,setPieceAerial:null,setPieceCurve:null,crossbarMissLogged:false});
}
function hold(e,p,target,dt){if(p&&target)e.move(p,target,dt);}
function face(e,p,target,dt){if(!p||!target)return;const d=unit(target.x-p.x,target.y-p.y);e.turnPlayer(p,d,dt);}
function stage(e,name){const q=e.trainingQualityV6;q.customStage=name;q.stageAt=e.time;}
function stageAge(e){return Math.max(0,e.time-(e.trainingQualityV6.stageAt??e.repStart));}
function receivedAfter(e,p,tick=-1){return !!p&&e.ball.lastPlayerId===p.id&&e.ball.lastTouchTick>tick;}
function rightGoal(e){return e.ball.x>FIELD.right+8&&e.ball.y>FIELD.goalTop&&e.ball.y<FIELD.goalBottom&&(e.ball.z||0)<=CROSSBAR_HEIGHT;}
function keeperTouchAfter(e,keeper,tick=-1){return !!keeper&&e.ball.lastPlayerId===keeper.id&&e.ball.lastTouchTick>tick;}
function shotTarget(keeper){return{x:FIELD.right+26,y:(keeper?.y??FIELD.centerY)<FIELD.centerY?FIELD.goalBottom-19:FIELD.goalTop+19};}
function terminal(e,success,text,reason){
  const q=e.trainingQualityV6;if(q.repTerminal)return;
  q.repSuccess=!!success;q.repTerminal=true;q.repTerminalAt=e.time;q.terminalReason=reason||text;
  e.flashTraining(text);
}
function shotOutcome(e,q,keeper){
  if(q.shotTick==null)return null;
  if(rightGoal(e))return{success:true,text:'GOL',reason:'goal'};
  if(keeperTouchAfter(e,keeper,q.shotTick))return{success:true,text:'AL ARCO',reason:'keeper-save'};
  const elapsed=Math.max(0,e.time-(q.shotTime??e.time));
  const crossed=e.ball.x>FIELD.right-4;
  if(crossed){
    const mouth=e.ball.y>FIELD.goalTop&&e.ball.y<FIELD.goalBottom&&(e.ball.z||0)<=CROSSBAR_HEIGHT;
    return{success:mouth,text:mouth?'AL ARCO':'AFUERA',reason:mouth?'on-target':'wide'};
  }
  if(elapsed>.42&&speed(e.ball)<.32)return{success:false,text:'REMATE CORTO',reason:'dead-shot'};
  if(elapsed>2.45)return{success:false,text:'AFUERA',reason:'shot-timeout'};
  return null;
}
function registerShot(e,q){
  if(q.shotTick!=null)return;
  const kick=e.lastTrainingKick;
  if(kick?.rep===e.rep&&kick.by===e.player.id&&(kick.kind==='shot'||kick.kind==='free-kick')){
    q.shotTick=kick.tick;q.shotTime=e.time;q.shotStartX=e.ball.x;
  }
}
function profiledKick(e,p,target,power,kind,receiver,dt,{lateral=0,meta=null}={}){
  if(!p||!target)return false;
  const previous=e.lastTrainingKick;
  if(previous?.rep===e.rep&&previous.by===p.id&&previous.kind===kind)return true;
  const d=unit(target.x-e.ball.x,target.y-e.ball.y),t={x:-d.y,y:d.x},contact=p.r+e.ball.r-.55;
  const spot={x:e.ball.x-d.x*(contact+1.5)+t.x*lateral,y:e.ball.y-d.y*(contact+1.5)+t.y*lateral};
  const facing=(p.facingX||0)*d.x+(p.facingY||0)*d.y;
  if(dist(p,spot)>3.6||facing<.965){
    p.kickIntent=null;hold(e,p,spot,dt);e.turnPlayer(p,d,dt);return false;
  }
  if(!p.kickIntent){
    const type=(kind==='shot'||kind==='free-kick')?'shot':'pass';
    e.armKick(p,target,power,type,{receiverId:receiver?.id||null,trainingKind:kind,...(meta||{})});
  }
  e.turnPlayer(p,d,dt);
  hold(e,p,{x:e.ball.x+d.x*20,y:e.ball.y+d.y*20},dt);
  return false;
}
function serviceFailed(e,q,maxAge=2.5){return stageAge(e)>maxAge&&q.shotTick==null;}
function setCommon(e,objective){
  const q=e.trainingQualityV6;
  Object.assign(q,{repTerminal:false,repTerminalAt:null,terminalReason:null,stageAt:e.time,shotTick:null,shotTime:null,serviceTick:-1,receiveTick:-1,objective});
  q.lastObservedTouch=null;
}

function setupProfileFinish(e,rep){
  const side=rep%2?1:-1,[server]=e.mates,[marker,keeper]=e.defenders;
  e.resetActor(server,560,FIELD.centerY+side*132,'CM');
  e.resetActor(e.player,720,FIELD.centerY+side*54,e.playerData?.position||'ST');
  e.resetActor(marker,838,FIELD.centerY-side*12,'CB');
  e.resetActor(keeper,FIELD.right-28,FIELD.centerY-side*18,'GK');
  resetFreeBall(e,server.x+18,server.y);
  setCommon(e,'Atacá un pase diagonal, recibí de costado y acomodá un solo contacto antes de definir.');
  Object.assign(e.trainingQualityV6,{receiveAnchor:{x:758,y:FIELD.centerY+side*36},possessionId:server.id});
  stage(e,'service');
  e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function profileFinishScenario(e,dt){
  const q=e.trainingQualityV6,[server]=e.mates,[marker,keeper]=e.defenders,side=e.rep%2?1:-1;
  e.observeTouches();hold(e,keeper,{x:FIELD.right-28,y:clamp(e.ball.y,FIELD.goalTop+16,FIELD.goalBottom-16)},dt);
  if(q.repTerminal)return;
  if(q.customStage==='service'){
    q.phase='Atacar el pase diagonal';
    hold(e,marker,{x:838,y:FIELD.centerY-side*12},dt);
    hold(e,e.player,q.receiveAnchor,dt);face(e,e.player,{x:FIELD.right,y:FIELD.centerY},dt);
    const lead={x:q.receiveAnchor.x+7,y:q.receiveAnchor.y};
    if(profiledKick(e,server,lead,2.75,'service',e.player,dt)){q.serviceTick=e.tick;e.pending(server,e.player,'service');stage(e,'receive');}
    return;
  }
  if(q.customStage==='receive'){
    q.phase='Recibir de costado';
    hold(e,marker,{x:842,y:FIELD.centerY-side*8},dt);
    const intercept=e.projectedIntercept(e.player),anchor=q.receiveAnchor;
    hold(e,e.player,{x:clamp(intercept.x,anchor.x-12,anchor.x+28),y:clamp(intercept.y,anchor.y-30,anchor.y+30)},dt);
    face(e,e.player,{x:FIELD.right,y:FIELD.centerY},dt);
    if(receivedAfter(e,e.player,q.serviceTick)){q.receiveTick=e.tick;stage(e,'profile');e.flashTraining('CONTROL ORIENTADO');return;}
    if(serviceFailed(e,q,2.6))terminal(e,false,'PASE PERDIDO','service-missed');
    return;
  }
  if(q.customStage==='profile'){
    q.phase='Acomodar cuerpo y definir';
    hold(e,marker,{x:clamp(e.player.x+58,820,900),y:clamp(e.player.y-side*44,230,470)},dt);
    const target=shotTarget(keeper);
    profiledKick(e,e.player,target,7.25,'shot',null,dt);
    registerShot(e,q);
    if(q.shotTick!=null)stage(e,'flight');
    return;
  }
  q.phase='Leer el remate';registerShot(e,q);const out=shotOutcome(e,q,keeper);if(out)terminal(e,out.success,out.text,out.reason);
}

function setupOneTouch(e,rep){
  const side=rep%2?1:-1,[server]=e.mates,[marker,keeper]=e.defenders;
  e.resetActor(server,565,FIELD.centerY+side*145,'CM');
  e.resetActor(e.player,675,FIELD.centerY+side*102,e.playerData?.position||'ST');
  e.resetActor(marker,845,FIELD.centerY-side*20,'CB');
  e.resetActor(keeper,FIELD.right-28,FIELD.centerY+side*16,'GK');
  resetFreeBall(e,server.x+18,server.y);
  setCommon(e,'Arrancá sin pelota, atacá el espacio entre central y arquero y rematá en el primer contacto.');
  Object.assign(e.trainingQualityV6,{strikePoint:{x:818,y:FIELD.centerY+side*14},possessionId:server.id,firstTouchBaseline:e.trainingMetricsV6.physicalTouches||0});
  stage(e,'run');e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function oneTouchScenario(e,dt){
  const q=e.trainingQualityV6,[server]=e.mates,[marker,keeper]=e.defenders,side=e.rep%2?1:-1;
  e.observeTouches();hold(e,keeper,{x:FIELD.right-28,y:clamp(e.ball.y,FIELD.goalTop+16,FIELD.goalBottom-16)},dt);if(q.repTerminal)return;
  if(q.customStage==='run'){
    q.phase='Atacar la ventana';
    hold(e,marker,{x:846,y:FIELD.centerY-side*18},dt);
    hold(e,e.player,{x:735,y:FIELD.centerY+side*42},dt);face(e,e.player,{x:FIELD.right,y:FIELD.centerY},dt);
    if(e.player.x>710||stageAge(e)>.55){
      if(profiledKick(e,server,q.strikePoint,3.15,'service',e.player,dt)){q.serviceTick=e.tick;e.pending(server,e.player,'service');stage(e,'attack-ball');}
    }
    return;
  }
  if(q.customStage==='attack-ball'){
    q.phase='Llegar y pegar de primera';
    hold(e,marker,{x:850,y:FIELD.centerY-side*18},dt);
    const intercept=e.projectedIntercept(e.player);hold(e,e.player,{x:Math.max(e.player.x,intercept.x),y:clamp(intercept.y,FIELD.goalTop-45,FIELD.goalBottom+45)},dt);
    const target=shotTarget(keeper);face(e,e.player,target,dt);
    if(!e.player.kickIntent&&dist(e.player,e.ball)<105)e.armKick(e.player,target,7.3,'shot',{trainingKind:'shot'});
    registerShot(e,q);
    if(q.shotTick!=null){stage(e,'flight');return;}
    if(receivedAfter(e,e.player,q.serviceTick)&&e.lastTrainingKick?.kind!=='shot')terminal(e,false,'TOQUE DE MÁS','extra-touch');
    else if(stageAge(e)>2.7)terminal(e,false,'NO LLEGÓ','service-missed');
    return;
  }
  q.phase='Leer el remate';registerShot(e,q);const out=shotOutcome(e,q,keeper);if(out)terminal(e,out.success,out.text,out.reason);
}

function setupRunBehind(e,rep){
  const side=rep%2?1:-1,[passer]=e.mates,[d1,d2,keeper]=e.defenders;
  e.resetActor(passer,485,FIELD.centerY+side*105,'CAM');
  e.resetActor(e.player,640,FIELD.centerY+side*28,e.playerData?.position||'ST');
  e.resetActor(d1,735,FIELD.centerY-72,'CB');e.resetActor(d2,735,FIELD.centerY+72,'CB');
  e.resetActor(keeper,FIELD.right-28,FIELD.centerY,'GK');resetFreeBall(e,passer.x+18,passer.y);
  setCommon(e,'Partí onside, fijá la última línea y arrancá al intervalo. El compañero debe filtrar al espacio, nunca a tu espalda.');
  Object.assign(e.trainingQualityV6,{lineX:735,leadPoint:{x:832,y:FIELD.centerY+side*12},possessionId:passer.id});
  stage(e,'hold-line');e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function runBehindScenario(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[passer]=e.mates,[d1,d2,keeper]=e.defenders,side=e.rep%2?1:-1;
  e.observeTouches();hold(e,keeper,{x:FIELD.right-28,y:FIELD.centerY},dt);if(q.repTerminal)return;
  if(q.customStage==='hold-line'){
    q.phase='Fijar y arrancar onside';
    hold(e,d1,{x:q.lineX,y:278},dt);hold(e,d2,{x:q.lineX,y:422},dt);
    hold(e,e.player,{x:682,y:FIELD.centerY+side*22},dt);face(e,e.player,{x:FIELD.right,y:q.leadPoint.y},dt);
    if(stageAge(e)>.48||e.player.x>670){m.timedRuns=(m.timedRuns||0)+1;stage(e,'release');}
    return;
  }
  if(q.customStage==='release'){
    q.phase='Pase filtrado al espacio';
    hold(e,d1,{x:q.lineX,y:282},dt);hold(e,d2,{x:q.lineX,y:418},dt);
    hold(e,e.player,{x:760,y:q.leadPoint.y},dt);face(e,e.player,{x:FIELD.right,y:q.leadPoint.y},dt);
    if(profiledKick(e,passer,q.leadPoint,3.7,'through',e.player,dt)){q.serviceTick=e.tick;e.pending(passer,e.player,'through');stage(e,'attack-pass');}
    return;
  }
  q.phase='Atacar el pase filtrado';
  hold(e,d1,{x:clamp(e.player.x-34,735,850),y:292},dt);hold(e,d2,{x:clamp(e.player.x-42,735,850),y:408},dt);
  const intercept=e.projectedIntercept(e.player);hold(e,e.player,{x:Math.max(e.player.x,intercept.x),y:clamp(intercept.y,245,455)},dt);
  if(receivedAfter(e,e.player,q.serviceTick)&&e.ball.x>q.lineX-6){m.throughReceptions=Math.max(1,m.throughReceptions||0);terminal(e,true,'PASE FILTRADO RECIBIDO','through-received');return;}
  if(stageAge(e)>3.0)terminal(e,false,'PASE LARGO','through-missed');
}

function setupWallRun(e,rep){
  const side=rep%2?1:-1,[mate]=e.mates,[d1,d2,keeper]=e.defenders;
  e.resetActor(mate,470,FIELD.centerY-side*22,'CAM');
  e.resetActor(e.player,620,FIELD.centerY+side*58,e.playerData?.position||'ST');
  e.resetActor(d1,690,FIELD.centerY+side*35,'CB');e.resetActor(d2,790,FIELD.centerY-side*65,'CB');
  e.resetActor(keeper,FIELD.right-28,FIELD.centerY,'GK');resetFreeBall(e,mate.x+18,mate.y);
  setCommon(e,'Venite al apoyo mirando al pasador, descargá simple y girá enseguida. La devolución tiene que ir delante de tu carrera.');
  Object.assign(e.trainingQualityV6,{receivePoint:{x:585,y:FIELD.centerY+side*36},lineX:780,possessionId:mate.id,layoffTick:-1,returnTick:-1});
  stage(e,'check');e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function wallRunScenario(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[mate]=e.mates,[d1,d2,keeper]=e.defenders,side=e.rep%2?1:-1;
  e.observeTouches();hold(e,keeper,{x:FIELD.right-28,y:FIELD.centerY},dt);if(q.repTerminal)return;
  if(q.customStage==='check'){
    q.phase='Venir al apoyo';
    hold(e,d1,{x:675,y:FIELD.centerY+side*12},dt);hold(e,d2,{x:q.lineX,y:FIELD.centerY-side*70},dt);
    hold(e,e.player,q.receivePoint,dt);face(e,e.player,mate,dt);
    if(dist(e.player,q.receivePoint)<18||stageAge(e)>.45){
      if(profiledKick(e,mate,q.receivePoint,2.65,'service',e.player,dt)){q.serviceTick=e.tick;e.pending(mate,e.player,'service');stage(e,'receive');}
    }
    return;
  }
  if(q.customStage==='receive'){
    q.phase='Recibir de frente al apoyo';
    hold(e,d1,{x:675,y:FIELD.centerY+side*10},dt);hold(e,d2,{x:q.lineX,y:FIELD.centerY-side*70},dt);
    const intercept=e.projectedIntercept(e.player);hold(e,e.player,{x:clamp(intercept.x,q.receivePoint.x-18,q.receivePoint.x+20),y:clamp(intercept.y,q.receivePoint.y-24,q.receivePoint.y+24)},dt);face(e,e.player,mate,dt);
    if(receivedAfter(e,e.player,q.serviceTick)){stage(e,'layoff');e.flashTraining('RECIBIDA');return;}
    if(stageAge(e)>2.4)terminal(e,false,'NO RECIBIÓ','first-pass-missed');
    return;
  }
  if(q.customStage==='layoff'){
    q.phase='Descargar simple';
    hold(e,d1,{x:clamp(e.player.x+48,655,720),y:e.player.y-side*28},dt);hold(e,d2,{x:q.lineX,y:FIELD.centerY-side*70},dt);
    if(profiledKick(e,e.player,mate,2.75,'wall',mate,dt)){q.layoffTick=e.tick;e.pending(e.player,mate,'wall');m.wallBeats=(m.wallBeats||0)+1;stage(e,'break');}
    return;
  }
  if(q.customStage==='break'){
    q.phase='Romper después de descargar';
    hold(e,e.player,{x:755,y:FIELD.centerY+side*8},dt);face(e,e.player,{x:FIELD.right,y:FIELD.centerY},dt);
    hold(e,d1,{x:clamp(e.player.x-24,675,760),y:e.player.y+side*38},dt);hold(e,d2,{x:q.lineX,y:FIELD.centerY-side*65},dt);
    const intercept=e.projectedIntercept(mate);hold(e,mate,intercept,dt);
    if(receivedAfter(e,mate,q.layoffTick))stage(e,'return-pass');
    else if(stageAge(e)>2.5)terminal(e,false,'DESCARGA PERDIDA','layoff-missed');
    return;
  }
  if(q.customStage==='return-pass'){
    q.phase='Filtrar la devolución';
    hold(e,e.player,{x:825,y:FIELD.centerY+side*10},dt);face(e,e.player,{x:FIELD.right,y:FIELD.centerY},dt);
    hold(e,d1,{x:clamp(e.player.x-38,700,800),y:e.player.y+side*42},dt);hold(e,d2,{x:q.lineX,y:FIELD.centerY-side*65},dt);
    const lead={x:clamp(e.player.x+62,830,900),y:e.player.y};
    if(profiledKick(e,mate,lead,3.45,'through',e.player,dt)){q.returnTick=e.tick;e.pending(mate,e.player,'through');stage(e,'attack-return');}
    return;
  }
  q.phase='Atacar devolución al espacio';
  const intercept=e.projectedIntercept(e.player);hold(e,e.player,{x:Math.max(e.player.x,intercept.x),y:clamp(intercept.y,245,455)},dt);
  hold(e,d1,{x:clamp(e.player.x-44,720,840),y:e.player.y+side*45},dt);hold(e,d2,{x:clamp(e.player.x-52,750,845),y:e.player.y-side*58},dt);
  if(receivedAfter(e,e.player,q.returnTick)&&e.ball.x>q.lineX){m.throughReceptions=Math.max(1,m.throughReceptions||0);terminal(e,true,'DESCARGA + RUPTURA','wall-run-complete');return;}
  if(stageAge(e)>3.0)terminal(e,false,'DEVOLUCIÓN PERDIDA','return-missed');
}

function setupBoxDuel(e,rep){
  const side=rep%2?1:-1,[def,keeper]=e.defenders;
  e.resetActor(e.player,720,FIELD.centerY+side*36,e.playerData?.position||'ST');
  e.resetActor(def,768,FIELD.centerY-side*8,'CB');e.resetActor(keeper,FIELD.right-28,FIELD.centerY-side*16,'GK');
  const user=Math.round(((e.playerData?.physical||50)+(e.playerData?.ballControl||50)+(e.playerData?.dribbling||50))/3),opp=clamp(Math.round(42+(user-42)*.45),42,66);
  Object.assign(def.data,{defense:opp,physical:opp,pace:Math.max(44,opp-4),composure:opp});
  resetFreeBall(e,e.player.x+17,e.player.y);
  setCommon(e,'Empezá con el central en tu hombro, protegé sin chocarlo de frente, girá al lado libre y terminá la acción.');
  Object.assign(e.trainingQualityV6,{duelSide:side,protectStart:e.time,turnComplete:false,possessionId:e.player.id});stage(e,'protect');
  e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function boxDuelScenario(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[def,keeper]=e.defenders,side=q.duelSide||1;
  e.observeTouches();hold(e,keeper,{x:FIELD.right-28,y:clamp(e.ball.y,FIELD.goalTop+16,FIELD.goalBottom-16)},dt);if(q.repTerminal)return;
  if(q.shotTick!=null){q.phase='Leer el remate';const out=shotOutcome(e,q,keeper);if(out)terminal(e,out.success,out.text,out.reason);return;}
  if(e.ball.lastTeam===1&&e.ball.lastPlayerId===def.id&&e.ball.lastTouchTick>(q.receiveTick??-1)&&stageAge(e)>.18){terminal(e,false,'PERDIÓ EL DUELO','duel-lost');return;}
  if(q.customStage==='protect'){
    q.phase='Proteger con el hombro';
    const lane={x:755,y:clamp(FIELD.centerY+side*92,235,465)};e.dribbleTo(e.player,lane,dt);
    hold(e,def,{x:clamp(e.player.x+34,754,810),y:clamp(e.player.y-side*34,230,470)},dt);
    if(stageAge(e)>.58){stage(e,'turn');e.flashTraining('PROTEGIDA');}
    return;
  }
  if(q.customStage==='turn'){
    q.phase='Girar al lado libre';
    const lane={x:842,y:clamp(FIELD.centerY+side*92,235,465)};e.dribbleTo(e.player,lane,dt);
    hold(e,def,{x:clamp(e.player.x+24,770,850),y:clamp(e.player.y-side*48,220,480)},dt);
    if(e.ball.x>802&&Math.abs(e.ball.y-def.y)>34){q.turnComplete=true;m.duelsBeaten=(m.duelsBeaten||0)+1;stage(e,'finish');e.flashTraining('GIRO LIMPIO');}
    else if(stageAge(e)>2.4)terminal(e,false,'SIN GIRO','turn-stalled');
    return;
  }
  q.phase='Definir la ventaja';
  hold(e,def,{x:clamp(e.player.x-44,790,885),y:clamp(e.player.y-side*38,225,475)},dt);
  const target=shotTarget(keeper);profiledKick(e,e.player,target,7.35,'shot',null,dt);registerShot(e,q);
}

function setupPress(e,rep){
  const side=rep%2?1:-1,[cover,presserMate]=e.mates,[carrier,wide,pivot,keeper]=e.defenders;
  e.resetActor(e.player,690,FIELD.centerY+side*18,e.playerData?.position||'ST');
  e.resetActor(cover,735,FIELD.centerY-side*80,'CAM');e.resetActor(presserMate,725,FIELD.centerY+side*145,'RW');
  e.resetActor(carrier,865,FIELD.centerY+side*12,'CB');e.resetActor(wide,790,FIELD.centerY+side*165,'RB');e.resetActor(pivot,755,FIELD.centerY-side*78,'CM');e.resetActor(keeper,FIELD.right-28,FIELD.centerY,'GK');
  const user=Math.round(((e.playerData?.pace||50)+(e.playerData?.stamina||50)+(e.playerData?.defense||50))/3),opp=clamp(Math.round(44+(user-44)*.42),44,63);
  for(const p of [carrier,wide,pivot])Object.assign(p.data,{passing:opp+5,ballControl:opp+2,composure:opp,pace:opp});
  resetFreeBall(e,carrier.x-18,carrier.y);setCommon(e,'Primero tapá el pase interior. Después corré de adentro hacia afuera para forzar la banda y saltá sobre el receptor.');
  Object.assign(e.trainingQualityV6,{possessionId:carrier.id,pressSide:side,widePassTick:-1,forcedPassTick:-1});stage(e,'screen');
  e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function pressScenario(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[cover,presserMate]=e.mates,[carrier,wide,pivot,keeper]=e.defenders,side=q.pressSide||1;
  e.observeTouches();hold(e,keeper,{x:FIELD.right-28,y:FIELD.centerY},dt);if(q.repTerminal)return;
  if([e.player,cover,presserMate].some(p=>p&&e.ball.lastPlayerId===p.id&&e.ball.lastTouchTick>(q.widePassTick??-1))){m.recoveries=(m.recoveries||0)+1;terminal(e,true,'RECUPERACIÓN','press-recovery');return;}
  if(q.customStage==='screen'){
    q.phase='1. Tapar pase interior';
    hold(e,cover,{x:760,y:FIELD.centerY-side*72},dt);hold(e,presserMate,{x:760,y:FIELD.centerY+side*138},dt);hold(e,pivot,{x:750,y:FIELD.centerY-side*82},dt);hold(e,wide,{x:790,y:FIELD.centerY+side*165},dt);
    const pressPoint={x:807,y:carrier.y-side*38};hold(e,e.player,pressPoint,dt);face(e,e.player,carrier,dt);
    if(dist(e.player,pressPoint)<18||stageAge(e)>.72)stage(e,'force-wide');
    return;
  }
  if(q.customStage==='force-wide'){
    q.phase='2. Orientar la salida hacia banda';
    hold(e,e.player,{x:carrier.x-42,y:carrier.y-side*28},dt);face(e,e.player,carrier,dt);hold(e,cover,{x:758,y:FIELD.centerY-side*72},dt);hold(e,presserMate,{x:755,y:FIELD.centerY+side*128},dt);
    if(profiledKick(e,carrier,wide,2.85,'pass',wide,dt)){q.widePassTick=e.tick;e.pending(carrier,wide,'pass');stage(e,'jump-wide');}
    return;
  }
  if(q.customStage==='jump-wide'){
    q.phase='3. Saltar sobre el receptor';
    const intercept=e.projectedIntercept(wide);hold(e,wide,intercept,dt);hold(e,e.player,{x:intercept.x-26,y:intercept.y-side*18},dt);hold(e,cover,{x:760,y:FIELD.centerY-side*72},dt);hold(e,presserMate,{x:760,y:FIELD.centerY+side*118},dt);
    if(receivedAfter(e,wide,q.widePassTick)){stage(e,'trap');e.flashTraining('PASE FORZADO A BANDA');}
    else if(stageAge(e)>2.6)terminal(e,true,'PASE FORZADO FALLIDO','forced-wide-error');
    return;
  }
  q.phase='4. Recuperar o forzar atrás';
  hold(e,cover,{x:770,y:FIELD.centerY-side*62},dt);hold(e,presserMate,{x:785,y:FIELD.centerY+side*112},dt);hold(e,pivot,{x:745,y:FIELD.centerY-side*76},dt);
  hold(e,e.player,{x:wide.x-24,y:wide.y-side*10},dt);face(e,e.player,wide,dt);
  e.dribbleTo(wide,{x:735,y:clamp(wide.y+side*35,105,595)},dt);
  if(dist(e.player,wide)<44&&q.forcedPassTick<0){
    const backward={x:carrier.x+8,y:carrier.y};
    if(profiledKick(e,wide,backward,2.75,'pass',carrier,dt)){q.forcedPassTick=e.tick;terminal(e,true,'PASE ATRÁS FORZADO','forced-back-pass');}
  }
  if(stageAge(e)>2.8)terminal(e,false,'PRESIÓN TARDE','press-late');
}

function freeKickPlan(e){
  const q=e.trainingQualityV6,keeper=e.defenders[4],targetY=(keeper?.y??FIELD.centerY)<FIELD.centerY?FIELD.goalBottom-19:FIELD.goalTop+19;
  const target={x:FIELD.right+26,y:targetY},side=targetY<e.ball.y?-1:1,technique=clamp((Number(e.playerData?.shooting??65)*.52+Number(e.playerData?.ballControl??65)*.20+Number(e.playerData?.composure??65)*.28),35,99);
  const initialAim={x:target.x,y:clamp(targetY+side*34,FIELD.goalTop-34,FIELD.goalBottom+34)},dir=unit(initialAim.x-e.ball.x,initialAim.y-e.ball.y);
  return{targetX:target.x,targetY:target.y,initialAim,side,spin:-side*clamp(.62+(technique-55)*.006,.52,.90),technique,launchVz:clamp(.47+(technique-60)*.0007,.455,.505),startX:e.ball.x,startY:e.ball.y,shotDir:dir};
}
function setupFreeKick(e,rep){
  const [w1,w2,w3,w4,keeper]=e.defenders,bx=[765,780,795][rep%3],by=[318,350,382][rep%3];
  resetFreeBall(e,bx,by);e.resetActor(keeper,FIELD.right-27,rep%2?FIELD.centerY-20:FIELD.centerY+20,'GK');
  const target={x:FIELD.right+26,y:keeper.y<FIELD.centerY?FIELD.goalBottom-19:FIELD.goalTop+19},positions=wallPositions(e.ball,target,rep%3===2?4:3),wall=[w1,w2,w3,w4];
  for(let i=0;i<wall.length;i++){const pos=positions[Math.min(i,positions.length-1)];e.resetActor(wall[i],pos.x+(i>=positions.length?18:0),pos.y,'CB');}
  const plan=freeKickPlan(e),d=unit(plan.initialAim.x-bx,plan.initialAim.y-by),contact=e.player.r+e.ball.r+8;
  e.resetActor(e.player,bx-d.x*contact,by-d.y*contact,e.playerData?.position||'ST');
  setCommon(e,'Elegí el palo libre, salí apenas por fuera de la barrera y hacé volver la pelota al arco con altura controlada.');
  Object.assign(e.trainingQualityV6,{freeKickPlan:plan,possessionId:e.player.id});stage(e,'profile');
  e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function freeKickScenario(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,keeper=e.defenders[4];if(q.repTerminal)return;
  hold(e,keeper,{x:FIELD.right-27,y:clamp(e.ball.y,FIELD.goalTop+15,FIELD.goalBottom-15)},dt);
  if(q.customStage==='profile'){
    q.phase='Perfilar hacia el palo libre';
    const plan=q.freeKickPlan,d=unit(plan.initialAim.x-e.ball.x,plan.initialAim.y-e.ball.y),contact=e.player.r+e.ball.r-.55,spot={x:e.ball.x-d.x*(contact+1.5),y:e.ball.y-d.y*(contact+1.5)};
    const facing=(e.player.facingX||0)*d.x+(e.player.facingY||0)*d.y;
    if(dist(e.player,spot)>3.4||facing<.97){e.player.kickIntent=null;hold(e,e.player,spot,dt);e.turnPlayer(e.player,d,dt);return;}
    if(!e.player.kickIntent)e.armKick(e.player,plan.initialAim,7.25,'shot',{trainingKind:'free-kick',curvePlan:plan,aerialPlan:plan});
    e.turnPlayer(e.player,d,dt);hold(e,e.player,{x:e.ball.x+d.x*19,y:e.ball.y+d.y*19},dt);
    const kick=e.lastTrainingKick;
    if(kick?.rep===e.rep&&kick.by===e.player.id&&kick.kind==='free-kick'){
      q.shotTick=kick.tick;q.shotTime=e.time;m.targetZones?.add?.(plan.targetY<FIELD.centerY?'top':'bottom');stage(e,'flight');
    }
    return;
  }
  q.phase='Leer trayectoria del tiro libre';
  if(rightGoal(e)){terminal(e,true,'GOL','goal');return;}
  if(keeperTouchAfter(e,keeper,q.shotTick)){terminal(e,true,'ATAJADO','keeper-save');return;}
  const elapsed=e.time-(q.shotTime??e.time),crossed=e.ball.x>FIELD.right-4;
  if(crossed){const onTarget=e.ball.y>FIELD.goalTop&&e.ball.y<FIELD.goalBottom&&(e.ball.z||0)<=CROSSBAR_HEIGHT;terminal(e,onTarget,onTarget?'AL ARCO':'AFUERA',onTarget?'on-target':'wide');return;}
  if(elapsed>.5&&speed(e.ball)<.3){terminal(e,false,'SE QUEDÓ CORTO','dead-shot');return;}
  if(elapsed>2.55)terminal(e,false,'AFUERA','shot-timeout');
}

function setupStrikerRep(e,rep){
  const id=e.drill?.id;
  if(id==='st-profile-finish')setupProfileFinish(e,rep);
  else if(id==='st-one-touch')setupOneTouch(e,rep);
  else if(id==='st-run-behind')setupRunBehind(e,rep);
  else if(id==='st-wall-run')setupWallRun(e,rep);
  else if(id==='st-box-duel')setupBoxDuel(e,rep);
  else if(id==='st-press')setupPress(e,rep);
  else if(id==='st-free-kick')setupFreeKick(e,rep);
}
function strikerScenario(e,dt){
  const id=e.drill?.id;
  if(id==='st-profile-finish')return profileFinishScenario(e,dt);
  if(id==='st-one-touch')return oneTouchScenario(e,dt);
  if(id==='st-run-behind')return runBehindScenario(e,dt);
  if(id==='st-wall-run')return wallRunScenario(e,dt);
  if(id==='st-box-duel')return boxDuelScenario(e,dt);
  if(id==='st-press')return pressScenario(e,dt);
  if(id==='st-free-kick')return freeKickScenario(e,dt);
}

export class TrainingMatchEngine extends TrainingMatchEngineV11{
  constructor(drill,result,player){super(drill,result,player);this.trainingEngineVersion=12;}
  resetRep(rep,initial=false){
    super.resetRep(rep,initial);
    if(STRIKER_REWORK.has(this.drill?.id))setupStrikerRep(this,rep);
  }
  scenario(dt){if(STRIKER_REWORK.has(this.drill?.id))return strikerScenario(this,dt);return super.scenario(dt);}
  step(dt){
    if(this.finished)return;
    super.step(dt);
    const q=this.trainingQualityV6;if(this.finished||!q?.repTerminal)return;
    if(this.time-(q.repTerminalAt??this.time)<.28)return;
    const reps=Math.max(1,this.result?.reps||1),current=this.rep;
    this.trainingMetricsV6.earlyRepAdvances=(this.trainingMetricsV6.earlyRepAdvances||0)+1;
    if(current+1<reps){
      this.time=(current+1)*this.repLength;
      this.resetRep(current+1,false);
      return;
    }
    this.finalizeRep();this.time=this.duration;this.finished=true;
    const out=this.sessionResult();this.flashTraining(`${out.grade} · ${out.quality}`);this.flashTimer=99;
  }
  sessionResult(){const out=super.sessionResult();return{...out,engineVersion:12};}
}

export const __trainingMatchEngineV12={STRIKER_REWORK,profiledKick,freeKickPlan,shotOutcome};
