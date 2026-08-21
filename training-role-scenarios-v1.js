import {TrainingMatchEngine} from './training-match-engine-latest.js';
import {trainingMarkerSnapshot} from './training-framework-v2.js';

const FIELD={left:55,right:1045,top:45,bottom:655,goalTop:295,goalBottom:405,centerX:550,centerY:350};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
function tune(p,role,stats={}){if(!p)return;p.role=role;p.data.engineRole=role;p.data.position=role;Object.assign(p.data,stats);}
function leftGoal(engine){return engine.ball.x<FIELD.left-9&&engine.ball.y>FIELD.goalTop&&engine.ball.y<FIELD.goalBottom;}
function safeY(y){return clamp(y,FIELD.goalTop+18,FIELD.goalBottom-18);}

const baseReset=TrainingMatchEngine.prototype.resetRep;
TrainingMatchEngine.prototype.resetRep=function roleSpecificReset(rep,initial=false){
  const out=baseReset.call(this,rep,initial),k=this.drill?.kind,q=this.trainingQualityV6;
  if(k==='def-1v1'){
    this.activate(0,1);const side=rep%2?1:-1,att=this.defenders[0];tune(this.player,'CB');tune(att,'ST',{pace:74,dribbling:72,shooting:70,ballControl:72,composure:68});
    this.resetActor(this.player,385,350+side*35,'CB');this.resetActor(att,690,350+side*90,'ST');this.resetBall(att.x-18,att.y);q.possessionId=att.id;q.objective=this.drill.objective;q.attackerId=att.id;q.shotStarted=false;q.wonBall=false;
  }else if(k==='def-cover'){
    this.activate(1,2);const carrier=this.defenders[0],runner=this.defenders[1],mate=this.mates[0];tune(this.player,'CB');tune(mate,'CB',{defense:70,pace:66});tune(carrier,'CAM',{passing:72,vision:74,dribbling:69});tune(runner,'ST',{pace:77,shooting:72});
    this.resetActor(this.player,360,390,'CB');this.resetActor(mate,345,285,'CB');this.resetActor(carrier,690,410,'CAM');this.resetActor(runner,610,250,'ST');this.resetBall(carrier.x-18,carrier.y);q.possessionId=carrier.id;q.objective=this.drill.objective;q.passSent=false;q.runnerId=runner.id;q.wonBall=false;
  }else if(k==='def-build'){
    this.activate(2,2);const press=this.defenders[0],cover=this.defenders[1];tune(this.player,'CB');tune(this.mates[0],'CM',{passing:73,vision:74});tune(this.mates[1],'RB',{pace:72,passing:69});tune(press,'ST',{pace:74,physical:69,defense:62});tune(cover,'CM',{pace:68,defense:67});
    this.resetActor(this.player,245,350,'CB');this.resetActor(this.mates[0],515,260,'CM');this.resetActor(this.mates[1],500,470,'RB');this.resetActor(press,405,350,'ST');this.resetActor(cover,610,355,'CM');this.resetBall(264,350);q.possessionId=this.player.id;q.objective=this.drill.objective;q.buildPass=false;q.wonBall=false;
  }else if(k==='gk-shot'){
    this.activate(0,1);const shooter=this.defenders[0];tune(this.player,'GK');tune(shooter,'ST',{shooting:76,composure:72,ballControl:70});
    this.resetActor(this.player,96,350,'GK');this.resetActor(shooter,510,310+(rep%3)*40,'ST');this.resetBall(shooter.x-18,shooter.y);q.possessionId=shooter.id;q.objective=this.drill.objective;q.shotStarted=false;q.saved=false;q.startTouch=this.ball.lastTouchTick;
  }else if(k==='gk-cross'){
    this.activate(0,3);const crosser=this.defenders[0],a1=this.defenders[1],a2=this.defenders[2];tune(this.player,'GK');tune(crosser,'RW',{passing:75,vision:73});tune(a1,'ST',{pace:72,shooting:74});tune(a2,'LW',{pace:74,shooting:70});
    this.resetActor(this.player,96,350,'GK');this.resetActor(crosser,520,110+(rep%2)*480,'RW');this.resetActor(a1,300,315,'ST');this.resetActor(a2,335,395,'LW');this.resetBall(crosser.x-18,crosser.y);q.possessionId=crosser.id;q.objective=this.drill.objective;q.crossSent=false;q.saved=false;
  }else if(k==='gk-sweep'){
    this.activate(0,2);const passer=this.defenders[0],runner=this.defenders[1];tune(this.player,'GK');tune(passer,'CAM',{passing:76,vision:76});tune(runner,'ST',{pace:80,shooting:72});
    this.resetActor(this.player,96,350,'GK');this.resetActor(passer,690,420,'CAM');this.resetActor(runner,505,300,'ST');this.resetBall(passer.x-18,passer.y);q.possessionId=passer.id;q.objective=this.drill.objective;q.passSent=false;q.saved=false;
  }else if(k==='gk-distribution'){
    this.activate(2,2);const p1=this.defenders[0],p2=this.defenders[1];tune(this.player,'GK');tune(this.mates[0],'CB',{passing:70,vision:68});tune(this.mates[1],'CM',{passing:74,vision:76});tune(p1,'ST',{pace:74});tune(p2,'CAM',{pace:70,vision:72});
    this.resetActor(this.player,115,350,'GK');this.resetActor(this.mates[0],335,235,'CB');this.resetActor(this.mates[1],430,455,'CM');this.resetActor(p1,300,350,'ST');this.resetActor(p2,520,400,'CAM');this.resetBall(135,350);q.possessionId=this.player.id;q.objective=this.drill.objective;q.distributed=false;
  }else if(this.drill?.frameworkVersion===2&&q){q.objective=this.drill.objective||q.objective;}
  return out;
};

function defend1v1(e,dt){
  const q=e.trainingQualityV6,a=e.defenders[0],goal={x:FIELD.left-24,y:FIELD.centerY};q.phase=q.wonBall?'Salida tras recuperar':'Temporizar y orientar';
  if(!q.shotStarted){e.dribbleTo(a,{x:245,y:clamp(a.y+(e.player.y>a.y?-40:40),180,520)},dt);if(a.x<340)q.shotStarted=e.tryKick(a,{x:FIELD.left-26,y:safeY(e.player.y<FIELD.centerY?FIELD.goalBottom-24:FIELD.goalTop+24)},7.2,'shot',null,dt);}
  const contain={x:clamp(e.ball.x-64,170,430),y:clamp(e.ball.y+(e.ball.y>FIELD.centerY?-24:24),170,530)};e.move(e.player,contain,dt);
  if(e.ball.lastPlayerId===e.player.id){q.wonBall=true;q.repSuccess=true;e.trainingMetricsV6.duelsBeaten++;}
  if(leftGoal(e)){q.repSuccess=false;q.phase='Remate concedido';}
  if(q.wonBall)e.move(e.player,{x:e.player.x+90,y:e.player.y},dt);
}
function defendCover(e,dt){
  const q=e.trainingQualityV6,carrier=e.defenders[0],runner=e.defenders[1],mate=e.mates[0];q.phase=q.passSent?'Cubrir ruptura':'Proteger profundidad';
  e.move(mate,{x:clamp(e.ball.x-75,250,430),y:e.ball.y+20},dt);e.move(runner,{x:220,y:runner.y+10},dt);
  if(!q.passSent){e.dribbleTo(carrier,{x:545,y:390},dt);if(carrier.x<575){q.passSent=e.tryKick(carrier,{x:runner.x-115,y:runner.y},6.2,'through',runner,dt);if(q.passSent)e.pending(carrier,runner,'through');}}
  const cover={x:clamp(runner.x-95,170,390),y:clamp(runner.y+(runner.y<FIELD.centerY?34:-34),180,520)};e.move(e.player,cover,dt);
  if(q.pendingPass)e.move(runner,e.projectedIntercept(runner),dt);else if(q.passSent)e.dribbleTo(runner,{x:180,y:FIELD.centerY},dt);
  if(e.ball.lastPlayerId===e.player.id){q.wonBall=true;q.repSuccess=true;}
  if(leftGoal(e)){q.repSuccess=false;q.phase='Profundidad perdida';}
}
function defendBuild(e,dt){
  const q=e.trainingQualityV6,[m1,m2]=e.mates,[press,cover]=e.defenders;q.phase=q.buildPass?'Dar continuidad':'Perfilar y superar presión';
  e.move(press,{x:e.ball.x+18,y:e.ball.y},dt);e.move(cover,{x:565,y:350},dt);e.move(m1,{x:520,y:225},dt);e.move(m2,{x:505,y:475},dt);
  if(!q.buildPass){const options=[m1,m2].sort((a,b)=>dist(b,press)-dist(a,press)),receiver=options[0];q.buildPass=e.tryKick(e.player,receiver,5.7,'pass',receiver,dt);if(q.buildPass)e.pending(e.player,receiver,'pass');}
  if(q.pendingPass){const receiver=[m1,m2].find(p=>p.id===q.pendingPass.to);if(receiver)e.move(receiver,e.projectedIntercept(receiver),dt);}
  if(q.buildPass&&!q.pendingPass&&[m1,m2].some(p=>p.id===q.possessionId)){q.repSuccess=true;q.phase='Primera presión superada';}
}
function keeperShot(e,dt){
  const q=e.trainingQualityV6,s=e.defenders[0];q.phase=q.shotStarted?'Atacar trayectoria':'Set y lectura';
  if(!q.shotStarted){e.move(e.player,{x:96,y:safeY(s.y)},dt);q.shotStarted=e.tryKick(s,{x:FIELD.left-25,y:safeY(330+(e.rep%2)*48)},7.5,'shot',null,dt);return;}
  const target=e.projectedIntercept(e.player);e.move(e.player,{x:clamp(target.x,72,180),y:clamp(target.y,245,455)},dt);
  if(e.ball.lastPlayerId===e.player.id){q.saved=true;q.repSuccess=true;q.phase='Atajada';}
  if(leftGoal(e)){q.repSuccess=false;q.phase='Gol recibido';}
}
function keeperCross(e,dt){
  const q=e.trainingQualityV6,[crosser,a1,a2]=e.defenders;q.phase=q.crossSent?'Leer punto de caída':'Ajustar posición';
  e.move(a1,{x:180,y:320},dt);e.move(a2,{x:210,y:395},dt);e.move(e.player,{x:105,y:clamp((a1.y+a2.y)/2,300,400)},dt);
  if(!q.crossSent){const target={x:170,y:e.rep%2?315:390};q.crossSent=e.tryKick(crosser,target,6.4,'cross',a1,dt);if(q.crossSent)e.pending(crosser,a1,'cross');return;}
  const target=e.projectedIntercept(e.player),claimable=target.x<235;e.move(e.player,claimable?target:{x:105,y:safeY(e.ball.y)},dt);
  if(e.ball.lastPlayerId===e.player.id){q.saved=true;q.repSuccess=true;q.phase='Área dominada';}
  if(leftGoal(e)){q.repSuccess=false;}
}
function keeperSweep(e,dt){
  const q=e.trainingQualityV6,[passer,runner]=e.defenders;q.phase=q.passSent?'Decidir salida':'Leer profundidad';
  e.move(runner,{x:225,y:runner.y},dt);if(!q.passSent){q.passSent=e.tryKick(passer,{x:220,y:runner.y},6.3,'through',runner,dt);if(q.passSent)e.pending(passer,runner,'through');return;}
  const target=e.projectedIntercept(e.player),advantage=target.x<260;e.move(e.player,advantage?target:{x:100,y:safeY(e.ball.y)},dt);if(q.pendingPass)e.move(runner,e.projectedIntercept(runner),dt);
  if(e.ball.lastPlayerId===e.player.id){q.saved=true;q.repSuccess=true;q.phase='Profundidad controlada';}
  if(leftGoal(e)){q.repSuccess=false;}
}
function keeperDistribution(e,dt){
  const q=e.trainingQualityV6,[m1,m2]=e.mates,[p1,p2]=e.defenders;q.phase=q.distributed?'Sostener salida':'Escanear primera presión';
  e.move(p1,{x:255,y:350},dt);e.move(p2,{x:415,y:390},dt);e.move(m1,{x:345,y:215},dt);e.move(m2,{x:470,y:470},dt);
  if(!q.distributed){const pressure=p=>Math.min(dist(p,p1),dist(p,p2)),receiver=[m1,m2].sort((a,b)=>pressure(b)-pressure(a))[0];q.distributed=e.tryKick(e.player,receiver,5.8,'pass',receiver,dt);if(q.distributed)e.pending(e.player,receiver,'pass');return;}
  if(q.pendingPass){const r=[m1,m2].find(p=>p.id===q.pendingPass.to);if(r)e.move(r,e.projectedIntercept(r),dt);return;}
  if([m1,m2].some(p=>p.id===q.possessionId)){q.repSuccess=true;q.phase='Salida limpia';}
}

const previousScenario=TrainingMatchEngine.prototype.scenario;
TrainingMatchEngine.prototype.scenario=function roleSpecificScenario(dt){
  switch(this.drill?.kind){
    case'def-1v1':return defend1v1(this,dt);case'def-cover':return defendCover(this,dt);case'def-build':return defendBuild(this,dt);
    case'gk-shot':return keeperShot(this,dt);case'gk-cross':return keeperCross(this,dt);case'gk-sweep':return keeperSweep(this,dt);case'gk-distribution':return keeperDistribution(this,dt);
    default:return previousScenario.call(this,dt);
  }
};

const previousResult=TrainingMatchEngine.prototype.sessionResult;
TrainingMatchEngine.prototype.sessionResult=function roleSpecificResult(){const out=previousResult.call(this);return{...out,markers:trainingMarkerSnapshot(this,this.drill)};};

export const __trainingRoleScenariosV1={defend1v1,defendCover,defendBuild,keeperShot,keeperCross,keeperSweep,keeperDistribution,leftGoal};
