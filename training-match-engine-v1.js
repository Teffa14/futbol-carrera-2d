import {MatchEngine} from './engine.js';
import {predictBallPath,bestReachableTrajectoryPoint} from './trajectory-core-v1.js';

const FIELD={left:55,right:1045,top:45,bottom:655,goalTop:295,goalBottom:405,goalDepth:46,centerX:550,centerY:350};
const REP={cones:6.4,'1v1':7.2,'2v2':8.2,'3v3':9.0,through:7.5,cross:8.0,finish:7.0,'free-kick':5.8};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
const gradeFor=q=>q>=91?'S':q>=82?'A':q>=72?'B':q>=62?'C':q>=52?'D':'E';

function basePlayer(data={},fallback={}){
  return{
    name:data.name||fallback.name||'Jugador',instanceId:data.instanceId||fallback.instanceId,
    engineRole:data.engineRole||data.position||fallback.engineRole||'CM',position:data.position||data.engineRole||fallback.engineRole||'CM',
    pace:data.pace??fallback.pace??72,shooting:data.shooting??fallback.shooting??68,passing:data.passing??fallback.passing??72,
    dribbling:data.dribbling??fallback.dribbling??72,defense:data.defense??fallback.defense??62,physical:data.physical??fallback.physical??68,
    ballControl:data.ballControl??fallback.ballControl??72,vision:data.vision??fallback.vision??70,stamina:data.stamina??fallback.stamina??74,
    composure:data.composure??fallback.composure??70,fitness:100,skills:Array.isArray(data.skills)?data.skills:[],build:data.build||null,
  };
}
function generic(name,id,role,stats={}){return basePlayer(stats,{name,instanceId:id,engineRole:role});}
function makeLineups(player){
  const user=basePlayer(player,{name:player?.name||'TU JUGADOR',instanceId:'training-user',engineRole:player?.position||'CM'});user.instanceId='training-user';
  return{
    home:[user,generic('Compañero 1','training-m1','CM',{passing:76,vision:74}),generic('Compañero 2','training-m2','RW',{pace:78,dribbling:75}),generic('Compañero 3','training-m3','ST',{pace:77,shooting:75})],
    away:[generic('Defensor 1','training-d1','CB',{defense:72,physical:72}),generic('Defensor 2','training-d2','CB',{defense:74,physical:70}),generic('Defensor 3','training-d3','LB',{pace:74,defense:70}),generic('Defensor 4','training-d4','RB',{pace:73,defense:71}),generic('Arquero','training-gk','GK',{defense:78,physical:76,pace:62})],
  };
}
function freshMetrics(){return{gatesCleared:0,duelsBeaten:0,passesAttempted:0,passesCompleted:0,timedRuns:0,throughReceptions:0,deliveries:0,deliveryReceptions:0,shots:0,goals:0,wallBeats:0,branches:new Set(),receivers:new Set(),serviceTypes:new Set(),targetZones:new Set(),deliveryChoices:new Set(),physicalTouches:0};}
function freshQuality(){return{activeRep:0,finalizedRep:-1,repResults:[],repSuccess:false,phase:'Preparar',objective:'',branch:null,pendingPass:null,lastObservedTouch:null,gateIndex:0,completedInRep:0,firstPass:false,returnPass:false,wallComplete:false,runnerStarted:false,passReleased:false,deliveryChoice:null,delivered:false,service:false,finishShot:false,beatDefender:false,goal:false,possessionId:'training-user'};}

export class TrainingMatchEngine extends MatchEngine{
  constructor(drill,result,player){
    const lineups=makeLineups(player);
    super(lineups.home,lineups.away,{userId:'training-user',seed:result?.seed||drill?.id||'training',homeName:'Entrenamiento',awayName:'Oposición'});
    this.drill=drill;this.result=result;this.playerData=player||{};this.trainingUsesMatchEngine=true;
    this.fullPlayers=[...this.players];this.homePool=this.fullPlayers.filter(p=>p.team===0);this.awayPool=this.fullPlayers.filter(p=>p.team===1);
    this.player=this.homePool[0];this.matePool=this.homePool.slice(1);this.defenderPool=this.awayPool;this.mates=[];this.defenders=[];this.cones=[];
    this.time=0;this.rep=0;this.repStart=0;this.repLength=REP[drill?.kind]||6.5;this.duration=this.repLength*Math.max(1,result?.reps||1);this.finished=false;this.restart=null;this.minute=0;
    this.trainingMetricsV6=freshMetrics();this.trainingQualityV6=freshQuality();this.trainingMetricsV5=this.trainingMetricsV6;this.trainingQualityV5=this.trainingQualityV6;this.trainingMetricsV4=this.trainingMetricsV6;this.trainingQualityV4=this.trainingQualityV6;
    this.metrics={kicks:0,touches:0,repResets:0,maxBallSpeed:0,trajectoryReads:0,maxPlayerTravel:0,maxBallTravel:0};this.repOrigin={px:0,py:0,bx:0,by:0};this.flashText='';this.flashTimer=0;this.lastTrainingKick=null;this._moved=new Set();
    this.resetRep(0,true);
  }

  progress(){return clamp(this.time/this.duration,0,1);}
  repProgress(){return clamp((this.time-this.repStart)/this.repLength,0,1);}
  repGood(){return !!this.trainingQualityV6.repSuccess;}
  allActors(){return[this.player,...this.mates,...this.defenders];}
  flashTraining(text){this.flashText=text;this.flashTimer=.45;}

  resetActor(p,x,y,role=null){
    if(!p)return;p.x=x;p.y=y;p.homeX=x;p.homeY=y;p.vx=0;p.vy=0;p.fatigue=0;p.kickIntent=null;p.dribbleIntent=null;p.kickCooldown=0;p.touchCooldown=0;p.decisionCooldown=0;p.duelCooldown=0;p.burstTimer=0;p.action='';p.actionTimer=0;
    const dir=p.team===0?1:-1;p.facingX=dir;p.facingY=0;p.desiredFacingX=dir;p.desiredFacingY=0;if(role){p.role=role;p.data.engineRole=role;}
  }
  activate(mates,defenders){this.mates=this.matePool.slice(0,mates);this.defenders=this.defenderPool.slice(0,defenders);this.players=[this.player,...this.mates,...this.defenders];}
  resetBall(x,y){Object.assign(this.ball,{x,y,vx:0,vy:0,lastTeam:null,lastPlayerId:null,passerId:null,intendedReceiverId:null,shotById:null,assistCandidateId:null,lastTouchTick:this.tick,lastActor:null,lastKick:null});this.lastTrainingKick=null;}
  resetQuality(rep){
    const q=this.trainingQualityV6;Object.assign(q,{activeRep:rep,repSuccess:false,phase:'Preparar',objective:'',branch:null,pendingPass:null,lastObservedTouch:null,gateIndex:0,completedInRep:0,firstPass:false,returnPass:false,wallComplete:false,runnerStarted:false,passReleased:false,deliveryChoice:null,delivered:false,service:false,finishShot:false,beatDefender:false,goal:false,possessionId:'training-user'});
  }
  finalizeRep(){const q=this.trainingQualityV6;if(q.finalizedRep===q.activeRep)return;q.repResults.push({rep:q.activeRep,success:!!q.repSuccess,branch:q.branch||null,phase:q.phase});q.finalizedRep=q.activeRep;}
  resetRep(rep,initial=false){
    if(!initial)this.finalizeRep();this.rep=rep;this.repStart=rep*this.repLength;if(!initial)this.metrics.repResets++;this.resetQuality(rep);this.cones=[];const q=this.trainingQualityV6,k=this.drill?.kind;
    if(k==='cones'){
      this.activate(0,0);const flip=rep%2?1:-1;this.resetActor(this.player,150,535,'CM');this.resetBall(167,535);q.gates=[{x:235,y:510},{x:315,y:455+flip*24},{x:395,y:395-flip*28},{x:485,y:330+flip*20}].map(g=>({...g,w:54}));this.cones=q.gates.flatMap(g=>[{x:g.x,y:g.y-g.w/2},{x:g.x,y:g.y+g.w/2}]);q.objective='Encadená cuatro puertas con los mismos contactos físicos del partido';
    }else if(k==='1v1'){
      this.activate(0,1);const side=rep%2?1:-1;this.resetActor(this.player,275,350+side*105,'RW');this.resetActor(this.defenders[0],520,350+side*30,'CB');this.resetBall(292,this.player.y);q.objective='Fijá al defensor, ganá un lado con contactos reales y finalizá';
    }else if(k==='2v2'){
      this.activate(1,2);this.resetActor(this.player,270,500,'CM');this.resetActor(this.mates[0],455,255,'CM');this.resetActor(this.defenders[0],430,455,'CB');this.resetActor(this.defenders[1],650,330,'CB');this.resetBall(287,500);q.objective='Atraé, soltá y atacá la devolución usando la física completa del partido';
    }else if(k==='3v3'){
      this.activate(2,3);this.resetActor(this.player,265,505,'CM');this.resetActor(this.mates[0],455,235,'CM');this.resetActor(this.mates[1],505,500,'RW');this.resetActor(this.defenders[0],430,430,'CB');this.resetActor(this.defenders[1],605,300,'CB');this.resetActor(this.defenders[2],720,455,'LB');this.resetBall(282,505);q.objective='Circulá entre varios receptores y progresá cuando la presión se desplace';
    }else if(k==='through'){
      this.activate(1,2);const shift=rep%2?45:-45;this.resetActor(this.player,335,500,'CAM');this.resetActor(this.mates[0],555,350+shift,'ST');this.resetActor(this.defenders[0],705,285+shift*.25,'CB');this.resetActor(this.defenders[1],705,415+shift*.25,'CB');this.resetBall(352,500);q.lineX=705;q.objective='Temporizá la ruptura y ejecutá el pase profundo con el mismo kick del partido';
    }else if(k==='cross'){
      this.activate(3,2);this.resetActor(this.player,620,580,'RW');this.resetActor(this.mates[0],855,315,'ST');this.resetActor(this.mates[1],875,385,'ST');this.resetActor(this.mates[2],770,470,'CAM');const blocked=rep%3===1;this.resetActor(this.defenders[0],blocked?715:760,blocked?555:455,'RB');this.resetActor(this.defenders[1],850,350,'CB');this.resetBall(637,580);q.objective='Desbordá y elegí centro o cutback según la geometría real de los defensores';
    }else if(k==='finish'){
      this.activate(1,2);this.resetActor(this.player,700,385,'ST');this.resetActor(this.mates[0],455,535,'CM');this.resetActor(this.defenders[0],790,385,'CB');this.resetActor(this.defenders[1],1015,rep%2?330:375,'GK');this.resetBall(472,535);q.serviceType=['cutback','through','cross'][rep%3];this.trainingMetricsV6.serviceTypes.add(q.serviceType);q.objective='Leé el servicio, atacá la trayectoria y definí contra un arquero físico';
    }else if(k==='free-kick'){
      this.activate(0,5);const shift=(rep%3-1)*16;this.resetActor(this.player,510,350+shift,'CAM');this.resetBall(532,350+shift);[0,1,2,3].forEach((i)=>this.resetActor(this.defenders[i],755,305+shift+i*30,'CB'));this.resetActor(this.defenders[4],1018,rep%2?330:375,'GK');q.objective='Leé barrera y arquero y ejecutá el tiro con el mismo facing y contacto del partido';
    }else{this.activate(0,0);this.resetActor(this.player,260,450,'CM');this.resetBall(277,450);q.objective='Trabajo técnico con física de partido';}
    this.players.forEach(p=>{p.perf.rating=6;});this.repOrigin={px:this.player.x,py:this.player.y,bx:this.ball.x,by:this.ball.y};
  }

  move(p,target,dt){if(!p||!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))return;this._moved.add(p.id);this.movePlayer(p,target,dt,false);}
  defend(p,target,dt){this.move(p,target,dt);}
  dribbleTo(p,target,dt){
    if(!p||!target)return;const d=unit(target.x-this.ball.x,target.y-this.ball.y),contact=p.r+this.ball.r+1.2,ballDist=dist(p,this.ball);p.dribbleIntent={targetX:target.x,targetY:target.y,ttl:.22};
    if(ballDist>contact+8)this.move(p,{x:this.ball.x-d.x*(p.r+this.ball.r-.8),y:this.ball.y-d.y*(p.r+this.ball.r-.8)},dt);else this.move(p,target,dt);
  }
  tryKick(p,target,power,kind='pass',receiver=null,dt=.016){
    if(this.lastTrainingKick?.rep===this.rep&&this.lastTrainingKick.by===p.id&&this.lastTrainingKick.kind===kind)return true;
    const d=unit(target.x-this.ball.x,target.y-this.ball.y),contact=p.r+this.ball.r-.6,spot={x:this.ball.x-d.x*contact,y:this.ball.y-d.y*contact};
    if(!p.kickIntent)this.armKick(p,target,power,(kind==='shot'||kind==='free-kick')?'shot':'pass',{receiverId:receiver?.id||null,trainingKind:kind});
    this.move(p,dist(p,this.ball)>p.r+this.ball.r+1.5?spot:{x:this.ball.x+d.x*22,y:this.ball.y+d.y*22},dt);return false;
  }
  registerPhysicalTouch(p,type='touch'){
    const trainingKind=type==='kick'?(p.kickIntent?.trainingKind||p.kickIntent?.type||'kick'):null;super.registerPhysicalTouch(p,type);this.ball.lastActor=p;this.trainingMetricsV6.physicalTouches++;
    if(trainingKind){this.ball.lastKick=trainingKind;this.lastTrainingKick={tick:this.tick,rep:this.rep,by:p.id,kind:trainingKind};this.metrics.kicks++;if(['pass','wall','third-man','through','cross','cutback','service'].includes(trainingKind))this.trainingMetricsV6.passesAttempted++;if(['shot','free-kick'].includes(trainingKind))this.trainingMetricsV6.shots++;}
    this.metrics.touches++;
  }
  projectedIntercept(p){
    const path=predictBallPath(this.ball,{field:FIELD,horizonFrames:110,sampleEvery:2});const pace=p?.data?.pace??70,reaction=(p?.data?.vision??65)*.35+(p?.data?.composure??65)*.25+(p?.data?.ballControl??65)*.2+pace*.2;this.metrics.trajectoryReads++;return bestReachableTrajectoryPoint(p,path,{acceleration:reaction,sprintSpeed:pace,reaction},{minFrame:2,maxFrame:100,slackFrames:3})||path[Math.min(path.length-1,5)]||{x:this.ball.x,y:this.ball.y};
  }
  observeTouches(){
    const q=this.trainingQualityV6,id=this.ball.lastPlayerId;if(!id||id===q.lastObservedTouch)return;q.lastObservedTouch=id;q.possessionId=id;
    if(q.pendingPass?.to===id){this.trainingMetricsV6.passesCompleted++;this.trainingMetricsV6.receivers.add(id);q.completedInRep++;if(q.pendingPass.kind==='through'&&this.ball.x>q.lineX)this.trainingMetricsV6.throughReceptions++;if(q.pendingPass.kind==='cross'||q.pendingPass.kind==='cutback')this.trainingMetricsV6.deliveryReceptions++;q.pendingPass=null;}
  }
  pending(from,to,kind){this.trainingQualityV6.pendingPass={from:from.id,to:to.id,kind};}
  branch(name){this.trainingQualityV6.branch=name;this.trainingMetricsV6.branches.add(name);}
  goalScored(){return this.ball.x>FIELD.right+9&&this.ball.y>FIELD.goalTop&&this.ball.y<FIELD.goalBottom;}

  scenario(dt){
    const q=this.trainingQualityV6,m=this.trainingMetricsV6,k=this.drill?.kind;
    if(k==='cones'){
      const g=q.gates[q.gateIndex];q.phase=g?`Puerta ${q.gateIndex+1}/${q.gates.length}`:'Aceleración de salida';if(!g){q.repSuccess=true;this.dribbleTo(this.player,{x:610,y:300},dt);return;}this.dribbleTo(this.player,g,dt);if(Math.abs(this.ball.x-g.x)<28&&Math.abs(this.ball.y-g.y)<g.w*.55){q.gateIndex++;m.gatesCleared++;this.flashTraining('TOQUE');}return;
    }
    if(k==='1v1'){
      const d=this.defenders[0];if(!q.branch&&d.x-this.ball.x<155){const lane=this.ball.y>d.y?'outside':'inside';this.branch(lane);q.target={x:690,y:clamp(this.ball.y+(lane==='outside'?115:-115),120,580)};}if(!q.branch){q.phase='Fijar defensor';this.dribbleTo(this.player,{x:430,y:this.ball.y},dt);}else{q.phase=q.beatDefender?'Atacar arco':`Salir por ${q.branch}`;this.dribbleTo(this.player,q.target,dt);}const force=q.branch==='outside'?-35:35;this.defend(d,{x:this.ball.x+48,y:clamp(this.ball.y+force,100,600)},dt);if(!q.beatDefender&&q.branch&&(this.ball.x>d.x+10||(this.ball.x>d.x-18&&Math.abs(this.ball.y-d.y)>95))){q.beatDefender=true;m.duelsBeaten++;this.flashTraining('SUPERADO');}if(q.beatDefender&&!q.finishShot)q.finishShot=this.tryKick(this.player,{x:FIELD.right+28,y:this.ball.y<FIELD.centerY?FIELD.goalBottom-24:FIELD.goalTop+24},7.4,'shot',null,dt);if(this.goalScored()){q.goal=true;q.repSuccess=true;m.goals++;}return;
    }
    if(k==='2v2'){
      const mate=this.mates[0],[d1,d2]=this.defenders;this.defend(d1,{x:this.ball.x+40,y:this.ball.y-8},dt);this.defend(d2,{x:650,y:330},dt);if(!q.firstPass){q.phase='Atraer y soltar';this.move(mate,{x:455,y:255},dt);if(dist(d1,this.ball)>82){this.dribbleTo(this.player,{x:365,y:475},dt);return;}if(!q.branch)this.branch('wall');q.firstPass=this.tryKick(this.player,mate,5.4,'pass',mate,dt);if(q.firstPass)this.pending(this.player,mate,'pass');return;}if(q.pendingPass){q.phase='Recibir bajo presión';this.move(mate,this.projectedIntercept(mate),dt);this.move(this.player,{x:590,y:485},dt);return;}if(q.possessionId===mate.id&&!q.returnPass){q.phase='Devolución al espacio';this.move(this.player,{x:620,y:475},dt);q.returnPass=this.tryKick(mate,{x:this.player.x+45,y:this.player.y},5.5,'wall',this.player,dt);if(q.returnPass)this.pending(mate,this.player,'wall');return;}if(q.returnPass&&q.pendingPass){q.phase='Atacar devolución';this.move(this.player,this.projectedIntercept(this.player),dt);return;}if(q.returnPass&&q.possessionId===this.player.id){if(!q.wallComplete){q.wallComplete=true;m.wallBeats++;}q.phase='Ventaja creada';this.dribbleTo(this.player,{x:810,y:370},dt);if(this.ball.x>760)q.repSuccess=true;}return;
    }
    if(k==='3v3'){
      const attack=[this.player,...this.mates];this.defenders.forEach((d,i)=>this.defend(d,i===0?{x:this.ball.x+38,y:this.ball.y}:{x:600+i*70,y:280+i*85},dt));if(q.pendingPass){q.phase='Atacar línea de pase';const r=attack.find(p=>p.id===q.pendingPass.to);if(r)this.move(r,this.projectedIntercept(r),dt);attack.filter(p=>p!==r).forEach((p,i)=>this.move(p,{x:clamp(this.ball.x+90+i*70,180,800),y:220+i*190},dt));return;}const holder=attack.find(p=>p.id===q.possessionId)||this.player;if(q.completedInRep>=3){q.phase='Progresar tras mover presión';this.dribbleTo(holder,{x:820,y:350},dt);if(this.ball.x>765)q.repSuccess=true;return;}q.phase='Circular y atraer';if(dist(holder,this.ball)>holder.r+this.ball.r+5){this.move(holder,this.projectedIntercept(holder),dt);return;}const options=attack.filter(p=>p!==holder).sort((a,b)=>dist(b,this.defenders[0])-dist(a,this.defenders[0]));const receiver=options[q.completedInRep%options.length];if(receiver&&this.tryKick(holder,receiver,5.4,'pass',receiver,dt)){this.pending(holder,receiver,'pass');}return;
    }
    if(k==='through'){
      const runner=this.mates[0];this.defenders.forEach((d,i)=>this.defend(d,{x:q.lineX,y:i?430:285},dt));if(!q.runnerStarted){q.phase='Fijar línea defensiva';this.dribbleTo(this.player,{x:500,y:485},dt);this.move(runner,{x:q.lineX-55,y:runner.y},dt);if(this.ball.x>455){q.runnerStarted=true;m.timedRuns++;}return;}this.move(runner,{x:900,y:runner.y-25},dt);if(!q.passReleased){q.phase='Soltar en la ruptura';const lead={x:clamp(runner.x+115,FIELD.left+25,FIELD.right-25),y:runner.y};q.passReleased=this.tryKick(this.player,lead,6.0,'through',runner,dt);if(q.passReleased)this.pending(this.player,runner,'through');return;}if(q.pendingPass){q.phase='Atacar pase profundo';this.move(runner,this.projectedIntercept(runner),dt);return;}if(q.possessionId===runner.id&&this.ball.x>q.lineX){q.repSuccess=true;m.throughReceptions=Math.max(1,m.throughReceptions);}return;
    }
    if(k==='cross'){
      const [near,far,cutback]=this.mates,[wideDef,boxDef]=this.defenders;this.move(near,{x:885,y:320},dt);this.move(far,{x:900,y:390},dt);this.move(cutback,{x:790,y:470},dt);this.defend(wideDef,{x:this.ball.x+44,y:clamp(this.ball.y-30,120,610)},dt);this.defend(boxDef,{x:860,y:355},dt);if(!q.delivered){q.phase='Desbordar y leer área';this.dribbleTo(this.player,{x:835,y:575},dt);if(this.ball.x<770)return;const bylineBlocked=dist(wideDef,this.ball)<68,receiver=bylineBlocked?cutback:(dist(boxDef,near)<dist(boxDef,far)?far:near),kind=bylineBlocked?'cutback':'cross';if(!q.deliveryChoice){q.deliveryChoice=kind;m.deliveryChoices.add(kind);this.branch(kind);}q.delivered=this.tryKick(this.player,receiver,6.0,kind,receiver,dt);if(q.delivered){m.deliveries++;this.pending(this.player,receiver,kind);}return;}if(q.pendingPass){q.phase='Atacar entrega';const receiver=this.mates.find(p=>p.id===q.pendingPass.to);if(receiver)this.move(receiver,this.projectedIntercept(receiver),dt);return;}if(this.mates.some(p=>p.id===q.possessionId)){q.repSuccess=true;}return;
    }
    if(k==='finish'){
      const server=this.mates[0],[marker,keeper]=this.defenders;this.defend(marker,{x:this.player.x+42,y:this.player.y},dt);this.defend(keeper,{x:1018,y:clamp(this.ball.y,FIELD.goalTop+18,FIELD.goalBottom-18)},dt);if(!q.service){q.phase=`Servicio ${q.serviceType}`;const target=q.serviceType==='cutback'?{x:705,y:410}:q.serviceType==='through'?{x:755,y:360}:{x:735,y:330};q.service=this.tryKick(server,target,q.serviceType==='cross'?6.2:5.6,'service',this.player,dt);if(q.service)this.pending(server,this.player,'service');return;}if(q.pendingPass){q.phase='Leer trayectoria';this.move(this.player,this.projectedIntercept(this.player),dt);return;}if(q.possessionId===this.player.id&&!q.finishShot){q.phase='Definir';q.finishShot=this.tryKick(this.player,{x:FIELD.right+28,y:keeper.y<FIELD.centerY?FIELD.goalBottom-22:FIELD.goalTop+22},7.5,'shot',null,dt);return;}if(this.goalScored()){q.goal=true;q.repSuccess=true;m.goals++;}return;
    }
    if(k==='free-kick'){
      const keeper=this.defenders[4],upperGap=keeper.y>FIELD.centerY,targetY=upperGap?FIELD.goalTop+24:FIELD.goalBottom-24,zone=upperGap?'upper-corner':'lower-corner';q.phase='Leer barrera y arquero';if(!q.branch){this.branch(zone);m.targetZones.add(zone);}if(!q.finishShot)q.finishShot=this.tryKick(this.player,{x:FIELD.right+28,y:targetY},7.6,'free-kick',null,dt);if(this.goalScored()){q.goal=true;q.repSuccess=true;m.goals++;}return;
    }
  }

  step(dt){
    if(this.finished)return;dt=Math.min(.05,Math.max(.001,dt));this.tick++;this.time+=dt;this.minute=this.time;this.flashTimer=Math.max(0,this.flashTimer-dt);if(this.flashTimer<=0)this.flashText='';
    const nextRep=Math.min((this.result?.reps||1)-1,Math.floor(this.time/this.repLength));if(nextRep!==this.rep&&this.time<this.duration)this.resetRep(nextRep);
    this._moved=new Set();this.updateFreeBall(dt);this.resolvePostCollisions();this.observeTouches();this.scenario(dt);for(const p of this.players)if(!this._moved.has(p.id))this.movePlayer(p,{x:p.x,y:p.y},dt,false);this.resolvePlayerCollisions();this.resolveBallPlayerCollisions();this.observeTouches();
    this.metrics.maxBallSpeed=Math.max(this.metrics.maxBallSpeed,Math.hypot(this.ball.vx,this.ball.vy));this.metrics.maxPlayerTravel=Math.max(this.metrics.maxPlayerTravel,dist(this.player,{x:this.repOrigin.px,y:this.repOrigin.py}));this.metrics.maxBallTravel=Math.max(this.metrics.maxBallTravel,dist(this.ball,{x:this.repOrigin.bx,y:this.repOrigin.by}));
    if(this.time>=this.duration){this.time=this.duration;this.finalizeRep();this.finished=true;const out=this.sessionResult();this.flashTraining(`${out.grade} · ${out.quality}`);this.flashTimer=99;}
  }

  sessionResult(){
    const q=this.trainingQualityV6,reps=Math.max(1,this.result?.reps||1),successes=q.repResults.filter(r=>r.success).length+(q.finalizedRep!==q.activeRep&&q.repSuccess?1:0),successRate=successes/reps,baseline=clamp(Number(this.result?.quality)||65,35,99),quality=clamp(Math.round(baseline*.35+successRate*65),35,99);return{...this.result,drillId:this.drill?.id,actual:true,reps,successes,quality,grade:gradeFor(quality),repResults:[...q.repResults]};
  }

  draw(ctx,width=1100,height=700){
    super.draw(ctx,width,height,{camera:'wide'});ctx.save();for(const c of this.cones){ctx.fillStyle='#ff9b2f';ctx.beginPath();ctx.moveTo(c.x,c.y-10);ctx.lineTo(c.x-7,c.y+8);ctx.lineTo(c.x+7,c.y+8);ctx.closePath();ctx.fill();}
    const q=this.trainingQualityV6;ctx.fillStyle='rgba(5,15,10,.86)';ctx.fillRect(70,62,520,72);ctx.fillStyle='#d8ff4c';ctx.font='800 15px system-ui';ctx.textAlign='left';ctx.fillText(this.drill?.name||'Entrenamiento',86,86);ctx.fillStyle='#fff';ctx.font='13px system-ui';ctx.fillText(`${q.phase} · Rep ${Math.min(this.result?.reps||1,this.rep+1)}/${this.result?.reps||1}`,86,108);ctx.fillStyle='#b9c8c0';ctx.font='12px system-ui';ctx.fillText(String(q.objective||'').slice(0,78),86,126);if(this.flashText){ctx.textAlign='center';ctx.font='900 28px system-ui';ctx.fillStyle='#d8ff4c';ctx.fillText(this.flashText,FIELD.centerX,92);}ctx.restore();
  }
}

export const __trainingMatchEngineV1={FIELD,REP};