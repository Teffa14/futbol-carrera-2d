import {TrainingMatchEngine as TrainingMatchEngineV3} from './training-match-engine-v3.js';

export const TRAINING_MATCH_ENGINE_VERSION=4;
const FIELD={left:55,right:1045,top:45,bottom:655,goalTop:295,goalBottom:405,centerX:550,centerY:350};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const pressureIds=new Set(['w-isolation','cam-pressure-escape','mid-pressure-escape']);

function resetFreeBall(e,x,y){e.resetBall(x,y);Object.assign(e.ball,{z:0,vz:0,spin:0,setPieceAerial:null,crossbarMissLogged:false});}
function markSuccess(e,text='RESUELTO'){const q=e.trainingQualityV6;if(q.repSuccess)return;q.repSuccess=true;e.flashTraining(text);}
function physicalReception(e,receiver,kickTick=-1){return !!receiver&&e.ball.lastPlayerId===receiver.id&&e.ball.lastTouchTick>kickTick;}
function trainingPassPower(e,to,kind='pass'){
  const d=dist(e.ball,to),loft=/through|cross/.test(kind);
  return loft?clamp(d/132,1.35,3.15):clamp(d/148,1.08,2.55);
}
function send(e,from,to,kind,dt,target=to){return e.tryKick(from,target,trainingPassPower(e,to,kind),kind,to,dt);}
function hold(e,p,x,y,dt){if(p)e.move(p,{x,y},dt);}
function setRepOrigin(e){e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};}

function setupPressure(e,rep){
  const q=e.trainingQualityV6,[def,keeper]=e.defenders,side=rep%2?1:-1,py=FIELD.centerY+side*135;
  e.resetActor(e.player,520,py,e.playerData?.position||'CM');
  e.resetActor(def,680,FIELD.centerY+side*65,'CB');
  if(keeper)e.resetActor(keeper,FIELD.right-28,FIELD.centerY-side*15,'GK');
  const user=Math.round(((e.playerData?.dribbling||50)+(e.playerData?.ballControl||50)+(e.playerData?.pace||50))/3),opp=clamp(Math.round(44+(user-44)*.48),44,64);
  Object.assign(def.data,{defense:opp,physical:Math.max(44,opp-2),pace:Math.max(46,opp-3),composure:opp});
  resetFreeBall(e,e.player.x+18,e.player.y);
  Object.assign(q,{escapeSide:side,engagementX:650,escapeY:clamp(py+side*82,115,585),beatDefender:false,pressureTouchStart:e.trainingMetricsV6.physicalTouches||0,repSuccess:false});
  q.objective='Fijá al defensor, ganá un lado con contactos físicos y conservá la ventaja';
  setRepOrigin(e);
}
function pressureScenario(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[def,keeper]=e.defenders,side=q.escapeSide||1;e.observeTouches();
  if(keeper)hold(e,keeper,FIELD.right-28,clamp(e.ball.y,FIELD.goalTop+16,FIELD.goalBottom-16),dt);
  if(!q.beatDefender){
    q.phase='Fijar y superar';
    e.dribbleTo(e.player,{x:770,y:q.escapeY},dt);
    hold(e,def,q.engagementX+8,clamp(FIELD.centerY+side*35+(e.ball.y-(FIELD.centerY+side*35))*.22,120,580),dt);
    const touches=(m.physicalTouches||0)-(q.pressureTouchStart||0);
    if(touches>=2&&e.ball.x>q.engagementX+18&&e.ball.lastPlayerId===e.player.id){q.beatDefender=true;m.duelsBeaten=(m.duelsBeaten||0)+1;e.flashTraining('SUPERADO');}
    return;
  }
  q.phase='Conservar la ventaja';
  hold(e,def,clamp(e.ball.x-62,590,760),clamp(e.ball.y-side*48,120,580),dt);
  e.dribbleTo(e.player,{x:835,y:clamp(q.escapeY+side*12,115,585)},dt);
  if(e.ball.x>q.engagementX+92&&e.ball.lastPlayerId===e.player.id)markSuccess(e,'VENTAJA CONSERVADA');
}

function setupWideCarry(e,rep){
  const q=e.trainingQualityV6,side=rep%2?1:-1,startY=FIELD.centerY+side*150;
  e.resetActor(e.player,170,startY,e.playerData?.position||'RW');resetFreeBall(e,188,startY);
  const ys=[startY,startY-side*28,startY+side*10,startY-side*24];
  q.gates=[280,405,535,665].map((x,i)=>({x,y:clamp(ys[i],120,580),w:118}));
  q.gateIndex=0;q.gatePrev={x:e.ball.x,y:e.ball.y};q.exit={x:755,y:clamp(ys[3]-side*18,120,580)};q.repSuccess=false;
  e.cones=q.gates.flatMap(g=>[{x:g.x,y:g.y-g.w/2},{x:g.x,y:g.y+g.w/2}]);setRepOrigin(e);
}
function segmentCrossesGate(a,b,g){
  if(!a||!b)return false;const dx=b.x-a.x;if(Math.abs(dx)<.001)return Math.abs(b.x-g.x)<25&&Math.abs(b.y-g.y)<=g.w*.54;
  const t=(g.x-a.x)/dx;if(t<0||t>1)return false;const y=a.y+(b.y-a.y)*t;return Math.abs(y-g.y)<=g.w*.54;
}
function wideCarryScenario(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6;e.observeTouches();const prev=q.gatePrev||{x:e.ball.x,y:e.ball.y},now={x:e.ball.x,y:e.ball.y};
  while(q.gateIndex<q.gates.length&&segmentCrossesGate(prev,now,q.gates[q.gateIndex])){q.gateIndex++;m.gatesCleared=(m.gatesCleared||0)+1;e.flashTraining('CONTROL');}
  q.gatePrev=now;
  if(q.gateIndex<q.gates.length){q.phase=`Puerta ${q.gateIndex+1}/${q.gates.length}`;e.dribbleTo(e.player,q.gates[q.gateIndex],dt);return;}
  q.phase='Acelerar después del control';e.dribbleTo(e.player,q.exit,dt);if(e.ball.x>q.exit.x-24&&e.ball.lastPlayerId===e.player.id)markSuccess(e,'SECUENCIA');
}

function setupCrossChoice(e,rep){
  const q=e.trainingQualityV6,[near,far,cut]=e.mates,[wide,box,keeper]=e.defenders,side=rep%2?1:-1,py=FIELD.centerY+side*205;
  e.resetActor(e.player,635,py,e.playerData?.position||'RW');e.resetActor(near,825,FIELD.centerY-side*42,'ST');e.resetActor(far,850,FIELD.centerY+side*48,'ST');e.resetActor(cut,765,FIELD.centerY+side*112,'CAM');
  e.resetActor(wide,730,py-side*42,'RB');e.resetActor(box,875,FIELD.centerY,'CB');e.resetActor(keeper,FIELD.right-28,FIELD.centerY-side*15,'GK');
  resetFreeBall(e,e.player.x+18,e.player.y);Object.assign(q,{customStage:'carry',receiverId:null,kickTick:-1,finishTick:-1,repSuccess:false});setRepOrigin(e);
}
function crossChoiceScenario(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[near,far,cut]=e.mates,[wide,box,keeper]=e.defenders,side=e.rep%2?1:-1;e.observeTouches();
  hold(e,near,840,FIELD.centerY-side*38,dt);hold(e,far,865,FIELD.centerY+side*54,dt);hold(e,cut,785,FIELD.centerY+side*112,dt);hold(e,box,875,FIELD.centerY,dt);hold(e,keeper,FIELD.right-28,FIELD.centerY-side*12,dt);
  if(q.customStage==='carry'){
    q.phase='Ganar línea y leer área';hold(e,wide,735,clamp(e.player.y-side*60,100,600),dt);e.dribbleTo(e.player,{x:770,y:e.player.y},dt);if(e.ball.x<735)return;
    const receiver=e.rep%2?far:cut,kind=receiver===cut?'cutback':'cross';q.receiverId=receiver.id;
    if(send(e,e.player,receiver,'cross-choice',dt)){q.customStage='receive';q.kickTick=e.tick;m.deliveries=(m.deliveries||0)+1;m.deliveryChoices?.add?.(kind);e.pending(e.player,receiver,kind);}return;
  }
  const receiver=e.mates.find(p=>p.id===q.receiverId);
  if(q.customStage==='receive'){
    q.phase='Atacar la entrega';if(receiver)e.move(receiver,e.projectedIntercept(receiver),dt);
    if(physicalReception(e,receiver,q.kickTick)){q.customStage='finish';m.deliveryReceptions=(m.deliveryReceptions||0)+1;e.flashTraining('RECIBIDA');}return;
  }
  q.phase='Finalizar la entrega';if(!receiver)return;hold(e,box,clamp(receiver.x+38,840,910),FIELD.centerY,dt);const target={x:FIELD.right+26,y:keeper.y<FIELD.centerY?FIELD.goalBottom-20:FIELD.goalTop+20};
  if(e.tryKick(receiver,target,6.8,'cross-finish',null,dt)){q.finishTick=e.tick;m.shots=Math.max(1,m.shots||0);markSuccess(e,'CENTRO + REMATE');}
}

function setupScanReceive(e,rep){
  const q=e.trainingQualityV6,[mate]=e.mates,[press,cover,keeper]=e.defenders,side=rep%2?1:-1;
  e.resetActor(mate,425,FIELD.centerY-side*92,'CM');e.resetActor(e.player,585,FIELD.centerY+side*82,e.playerData?.position||'CAM');
  e.resetActor(press,515,FIELD.centerY-side*185,'CM');e.resetActor(cover,715,FIELD.centerY+side*28,'CB');if(keeper)e.resetActor(keeper,FIELD.right-28,FIELD.centerY,'GK');
  resetFreeBall(e,mate.x+18,mate.y);Object.assign(q,{customStage:'offer',possessionId:mate.id,kickTick:-1,receiveX:null,repSuccess:false});setRepOrigin(e);
}
function scanReceiveScenario(e,dt){
  const q=e.trainingQualityV6,[mate]=e.mates,[press,cover]=e.defenders,side=e.rep%2?1:-1;e.observeTouches();
  hold(e,press,505,FIELD.centerY-side*170,dt);hold(e,cover,715,FIELD.centerY+side*22,dt);
  if(q.customStage==='offer'){
    q.phase='Escanear y aparecer entre líneas';e.move(e.player,{x:600,y:FIELD.centerY+side*75},dt);e.dribbleTo(mate,{x:455,y:mate.y},dt);
    if(e.repProgress()>.07&&send(e,mate,e.player,'scan-service',dt,{x:e.player.x+12,y:e.player.y})){q.customStage='receive';q.kickTick=e.tick;e.pending(mate,e.player,'pass');}return;
  }
  if(q.customStage==='receive'){
    q.phase='Atacar la trayectoria';e.move(e.player,e.projectedIntercept(e.player),dt);
    if(physicalReception(e,e.player,q.kickTick)){q.customStage='turn';q.receiveX=e.ball.x;e.flashTraining('RECIBIDA');}return;
  }
  q.phase='Orientar y progresar';hold(e,cover,clamp(e.ball.x+58,690,760),clamp(e.ball.y-side*48,120,580),dt);e.dribbleTo(e.player,{x:735,y:clamp(e.ball.y+side*36,120,580)},dt);
  if(e.ball.lastPlayerId===e.player.id&&e.ball.x>(q.receiveX||590)+48)markSuccess(e,'RECEPCIÓN ORIENTADA');
}

function setupTempo(e,rep){
  const q=e.trainingQualityV6,[safe,runner]=e.mates,[p1,p2,p3,keeper]=e.defenders,side=rep%2?1:-1;
  e.resetActor(e.player,430,FIELD.centerY+side*62,e.playerData?.position||'CM');e.resetActor(safe,535,FIELD.centerY-side*88,'CM');e.resetActor(runner,625,FIELD.centerY+side*112,'CAM');
  e.resetActor(p1,535,FIELD.centerY+side*8,'CM');e.resetActor(p2,680,FIELD.centerY-side*42,'CB');e.resetActor(p3,760,FIELD.centerY+side*125,'LB');if(keeper)e.resetActor(keeper,FIELD.right-28,FIELD.centerY,'GK');
  resetFreeBall(e,e.player.x+18,e.player.y);Object.assign(q,{customStage:rep%2?'draw':'secure',possessionId:e.player.id,lineX:650,kickTick:-1,repSuccess:false});setRepOrigin(e);
}
function tempoScenario(e,dt){
  const q=e.trainingQualityV6,[safe,runner]=e.mates,[p1,p2,p3]=e.defenders,side=e.rep%2?1:-1;e.observeTouches();hold(e,p2,680,FIELD.centerY-side*42,dt);hold(e,p3,760,FIELD.centerY+side*125,dt);
  if(q.customStage==='secure'){
    q.phase='Asegurar y mover la presión';hold(e,p1,520,FIELD.centerY+side*15,dt);e.move(safe,{x:535,y:FIELD.centerY-side*88},dt);
    if(send(e,e.player,safe,'tempo-secure',dt)){q.customStage='secure-receive';q.kickTick=e.tick;e.pending(e.player,safe,'pass');}return;
  }
  if(q.customStage==='secure-receive'){
    q.phase='Dar continuidad';e.move(safe,e.projectedIntercept(safe),dt);if(physicalReception(e,safe,q.kickTick)){q.customStage='return';e.flashTraining('ASEGURADA');}return;
  }
  if(q.customStage==='return'){
    q.phase='Volver a ofrecerse';e.move(e.player,{x:555,y:FIELD.centerY+side*54},dt);hold(e,p1,525,FIELD.centerY-side*5,dt);
    if(send(e,safe,e.player,'tempo-return',dt)){q.customStage='return-receive';q.kickTick=e.tick;e.pending(safe,e.player,'pass');}return;
  }
  if(q.customStage==='return-receive'){
    q.phase='Reconocer la aceleración';e.move(e.player,e.projectedIntercept(e.player),dt);if(physicalReception(e,e.player,q.kickTick))q.customStage='draw';return;
  }
  if(q.customStage==='draw'){
    q.phase='Fijar antes de acelerar';hold(e,p1,575,FIELD.centerY+side*18,dt);e.move(runner,{x:660,y:FIELD.centerY+side*105},dt);e.dribbleTo(e.player,{x:535,y:e.player.y},dt);
    if(e.repProgress()>.20&&send(e,e.player,runner,'tempo-break',dt,{x:runner.x+28,y:runner.y})){q.customStage='progress';q.kickTick=e.tick;e.pending(e.player,runner,'through');}return;
  }
  q.phase='Sostener la progresión';hold(e,p1,575,FIELD.centerY+side*18,dt);e.move(runner,e.projectedIntercept(runner),dt);
  if(physicalReception(e,runner,q.kickTick)&&e.ball.x>q.lineX-20)markSuccess(e,'RITMO CORRECTO');
}

function setupSupport(e,rep){
  const q=e.trainingQualityV6,[mate]=e.mates,[press,cover,keeper]=e.defenders,side=rep%2?1:-1;
  e.resetActor(mate,425,FIELD.centerY-side*78,'CM');e.resetActor(e.player,555,FIELD.centerY+side*98,e.playerData?.position||'CM');e.resetActor(press,505,FIELD.centerY-side*175,'CM');e.resetActor(cover,690,FIELD.centerY+side*58,'CB');if(keeper)e.resetActor(keeper,FIELD.right-28,FIELD.centerY,'GK');
  resetFreeBall(e,mate.x+18,mate.y);Object.assign(q,{customStage:'offer',possessionId:mate.id,kickTick:-1,repSuccess:false});setRepOrigin(e);
}
function supportScenario(e,dt){
  const q=e.trainingQualityV6,[mate]=e.mates,[press,cover]=e.defenders,side=e.rep%2?1:-1;e.observeTouches();hold(e,press,500,FIELD.centerY-side*165,dt);hold(e,cover,690,FIELD.centerY+side*55,dt);
  if(q.customStage==='offer'){
    q.phase='Crear un ángulo útil';e.move(e.player,{x:560,y:FIELD.centerY+side*92},dt);e.dribbleTo(mate,{x:452,y:mate.y},dt);
    if(e.repProgress()>.07&&send(e,mate,e.player,'support-service',dt)){q.customStage='receive';q.kickTick=e.tick;e.pending(mate,e.player,'pass');}return;
  }
  if(q.customStage==='receive'){
    q.phase='Recibir perfilado';e.move(e.player,e.projectedIntercept(e.player),dt);if(physicalReception(e,e.player,q.kickTick)){q.customStage='return';e.flashTraining('APOYO');}return;
  }
  if(q.customStage==='return'){
    q.phase='Soltar y volver a aparecer';e.move(mate,{x:575,y:FIELD.centerY-side*65},dt);
    if(send(e,e.player,mate,'support-return',dt)){q.customStage='return-receive';q.kickTick=e.tick;e.pending(e.player,mate,'pass');}return;
  }
  q.phase='Sostener la línea de apoyo';e.move(mate,e.projectedIntercept(mate),dt);e.move(e.player,{x:675,y:FIELD.centerY+side*70},dt);
  if(physicalReception(e,mate,q.kickTick)&&e.player.x>625)markSuccess(e,'APOYO CONTINUO');
}

function setupBuild(e,rep){
  const q=e.trainingQualityV6,[m1,m2]=e.mates,[p1,p2]=e.defenders,side=rep%2?1:-1;
  e.resetActor(e.player,245,FIELD.centerY,e.playerData?.position||'CB');e.resetActor(m1,470,225,'CM');e.resetActor(m2,470,475,'RB');
  e.resetActor(p1,345,FIELD.centerY+side*105,'ST');e.resetActor(p2,610,FIELD.centerY-side*38,'CM');resetFreeBall(e,e.player.x+18,e.player.y);
  Object.assign(q,{customStage:'choose',possessionId:e.player.id,receiverId:side>0?m1.id:m2.id,kickTick:-1,pressureLineX:355,repSuccess:false});setRepOrigin(e);
}
function buildScenario(e,dt){
  const q=e.trainingQualityV6,[m1,m2]=e.mates,[p1,p2]=e.defenders,side=e.rep%2?1:-1,receiver=[m1,m2].find(p=>p.id===q.receiverId);e.observeTouches();
  hold(e,p1,345,FIELD.centerY+side*105,dt);hold(e,p2,610,FIELD.centerY-side*38,dt);hold(e,m1,485,225,dt);hold(e,m2,485,475,dt);
  if(q.customStage==='choose'){
    q.phase='Superar primera presión';if(receiver&&send(e,e.player,receiver,'build-out',dt)){q.customStage='receive';q.kickTick=e.tick;e.pending(e.player,receiver,'pass');}return;
  }
  q.phase='Dar continuidad a la salida';if(receiver)e.move(receiver,e.projectedIntercept(receiver),dt);
  if(physicalReception(e,receiver,q.kickTick)&&receiver.x>q.pressureLineX+55)markSuccess(e,'SALIDA LIMPIA');
}

function setupDistribution(e,rep){
  const q=e.trainingQualityV6,[m1,m2]=e.mates,[p1,p2]=e.defenders,side=rep%2?1:-1;
  e.resetActor(e.player,FIELD.left+58,FIELD.centerY,'GK');e.resetActor(m1,335,225,'CB');e.resetActor(m2,405,475,'CM');e.resetActor(p1,245,FIELD.centerY+side*92,'ST');e.resetActor(p2,500,FIELD.centerY-side*68,'CAM');
  resetFreeBall(e,e.player.x+18,e.player.y);Object.assign(q,{customStage:'wait',possessionId:e.player.id,receiverId:side>0?m1.id:m2.id,kickTick:-1,repSuccess:false});setRepOrigin(e);
}
function distributionScenario(e,dt){
  const q=e.trainingQualityV6,[m1,m2]=e.mates,[p1,p2]=e.defenders,side=e.rep%2?1:-1,receiver=[m1,m2].find(p=>p.id===q.receiverId);e.observeTouches();hold(e,m1,345,225,dt);hold(e,m2,415,475,dt);hold(e,p2,500,FIELD.centerY-side*68,dt);
  if(q.customStage==='wait'){
    q.phase='Atraer primera presión';hold(e,p1,220,FIELD.centerY+side*82,dt);e.dribbleTo(e.player,{x:145,y:FIELD.centerY},dt);if(e.repProgress()>.10)q.customStage='pass';return;
  }
  if(q.customStage==='pass'){
    q.phase='Elegir la salida';hold(e,p1,220,FIELD.centerY+side*82,dt);if(receiver&&send(e,e.player,receiver,'gk-release',dt)){q.customStage='receive';q.kickTick=e.tick;e.pending(e.player,receiver,'pass');}return;
  }
  q.phase='Acompañar la distribución';hold(e,p1,220,FIELD.centerY+side*82,dt);if(receiver)e.move(receiver,e.projectedIntercept(receiver),dt);
  if(physicalReception(e,receiver,q.kickTick))markSuccess(e,'DISTRIBUCIÓN LIMPIA');
}

export class TrainingMatchEngine extends TrainingMatchEngineV3{
  constructor(drill,result,player){super(drill,result,player);this.trainingEngineVersion=4;}
  resetRep(rep,initial=false){
    super.resetRep(rep,initial);const id=this.drill?.id;
    if(pressureIds.has(id))setupPressure(this,rep);
    else if(id==='w-wide-carry')setupWideCarry(this,rep);
    else if(id==='w-cross-choice')setupCrossChoice(this,rep);
    else if(id==='cam-scan-receive')setupScanReceive(this,rep);
    else if(id==='mid-tempo')setupTempo(this,rep);
    else if(id==='mid-support')setupSupport(this,rep);
    else if(id==='def-build')setupBuild(this,rep);
    else if(id==='gk-distribution')setupDistribution(this,rep);
  }
  scenario(dt){
    const id=this.drill?.id;
    if(pressureIds.has(id))return pressureScenario(this,dt);
    if(id==='w-wide-carry')return wideCarryScenario(this,dt);
    if(id==='w-cross-choice')return crossChoiceScenario(this,dt);
    if(id==='cam-scan-receive')return scanReceiveScenario(this,dt);
    if(id==='mid-tempo')return tempoScenario(this,dt);
    if(id==='mid-support')return supportScenario(this,dt);
    if(id==='def-build')return buildScenario(this,dt);
    if(id==='gk-distribution')return distributionScenario(this,dt);
    return super.scenario(dt);
  }
  sessionResult(){const out=super.sessionResult();return{...out,engineVersion:4};}
}

export const __trainingMatchEngineV4={trainingPassPower,segmentCrossesGate};
