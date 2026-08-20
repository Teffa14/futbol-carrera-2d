import {TrainingMatchEngine} from './training-match-engine-v1.js';

const FIELD={left:55,right:1045,top:45,bottom:655,goalTop:295,goalBottom:405,centerX:550,centerY:350};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const finite=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
const lineDist=(p,a,b)=>{const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,len=vx*vx+vy*vy||1,t=clamp((wx*vx+wy*vy)/len,0,1),x=a.x+vx*t,y=a.y+vy*t;return Math.hypot(p.x-x,p.y-y);};
const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const pick=(e,list,salt='')=>list[(hash(`${e.result?.seed}|${e.drill?.id}|${e.rep}|${salt}`)%list.length)];
const spaceScore=(point,defs)=>defs.reduce((best,d)=>Math.min(best,dist(point,d)),999);
const laneScore=(a,b,defs)=>defs.reduce((best,d)=>Math.min(best,lineDist(d,a,b)),999);
const ballSpeed=e=>Math.hypot(e.ball.vx,e.ball.vy);

function intel(e){
  e.trainingIntelligenceV7??={variant:'',coachCue:'',decisionScore:50,goodReads:0,badReads:0,choices:new Set(),counterpresses:0,recoveries:0,firstTimeShots:0,controlledFinishes:0,scanTicks:0,lastOppTouchTick:-999,repDecisionStart:0};
  return e.trainingIntelligenceV7;
}
function resetIntel(e){const s=intel(e);Object.assign(s,{variant:'',coachCue:'Escaneá antes de decidir',decisionScore:50,goodReads:0,badReads:0,choices:new Set(),counterpresses:0,recoveries:0,firstTimeShots:0,controlledFinishes:0,scanTicks:0,lastOppTouchTick:-999,repDecisionStart:e.time||0});return s;}
function reward(e,choice,amount=5){const s=intel(e);s.goodReads++;s.decisionScore=clamp(s.decisionScore+amount,0,100);if(choice)s.choices.add(choice);}
function punish(e,amount=4){const s=intel(e);s.badReads++;s.decisionScore=clamp(s.decisionScore-amount,0,100);}
function setCue(e,text){intel(e).coachCue=text;}
function goalTarget(e,keeper,from=e.ball){const far=keeper?.y<FIELD.centerY?FIELD.goalBottom-22:FIELD.goalTop+22,near=from.y<FIELD.centerY?FIELD.goalTop+26:FIELD.goalBottom-26;return{x:FIELD.right+28,y:Math.abs((keeper?.y??FIELD.centerY)-far)>32?far:near};}
function bestReceiver(e,holder,options,defs){return options.map(p=>{const open=spaceScore(p,defs),lane=laneScore(holder,p,defs),progress=(p.x-holder.x)*.16;return{p,score:open*.48+lane*.62+progress};}).sort((a,b)=>b.score-a.score)[0]?.p||null;}
function closest(point,list){return [...list].sort((a,b)=>dist(a,point)-dist(b,point))[0]||null;}

const baseReset=TrainingMatchEngine.prototype.resetRep;
TrainingMatchEngine.prototype.resetRep=function intelligentReset(rep,initial=false){
  const out=baseReset.call(this,rep,initial),q=this.trainingQualityV6,s=resetIntel(this),k=this.drill?.kind;
  if(k==='cones'){
    s.variant=pick(this,['zigzag-corto','cambio-largo','doble-salida'],'cones');const flip=rep%2?1:-1;
    const layouts={
      'zigzag-corto':[{x:235,y:515},{x:315,y:455+flip*28},{x:395,y:405-flip*34},{x:475,y:340+flip*25}],
      'cambio-largo':[{x:235,y:520},{x:330,y:430-flip*55},{x:415,y:390+flip*35},{x:505,y:305-flip*45}],
      'doble-salida':[{x:235,y:500},{x:305,y:455+flip*48},{x:385,y:395+flip*48},{x:490,y:335-flip*30}],
    };
    q.gates=layouts[s.variant].map(g=>({...g,w:58}));this.cones=q.gates.flatMap(g=>[{x:g.x,y:g.y-g.w/2},{x:g.x,y:g.y+g.w/2}]);q.exit={x:625,y:clamp(q.gates.at(-1).y+(flip*35),120,580)};q.objective='Control corto: atravesá las puertas con la pelota y acelerá al salir';setCue(this,'No persigas el cono: prepará el toque siguiente.');
  }else if(k==='1v1'){
    s.variant=pick(this,['jockey','salta-a-presionar','te-muestra-la-linea'],'1v1');q.defenderCommit=0;q.skillAttempted=false;
    if(s.variant==='salta-a-presionar')this.resetActor(this.defenders[0],480,this.player.y-22,'CB');
    if(s.variant==='te-muestra-la-linea')this.resetActor(this.defenders[0],520,FIELD.centerY+(rep%2?52:-52),'CB');
    q.objective='Leé el cuerpo del defensor, elegí la salida y terminá la acción';setCue(this,'Fijalo primero. Elegí el lado después de que comprometa el cuerpo.');
  }else if(k==='2v2'){
    s.variant=pick(this,['presion-al-portador','marca-al-apoyo','cierre-interior'],'2v2');q.plan=null;q.overlap=false;
    if(s.variant==='marca-al-apoyo')this.resetActor(this.defenders[1],520,285,'CB');
    if(s.variant==='cierre-interior')this.resetActor(this.defenders[0],420,405,'CB');
    q.objective='Creá una ventaja 2v2: pared si está abierta, conducción si la línea está cerrada';setCue(this,'No fuerces la pared. Primero mirá quién salta y quién cubre.');
  }else if(k==='3v3'){
    s.variant=pick(this,['posesion','presion-alta','transicion'],'3v3');q.turnoverAt=null;q.recovered=false;q.passCount=0;
    q.objective='Conservá la pelota, mové la presión y reaccioná inmediatamente si la perdés';setCue(this,'Formá un triángulo. Después del pase, volvé a ofrecer una línea.');
  }else if(k==='through'){
    s.variant=pick(this,['diagonal','ciego-del-central','apoyo-y-ruptura'],'through');q.runPhase='hold';q.runClock=0;q.passWindow=false;
    if(s.variant==='diagonal')this.resetActor(this.mates[0],585,435,'ST');
    if(s.variant==='ciego-del-central')this.resetActor(this.mates[0],625,300,'ST');
    q.objective='Sincronizá la ruptura con la línea rival y pasá al espacio, no al cuerpo';setCue(this,'La carrera buena empieza onside y termina detrás del defensor.');
  }else if(k==='cross'){
    s.variant=pick(this,['fondo-cerrado','primer-palo-cerrado','segundo-palo-cerrado'],'cross');
    if(s.variant==='fondo-cerrado')this.resetActor(this.defenders[0],725,565,'RB');
    if(s.variant==='primer-palo-cerrado')this.resetActor(this.defenders[1],880,320,'CB');
    if(s.variant==='segundo-palo-cerrado')this.resetActor(this.defenders[1],900,390,'CB');
    q.objective='Desbordá y elegí la entrega que deja al receptor con más espacio';setCue(this,'Levantá la cabeza antes del último toque: centro y cutback no son la misma decisión.');
  }else if(k==='finish'){
    s.variant=pick(this,['arquero-achica','marcador-encima','espacio-para-primera'],'finish');q.finishMode=null;q.keeperReactAt=null;
    if(s.variant==='marcador-encima')this.resetActor(this.defenders[0],760,390,'CB');
    if(s.variant==='espacio-para-primera')this.resetActor(this.defenders[0],825,430,'CB');
    q.objective='Atacá la trayectoria y decidí entre remate de primera o control antes de definir';setCue(this,'Tu primera decisión es dónde llegar. La segunda es si conviene controlar.');
  }else if(k==='free-kick'){
    s.variant=pick(this,['arquero-cubre-palo','barrera-cargada-arriba','barrera-cargada-abajo'],'free');q.scanUntil=(this.time||0)+.42;q.targetChosen=false;
    const wallShift=s.variant==='barrera-cargada-arriba'?-18:s.variant==='barrera-cargada-abajo'?18:0;
    this.defenders.slice(0,4).forEach((d,i)=>this.resetActor(d,755,305+wallShift+i*30,'CB'));
    if(s.variant==='arquero-cubre-palo')this.resetActor(this.defenders[4],1018,this.ball.y<FIELD.centerY?FIELD.goalTop+32:FIELD.goalBottom-32,'GK');
    q.objective='Escaneá barrera y arquero, elegí zona y ejecutá con el facing real del partido';setCue(this,'No patees por rutina. Leé qué zona está defendida.');
  }
  return out;
};

function cones(e,dt){const q=e.trainingQualityV6,s=intel(e),m=e.trainingMetricsV6,g=q.gates[q.gateIndex];if(g){q.phase=`Control ${q.gateIndex+1}/${q.gates.length}`;const tooFar=dist(e.player,e.ball)>44;setCue(e,tooFar?'Acortá el próximo toque: la pelota se te separó.':'Perfilá el cuerpo hacia la próxima puerta.');e.dribbleTo(e.player,g,dt);if(e.ball.x>=g.x-18&&Math.abs(e.ball.y-g.y)<g.w*.58){q.gateIndex++;m.gatesCleared++;reward(e,'gate',3);e.flashTraining('PUERTA');}return;}q.phase='Aceleración de salida';setCue(e,'Ahora sí: tocá largo y acelerá detrás de la pelota.');e.dribbleTo(e.player,q.exit,dt);if(e.ball.x>q.exit.x-30){q.repSuccess=true;reward(e,'exit',8);}}

function oneVOne(e,dt){const q=e.trainingQualityV6,s=intel(e),m=e.trainingMetricsV6,d=e.defenders[0],toGoal={x:FIELD.right,y:FIELD.centerY};const approach={x:e.ball.x+52,y:e.ball.y};
  if(!q.branch){q.phase='Fijar defensor';const hold=s.variant==='salta-a-presionar'?{x:e.ball.x+30,y:e.ball.y}:{x:e.ball.x+54,y:e.ball.y+(s.variant==='te-muestra-la-linea'?(e.ball.y<FIELD.centerY?-28:28):0)};e.defend(d,hold,dt);e.dribbleTo(e.player,{x:455,y:e.ball.y},dt);if(dist(d,e.ball)<145){q.defenderCommit=(q.defenderCommit||0)+dt;if(q.defenderCommit>.22){const inside={x:675,y:FIELD.centerY+(e.ball.y<FIELD.centerY?-18:18)},outside={x:650,y:e.ball.y<FIELD.centerY?FIELD.top+72:FIELD.bottom-72},insideScore=spaceScore(inside,[d])+Math.max(0,145-dist(inside,toGoal))*.08,outsideScore=spaceScore(outside,[d]);q.branch=insideScore>=outsideScore?'inside':'outside';q.target=q.branch==='inside'?inside:outside;s.choices.add(q.branch);reward(e,q.branch,5);if(!q.skillAttempted&&dist(d,e.ball)<78){q.skillAttempted=true;e.attemptSkillMove(e.player,d);}}}return;}
  q.phase=q.beatDefender?'Atacar arco':`Resolver ${q.branch}`;q.defenderCommit+=dt;const committed=q.defenderCommit<.72,commitY=q.branch==='inside'?(e.ball.y<FIELD.centerY?e.ball.y-55:e.ball.y+55):FIELD.centerY;const defendTarget=committed?{x:e.ball.x+42,y:clamp(commitY,90,610)}:{x:e.ball.x+30,y:e.ball.y};e.defend(d,defendTarget,dt);e.dribbleTo(e.player,q.beatDefender?{x:820,y:FIELD.centerY}:q.target,dt);
  if(!q.beatDefender&&(e.ball.x>d.x+14||Math.abs(e.ball.y-d.y)>105&&e.ball.x>d.x-25)){q.beatDefender=true;m.duelsBeaten++;reward(e,'beat',10);e.flashTraining('SUPERADO');setCue(e,'Ya ganaste el duelo. Separá la pelota y prepará el remate.');}
  if(q.beatDefender&&!q.finishShot&&e.ball.x>700)q.finishShot=e.tryKick(e.player,goalTarget(e,e.defenders.find(x=>x.role==='GK')),7.4,'shot',null,dt);if(e.goalScored()){q.goal=true;q.repSuccess=true;m.goals++;reward(e,'goal',10);}}

function twoVTwo(e,dt){const q=e.trainingQualityV6,s=intel(e),mate=e.mates[0],[d1,d2]=e.defenders;e.observeTouches();const presserTarget=s.variant==='cierre-interior'?{x:e.ball.x+30,y:e.ball.y-42}:{x:e.ball.x+34,y:e.ball.y};e.defend(d1,presserTarget,dt);e.defend(d2,{x:mate.x+28,y:mate.y},dt);e.move(mate,{x:clamp(e.ball.x+155,390,650),y:e.ball.y<FIELD.centerY?FIELD.centerY+125:FIELD.centerY-125},dt);
  if(!q.firstPass){q.phase='Leer el 2v2';const lane=laneScore(e.ball,mate,[d1,d2]),press=dist(d1,e.ball);if(!q.plan&&press<120){q.plan=lane>46?'wall':'carry';s.choices.add(q.plan);reward(e,q.plan,6);setCue(e,q.plan==='wall'?'El defensor saltó y dejó la pared. Soltá y seguí.':'La línea de pase está tapada. Conducí para mover al marcador.');}
    if(!q.plan||q.plan==='carry'){const escape={x:e.ball.x+110,y:clamp(e.ball.y+(d1.y<e.ball.y?75:-75),120,580)};e.dribbleTo(e.player,escape,dt);if(q.plan==='carry'&&e.ball.x>445&&laneScore(e.ball,mate,[d1,d2])>40){q.plan='carry-release';reward(e,'created-lane',6);}if(q.plan!=='carry-release')return;}
    q.firstPass=e.tryKick(e.player,mate,5.4,'pass',mate,dt);if(q.firstPass)e.pending(e.player,mate,'pass');return;}
  if(q.pendingPass){q.phase='Atacar después de soltar';e.move(mate,e.projectedIntercept(mate),dt);e.move(e.player,{x:clamp(mate.x+145,520,760),y:clamp(mate.y+70,120,580)},dt);return;}
  if(q.possessionId===mate.id&&!q.returnPass){q.phase='Devolución o continuación';const runLane=laneScore(mate,e.player,[d1,d2]);if(runLane>35){q.returnPass=e.tryKick(mate,{x:e.player.x+55,y:e.player.y},5.5,'wall',e.player,dt);if(q.returnPass){e.pending(mate,e.player,'wall');reward(e,'return',7);}}else{e.dribbleTo(mate,{x:690,y:FIELD.centerY},dt);}return;}
  if(q.returnPass&&q.pendingPass){q.phase='Recibir la ventaja';e.move(e.player,e.projectedIntercept(e.player),dt);return;}if(q.returnPass&&q.possessionId===e.player.id){if(!q.wallComplete){q.wallComplete=true;m.wallBeats++;reward(e,'wall-complete',8);}e.dribbleTo(e.player,{x:820,y:FIELD.centerY},dt);if(e.ball.x>760)q.repSuccess=true;}}

function threeVThree(e,dt){const q=e.trainingQualityV6,s=intel(e),m=e.trainingMetricsV6,attack=[e.player,...e.mates],defs=e.defenders;e.observeTouches();const opponentHas=defs.some(d=>d.id===q.possessionId);
  if(opponentHas){if(q.turnoverAt==null){q.turnoverAt=e.time;s.counterpresses++;punish(e,3);setCue(e,'Pérdida: cinco metros hacia la pelota, no hacia tu posición inicial.');}q.phase='Contrapresión';const carrier=defs.find(d=>d.id===q.possessionId)||closest(e.ball,defs);attack.forEach((p,i)=>e.move(p,i===0?e.projectedIntercept(p):{x:carrier.x-30-i*15,y:carrier.y+(i-1)*48},dt));defs.forEach((d,i)=>{if(d===carrier)e.move(d,{x:clamp(d.x-85,FIELD.left+40,FIELD.right-40),y:d.y},dt);else e.move(d,{x:d.x-45,y:d.y+(i?55:-55)},dt);});if(q.possessionId&&attack.some(a=>a.id===q.possessionId)){q.recovered=true;s.recoveries++;reward(e,'counterpress-recovery',12);q.turnoverAt=null;}else if(e.time-q.turnoverAt>1.7){setCue(e,'No llegaste a cerrar la pérdida. Recuperá estructura.');}return;}
  q.phase='Circular y progresar';const holder=attack.find(p=>p.id===q.possessionId)||closest(e.ball,attack)||e.player,press=closest(e.ball,defs);defs.forEach((d,i)=>{if(d===press)e.defend(d,{x:e.ball.x+28,y:e.ball.y},dt);else{const mark=attack[(i+1)%attack.length];e.defend(d,{x:mark.x+32,y:mark.y},dt);}});attack.filter(p=>p!==holder).forEach((p,i)=>e.move(p,{x:clamp(e.ball.x+120+i*70,250,820),y:i?470:225},dt));if(dist(holder,e.ball)>holder.r+e.ball.r+8){e.move(holder,e.projectedIntercept(holder),dt);return;}const receiver=bestReceiver(e,holder,attack.filter(p=>p!==holder),defs);if(receiver&&laneScore(holder,receiver,defs)>24){if(e.tryKick(holder,receiver,5.35,'pass',receiver,dt)){e.pending(holder,receiver,'pass');q.passCount=(q.passCount||0)+1;reward(e,receiver.id,4);}}else{e.dribbleTo(holder,{x:holder.x+65,y:clamp(holder.y+(press.y<holder.y?55:-55),120,580)},dt);}if((q.completedInRep>=3||q.passCount>=4)&&e.ball.x>650){q.repSuccess=true;reward(e,'progression',8);}}

function through(e,dt){const q=e.trainingQualityV6,s=intel(e),m=e.trainingMetricsV6,runner=e.mates[0],[d1,d2]=e.defenders;q.runClock=(q.runClock||0)+dt;const lineX=q.lineX;
  const lineBehavior=pick(e,['step','hold','drop'],'line');const lineShift=lineBehavior==='step'?-20:lineBehavior==='drop'?35:0;e.defend(d1,{x:lineX+lineShift,y:300},dt);e.defend(d2,{x:lineX+lineShift,y:420},dt);
  if(q.runPhase==='hold'){q.phase='Escanear línea';e.dribbleTo(e.player,{x:500,y:490},dt);const holdY=s.variant==='diagonal'?450:s.variant==='ciego-del-central'?300:400;e.move(runner,{x:lineX-55,y:holdY},dt);setCue(e,lineBehavior==='step'?'La línea salta: esperá medio tiempo y atacá el espacio que deja.':'Mantenete onside hasta que el pasador pueda levantar la cabeza.');if(e.ball.x>455&&q.runClock>.65){q.runPhase=s.variant==='apoyo-y-ruptura'?'check':'go';q.runClock=0;m.timedRuns++;reward(e,'scan-line',5);}return;}
  if(q.runPhase==='check'){q.phase='Amago de apoyo';e.move(runner,{x:lineX-105,y:runner.y+20},dt);if(q.runClock>.48){q.runPhase='go';q.runClock=0;reward(e,'check-go',5);}return;}
  if(!q.passReleased){q.phase='Atacar espalda';const runTarget=s.variant==='diagonal'?{x:900,y:330}:s.variant==='ciego-del-central'?{x:910,y:380}:{x:900,y:runner.y};e.move(runner,runTarget,dt);const lead={x:clamp(runner.x+105,FIELD.left+25,FIELD.right-25),y:runner.y+(s.variant==='diagonal'?-18:0)},lane=laneScore(e.ball,lead,[d1,d2]);if(runner.x>lineX-18&&lane>24){q.passReleased=e.tryKick(e.player,lead,6.0,'through',runner,dt);if(q.passReleased){e.pending(e.player,runner,'through');reward(e,'release-window',9);}}return;}
  if(q.pendingPass){q.phase='Atacar trayectoria';e.move(runner,e.projectedIntercept(runner),dt);return;}if(q.possessionId===runner.id&&e.ball.x>lineX){q.repSuccess=true;m.throughReceptions=Math.max(1,m.throughReceptions);reward(e,'receive-behind-line',10);}}

function crossing(e,dt){const q=e.trainingQualityV6,s=intel(e),m=e.trainingMetricsV6,[near,far,cutback]=e.mates,[wideDef,boxDef]=e.defenders;const progress=clamp((e.ball.x-620)/240,0,1);e.move(near,{x:845+progress*65,y:315},dt);e.move(far,{x:855+progress*70,y:405},dt);e.move(cutback,{x:745+progress*70,y:475-progress*35},dt);
  const showInside=s.variant==='fondo-cerrado';e.defend(wideDef,{x:e.ball.x+38,y:clamp(e.ball.y+(showInside?-42:18),110,605)},dt);const markTarget=s.variant==='primer-palo-cerrado'?near:s.variant==='segundo-palo-cerrado'?far:cutback;e.defend(boxDef,{x:markTarget.x+18,y:markTarget.y},dt);
  if(!q.delivered){q.phase='Llegar y levantar cabeza';e.dribbleTo(e.player,{x:840,y:575},dt);if(e.ball.x<765)return;const candidates=[{p:near,kind:'near-cross'},{p:far,kind:'far-cross'},{p:cutback,kind:'cutback'}].map(o=>({...o,score:spaceScore(o.p,[wideDef,boxDef])*.55+laneScore(e.ball,o.p,[wideDef,boxDef])*.7})).sort((a,b)=>b.score-a.score),best=candidates[0];if(!q.deliveryChoice){q.deliveryChoice=best.kind;m.deliveryChoices.add(best.kind);e.branch(best.kind);reward(e,best.kind,8);setCue(e,`La defensa cerró ${candidates.at(-1).kind}. Elegí ${best.kind}.`);}const kickKind=best.kind==='cutback'?'cutback':'cross';q.delivered=e.tryKick(e.player,best.p,6.05,kickKind,best.p,dt);if(q.delivered){m.deliveries++;e.pending(e.player,best.p,kickKind);}return;}
  if(q.pendingPass){q.phase='Ocupar zona de remate';const receiver=e.mates.find(p=>p.id===q.pendingPass.to);if(receiver)e.move(receiver,e.projectedIntercept(receiver),dt);return;}if(e.mates.some(p=>p.id===q.possessionId)){q.repSuccess=true;reward(e,'delivery-received',9);}}

function finishing(e,dt){const q=e.trainingQualityV6,s=intel(e),m=e.trainingMetricsV6,server=e.mates[0],[marker,keeper]=e.defenders;e.observeTouches();const pressure=dist(marker,e.player),speed=ballSpeed(e);e.defend(marker,{x:e.player.x+30,y:e.player.y+(s.variant==='marcador-encima'?-12:20)},dt);
  if(!q.service){q.phase=`Servicio: ${q.serviceType}`;const target=q.serviceType==='cutback'?{x:705,y:410}:q.serviceType==='through'?{x:770,y:360}:{x:745,y:330};q.service=e.tryKick(server,target,q.serviceType==='cross'?6.25:5.65,'service',e.player,dt);if(q.service)e.pending(server,e.player,'service');return;}
  if(q.pendingPass){q.phase='Atacar trayectoria';const intercept=e.projectedIntercept(e.player);e.move(e.player,intercept,dt);if(q.finishMode==null&&dist(e.player,e.ball)<48){q.finishMode=(pressure>70&&speed>2.2)||s.variant==='espacio-para-primera'?'first-time':'control';s.choices.add(q.finishMode);reward(e,q.finishMode,6);setCue(e,q.finishMode==='first-time'?'Tenés espacio y la pelota viene limpia: atacá de primera.':'El marcador llega: orientá el primer toque y separá el remate.');}return;}
  if(q.finishMode==='control'&&q.possessionId===e.player.id&&!q.controlSettled){q.phase='Orientar control';q.controlSettled=true;s.controlledFinishes++;e.dribbleTo(e.player,{x:e.player.x+42,y:keeper.y<FIELD.centerY?e.player.y+22:e.player.y-22},dt);return;}
  if(!q.finishShot&&(q.possessionId===e.player.id||q.finishMode==='first-time'&&dist(e.player,e.ball)<e.player.r+e.ball.r+6)){q.phase='Definir';q.finishShot=e.tryKick(e.player,goalTarget(e,keeper),7.55,'shot',null,dt);if(q.finishShot&&q.finishMode==='first-time')s.firstTimeShots++;return;}
  if(q.finishShot&&ballSpeed(e)>1.1){const predictedY=clamp(e.ball.y+e.ball.vy*20,FIELD.goalTop+18,FIELD.goalBottom-18);e.move(keeper,{x:1014,y:predictedY},dt);}if(e.goalScored()){q.goal=true;q.repSuccess=true;m.goals++;reward(e,'finish',10);}}

function freeKick(e,dt){const q=e.trainingQualityV6,s=intel(e),m=e.trainingMetricsV6,keeper=e.defenders[4],wall=e.defenders.slice(0,4);if(e.time<q.scanUntil){q.phase='Escanear';s.scanTicks++;setCue(e,'Mirá la posición del arquero y el borde exterior de la barrera.');return;}if(!q.targetChosen){const zones=[{id:'upper',p:{x:FIELD.right+28,y:FIELD.goalTop+22}},{id:'lower',p:{x:FIELD.right+28,y:FIELD.goalBottom-22}},{id:'low-gap',p:{x:FIELD.right+28,y:FIELD.centerY+(keeper.y<FIELD.centerY?38:-38)}}].map(z=>({...z,score:Math.abs(keeper.y-z.p.y)*.75+laneScore(e.ball,z.p,wall)*.7})).sort((a,b)=>b.score-a.score);q.freeTarget=zones[0];q.targetChosen=true;e.branch(zones[0].id);m.targetZones.add(zones[0].id);reward(e,zones[0].id,8);setCue(e,`Zona elegida: ${zones[0].id}. Ahora alineá el cuerpo y ejecutá.`);}q.phase='Ejecutar';if(!q.finishShot)q.finishShot=e.tryKick(e.player,q.freeTarget.p,q.freeTarget.id==='low-gap'?7.15:7.65,'free-kick',null,dt);if(q.finishShot&&ballSpeed(e)>1.1){const predictedY=clamp(e.ball.y+e.ball.vy*22,FIELD.goalTop+18,FIELD.goalBottom-18);e.move(keeper,{x:1016,y:predictedY},dt);}if(e.goalScored()){q.goal=true;q.repSuccess=true;m.goals++;reward(e,'free-kick-goal',10);}}

const baseScenario=TrainingMatchEngine.prototype.scenario;
TrainingMatchEngine.prototype.scenario=function intelligentScenario(dt){const k=this.drill?.kind;if(k==='cones')return cones(this,dt);if(k==='1v1')return oneVOne(this,dt);if(k==='2v2')return twoVTwo(this,dt);if(k==='3v3')return threeVThree(this,dt);if(k==='through')return through(this,dt);if(k==='cross')return crossing(this,dt);if(k==='finish')return finishing(this,dt);if(k==='free-kick')return freeKick(this,dt);return baseScenario.call(this,dt);};

const baseSessionResult=TrainingMatchEngine.prototype.sessionResult;
TrainingMatchEngine.prototype.sessionResult=function intelligentSessionResult(){const base=baseSessionResult.call(this),s=intel(this),m=this.trainingMetricsV6,reps=Math.max(1,base.reps||1),successRate=(base.successes||0)/reps,decision=clamp(Math.round(s.decisionScore),0,100),baseline=clamp(Number(this.result?.quality)||65,35,99),quality=clamp(Math.round(baseline*.30+successRate*48+decision*.22),35,99),feedback=[];
  if(this.drill?.kind==='cones')feedback.push(m.gatesCleared>=reps*3?'Buen control entre puertas.':'Necesitás encadenar más puertas sin separar la pelota.');
  if(this.drill?.kind==='1v1')feedback.push(m.duelsBeaten>=Math.ceil(reps*.35)?'Elegiste bien cuándo atacar el lado débil.':'Estás decidiendo la salida antes de fijar al defensor.');
  if(this.drill?.kind==='2v2')feedback.push(m.wallBeats>0?'La devolución generó ventaja real.':'Mové al primer defensor antes de pedir la devolución.');
  if(this.drill?.kind==='3v3')feedback.push(s.counterpresses?`Contrapresión: ${s.recoveries}/${s.counterpresses} recuperaciones.`:'Conservaste sin pérdidas que activaran contrapresión.');
  if(this.drill?.kind==='through')feedback.push(m.throughReceptions>0?'La ruptura y el pase quedaron sincronizados.':'El pase profundo salió fuera de la ventana de ruptura.');
  if(this.drill?.kind==='cross')feedback.push(m.deliveryChoices.size>1?'Leíste distintas soluciones de entrega.':'Repetiste demasiado la misma solución desde banda.');
  if(this.drill?.kind==='finish')feedback.push(`Decisión de remate: ${s.firstTimeShots} de primera · ${s.controlledFinishes} con control.`);
  if(this.drill?.kind==='free-kick')feedback.push(`Zonas leídas: ${[...m.targetZones].join(', ')||'ninguna'}.`);
  feedback.push(`Lecturas: ${s.goodReads} buenas · ${s.badReads} corregibles.`);return{...base,quality,grade:quality>=91?'S':quality>=82?'A':quality>=72?'B':quality>=62?'C':quality>=52?'D':'E',decisionScore:decision,decisionVariety:[...s.choices],feedback};};

const baseDraw=TrainingMatchEngine.prototype.draw;
TrainingMatchEngine.prototype.draw=function intelligentDraw(ctx,width=1100,height=700){baseDraw.call(this,ctx,width,height);const s=intel(this);ctx.save();ctx.fillStyle='rgba(5,15,10,.88)';ctx.fillRect(70,145,560,58);ctx.fillStyle='#91a49a';ctx.font='700 11px system-ui';ctx.textAlign='left';ctx.fillText(`VARIANTE · ${String(s.variant||'libre').toUpperCase()}`,86,166);ctx.fillStyle='#fff';ctx.font='13px system-ui';ctx.fillText(String(s.coachCue||'').slice(0,80),86,189);ctx.restore();};

export const __trainingIntelligenceV7={spaceScore,laneScore,bestReceiver};
