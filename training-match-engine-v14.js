import {TrainingMatchEngine as TrainingMatchEngineV13,__trainingMatchEngineV13} from './training-match-engine-v13.js';

export const TRAINING_MATCH_ENGINE_VERSION=14;

const FIELD={right:1045,goalTop:295,goalBottom:405,centerY:350};
const IDS=new Set(['st-profile-finish','st-one-touch','st-run-behind','st-wall-run','st-box-duel','st-press']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
const speed=b=>Math.hypot(b?.vx||0,b?.vy||0);
const physicalKick=__trainingMatchEngineV13.physicalKick;
const carryBehind=__trainingMatchEngineV13.carryBehind;

function hold(e,p,target,dt){if(p&&target)e.move(p,target,dt);}
function face(e,p,target,dt){if(!p||!target)return;const d=unit(target.x-p.x,target.y-p.y);e.turnPlayer(p,d,dt);}
function facingDot(p,target){if(!p||!target)return-1;const d=unit(target.x-p.x,target.y-p.y);return(p.facingX||0)*d.x+(p.facingY||0)*d.y;}
function stage(e,name){e.trainingQualityV6.customStage=name;e.trainingQualityV6.stageAt=e.time;}
function age(e){return Math.max(0,e.time-(e.trainingQualityV6.stageAt??e.repStart));}
function resetBall(e,x,y){e.resetBall(x,y);Object.assign(e.ball,{z:0,vz:0,spin:0,setPieceAerial:null,setPieceCurve:null,crossbarMissLogged:false,trainingDirectPass:false});}
function common(e,objective){Object.assign(e.trainingQualityV6,{repTerminal:false,repTerminalAt:null,terminalReason:null,objective,shotTick:null,shotTime:null,serviceTick:-1,expectedDirectReceiverId:null,directReceiveTick:-1,directReceiveX:null,directReceiveY:null});e.ball.trainingDirectPass=false;}
function terminal(e,success,text,reason=text){const q=e.trainingQualityV6;if(q.repTerminal)return;q.repSuccess=!!success;q.repTerminal=true;q.repTerminalAt=e.time;q.terminalReason=reason;e.flashTraining(text);}
function receivedAfter(e,p,tick=-1){return !!p&&e.ball.lastPlayerId===p.id&&(e.ball.lastTouchTick??-1)>tick;}
function goalTarget(side=1){return{x:FIELD.right+22,y:side<0?322:378};}
function markShot(e){const q=e.trainingQualityV6,k=e.lastTrainingKick;if(q.shotTick==null&&k?.rep===e.rep&&k.by===e.player.id&&k.kind==='shot'){q.shotTick=k.tick;q.shotTime=e.time;e.ball.trainingDirectPass=false;}}
function shotOutcome(e,keeper){const q=e.trainingQualityV6;if(q.shotTick==null)return null;if(e.goalScored?.())return{success:true,text:'GOL',reason:'goal'};if(keeper&&e.ball.lastPlayerId===keeper.id&&(e.ball.lastTouchTick??-1)>q.shotTick)return{success:true,text:'AL ARCO',reason:'save'};const elapsed=e.time-(q.shotTime??e.time);if(e.ball.x>FIELD.right-3){const on=e.ball.y>FIELD.goalTop&&e.ball.y<FIELD.goalBottom;return{success:on,text:on?'AL ARCO':'AFUERA',reason:on?'on-target':'wide'};}if(elapsed>.38&&speed(e.ball)<.28)return{success:false,text:'CORTO',reason:'dead'};if(elapsed>2.2)return{success:false,text:'AFUERA',reason:'timeout'};return null;}
function prepareShot(e,target,dt,power=6.15){const p=e.player,d=unit(target.x-e.ball.x,target.y-e.ball.y),contact=p.r+e.ball.r-.6,spot={x:e.ball.x-d.x*(contact+1.1),y:e.ball.y-d.y*(contact+1.1)};if(speed(e.ball)>.72&&age(e)<.5){face(e,p,target,dt);hold(e,p,spot,dt);return false;}return physicalKick(e,p,target,power,'shot',dt);}
function observe(e){e.observeTouches?.();}

function setupProfile(e,rep){
  const side=rep%2?1:-1,[server]=e.mates,[marker,keeper]=e.defenders;
  e.resetActor(server,600,FIELD.centerY+side*58,'CM');e.resetActor(e.player,690,FIELD.centerY+side*54,'ST');
  e.resetActor(marker,875,FIELD.centerY-side*112,'CB');e.resetActor(keeper,FIELD.right-27,FIELD.centerY-side*14,'GK');
  resetBall(e,server.x+18,server.y);common(e,'Llegá al apoyo, recibí de costado, orientá un contacto hacia delante y recién después perfilate detrás de la pelota para definir.');
  Object.assign(e.trainingQualityV6,{side,receive:{x:748,y:FIELD.centerY+side*28},finishPocket:{x:815,y:FIELD.centerY+side*18},possessionId:server.id,receiveTick:-1});
  stage(e,'arrive');e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function profile(e,dt){
  const q=e.trainingQualityV6,[server]=e.mates,[marker,keeper]=e.defenders;observe(e);if(q.repTerminal)return;
  hold(e,keeper,{x:FIELD.right-27,y:FIELD.centerY-q.side*14},dt);hold(e,marker,{x:875,y:FIELD.centerY-q.side*112},dt);
  if(q.customStage==='arrive'){q.phase='Llegar y abrir el cuerpo';hold(e,e.player,q.receive,dt);face(e,e.player,goalTarget(q.side),dt);if(dist(e.player,q.receive)<9)stage(e,'service');return;}
  if(q.customStage==='service'){q.phase='Pase diagonal al pie hábil';hold(e,e.player,q.receive,dt);face(e,e.player,goalTarget(q.side),dt);if(physicalKick(e,server,{x:q.receive.x+5,y:q.receive.y},2.15,'service',dt,{receiver:e.player})){q.serviceTick=e.tick;e.pending(server,e.player,'service');stage(e,'receive');}return;}
  if(q.customStage==='receive'){q.phase='Control orientado';const intercept=e.projectedIntercept(e.player);hold(e,e.player,{x:clamp(intercept.x,q.receive.x-10,q.receive.x+24),y:clamp(intercept.y,q.receive.y-20,q.receive.y+20)},dt);face(e,e.player,goalTarget(q.side),dt);if(receivedAfter(e,e.player,q.serviceTick)){q.receiveTick=e.ball.lastTouchTick;stage(e,'orient');e.flashTraining('CONTROL');return;}if(age(e)>2.8)terminal(e,false,'PASE PERDIDO','service-missed');return;}
  if(q.customStage==='orient'){q.phase='Orientar hacia el remate';e.player.kickIntent=null;e.dribbleTo(e.player,q.finishPocket,dt);face(e,e.player,goalTarget(q.side),dt);if(e.ball.x>q.finishPocket.x-18&&e.ball.lastPlayerId===e.player.id){e.player.dribbleIntent=null;stage(e,'finish');return;}if(age(e)>2.2){e.player.dribbleIntent=null;stage(e,'finish');}return;}
  if(q.customStage==='finish'){q.phase='Perfilar y definir';prepareShot(e,goalTarget(q.side),dt,6.15);markShot(e);if(q.shotTick!=null)stage(e,'flight');return;}
  q.phase='Resolver remate';const out=shotOutcome(e,keeper);if(out)terminal(e,out.success,out.text,out.reason);
}

function setupOne(e,rep){
  const side=rep%2?1:-1,[server]=e.mates,[marker,keeper]=e.defenders,sy=FIELD.centerY+side*22;
  e.resetActor(server,615,sy,'CM');e.resetActor(e.player,705,sy,'ST');e.resetActor(marker,885,FIELD.centerY-side*118,'CB');e.resetActor(keeper,FIELD.right-27,FIELD.centerY-side*14,'GK');
  resetBall(e,server.x+18,sy);common(e,'Corré sin pelota, frená, terminá de orientar el cuerpo al arco y recién entonces recibí el pase raso para rematar de primera.');
  Object.assign(e.trainingQualityV6,{side,strike:{x:812,y:sy},possessionId:server.id});stage(e,'run');e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function one(e,dt){
  const q=e.trainingQualityV6,[server]=e.mates,[marker,keeper]=e.defenders;observe(e);if(q.repTerminal)return;
  hold(e,marker,{x:885,y:FIELD.centerY-q.side*118},dt);hold(e,keeper,{x:FIELD.right-27,y:FIELD.centerY-q.side*14},dt);
  const target=goalTarget(q.side);
  if(q.customStage==='run'){q.phase='Llegar al punto de remate';hold(e,e.player,q.strike,dt);face(e,e.player,target,dt);if(dist(e.player,q.strike)<7){e.player.vx*=.15;e.player.vy*=.15;stage(e,'profile');}return;}
  if(q.customStage==='profile'){q.phase='Terminar de perfilar';e.player.vx*=.35;e.player.vy*=.35;e.player.dribbleIntent=null;e.player.kickIntent=null;face(e,e.player,target,dt);if(facingDot(e.player,target)>.992&&age(e)>.10)stage(e,'serve');return;}
  if(q.customStage==='serve'){q.phase='Sale el pase raso';e.player.vx*=.35;e.player.vy*=.35;face(e,e.player,target,dt);if(facingDot(e.player,target)<.985)return;if(physicalKick(e,server,{x:e.player.x,y:e.player.y},2.25,'service',dt,{direct:true})){q.serviceTick=e.tick;q.expectedDirectReceiverId=e.player.id;e.pending(server,e.player,'service');e.armKick(e.player,target,6.1,'shot',{trainingKind:'shot'});stage(e,'strike');}return;}
  if(q.customStage==='strike'){q.phase='Rematar de primera';e.player.vx*=.45;e.player.vy*=.45;face(e,e.player,target,dt);if(!e.player.kickIntent)e.armKick(e.player,target,6.1,'shot',{trainingKind:'shot'});markShot(e);if(q.shotTick!=null){stage(e,'flight');return;}if(age(e)>3.0)terminal(e,false,'NO LLEGÓ','missed-service');return;}
  q.phase='Resolver remate';const out=shotOutcome(e,keeper);if(out)terminal(e,out.success,out.text,out.reason);
}

function setupRun(e,rep){
  const side=rep%2?1:-1,[passer]=e.mates,[d1,d2,keeper]=e.defenders;
  e.resetActor(passer,555,FIELD.centerY-side*18,'CAM');e.resetActor(e.player,660,FIELD.centerY+side*104,'ST');
  e.resetActor(d1,748,238,'CB');e.resetActor(d2,748,462,'CB');e.resetActor(keeper,FIELD.right-27,FIELD.centerY,'GK');
  resetBall(e,passer.x+18,passer.y);common(e,'Esperá onside y fuera de la línea del pase. El pase filtrado sale primero; después atacás el espacio y cortás hacia la pelota una vez que cruza la última línea.');
  Object.assign(e.trainingQualityV6,{side,lineX:748,wait:{x:690,y:FIELD.centerY+side*100},runLane:{x:790,y:FIELD.centerY+side*78},lead:{x:850,y:FIELD.centerY+side*12},possessionId:passer.id});
  stage(e,'wait');e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function run(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[passer]=e.mates,[d1,d2,keeper]=e.defenders;observe(e);if(q.repTerminal)return;
  hold(e,d1,{x:q.lineX,y:238},dt);hold(e,d2,{x:q.lineX,y:462},dt);hold(e,keeper,{x:FIELD.right-27,y:FIELD.centerY},dt);
  if(q.customStage==='wait'){q.phase='Esperar onside';hold(e,e.player,q.wait,dt);face(e,e.player,q.runLane,dt);if(dist(e.player,q.wait)<8){m.timedRuns=(m.timedRuns||0)+1;stage(e,'release');}return;}
  if(q.customStage==='release'){q.phase='Golpeo del pase filtrado';hold(e,e.player,q.wait,dt);face(e,e.player,q.runLane,dt);if(physicalKick(e,passer,q.lead,2.05,'through',dt,{direct:true})){q.serviceTick=e.tick;q.expectedDirectReceiverId=e.player.id;e.pending(passer,e.player,'through');stage(e,'lane');}return;}
  if(q.customStage==='lane'){
    q.phase='Acelerar por fuera de la trayectoria';hold(e,e.player,q.runLane,dt);face(e,e.player,q.lead,dt);
    if(e.ball.x>q.lineX-10)stage(e,'attack');else if(age(e)>3.2)terminal(e,false,'PASE CORTO','through-short');return;
  }
  q.phase='Cortar y recibir detrás de la línea';const intercept=e.projectedIntercept(e.player);hold(e,e.player,{x:Math.max(q.lineX+16,intercept.x),y:clamp(intercept.y,280,420)},dt);face(e,e.player,q.lead,dt);
  if(receivedAfter(e,e.player,q.serviceTick)){if(e.ball.x>q.lineX-4||e.player.x>q.lineX+10){m.throughReceptions=Math.max(1,m.throughReceptions||0);terminal(e,true,'PASE FILTRADO RECIBIDO','through-received');return;}}
  if(age(e)>4.2)terminal(e,false,'NO LLEGÓ','through-missed');
}

function setupWall(e,rep){
  const side=rep%2?1:-1,[mate]=e.mates,[d1,d2,keeper]=e.defenders;
  e.resetActor(mate,570,FIELD.centerY-side*10,'CAM');e.resetActor(e.player,680,FIELD.centerY+side*48,'ST');
  e.resetActor(d1,790,220,'CB');e.resetActor(d2,790,480,'CB');e.resetActor(keeper,FIELD.right-27,FIELD.centerY,'GK');
  resetBall(e,mate.x+18,mate.y);common(e,'Venite al apoyo, descargá de primera y arrancá. El apoyo devuelve de primera hacia el espacio central, siempre por delante de tu carrera.');
  Object.assign(e.trainingQualityV6,{side,support:{x:645,y:FIELD.centerY+side*20},mateSpot:{x:600,y:FIELD.centerY-side*8},breakPoint:{x:735,y:FIELD.centerY+side*64},runLane:{x:795,y:FIELD.centerY+side*66},lead:{x:855,y:FIELD.centerY+side*10},lineX:775,possessionId:mate.id,wallTick:-1,returnTick:-1});
  stage(e,'check');e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function wall(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[mate]=e.mates,[d1,d2,keeper]=e.defenders;observe(e);if(q.repTerminal)return;
  hold(e,d1,{x:790,y:220},dt);hold(e,d2,{x:790,y:480},dt);hold(e,keeper,{x:FIELD.right-27,y:FIELD.centerY},dt);
  if(q.customStage==='check'){q.phase='Venir al apoyo';hold(e,e.player,q.support,dt);face(e,e.player,mate,dt);if(dist(e.player,q.support)<8)stage(e,'service');return;}
  if(q.customStage==='service'){
    q.phase='Pase al pie';hold(e,e.player,q.support,dt);face(e,e.player,mate,dt);hold(e,mate,q.mateSpot,dt);
    if(physicalKick(e,mate,{x:q.support.x+2,y:q.support.y},1.9,'service',dt,{direct:true})){q.serviceTick=e.tick;q.expectedDirectReceiverId=e.player.id;e.pending(mate,e.player,'service');e.armKick(e.player,q.mateSpot,2.0,'pass',{trainingKind:'wall'});stage(e,'layoff');}return;
  }
  if(q.customStage==='layoff'){
    q.phase='Descargar de primera';e.player.vx*=.5;e.player.vy*=.5;face(e,e.player,q.mateSpot,dt);hold(e,mate,q.mateSpot,dt);face(e,mate,q.lead,dt);
    if(!e.player.kickIntent)e.armKick(e.player,q.mateSpot,2.0,'pass',{trainingKind:'wall'});
    const k=e.lastTrainingKick;if(k?.rep===e.rep&&k.by===e.player.id&&k.kind==='wall'){q.wallTick=k.tick;e.ball.trainingDirectPass=true;q.expectedDirectReceiverId=mate.id;e.pending(e.player,mate,'wall');m.wallBeats=(m.wallBeats||0)+1;stage(e,'return-ready');return;}
    if(age(e)>3)terminal(e,false,'NO DESCARGÓ','layoff-missed');return;
  }
  if(q.customStage==='return-ready'){
    q.phase='Arrancar tras la descarga';hold(e,e.player,q.breakPoint,dt);face(e,e.player,q.runLane,dt);hold(e,mate,q.mateSpot,dt);face(e,mate,q.lead,dt);
    if(receivedAfter(e,mate,q.wallTick)){e.ball.trainingDirectPass=false;stage(e,'return');return;}
    if(age(e)>3)terminal(e,false,'DESCARGA PERDIDA','wall-missed');return;
  }
  if(q.customStage==='return'){
    q.phase='Devolver al espacio';hold(e,e.player,q.breakPoint,dt);face(e,e.player,q.runLane,dt);face(e,mate,q.lead,dt);
    if(physicalKick(e,mate,q.lead,2.05,'through',dt,{direct:true})){q.returnTick=e.tick;q.expectedDirectReceiverId=e.player.id;e.pending(mate,e.player,'through');stage(e,'lane');return;}
    if(age(e)>3)terminal(e,false,'DEVOLUCIÓN TARDE','return-late');return;
  }
  if(q.customStage==='lane'){
    q.phase='Romper fuera de la trayectoria';hold(e,e.player,q.runLane,dt);face(e,e.player,q.lead,dt);
    if(e.ball.x>q.lineX-8)stage(e,'attack-return');else if(age(e)>3.2)terminal(e,false,'DEVOLUCIÓN CORTA','return-short');return;
  }
  q.phase='Atacar devolución';const intercept=e.projectedIntercept(e.player);hold(e,e.player,{x:Math.max(q.lineX+14,intercept.x),y:clamp(intercept.y,285,415)},dt);face(e,e.player,q.lead,dt);
  if(receivedAfter(e,e.player,q.returnTick)){if(e.ball.x>q.lineX-4||e.player.x>q.lineX+10){m.throughReceptions=Math.max(1,m.throughReceptions||0);terminal(e,true,'DESCARGA + RUPTURA','wall-run-complete');return;}}
  if(age(e)>4.2)terminal(e,false,'DEVOLUCIÓN PERDIDA','return-missed');
}

function setupBox(e,rep){const side=rep%2?1:-1,[def,keeper]=e.defenders;e.resetActor(e.player,720,FIELD.centerY+side*18,'ST');e.resetActor(def,738,FIELD.centerY-side*24,'CB');e.resetActor(keeper,FIELD.right-27,FIELD.centerY,'GK');resetBall(e,e.player.x+18,e.player.y);common(e,'Arrancá hombro con hombro, no detrás del central. Protegé el primer contacto, girá sólo 40–50 px hacia el lado libre y después recuperá posición detrás de la pelota para definir.');Object.assign(e.trainingQualityV6,{side,startY:e.ball.y,possessionId:e.player.id});stage(e,'shield');e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};}
function box(e,dt){const q=e.trainingQualityV6,m=e.trainingMetricsV6,[def,keeper]=e.defenders;observe(e);if(q.repTerminal)return;hold(e,keeper,{x:FIELD.right-27,y:FIELD.centerY},dt);if(q.shotTick!=null){const out=shotOutcome(e,keeper);if(out)terminal(e,out.success,out.text,out.reason);return;}if(q.customStage==='shield'){q.phase='Proteger hombro con hombro';const lane={x:770,y:FIELD.centerY+q.side*42};carryBehind(e,e.player,lane,dt);hold(e,def,{x:e.player.x+10,y:e.player.y-q.side*30},dt);if(age(e)>.55)stage(e,'turn');return;}if(q.customStage==='turn'){q.phase='Girar al lado libre';const lane={x:805,y:FIELD.centerY+q.side*48};carryBehind(e,e.player,lane,dt);hold(e,def,{x:e.player.x-12,y:e.player.y-q.side*34},dt);if(e.ball.x>770&&Math.abs(e.ball.y-q.startY)>18){m.duelsBeaten=(m.duelsBeaten||0)+1;stage(e,'finish');e.flashTraining('GIRO LIMPIO');return;}if(age(e)>2.4)terminal(e,false,'SIN GIRO','turn-stalled');return;}q.phase='Recuperar perfil y definir';hold(e,def,{x:e.player.x-58,y:e.player.y-q.side*46},dt);prepareShot(e,{x:FIELD.right+22,y:FIELD.centerY},dt,5.85);markShot(e);}

function setupPress(e,rep){
  const side=rep%2?1:-1,[cover,wing]=e.mates,[carrier,wide,pivot,keeper]=e.defenders;
  e.resetActor(e.player,680,FIELD.centerY+side*12,'ST');e.resetActor(cover,730,FIELD.centerY-side*110,'CAM');e.resetActor(wing,735,FIELD.centerY+side*160,'RW');
  e.resetActor(carrier,885,FIELD.centerY,'CB');e.resetActor(wide,820,FIELD.centerY+side*112,'RB');e.resetActor(pivot,755,FIELD.centerY-side*100,'CM');e.resetActor(keeper,FIELD.right-27,FIELD.centerY,'GK');
  resetBall(e,carrier.x-18,carrier.y);common(e,'1) Tapá el pase interior. 2) Orientá al central hacia la banda. 3) Cuando juegue al lateral, saltá sobre el receptor. 4) Recuperá o forzá la devolución.');
  Object.assign(e.trainingQualityV6,{side,screen:{x:770,y:FIELD.centerY-side*42},force:{x:795,y:FIELD.centerY-side*32},wideTarget:{x:wide.x,y:wide.y},wideTick:-1,possessionId:carrier.id});
  stage(e,'screen');e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function press(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[cover,wing]=e.mates,[carrier,wide,pivot,keeper]=e.defenders;observe(e);if(q.repTerminal)return;
  hold(e,keeper,{x:FIELD.right-27,y:FIELD.centerY},dt);hold(e,pivot,{x:755,y:FIELD.centerY-q.side*100},dt);hold(e,cover,{x:730,y:FIELD.centerY-q.side*110},dt);hold(e,wing,{x:735,y:FIELD.centerY+q.side*160},dt);
  if(q.wideTick>=0&&[e.player,cover,wing].some(p=>receivedAfter(e,p,q.wideTick))){m.recoveries=(m.recoveries||0)+1;terminal(e,true,'RECUPERACIÓN','recovery');return;}
  if(q.customStage==='screen'){
    q.phase='1. Tapar pase interior';hold(e,wide,q.wideTarget,dt);hold(e,e.player,q.screen,dt);face(e,e.player,carrier,dt);carrier.vx*=.25;carrier.vy*=.25;face(e,carrier,q.wideTarget,dt);
    if(dist(e.player,q.screen)<9&&facingDot(carrier,q.wideTarget)>.97)stage(e,'force-wide');return;
  }
  if(q.customStage==='force-wide'){
    q.phase='2. Orientar a banda';hold(e,e.player,q.force,dt);face(e,e.player,carrier,dt);hold(e,wide,q.wideTarget,dt);face(e,carrier,q.wideTarget,dt);
    if(physicalKick(e,carrier,q.wideTarget,1.95,'press-wide',dt,{direct:true})){q.wideTick=e.tick;q.expectedDirectReceiverId=wide.id;e.pending(carrier,wide,'press-wide');stage(e,'jump');return;}
    return;
  }
  if(q.customStage==='jump'){
    q.phase='3. Saltar sobre el lateral';const intercept=e.projectedIntercept(wide);hold(e,wide,intercept,dt);hold(e,e.player,{x:intercept.x-46,y:intercept.y-q.side*16},dt);face(e,e.player,wide,dt);
    if(receivedAfter(e,wide,q.wideTick)){stage(e,'trap');e.flashTraining('ENCERRADO EN BANDA');return;}
    if(age(e)>3.2)terminal(e,false,'PASE PERDIDO','wide-missed');return;
  }
  q.phase='4. Forzar devolución';hold(e,e.player,{x:wide.x-34,y:wide.y-q.side*10},dt);face(e,e.player,wide,dt);
  if(dist(e.player,wide)<72&&physicalKick(e,wide,{x:carrier.x-8,y:carrier.y},1.9,'press-release',dt,{direct:true})){terminal(e,true,'PASE ATRÁS FORZADO','forced-back');return;}
  if(age(e)>3.2)terminal(e,false,'PRESIÓN TARDE','late');
}

function setup(e,rep){const id=e.drill?.id;if(id==='st-profile-finish')setupProfile(e,rep);else if(id==='st-one-touch')setupOne(e,rep);else if(id==='st-run-behind')setupRun(e,rep);else if(id==='st-wall-run')setupWall(e,rep);else if(id==='st-box-duel')setupBox(e,rep);else if(id==='st-press')setupPress(e,rep);}
function scenario(e,dt){const id=e.drill?.id;if(id==='st-profile-finish')return profile(e,dt);if(id==='st-one-touch')return one(e,dt);if(id==='st-run-behind')return run(e,dt);if(id==='st-wall-run')return wall(e,dt);if(id==='st-box-duel')return box(e,dt);if(id==='st-press')return press(e,dt);}

export class TrainingMatchEngine extends TrainingMatchEngineV13{
  constructor(drill,result,player){super(drill,result,player);this.trainingEngineVersion=14;}
  resetRep(rep,initial=false){super.resetRep(rep,initial);if(IDS.has(this.drill?.id))setup(this,rep);}
  scenario(dt){if(IDS.has(this.drill?.id))return scenario(this,dt);return super.scenario(dt);}
  sessionResult(){return{...super.sessionResult(),engineVersion:14};}
}

export const __trainingMatchEngineV14={IDS};
