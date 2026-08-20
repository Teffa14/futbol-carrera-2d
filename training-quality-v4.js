import {TrainingEngine} from './training-engine-v1.js';

const LEFT=38,RIGHT=862,TOP=32,BOTTOM=488,CX=450,CY=260;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const actor=(x,y,role='mate',tag=role,r=9)=>({x,y,vx:0,vy:0,r,role,tag,kickCooldown:0,target:null});
const tagOf=a=>a?.tag||(a?.role==='user'?'user':null);
const gradeFor=q=>q>=91?'S':q>=82?'A':q>=72?'B':q>=62?'C':q>=52?'D':'E';
const repLengths={cones:4.4,'1v1':4.8,'2v2':5.4,'3v3':5.8,through:4.8,cross:5.6,finish:4.8,'free-kick':4.1};

function lineDistance(p,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,len=vx*vx+vy*vy||1,t=clamp((wx*vx+wy*vy)/len,0,1),x=a.x+vx*t,y=a.y+vy*t;return Math.hypot(p.x-x,p.y-y);}
function laneOpen(a,b,defs,width=28){return !defs.some(d=>lineDistance(d,a,b)<width&&dist(a,d)<dist(a,b)+35);}
function openness(a,defs){const nearest=defs.reduce((m,d)=>Math.min(m,dist(a,d)),999);return nearest;}
function nearestTo(point,list){return [...list].sort((a,b)=>dist(a,point)-dist(b,point))[0]||null;}
function resetDisc(engine,a,x,y){engine.resetActor(a,x,y);a.tag??=a.role;}

function ensureQuality(engine){
  if(engine.trainingQualityV4)return engine.trainingQualityV4;
  engine.trainingMetricsV4={
    gatesCleared:0,duelsBeaten:0,passesAttempted:0,passesCompleted:0,timedRuns:0,
    throughReceptions:0,deliveries:0,deliveryReceptions:0,shots:0,goals:0,wallBeats:0,
    branches:new Set(),receivers:new Set(),serviceTypes:new Set(),targetZones:new Set()
  };
  engine.trainingQualityV4={activeRep:0,finalizedRep:-1,repResults:[],repSuccess:false,phase:'Preparar',objective:'',branch:null,pendingPass:null,lastTouchTag:null,target:null,gateIndex:0};
  return engine.trainingQualityV4;
}
function resetRepState(engine,rep){
  const q=ensureQuality(engine);q.activeRep=rep;q.repSuccess=false;q.phase='Preparar';q.objective='';q.branch=null;q.pendingPass=null;q.lastTouchTag=null;q.target=null;q.gateIndex=0;q.completedInRep=0;q.shotOnTarget=false;q.beatDefender=false;q.runnerStarted=false;q.passReleased=false;q.deliveryChoice=null;q.serviceType=null;q.finishShot=false;q.goal=false;
}
function finalizeRep(engine){
  const q=ensureQuality(engine);if(q.finalizedRep===q.activeRep)return;
  q.repResults.push({rep:q.activeRep,success:!!q.repSuccess,branch:q.branch||null,phase:q.phase});q.finalizedRep=q.activeRep;
}
function markBranch(engine,name){const q=ensureQuality(engine),m=engine.trainingMetricsV4;q.branch=name;m.branches.add(name);}
function setPending(engine,from,to,kind){ensureQuality(engine).pendingPass={from:tagOf(from),to:tagOf(to),kind};}
function observeTouches(engine){
  const q=ensureQuality(engine),m=engine.trainingMetricsV4,a=engine.ball.lastActor,tag=tagOf(a);if(!tag||tag===q.lastTouchTag)return;
  if(q.pendingPass&&q.pendingPass.to===tag){m.passesCompleted++;m.receivers.add(tag);q.completedInRep++;q.pendingPass=null;}
  q.lastTouchTag=tag;
}
function attempt(engine,from,target,power,kind,toActor=null,scale=1){
  const ok=engine.approachKick(from,target,power,kind,scale);if(ok){const m=engine.trainingMetricsV4;if(['pass','wall','third-man','through','cross','cutback','service'].includes(kind))m.passesAttempted++;if(['shot','free-kick'].includes(kind))m.shots++;if(toActor)setPending(engine,from,toActor,kind);}return ok;
}
function defenderMove(engine,d,target,dt,scale=1){engine.move(d,target,dt,scale);}
function carrier(engine,attackers){const last=engine.ball.lastActor;return attackers.includes(last)?last:nearestTo(engine.ball,attackers);}

const previousReset=TrainingEngine.prototype.resetRep;
TrainingEngine.prototype.resetRep=function qualityReset(rep,initial=false){
  if(this.trainingQualityV4&&!initial)finalizeRep(this);
  const out=previousReset.call(this,rep,initial);ensureQuality(this);resetRepState(this,rep);
  this.repLength=Math.max(repLengths[this.drill?.kind]||3.8,Number(this.repLength)||0);this.duration=this.repLength*Math.max(1,this.result?.reps||1);
  this.player.tag='user';
  const q=this.trainingQualityV4,k=this.drill?.kind;
  if(k==='cones'){
    const flip=rep%2?1:-1,ys=[400,335,275,215,160,205].map((y,i)=>clamp(y+flip*(i%2?28:-18),90,430));
    q.gates=[190,300,415,535,650,770].map((x,i)=>({x,y:ys[i],w:34}));this.cones=q.gates.flatMap(g=>[{x:g.x,y:g.y-g.w/2},{x:g.x,y:g.y+g.w/2}]);
    resetDisc(this,this.player,110,400);Object.assign(this.ball,{x:126,y:400,vx:0,vy:0,lastActor:null,lastKick:null});q.objective='Superá 6 puertas sin perder la pelota';
  }else if(k==='1v1'){
    const side=rep%2?1:-1;resetDisc(this,this.player,145,CY+side*115);Object.assign(this.ball,{x:161,y:this.player.y,vx:0,vy:0,lastActor:null,lastKick:null});this.defenders=[actor(455,CY+side*32,'def','d1',10)];q.objective='Fijá al defensor, ganá un lado y terminá la acción';
  }else if(k==='2v2'){
    resetDisc(this,this.player,155,355);Object.assign(this.ball,{x:171,y:355,vx:0,vy:0,lastActor:null,lastKick:null});this.mates=[actor(390,210,'mate','m1')];this.defenders=[actor(410,330,'def','d1',10),actor(610,245,'def','d2',10)];q.objective='Atraé presión y resolvé con pared o pase al jugador libre';
  }else if(k==='3v3'){
    resetDisc(this,this.player,135,355);Object.assign(this.ball,{x:151,y:355,vx:0,vy:0,lastActor:null,lastKick:null});this.mates=[actor(335,175,'mate','m1'),actor(455,365,'mate','m2')];this.defenders=[actor(330,315,'def','d1',10),actor(500,225,'def','d2',10),actor(650,330,'def','d3',10)];q.objective='Conservá, mové la presión y progresá después de 3 pases';
  }else if(k==='through'){
    const spread=rep%2?35:-35;resetDisc(this,this.player,205,350);Object.assign(this.ball,{x:221,y:350,vx:0,vy:0,lastActor:null,lastKick:null});this.mates=[actor(455,260+spread,'runner','runner')];this.defenders=[actor(545,205+spread*.35,'def','d1',10),actor(545,330+spread*.25,'def','d2',10)];q.lineX=545;q.objective='Esperá la ruptura onside y soltá el pase al espacio';
  }else if(k==='cross'){
    resetDisc(this,this.player,490,430);Object.assign(this.ball,{x:506,y:430,vx:0,vy:0,lastActor:null,lastKick:null});this.mates=[actor(705,225,'runner','near'),actor(750,315,'runner','far'),actor(665,360,'runner','cutback')];const blockByline=rep%3===1;this.defenders=[actor(blockByline?620:675,blockByline?425:335,'def','wideDef',10),actor(735,270,'def','boxDef',10)];q.objective='Leé al defensor: fondo, centro o cutback según el espacio';
  }else if(k==='finish'){
    resetDisc(this,this.player,535,300);this.mates=[actor(300,385,'server','server')];this.defenders=[actor(675,285,'def','marker',10),actor(830,CY,'keeper','gk',11)];Object.assign(this.ball,{x:316,y:385,vx:0,vy:0,lastActor:null,lastKick:null});q.serviceType=['cutback','through','cross'][rep%3];q.objective='Leé el servicio, atacá su trayectoria y finalizá antes del cierre';this.trainingMetricsV4.serviceTypes.add(q.serviceType);
  }else if(k==='free-kick'){
    const yShift=(rep%3-1)*18;resetDisc(this,this.player,300,CY+yShift);Object.assign(this.ball,{x:345,y:CY+yShift,vx:0,vy:0,lastActor:null,lastKick:null});this.defenders=[actor(560,218+yShift,'wall','w1',9),actor(560,242+yShift,'wall','w2',9),actor(560,266+yShift,'wall','w3',9),actor(560,290+yShift,'wall','w4',9),actor(830,CY,'keeper','gk',11)];q.objective='Elegí el espacio que dejan barrera y arquero y superalos';
  }
  this.repOrigin={px:this.player.x,py:this.player.y,bx:this.ball.x,by:this.ball.y};return out;
};

function conesScenario(e,dt){const q=e.trainingQualityV4,m=e.trainingMetricsV4,g=q.gates[q.gateIndex];q.phase=`Puerta ${Math.min(q.gateIndex+1,q.gates.length)}/${q.gates.length}`;if(!g){q.repSuccess=true;q.phase='Salida limpia';e.dribbleTo(e.player,{x:820,y:220},dt);return;}e.dribbleTo(e.player,g,dt);if(Math.abs(e.ball.x-g.x)<22&&Math.abs(e.ball.y-g.y)<g.w*.46){q.gateIndex++;m.gatesCleared++;e.flash='PUERTA';e.flashTimer=.22;}}
function oneVOneScenario(e,dt){const q=e.trainingQualityV4,m=e.trainingMetricsV4,d=e.defenders[0],goal={x:852,y:CY};const dx=d.x-e.ball.x;if(!q.branch&&dx<185){const lane=d.y<e.ball.y?'outside':'inside';markBranch(e,lane);q.target={x:650,y:clamp(e.ball.y+(lane==='outside'?95:-95),95,425)};}if(!q.branch){q.phase='Fijar defensor';e.dribbleTo(e.player,{x:395,y:e.ball.y},dt);}else{q.phase=`Atacar ${q.branch}`;e.dribbleTo(e.player,q.target,dt);}const shade=q.branch==='outside'?-26:26;defenderMove(e,d,{x:e.ball.x+52,y:clamp(e.ball.y+shade,75,445)},dt,.98);if(!q.beatDefender&&e.ball.x>d.x+30){q.beatDefender=true;m.duelsBeaten++;}if(q.beatDefender&&!q.finishShot){const shotTarget={x:goal.x,y:clamp(CY+(e.ball.y<CY?55:-55),210,310)};q.finishShot=attempt(e,e.player,shotTarget,6.0,'shot',null,1.06);if(q.finishShot)q.phase='Finalizar';}if(q.finishShot&&e.ball.x>838&&e.ball.y>198&&e.ball.y<322){q.shotOnTarget=true;q.repSuccess=true;}}
function twoVTwoScenario(e,dt){const q=e.trainingQualityV4,m=e.trainingMetricsV4,mate=e.mates[0],[d1,d2]=e.defenders;observeTouches(e);defenderMove(e,d1,{x:e.ball.x+48,y:e.ball.y-10},dt,1.0);defenderMove(e,d2,{x:585,y:245},dt,.96);e.move(mate,{x:410,y:205+(e.ball.y>CY?20:-10)},dt,1.02);
  if(!q.branch&&dist(d1,e.ball)<145){const open=laneOpen(e.ball,mate,[d1,d2],34);markBranch(e,open?'wall':'carry-release');}
  if(!q.branch){q.phase='Atraer presión';e.dribbleTo(e.player,{x:330,y:330},dt);return;}
  if(q.branch==='carry-release'&&!q.firstPass){q.phase='Mover al primer defensor';e.dribbleTo(e.player,{x:430,y:390},dt);if(dist(d1,e.ball)<82&&laneOpen(e.ball,mate,[d2],38)){q.firstPass=attempt(e,e.player,mate,4.8,'pass',mate,1.05);}return;}
  if(!q.firstPass){q.phase='Soltar y romper';q.firstPass=attempt(e,e.player,mate,4.8,'pass',mate,1.05);e.move(e.player,{x:610,y:350},dt,1.06);return;}
  if(e.ball.lastActor===mate&&!q.returnPass){q.phase='Devolver al espacio';e.move(e.player,{x:650,y:335},dt,1.08);q.returnPass=attempt(e,mate,{x:e.player.x+70,y:e.player.y},5.0,'wall',e.player,1.06);return;}
  if(q.returnPass){q.phase='Atacar ventaja';const p=e.projectedIntercept(e.player);e.move(e.player,p,dt,1.09);if(e.ball.lastActor===e.player&&e.player.x>575){q.wallComplete=true;m.wallBeats++;e.dribbleTo(e.player,{x:805,y:280},dt);}if(q.wallComplete&&e.ball.x>740)q.repSuccess=true;}}
function threeVThreeScenario(e,dt){const q=e.trainingQualityV4,m=e.trainingMetricsV4,attackers=[e.player,...e.mates],defs=e.defenders;observeTouches(e);const c=carrier(e,attackers);q.phase=q.completedInRep>=3?'Progresar':'Circular y atraer';defs.forEach((d,i)=>{const target=i===0?e.ball:(i===1?attackers[(i+q.completedInRep)%attackers.length]:{x:610,y:CY});defenderMove(e,d,{x:target.x+34,y:target.y+(i-1)*18},dt,.98);});
  const support=attackers.filter(a=>a!==c);support.forEach((a,i)=>{const y=clamp(e.ball.y+(i?115:-115),85,435),x=clamp(e.ball.x+125+(i*45),120,760);e.move(a,{x,y},dt,1.02);});
  if(q.completedInRep>=3){if(c===e.player)e.dribbleTo(e.player,{x:810,y:CY},dt);else e.move(c,{x:790,y:CY},dt,1.05);if(e.ball.x>745){q.repSuccess=true;return;}}
  if(!c||dist(c,e.ball)>c.r+e.ball.r+8){e.move(c,e.projectedIntercept(c),dt,1.04);return;}
  if(c.kickCooldown>0)return;const candidates=support.map(a=>({a,score:openness(a,defs)+(a.x-c.x)*.22+(laneOpen(e.ball,a,defs,30)?55:-50)})).sort((a,b)=>b.score-a.score);const best=candidates[0]?.a;if(best&&candidates[0].score>40){const kicked=attempt(e,c,best,4.7,'pass',best,1.03);if(kicked){q.lastTouchTag=tagOf(c);m.receivers.add(tagOf(best));}}}
function throughScenario(e,dt){const q=e.trainingQualityV4,m=e.trainingMetricsV4,r=e.mates[0],[d1,d2]=e.defenders;const line=q.lineX;observeTouches(e);d1.x=line;d2.x=line;defenderMove(e,d1,{x:line,y:clamp(r.y-55,120,400)},dt,.72);defenderMove(e,d2,{x:line,y:clamp(r.y+65,120,400)},dt,.72);const ready=dist(e.player,e.ball)<28;
  if(!q.runnerStarted&&ready){q.runnerStarted=true;m.timedRuns++;q.phase='Ruptura en el hombro';}
  if(q.runnerStarted&&!q.passReleased){const channelY=(d1.y+d2.y)/2+(e.rep%2?38:-38);e.move(r,{x:line-18,y:channelY},dt,1.08);if(r.x>line-34){const lead={x:780,y:channelY};q.target=lead;q.passReleased=attempt(e,e.player,lead,5.7,'through',r,1.03);if(q.passReleased)q.phase='Pase al espacio';}else q.phase='Temporizar';}
  if(q.passReleased){const p=e.projectedIntercept(r);e.move(r,p,dt,1.1);d1.x=Math.max(line,d1.x);d2.x=Math.max(line,d2.x);if(e.ball.lastActor===r&&r.x>line+28){m.throughReceptions++;q.repSuccess=true;q.phase='Recepción detrás de línea';}}
  if(!q.runnerStarted)e.dribbleTo(e.player,{x:310,y:350},dt);}
function crossScenario(e,dt){const q=e.trainingQualityV4,m=e.trainingMetricsV4,[near,far,cutback]=e.mates,[wide,box]=e.defenders;observeTouches(e);e.move(near,{x:760,y:220},dt,1.06);e.move(far,{x:785,y:305},dt,1.04);e.move(cutback,{x:655,y:345},dt,1.03);defenderMove(e,wide,{x:clamp(e.ball.x+40,590,700),y:clamp(e.ball.y-28,315,435)},dt,1.0);defenderMove(e,box,{x:735,y:270},dt,.96);
  if(!q.deliveryChoice){q.phase='Desbordar y leer';e.dribbleTo(e.player,{x:650,y:430},dt);if(e.ball.x>600){const bylineBlocked=dist(wide,{x:e.ball.x+50,y:e.ball.y})<70;const farOpen=openness(far,[box])>openness(near,[box])+8;q.deliveryChoice=bylineBlocked?'cutback':(farOpen?'far-cross':'near-cross');markBranch(e,q.deliveryChoice);m.deliveryChoices??=new Set();m.deliveryChoices.add(q.deliveryChoice);}}
  if(q.deliveryChoice&&!q.delivered){let target,targetActor,kind='cross';if(q.deliveryChoice==='cutback'){target=cutback;targetActor=cutback;kind='cutback';}else if(q.deliveryChoice==='far-cross'){target={x:far.x+15,y:far.y};targetActor=far;}else{target={x:near.x+18,y:near.y};targetActor=near;}q.target=target;q.phase=q.deliveryChoice==='cutback'?'Pase atrás':'Centro al área';q.delivered=attempt(e,e.player,target,5.8,kind,targetActor,1.08);if(q.delivered)m.deliveries++;}
  if(q.delivered){for(const a of [near,far,cutback])e.move(a,e.projectedIntercept(a),dt,1.04);if([near,far,cutback].includes(e.ball.lastActor)){m.deliveryReceptions++;q.repSuccess=true;q.phase='Entrega encontrada';}}}
function finishingScenario(e,dt){const q=e.trainingQualityV4,m=e.trainingMetricsV4,server=e.mates[0],[marker,gk]=e.defenders;observeTouches(e);const type=q.serviceType;let serviceTarget;if(type==='cutback')serviceTarget={x:590,y:315};else if(type==='through')serviceTarget={x:665,y:250};else serviceTarget={x:620,y:210};defenderMove(e,marker,{x:e.player.x+50,y:e.player.y+12},dt,.94);defenderMove(e,gk,{x:830,y:clamp(e.ball.y,215,305)},dt,.82);
  if(!q.service){q.phase=`Servicio: ${type}`;q.service=attempt(e,server,serviceTarget,type==='cross'?5.4:5.0,'service',e.player,1.04);return;}
  if(!q.finishShot){const p=e.projectedIntercept(e.player);e.move(e.player,p,dt,1.1);if(e.ball.lastActor===e.player||dist(e.player,e.ball)<e.player.r+e.ball.r+3){const target={x:852,y:gk.y<CY?305:215};q.target=target;q.phase='Definir según arquero';q.finishShot=attempt(e,e.player,target,6.4,'shot',null,1.08);}return;}
  if(q.finishShot&&e.ball.x>838&&e.ball.y>198&&e.ball.y<322&&e.ball.lastActor!==gk){m.goals++;q.goal=true;q.repSuccess=true;q.phase='Finalización limpia';}}
function freeKickScenario(e,dt){const q=e.trainingQualityV4,m=e.trainingMetricsV4,gk=e.defenders.at(-1),wall=e.defenders.slice(0,-1);wall.forEach(w=>{w.vx=0;w.vy=0;});defenderMove(e,gk,{x:830,y:clamp(e.ball.y,215,305)},dt,.55);if(!q.target){const wallMean=wall.reduce((s,w)=>s+w.y,0)/wall.length,targetY=gk.y<=wallMean?305:215;q.target={x:852,y:targetY};m.targetZones.add(targetY<260?'top':'bottom');markBranch(e,targetY<260?'upper-corner':'lower-corner');}if(!q.finishShot){q.phase='Perfil y golpeo';q.finishShot=attempt(e,e.player,q.target,6.7,'free-kick',null,.98);return;}q.phase='Trayectoria';if(e.ball.lastActor&&wall.includes(e.ball.lastActor))q.wallHit=true;if(e.ball.x>838&&e.ball.y>198&&e.ball.y<322&&e.ball.lastActor!==gk&&!q.wallHit){m.goals++;q.repSuccess=true;q.phase='Superó barrera y arquero';}}

TrainingEngine.prototype.scenario=function objectiveDrivenScenario(dt){const q=ensureQuality(this);observeTouches(this);switch(this.drill?.kind){case'cones':return conesScenario(this,dt);case'1v1':return oneVOneScenario(this,dt);case'2v2':return twoVTwoScenario(this,dt);case'3v3':return threeVThreeScenario(this,dt);case'through':return throughScenario(this,dt);case'cross':return crossScenario(this,dt);case'finish':return finishingScenario(this,dt);case'free-kick':return freeKickScenario(this,dt);default:q.phase='Trabajo técnico';return this.dribbleTo(this.player,{x:780,y:CY},dt);}};

const previousStep=TrainingEngine.prototype.step;
TrainingEngine.prototype.step=function qualityStep(dt){const wasFinished=this.finished;previousStep.call(this,dt);if(!wasFinished&&this.finished)finalizeRep(this);};

TrainingEngine.prototype.sessionResult=function sessionResult(){finalizeRep(this);const q=ensureQuality(this),reps=Math.max(1,this.result?.reps||q.repResults.length||1),successes=q.repResults.filter(r=>r.success).length,ratio=successes/reps,base=Number(this.result?.quality)||60,quality=clamp(Math.round(base*.55+ratio*100*.45),35,98);return{...this.result,quality,grade:gradeFor(quality),reps,successes,actual:true,repResults:[...q.repResults]};};

const previousDraw=TrainingEngine.prototype.draw;
TrainingEngine.prototype.draw=function qualityDraw(ctx,width=900,height=520){previousDraw.call(this,ctx,width,height);const q=ensureQuality(this),m=this.trainingMetricsV4,sx=width/900,sy=height/520;ctx.save();ctx.scale(sx,sy);
  if(this.drill?.kind==='cones'&&q.gates?.[q.gateIndex]){const g=q.gates[q.gateIndex];ctx.strokeStyle='#d8ff4c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(g.x,g.y-g.w/2);ctx.lineTo(g.x,g.y+g.w/2);ctx.stroke();}
  if(this.drill?.kind==='through'&&q.lineX){ctx.setLineDash([8,6]);ctx.strokeStyle='rgba(255,220,90,.8)';ctx.beginPath();ctx.moveTo(q.lineX,TOP);ctx.lineTo(q.lineX,BOTTOM);ctx.stroke();ctx.setLineDash([]);}
  if(['2v2','3v3'].includes(this.drill?.kind)){ctx.fillStyle='rgba(216,255,76,.08)';ctx.fillRect(745,TOP,RIGHT-745,BOTTOM-TOP);}
  if(q.target&&Number.isFinite(q.target.x)){ctx.strokeStyle='rgba(216,255,76,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.target.x,q.target.y,13,0,Math.PI*2);ctx.stroke();}
  const done=q.repResults.filter(r=>r.success).length+(q.repSuccess&&q.finalizedRep!==q.activeRep?1:0);ctx.fillStyle='rgba(5,15,10,.88)';ctx.fillRect(LEFT+10,BOTTOM-66,430,52);ctx.fillStyle='#d8ff4c';ctx.font='800 12px system-ui';ctx.textAlign='left';ctx.fillText(q.phase||'Entrenamiento',LEFT+22,BOTTOM-44);ctx.fillStyle='#fff';ctx.font='11px system-ui';ctx.fillText(q.objective||'',LEFT+22,BOTTOM-26);ctx.textAlign='right';ctx.fillStyle='#d8ff4c';ctx.fillText(`Éxitos ${done}/${this.result.reps}`,RIGHT-18,BOTTOM-26);ctx.restore();};

export const __trainingQualityV4={laneOpen,openness,gradeFor,finalizeRep};
