import {TrainingMatchEngine as TrainingMatchEngineV2} from './training-match-engine-v2.js';
import {CROSSBAR_HEIGHT,WALL_CLEAR_HEIGHT} from './set-piece-height-v2.js';

export const TRAINING_MATCH_ENGINE_VERSION=3;
const FIELD={left:55,right:1045,top:45,bottom:655,goalTop:295,goalBottom:405,centerX:550,centerY:350};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const lineDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy||1,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l2,0,1);return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));};
const brokenPressureIds=new Set(['w-isolation','cam-pressure-escape','mid-pressure-escape']);

function goal(e){return e.ball.x>FIELD.right+8&&e.ball.y>FIELD.goalTop&&e.ball.y<FIELD.goalBottom&&(e.ball.z||0)<=CROSSBAR_HEIGHT;}
function keeperTouch(e,q,keeper){return !!keeper&&q.shotTick!=null&&e.tick>q.shotTick&&e.ball.lastPlayerId===keeper.id;}
function cleanFinish(e,q,keeper){if(goal(e)||keeperTouch(e,q,keeper))return true;if(q.shotTick==null)return false;const towardGoal=e.ball.vx>1.1||e.ball.x>(q.shotStartX??e.ball.x)+35;return towardGoal&&e.ball.x>FIELD.right-165&&Math.abs(e.ball.y-FIELD.centerY)<135;}
function cleanFreeKick(e,q,keeper){
  if(goal(e)||keeperTouch(e,q,keeper))return true;
  const kick=e.lastTrainingKick;
  if(!kick||kick.rep!==e.rep||kick.by!==e.player.id||kick.kind!=='free-kick')return false;
  const travelled=e.ball.x-(q.freeKickStartX??e.repOrigin?.bx??e.ball.x);
  const clearedWall=travelled>82&&(q.maxFreeKickHeight||0)>=WALL_CLEAR_HEIGHT;
  const threatening=travelled>150&&e.ball.y>FIELD.goalTop-42&&e.ball.y<FIELD.goalBottom+42&&(e.ball.z||0)<=CROSSBAR_HEIGHT+1.1;
  return clearedWall&&threatening;
}
function resetFreeBall(e,x,y){e.resetBall(x,y);Object.assign(e.ball,{z:0,vz:0,spin:0,setPieceAerial:null,crossbarMissLogged:false});}
function markSuccess(e,text='RESUELTO'){const q=e.trainingQualityV6;if(q.repSuccess)return;q.repSuccess=true;e.flashTraining(text);}
function adaptivePassPower(e,from,to,kind='pass'){
  const d=dist(e.ball,to),loft=/through|cross/.test(kind);
  return clamp((loft?1.55:1.35)+d/(loft?120:145),loft?2.75:2.35,loft?4.65:4.05);
}
function kickReceiver(e,from,to,kind,dt,target=to){return e.tryKick(from,target,adaptivePassPower(e,from,to,kind),kind,to,dt);}
function nearestPressure(p,defs){return defs.length?Math.min(...defs.map(d=>dist(p,d))):999;}
function openReceiver(from,options,defs){return [...options].sort((a,b)=>(nearestPressure(b,defs)+Math.min(...defs.map(d=>lineDistance(d,from,b))))-(nearestPressure(a,defs)+Math.min(...defs.map(d=>lineDistance(d,from,a)))))[0];}

function setupBoxDuel(e,rep){
  const q=e.trainingQualityV6,[def,keeper]=e.defenders,side=rep%2?1:-1;
  e.resetActor(e.player,748,FIELD.centerY+side*42,e.playerData?.position||'ST');
  e.resetActor(def,710,FIELD.centerY+side*48,'CB');
  e.resetActor(keeper,FIELD.right-28,FIELD.centerY-side*18,'GK');
  const user=Math.round(((e.playerData?.physical||50)+(e.playerData?.ballControl||50)+(e.playerData?.dribbling||50))/3);
  const opposition=clamp(Math.round(40+(user-40)*.48),40,68);
  Object.assign(def.data,{defense:opposition,physical:opposition,pace:Math.max(42,opposition-5),composure:opposition});
  Object.assign(keeper.data,{defense:clamp(opposition+5,46,73),pace:Math.max(48,opposition-9),composure:opposition});
  resetFreeBall(e,e.player.x+15,e.player.y);
  Object.assign(q,{boxPhase:'protect',protectTime:0,turnComplete:false,shotTick:null,shotStartX:null,goal:false,repSuccess:false});
  q.objective='Protegé de espaldas, sacá al central de la línea, girá hacia el lado libre y terminá la ventaja con un remate';
  e.trainingIntelligenceV7??={};e.trainingIntelligenceV7.coachCue='Primero sostené la pelota. El giro vale cuando tu cuerpo queda entre el central y la pelota; recién después atacá el arco.';
  e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function boxDuelScenario(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[def,keeper]=e.defenders,side=e.rep%2?1:-1;
  if(goal(e)){if(!q.goal){q.goal=true;m.goals=(m.goals||0)+1;}markSuccess(e,'GOL');return;}
  if(q.shotTick!=null){q.phase='Seguir la finalización';if(cleanFinish(e,q,keeper))markSuccess(e,'GIRO + REMATE');if(keeper)e.move(keeper,{x:FIELD.right-28,y:clamp(e.ball.y,FIELD.goalTop+16,FIELD.goalBottom-16)},dt);return;}
  if(q.boxPhase==='protect'){
    q.phase='Proteger de espaldas';const shieldLane={x:775,y:clamp(FIELD.centerY+side*105,220,480)};e.dribbleTo(e.player,shieldLane,dt);e.defend(def,{x:e.ball.x-38,y:e.ball.y+side*12},dt);
    if(e.ball.lastPlayerId===e.player.id||dist(e.player,e.ball)<e.player.r+e.ball.r+8)q.protectTime+=dt;
    if(q.protectTime>=.58||e.repProgress()>.22){q.boxPhase='turn';e.flashTraining('PROTEGIDA');}return;
  }
  if(q.boxPhase==='turn'){
    q.phase='Girar hacia el lado libre';const turnLane={x:850,y:clamp(FIELD.centerY-side*72,245,455)};e.dribbleTo(e.player,turnLane,dt);e.defend(def,{x:e.ball.x-42,y:e.ball.y+side*40},dt);
    if(e.ball.x>800&&(dist(e.player,def)>20||Math.abs(e.ball.y-def.y)>32||e.repProgress()>.48)){q.turnComplete=true;q.boxPhase='finish';m.duelsBeaten=(m.duelsBeaten||0)+1;e.flashTraining('GIRO');}return;
  }
  q.phase='Terminar la ventaja';if(keeper)e.move(keeper,{x:FIELD.right-28,y:clamp(e.ball.y,FIELD.goalTop+16,FIELD.goalBottom-16)},dt);e.defend(def,{x:e.ball.x-50,y:e.ball.y+side*34},dt);
  const target={x:FIELD.right+26,y:keeper?.y<FIELD.centerY?FIELD.goalBottom-20:FIELD.goalTop+20};
  if(e.tryKick(e.player,target,7.35,'shot',null,dt)){q.shotTick=e.tick;q.shotStartX=e.ball.x;m.shots=Math.max(1,m.shots||0);if(q.turnComplete)markSuccess(e,'REMATE');}
}

function setupPressureEscape(e,rep){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[def,keeper]=e.defenders,side=rep%2?1:-1,wide=e.drill?.id==='w-isolation';
  const y=wide?FIELD.centerY+side*190:FIELD.centerY+side*95;
  e.resetActor(e.player,535,y,e.playerData?.position||'CM');e.resetActor(def,700,y-side*42,'CB');if(keeper)e.resetActor(keeper,FIELD.right-28,FIELD.centerY,'GK');resetFreeBall(e,e.player.x+18,e.player.y);
  Object.assign(q,{duelLineX:def.x,duelTouchStart:m.physicalTouches||0,beatDefender:false,escapeSide:side,repSuccess:false});
  q.objective=wide?'Fijá al lateral, ganá un costado con contactos reales y conservá la ventaja':'Protegé, girá hacia el lado libre y salí de la presión con control de la siguiente acción';
  e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function pressureEscapeScenario(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[def]=e.defenders,side=q.escapeSide||1;
  if(!q.beatDefender){
    q.phase='Fijar y superar';const lane={x:q.duelLineX+95,y:clamp(e.player.y-side*105,105,595)};e.dribbleTo(e.player,lane,dt);e.defend(def,{x:q.duelLineX+8,y:clamp(e.ball.y+side*28,105,595)},dt);
    const touches=(m.physicalTouches||0)-(q.duelTouchStart||0),crossed=e.ball.x>q.duelLineX+26,free=dist(e.ball,def)>20||e.repProgress()>.48;
    if(touches>=2&&crossed&&free){q.beatDefender=true;m.duelsBeaten=(m.duelsBeaten||0)+1;e.flashTraining('SUPERADO');}return;
  }
  q.phase='Conservar la ventaja';e.defend(def,{x:e.ball.x-42,y:e.ball.y+side*35},dt);e.dribbleTo(e.player,{x:860,y:clamp(e.ball.y-side*28,105,595)},dt);
  if(e.ball.x>815&&e.ball.lastPlayerId===e.player.id)markSuccess(e,'SALIDA LIMPIA');
}

function setupWideCarry(e,rep){
  const q=e.trainingQualityV6,side=rep%2?1:-1,startY=FIELD.centerY+side*150;
  e.resetActor(e.player,175,startY,e.playerData?.position||'RW');resetFreeBall(e,193,startY);
  const ys=[startY,startY-side*48,startY+side*18,startY-side*58];q.gates=[270,390,515,645].map((x,i)=>({x,y:clamp(ys[i],125,575),w:86}));q.gateIndex=0;q.gatePrev={x:e.ball.x,y:e.ball.y};q.exit={x:765,y:clamp(ys[3]-side*30,125,575)};e.cones=q.gates.flatMap(g=>[{x:g.x,y:g.y-g.w/2},{x:g.x,y:g.y+g.w/2}]);q.repSuccess=false;e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function gateCrossed(prev,ball,g){
  const near=Math.abs(ball.x-g.x)<=24&&Math.abs(ball.y-g.y)<=g.w*.52;if(near)return true;
  if(!prev||prev.x>g.x||ball.x<g.x)return false;const span=ball.x-prev.x;if(span<=.001)return false;const t=(g.x-prev.x)/span,y=prev.y+(ball.y-prev.y)*t;return Math.abs(y-g.y)<=g.w*.52;
}
function wideCarryScenario(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,g=q.gates?.[q.gateIndex],prev=q.gatePrev;
  if(g){q.phase=`Puerta ${q.gateIndex+1}/${q.gates.length}`;if(gateCrossed(prev,e.ball,g)){q.gateIndex++;m.gatesCleared=(m.gatesCleared||0)+1;e.flashTraining('CONTROL');}q.gatePrev={x:e.ball.x,y:e.ball.y};const next=q.gates?.[q.gateIndex];e.dribbleTo(e.player,next||q.exit,dt);return;}
  q.phase='Acelerar después del control';e.dribbleTo(e.player,q.exit,dt);if(e.ball.x>q.exit.x-28&&e.ball.lastPlayerId===e.player.id)markSuccess(e,'SECUENCIA');
}

function setupCrossChoice(e,rep){const q=e.trainingQualityV6;Object.assign(q,{customStage:'carry',receiverId:null,deliveryKind:null,repSuccess:false});}
function crossChoiceScenario(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[near,far,cut]=e.mates,[wide,box,keeper]=e.defenders,side=e.rep%2?1:-1;
  e.move(near,{x:880,y:FIELD.centerY-side*55},dt);e.move(far,{x:900,y:FIELD.centerY+side*65},dt);e.move(cut,{x:785,y:FIELD.centerY+side*125},dt);e.defend(wide,{x:clamp(e.ball.x+30,700,805),y:clamp(e.ball.y-side*18,95,605)},dt);if(box)e.defend(box,{x:855,y:FIELD.centerY},dt);if(keeper)e.move(keeper,{x:FIELD.right-28,y:clamp(e.ball.y,FIELD.goalTop+16,FIELD.goalBottom-16)},dt);
  if(q.customStage==='carry'){q.phase='Ganar línea y levantar la cabeza';e.dribbleTo(e.player,{x:785,y:e.player.y},dt);if(e.ball.x<748)return;const options=[near,far,cut],defs=[box,keeper].filter(Boolean),receiver=openReceiver(e.player,options,defs),kind=receiver===cut?'cutback':'cross';q.receiverId=receiver.id;q.deliveryKind=kind;if(kickReceiver(e,e.player,receiver,kind,dt)){q.customStage='receive';q.delivered=true;m.deliveries=(m.deliveries||0)+1;m.deliveryChoices?.add?.(kind);e.pending(e.player,receiver,kind);}return;}
  const receiver=e.mates.find(p=>p.id===q.receiverId);if(q.customStage==='receive'){q.phase='Atacar la entrega';if(receiver)e.move(receiver,e.projectedIntercept(receiver),dt);if(receiver&&q.pendingPass==null&&q.possessionId===receiver.id){m.deliveryReceptions=Math.max(1,m.deliveryReceptions||0);markSuccess(e,'ENTREGA COMPLETA');}return;}
}

function setupScanReceive(e,rep){
  const q=e.trainingQualityV6,[mate]=e.mates,[press,cover,keeper]=e.defenders,side=rep%2?1:-1;
  e.resetActor(e.player,615,FIELD.centerY+side*82,e.playerData?.position||'CAM');e.resetActor(mate,425,FIELD.centerY-side*120,'CM');e.resetActor(press,520,FIELD.centerY-side*65,'CM');e.resetActor(cover,735,FIELD.centerY+side*35,'CB');if(keeper)e.resetActor(keeper,FIELD.right-28,FIELD.centerY,'GK');resetFreeBall(e,mate.x+18,mate.y);Object.assign(q,{customStage:'offer',possessionId:mate.id,receiverId:e.player.id,repSuccess:false});e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function scanReceiveScenario(e,dt){
  const q=e.trainingQualityV6,[mate]=e.mates,[press,cover]=e.defenders,side=e.rep%2?1:-1;
  if(q.customStage==='offer'){q.phase='Escanear y aparecer entre líneas';const pocket={x:625,y:FIELD.centerY+side*92};e.move(e.player,pocket,dt);e.defend(press,{x:mate.x+48,y:mate.y},dt);e.defend(cover,{x:710,y:FIELD.centerY+side*35},dt);e.dribbleTo(mate,{x:470,y:mate.y},dt);if(e.repProgress()>.16&&kickReceiver(e,mate,e.player,'pass',dt,{x:e.player.x+18,y:e.player.y})){q.customStage='receive';e.pending(mate,e.player,'pass');}return;}
  if(q.customStage==='receive'){q.phase='Atacar la trayectoria';e.move(e.player,e.projectedIntercept(e.player),dt);e.defend(cover,{x:e.player.x+35,y:e.player.y-side*22},dt);if(q.pendingPass==null&&q.possessionId===e.player.id){q.customStage='turn';q.receiveX=e.ball.x;e.flashTraining('RECIBIDA');}return;}
  q.phase='Orientar y atacar la ventaja';e.defend(cover,{x:e.ball.x+42,y:e.ball.y+side*28},dt);e.dribbleTo(e.player,{x:790,y:clamp(e.ball.y-side*45,125,575)},dt);if(e.ball.lastPlayerId===e.player.id&&e.ball.x>(q.receiveX||610)+55)markSuccess(e,'RECEPCIÓN ORIENTADA');
}

function setupThirdMan(e,rep){
  const q=e.trainingQualityV6,[first,link]=e.mates,[p1,p2,p3,keeper]=e.defenders,side=rep%2?1:-1;
  e.resetActor(first,420,FIELD.centerY+side*125,'CM');e.resetActor(link,545,FIELD.centerY-side*115,'CM');e.resetActor(e.player,620,FIELD.centerY+side*88,e.playerData?.position||'CAM');e.resetActor(p1,545,FIELD.centerY+side*35,'CM');e.resetActor(p2,675,FIELD.centerY-side*45,'CB');e.resetActor(p3,770,FIELD.centerY+side*115,'LB');if(keeper)e.resetActor(keeper,FIELD.right-28,FIELD.centerY,'GK');resetFreeBall(e,first.x+18,first.y);Object.assign(q,{customStage:'first',possessionId:first.id,thirdLineX:675,repSuccess:false});e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function thirdManScenario(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[first,link]=e.mates,[p1,p2,p3]=e.defenders,side=e.rep%2?1:-1;
  e.defend(p1,{x:q.customStage==='first'?first.x+45:link.x+42,y:q.customStage==='first'?first.y:link.y},dt);e.defend(p2,{x:q.thirdLineX,y:FIELD.centerY-side*28},dt);e.defend(p3,{x:770,y:FIELD.centerY+side*105},dt);
  if(q.customStage==='first'){q.phase='Mover la primera presión';e.move(link,{x:560,y:FIELD.centerY-side*118},dt);e.move(e.player,{x:635,y:FIELD.centerY+side*82},dt);if(kickReceiver(e,first,link,'pass',dt)){q.customStage='link';e.pending(first,link,'pass');}return;}
  if(q.customStage==='link'){q.phase='Preparar al tercer hombre';e.move(link,e.projectedIntercept(link),dt);e.move(e.player,{x:735,y:FIELD.centerY+side*70},dt);if(q.pendingPass==null&&q.possessionId===link.id){q.customStage='third';e.flashTraining('DESCARGA');}return;}
  if(q.customStage==='third'){q.phase='Encontrar al que aparece';e.move(e.player,{x:760,y:FIELD.centerY+side*62},dt);if(kickReceiver(e,link,e.player,'third-man',dt,{x:e.player.x+24,y:e.player.y})){q.customStage='receive';e.pending(link,e.player,'third-man');}return;}
  q.phase='Romper con el tercer hombre';e.move(e.player,e.projectedIntercept(e.player),dt);if(q.pendingPass==null&&q.possessionId===e.player.id&&e.ball.x>q.thirdLineX){m.wallBeats=(m.wallBeats||0)+1;markSuccess(e,'TERCER HOMBRE');}
}

function setupTempo(e,rep){
  const q=e.trainingQualityV6,[safe,runner]=e.mates,[p1,p2,p3,keeper]=e.defenders,side=rep%2?1:-1;
  e.resetActor(e.player,430,FIELD.centerY+side*90,e.playerData?.position||'CM');e.resetActor(safe,535,FIELD.centerY-side*120,'CM');e.resetActor(runner,650,FIELD.centerY+side*120,'CAM');e.resetActor(p1,550,FIELD.centerY+side*45,'CM');e.resetActor(p2,690,FIELD.centerY-side*40,'CB');e.resetActor(p3,770,FIELD.centerY+side*120,'LB');if(keeper)e.resetActor(keeper,FIELD.right-28,FIELD.centerY,'GK');resetFreeBall(e,e.player.x+18,e.player.y);Object.assign(q,{customStage:rep%2?'accelerate':'secure',possessionId:e.player.id,tempoLineX:690,repSuccess:false});e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function tempoScenario(e,dt){
  const q=e.trainingQualityV6,[safe,runner]=e.mates,[p1,p2,p3]=e.defenders,side=e.rep%2?1:-1;
  e.defend(p1,{x:e.ball.x+38,y:e.ball.y},dt);e.defend(p2,{x:q.tempoLineX,y:FIELD.centerY-side*42},dt);e.defend(p3,{x:770,y:FIELD.centerY+side*120},dt);e.move(safe,{x:550,y:FIELD.centerY-side*120},dt);e.move(runner,{x:735,y:FIELD.centerY+side*105},dt);
  if(q.customStage==='secure'){q.phase='Asegurar para mover la presión';if(kickReceiver(e,e.player,safe,'pass',dt)){q.customStage='secure-receive';e.pending(e.player,safe,'pass');}return;}
  if(q.customStage==='secure-receive'){q.phase='Dar continuidad';e.move(safe,e.projectedIntercept(safe),dt);if(q.pendingPass==null&&q.possessionId===safe.id){q.customStage='return';}return;}
  if(q.customStage==='return'){q.phase='Volver a ofrecerse';e.move(e.player,{x:560,y:FIELD.centerY+side*65},dt);if(kickReceiver(e,safe,e.player,'pass',dt)){q.customStage='return-receive';e.pending(safe,e.player,'pass');}return;}
  if(q.customStage==='return-receive'){q.phase='Reconocer cuándo acelerar';e.move(e.player,e.projectedIntercept(e.player),dt);if(q.pendingPass==null&&q.possessionId===e.player.id)q.customStage='accelerate';return;}
  if(q.customStage==='accelerate'){q.phase='Romper la línea correcta';e.move(runner,{x:755,y:FIELD.centerY+side*96},dt);const holder=q.possessionId===e.player.id?e.player:e.player;if(kickReceiver(e,holder,runner,'through',dt,{x:runner.x+28,y:runner.y})){q.customStage='progress';e.pending(holder,runner,'through');}return;}
  q.phase='Sostener la progresión';e.move(runner,e.projectedIntercept(runner),dt);if(q.pendingPass==null&&q.possessionId===runner.id&&e.ball.x>q.tempoLineX)markSuccess(e,'RITMO CORRECTO');
}

function setupMidSupport(e,rep){
  const q=e.trainingQualityV6,[mate]=e.mates,[press,cover,keeper]=e.defenders,side=rep%2?1:-1;
  e.resetActor(mate,430,FIELD.centerY-side*95,'CM');e.resetActor(e.player,555,FIELD.centerY+side*125,e.playerData?.position||'CM');e.resetActor(press,515,FIELD.centerY-side*48,'CM');e.resetActor(cover,680,FIELD.centerY+side*70,'CB');if(keeper)e.resetActor(keeper,FIELD.right-28,FIELD.centerY,'GK');resetFreeBall(e,mate.x+18,mate.y);Object.assign(q,{customStage:'offer',possessionId:mate.id,repSuccess:false});e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}
function midSupportScenario(e,dt){
  const q=e.trainingQualityV6,[mate]=e.mates,[press,cover]=e.defenders,side=e.rep%2?1:-1;
  e.defend(press,{x:mate.x+42,y:mate.y},dt);e.defend(cover,{x:675,y:FIELD.centerY+side*55},dt);
  if(q.customStage==='offer'){q.phase='Crear un ángulo útil';e.move(e.player,{x:565,y:FIELD.centerY+side*115},dt);e.dribbleTo(mate,{x:470,y:mate.y},dt);if(e.repProgress()>.14&&kickReceiver(e,mate,e.player,'pass',dt)){q.customStage='receive';e.pending(mate,e.player,'pass');}return;}
  if(q.customStage==='receive'){q.phase='Recibir perfilado';e.move(e.player,e.projectedIntercept(e.player),dt);if(q.pendingPass==null&&q.possessionId===e.player.id){q.customStage='return';e.flashTraining('APOYO');}return;}
  if(q.customStage==='return'){q.phase='Pasar y volver a aparecer';e.move(mate,{x:585,y:FIELD.centerY-side*75},dt);if(kickReceiver(e,e.player,mate,'pass',dt)){q.customStage='return-receive';e.pending(e.player,mate,'pass');}return;}
  e.move(mate,e.projectedIntercept(mate),dt);e.move(e.player,{x:690,y:FIELD.centerY+side*82},dt);if(q.pendingPass==null&&q.possessionId===mate.id)markSuccess(e,'APOYO CONTINUO');
}

function setupBuildOut(e){const q=e.trainingQualityV6;Object.assign(q,{customStage:'choose',receiverId:null,repSuccess:false});}
function buildOutScenario(e,dt){
  const q=e.trainingQualityV6,[m1,m2]=e.mates,[p1,p2]=e.defenders;e.move(m1,{x:500,y:225},dt);e.move(m2,{x:510,y:475},dt);e.defend(p1,{x:345,y:FIELD.centerY},dt);e.defend(p2,{x:610,y:FIELD.centerY+35},dt);
  if(q.customStage==='choose'){q.phase='Escanear y superar primera presión';const receiver=openReceiver(e.player,[m1,m2],[p1,p2]);q.receiverId=receiver.id;if(kickReceiver(e,e.player,receiver,'pass',dt)){q.customStage='receive';e.pending(e.player,receiver,'pass');}return;}
  const receiver=e.mates.find(p=>p.id===q.receiverId);q.phase='Dar continuidad a la salida';if(receiver)e.move(receiver,e.projectedIntercept(receiver),dt);if(receiver&&q.pendingPass==null&&q.possessionId===receiver.id&&receiver.x>e.player.x+120)markSuccess(e,'SALIDA LIMPIA');
}
function setupGKDistribution(e){const q=e.trainingQualityV6;Object.assign(q,{customStage:'wait',receiverId:null,repSuccess:false});}
function gkDistributionScenario(e,dt){
  const q=e.trainingQualityV6,[m1,m2]=e.mates,[p1,p2]=e.defenders;e.move(m1,{x:335,y:215},dt);e.move(m2,{x:445,y:475},dt);e.defend(p1,{x:215,y:FIELD.centerY},dt);e.defend(p2,{x:470,y:410},dt);
  if(q.customStage==='wait'){q.phase='Atraer la primera presión';if(e.repProgress()<.12){e.dribbleTo(e.player,{x:150,y:FIELD.centerY},dt);return;}const receiver=openReceiver(e.player,[m1,m2],[p1,p2]);q.receiverId=receiver.id;q.customStage='pass';}
  if(q.customStage==='pass'){const receiver=e.mates.find(p=>p.id===q.receiverId);q.phase='Elegir la salida';if(receiver&&kickReceiver(e,e.player,receiver,'pass',dt)){q.customStage='receive';e.pending(e.player,receiver,'pass');}return;}
  const receiver=e.mates.find(p=>p.id===q.receiverId);q.phase='Acompañar la distribución';if(receiver)e.move(receiver,e.projectedIntercept(receiver),dt);if(receiver&&q.pendingPass==null&&q.possessionId===receiver.id)markSuccess(e,'DISTRIBUCIÓN LIMPIA');
}

function freeKickScenario(e,dt){
  const q=e.trainingQualityV6,keeper=e.defenders[4];q.maxFreeKickHeight=Math.max(q.maxFreeKickHeight||0,e.ball.z||0);if(q.freeKickStartX==null)q.freeKickStartX=e.ball.x;superScenario(e,dt);q.maxFreeKickHeight=Math.max(q.maxFreeKickHeight||0,e.ball.z||0);if(cleanFreeKick(e,q,keeper))markSuccess(e,goal(e)?'GOL':'TIRO LIMPIO');
}
function superScenario(e,dt){return TrainingMatchEngineV2.prototype.scenario.call(e,dt);}

export class TrainingMatchEngine extends TrainingMatchEngineV2{
  constructor(drill,result,player){super(drill,result,player);this.trainingEngineVersion=3;}
  resetRep(rep,initial=false){
    super.resetRep(rep,initial);const id=this.drill?.id;
    if(id==='st-box-duel')setupBoxDuel(this,rep);
    else if(brokenPressureIds.has(id))setupPressureEscape(this,rep);
    else if(id==='w-wide-carry')setupWideCarry(this,rep);
    else if(id==='w-cross-choice')setupCrossChoice(this,rep);
    else if(id==='cam-scan-receive')setupScanReceive(this,rep);
    else if(id==='cam-third-man')setupThirdMan(this,rep);
    else if(id==='mid-tempo')setupTempo(this,rep);
    else if(id==='mid-support')setupMidSupport(this,rep);
    else if(id==='def-build')setupBuildOut(this,rep);
    else if(id==='gk-distribution')setupGKDistribution(this,rep);
    if(this.drill?.kind==='free-kick')Object.assign(this.trainingQualityV6,{freeKickStartX:this.ball.x,maxFreeKickHeight:this.ball.z||0});
  }
  scenario(dt){
    const id=this.drill?.id;
    if(id==='st-box-duel')return boxDuelScenario(this,dt);
    if(brokenPressureIds.has(id))return pressureEscapeScenario(this,dt);
    if(id==='w-wide-carry')return wideCarryScenario(this,dt);
    if(id==='w-cross-choice')return crossChoiceScenario(this,dt);
    if(id==='cam-scan-receive')return scanReceiveScenario(this,dt);
    if(id==='cam-third-man')return thirdManScenario(this,dt);
    if(id==='mid-tempo')return tempoScenario(this,dt);
    if(id==='mid-support')return midSupportScenario(this,dt);
    if(id==='def-build')return buildOutScenario(this,dt);
    if(id==='gk-distribution')return gkDistributionScenario(this,dt);
    if(this.drill?.kind==='free-kick')return freeKickScenario(this,dt);
    return super.scenario(dt);
  }
  sessionResult(){const out=super.sessionResult();return{...out,engineVersion:3};}
}

export const __trainingMatchEngineV3={setupBoxDuel,boxDuelScenario,cleanFinish,cleanFreeKick,adaptivePassPower,gateCrossed};
