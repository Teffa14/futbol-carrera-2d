import {TrainingEngine} from './training-engine-v1.js';

const LEFT=38,RIGHT=862,TOP=32,BOTTOM=488,CY=260;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const dist=(a,b)=>finite(a)&&finite(b)?Math.hypot(a.x-b.x,a.y-b.y):Infinity;
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
const actor=(x,y,role='mate',tag=role,r=9)=>({x,y,vx:0,vy:0,r,role,tag,kickCooldown:0,target:null});
const tagOf=a=>a?.tag||(a?.role==='user'?'user':null);
const gradeFor=q=>q>=91?'S':q>=82?'A':q>=72?'B':q>=62?'C':q>=52?'D':'E';
const REP={cones:4.8,'1v1':5.2,'2v2':5.5,'3v3':5.8,through:5.0,cross:5.8,finish:5.0,'free-kick':4.4};

function lineDistance(p,a,b){if(!finite(p)||!finite(a)||!finite(b))return 999;const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,len=vx*vx+vy*vy||1,t=clamp((wx*vx+wy*vy)/len,0,1),x=a.x+vx*t,y=a.y+vy*t;return Math.hypot(p.x-x,p.y-y);}
function laneOpen(a,b,defs,width=27){return finite(a)&&finite(b)&&!defs.some(d=>finite(d)&&lineDistance(d,a,b)<width&&dist(a,d)<dist(a,b)+25);}
function openness(a,defs){return defs.reduce((best,d)=>Math.min(best,dist(a,d)),999);}
function safePoint(p,fallback){return finite(p)?p:{x:fallback.x,y:fallback.y};}
function safeIntercept(e,a){let p=null;try{p=e.projectedIntercept(a);}catch{}return safePoint(p,e.ball);}
function resetA(e,a,x,y){e.resetActor(a,x,y);a.tag??=a.role;}

function state(e){
  if(e.trainingQualityV5)return e.trainingQualityV5;
  const metrics={gatesCleared:0,duelsBeaten:0,passesAttempted:0,passesCompleted:0,timedRuns:0,throughReceptions:0,deliveries:0,deliveryReceptions:0,shots:0,goals:0,wallBeats:0,branches:new Set(),receivers:new Set(),serviceTypes:new Set(),targetZones:new Set(),deliveryChoices:new Set()};
  const q={activeRep:0,finalizedRep:-1,repResults:[],repSuccess:false,phase:'Preparar',objective:'',branch:null,pendingPass:null,lastTouchTag:null,target:null,gateIndex:0,completedInRep:0};
  e.trainingMetricsV5=metrics;e.trainingQualityV5=q;
  // Compatibility aliases for the existing live UI while the V5 layer is rolled out.
  e.trainingMetricsV4=metrics;e.trainingQualityV4=q;
  return q;
}
function resetState(e,rep){const q=state(e);Object.assign(q,{activeRep:rep,repSuccess:false,phase:'Preparar',objective:'',branch:null,pendingPass:null,lastTouchTag:null,target:null,gateIndex:0,completedInRep:0,firstPass:false,returnPass:false,wallComplete:false,runnerStarted:false,passReleased:false,deliveryChoice:null,delivered:false,service:false,finishShot:false,beatDefender:false,wallHit:false,goal:false,possessionTag:'user'});}
function finalize(e){const q=state(e);if(q.finalizedRep===q.activeRep)return;q.repResults.push({rep:q.activeRep,success:!!q.repSuccess,branch:q.branch||null,phase:q.phase});q.finalizedRep=q.activeRep;}
function branch(e,name){const q=state(e);q.branch=name;e.trainingMetricsV5.branches.add(name);}
function pending(e,from,to,kind){state(e).pendingPass={from:tagOf(from),to:tagOf(to),kind};}
function observe(e){const q=state(e),m=e.trainingMetricsV5,tag=tagOf(e.ball.lastActor);if(!tag||tag===q.lastTouchTag)return;if(q.pendingPass&&q.pendingPass.to===tag){m.passesCompleted++;m.receivers.add(tag);q.completedInRep++;q.possessionTag=tag;q.pendingPass=null;}q.lastTouchTag=tag;}
function byTag(e,tag){return [e.player,...e.mates,...e.defenders].find(a=>tagOf(a)===tag)||null;}

function kickToward(e,from,target,power,kind,to=null,scale=1){
  if(!from||!finite(target)||!finite(e.ball))return false;
  const contact=(from.r||9)+(e.ball.r||5)+2;
  let ok=false;
  if(dist(from,e.ball)<=contact)ok=e.kick(from,target,power,kind);
  else{
    const d=unit(target.x-e.ball.x,target.y-e.ball.y),spot={x:e.ball.x-d.x*(contact-1.6),y:e.ball.y-d.y*(contact-1.6)};
    if(finite(spot))e.move(from,spot,e.__trainingDt||.016,scale);
    if(dist(from,e.ball)<=contact+1.2)ok=e.kick(from,target,power,kind);
  }
  if(ok){const m=e.trainingMetricsV5;if(['pass','wall','third-man','through','cross','cutback','service'].includes(kind))m.passesAttempted++;if(['shot','free-kick'].includes(kind))m.shots++;if(to)pending(e,from,to,kind);}return ok;
}
function defend(e,d,target,dt,scale=.88){if(d&&finite(target))e.move(d,target,dt,scale);}

const priorReset=TrainingEngine.prototype.resetRep;
TrainingEngine.prototype.resetRep=function drillV5Reset(rep,initial=false){
  if(this.trainingQualityV5&&!initial)finalize(this);
  const out=priorReset.call(this,rep,initial);state(this);resetState(this,rep);this.repLength=REP[this.drill?.kind]||4.8;this.duration=this.repLength*Math.max(1,this.result?.reps||1);this.player.tag='user';
  const q=this.trainingQualityV5,k=this.drill?.kind;
  if(k==='cones'){
    const flip=rep%2?1:-1;q.gates=[{x:170,y:380},{x:220,y:330+flip*28},{x:270,y:275-flip*28},{x:325,y:225+flip*22}].map(g=>({...g,w:38}));this.cones=q.gates.flatMap(g=>[{x:g.x,y:g.y-g.w/2},{x:g.x,y:g.y+g.w/2}]);resetA(this,this.player,105,405);Object.assign(this.ball,{x:118,y:405,vx:0,vy:0,lastActor:null,lastKick:null});q.objective='Pasá cuatro puertas con microtoques y cambios de dirección';
  }else if(k==='1v1'){
    const side=rep%2?1:-1;resetA(this,this.player,245,CY+side*72);Object.assign(this.ball,{x:258,y:this.player.y,vx:0,vy:0,lastActor:null,lastKick:null});this.defenders=[actor(400,CY+side*22,'def','d1',10)];q.objective='Fijá al defensor, ganá un lado y terminá la acción';
  }else if(k==='2v2'){
    resetA(this,this.player,235,345);Object.assign(this.ball,{x:248,y:345,vx:0,vy:0,lastActor:null,lastKick:null});this.mates=[actor(365,215,'mate','m1')];this.defenders=[actor(345,320,'def','d1',10),actor(515,250,'def','d2',10)];q.objective='Atraé al primer defensor, soltá y atacá la devolución';
  }else if(k==='3v3'){
    resetA(this,this.player,245,345);Object.assign(this.ball,{x:258,y:345,vx:0,vy:0,lastActor:null,lastKick:null});this.mates=[actor(355,190,'mate','m1'),actor(395,370,'mate','m2')];this.defenders=[actor(340,305,'def','d1',10),actor(465,230,'def','d2',10),actor(570,335,'def','d3',10)];q.objective='Circulá por tres receptores y progresá cuando la presión se mueva';
  }else if(k==='through'){
    const shift=rep%2?28:-28;resetA(this,this.player,295,350);Object.assign(this.ball,{x:308,y:350,vx:0,vy:0,lastActor:null,lastKick:null});this.mates=[actor(445,270+shift,'runner','runner')];this.defenders=[actor(540,215+shift*.3,'def','d1',10),actor(540,335+shift*.3,'def','d2',10)];q.lineX=540;q.objective='Temporizá y soltá cuando el corredor ataque el hombro onside';
  }else if(k==='cross'){
    resetA(this,this.player,515,428);Object.assign(this.ball,{x:528,y:428,vx:0,vy:0,lastActor:null,lastKick:null});this.mates=[actor(715,220,'runner','near'),actor(755,305,'runner','far'),actor(655,350,'runner','cutback')];const bylineBlocked=rep%3===1;this.defenders=[actor(bylineBlocked?605:650,bylineBlocked?420:335,'def','wideDef',10),actor(rep%3===2?750:715,270,'def','boxDef',10)];q.objective='Desbordá y elegí centro o cutback según dónde cierre el rival';
  }else if(k==='finish'){
    resetA(this,this.player,555,300);this.mates=[actor(400,385,'server','server')];this.defenders=[actor(665,285,'def','marker',10),actor(830,rep%2?235:290,'keeper','gk',11)];Object.assign(this.ball,{x:413,y:385,vx:0,vy:0,lastActor:null,lastKick:null});q.serviceType=['cutback','through','cross'][rep%3];this.trainingMetricsV5.serviceTypes.add(q.serviceType);q.objective='Leé tres servicios distintos y atacá la trayectoria antes del marcador';
  }else if(k==='free-kick'){
    const shift=(rep%3-1)*13;resetA(this,this.player,325,CY+shift);Object.assign(this.ball,{x:338,y:CY+shift,vx:0,vy:0,lastActor:null,lastKick:null});const keeperY=rep%2?295:225;this.defenders=[actor(555,220+shift,'wall','w1',9),actor(555,245+shift,'wall','w2',9),actor(555,270+shift,'wall','w3',9),actor(555,295+shift,'wall','w4',9),actor(830,keeperY,'keeper','gk',11)];q.objective='Leé barrera y arquero y elegí el rincón disponible';
  }
  this.repOrigin={px:this.player.x,py:this.player.y,bx:this.ball.x,by:this.ball.y};return out;
};

function cones(e,dt){const q=e.trainingQualityV5,m=e.trainingMetricsV5,g=q.gates[q.gateIndex];q.phase=g?`Puerta ${q.gateIndex+1}/${q.gates.length}`:'Acelerar después del slalom';if(!g){q.repSuccess=true;e.dribbleTo(e.player,{x:390,y:210},dt);return;}e.dribbleTo(e.player,g,dt);if(Math.abs(e.ball.x-g.x)<22&&Math.abs(e.ball.y-g.y)<g.w*.48){q.gateIndex++;m.gatesCleared++;e.flash='PUERTA';e.flashTimer=.2;}}
function oneVOne(e,dt){const q=e.trainingQualityV5,m=e.trainingMetricsV5,d=e.defenders[0];if(!q.branch&&d.x-e.ball.x<120){const lane=e.ball.y>d.y?'outside':'inside';branch(e,lane);q.target={x:505,y:clamp(e.ball.y+(lane==='outside'?85:-85),100,420)};}if(!q.branch){q.phase='Fijar defensor';e.dribbleTo(e.player,{x:340,y:e.ball.y},dt);}else{q.phase=`Salir por ${q.branch}`;e.dribbleTo(e.player,q.target,dt);}const force=q.branch==='outside'?-24:24;defend(e,d,{x:e.ball.x+42,y:clamp(e.ball.y+force,90,430)},dt,.78);if(!q.beatDefender&&q.branch&&(e.ball.x>d.x+8||Math.abs(e.ball.y-d.y)>82&&e.ball.x>d.x-18)){q.beatDefender=true;m.duelsBeaten++;q.phase='Defensor superado';}if(q.beatDefender&&!q.finishShot){q.finishShot=kickToward(e,e.player,{x:852,y:e.ball.y<CY?305:215},6.1,'shot',null,1.08);if(q.finishShot)q.phase='Finalizar';}if(q.finishShot&&e.ball.x>825){q.repSuccess=true;}}
function twoVTwo(e,dt){const q=e.trainingQualityV5,m=e.trainingMetricsV5,mate=e.mates[0],[d1,d2]=e.defenders;observe(e);defend(e,d1,{x:e.ball.x+36,y:e.ball.y-8},dt,.83);defend(e,d2,{x:500,y:245},dt,.78);
  if(!q.firstPass){q.phase='Atraer y soltar';e.move(mate,{x:365,y:215},dt,.98);if(dist(d1,e.ball)>72){e.dribbleTo(e.player,{x:300,y:340},dt);return;}branch(e,laneOpen(e.ball,mate,[d2],32)?'wall':'carry-release');q.firstPass=kickToward(e,e.player,mate,4.9,'pass',mate,1.08);return;}
  if(q.pendingPass){q.phase='Compañero recibe';e.move(mate,safeIntercept(e,mate),dt,1.08);e.move(e.player,{x:485,y:340},dt,1.1);return;}
  if(q.possessionTag==='m1'&&!q.returnPass){q.phase='Devolución al espacio';e.move(e.player,{x:510,y:335},dt,1.12);q.returnPass=kickToward(e,mate,{x:e.player.x+42,y:e.player.y},5.1,'wall',e.player,1.08);return;}
  if(q.returnPass&&q.pendingPass){q.phase='Atacar devolución';e.move(e.player,safeIntercept(e,e.player),dt,1.12);return;}
  if(q.returnPass&&e.ball.lastActor===e.player){if(!q.wallComplete){q.wallComplete=true;m.wallBeats++;}q.phase='Ventaja creada';e.dribbleTo(e.player,{x:660,y:285},dt);if(e.ball.x>610)q.repSuccess=true;}}
function threeVThree(e,dt){const q=e.trainingQualityV5,m=e.trainingMetricsV5,attack=[e.player,...e.mates],defs=e.defenders;observe(e);const holder=byTag(e,q.possessionTag)||e.player;defs.forEach((d,i)=>{const t=i===0?e.ball:(i===1?holder:{x:520,y:CY});defend(e,d,{x:t.x+30,y:t.y+(i-1)*18},dt,.75);});
  if(q.pendingPass){q.phase='Atacar línea de pase';const receiver=byTag(e,q.pendingPass.to);if(receiver)e.move(receiver,safeIntercept(e,receiver),dt,1.1);attack.filter(a=>a!==receiver).forEach((a,i)=>e.move(a,{x:clamp(e.ball.x+70+i*45,180,620),y:clamp(CY+(i?105:-105),90,430)},dt,.9));return;}
  if(q.completedInRep>=3){q.phase='Progresar tras mover presión';if(holder===e.player)e.dribbleTo(e.player,{x:680,y:CY},dt);else e.move(holder,{x:670,y:CY},dt,1.04);if(e.ball.x>625)q.repSuccess=true;return;}
  q.phase='Circular y atraer';if(dist(holder,e.ball)>holder.r+e.ball.r+4){e.move(holder,safeIntercept(e,holder),dt,1.05);return;}const candidates=attack.filter(a=>a!==holder).map(a=>({a,score:openness(a,defs)+(laneOpen(e.ball,a,defs)?55:-35)+(a.x-holder.x)*.16-(m.receivers.has(tagOf(a))?12:0)})).sort((a,b)=>b.score-a.score);const best=candidates[0]?.a;if(best){const ok=kickToward(e,holder,best,4.65,'pass',best,1.04);if(ok){m.receivers.add(tagOf(best));q.lastTouchTag=tagOf(holder);}}}
function through(e,dt){const q=e.trainingQualityV5,m=e.trainingMetricsV5,r=e.mates[0],[d1,d2]=e.defenders;observe(e);d1.x=q.lineX;d2.x=q.lineX;defend(e,d1,{x:q.lineX,y:r.y-55},dt,.45);defend(e,d2,{x:q.lineX,y:r.y+55},dt,.45);if(!q.runnerStarted){q.runnerStarted=true;m.timedRuns++;q.phase='Temporizar ruptura';}
  if(!q.passReleased){e.dribbleTo(e.player,{x:335,y:350},dt);e.move(r,{x:q.lineX-18,y:r.y},dt,1.08);if(r.x>q.lineX-34&&dist(e.player,e.ball)<30){q.target={x:690,y:r.y};q.passReleased=kickToward(e,e.player,q.target,5.65,'through',r,1.05);if(q.passReleased)q.phase='Pase al espacio';}return;}
  if(q.pendingPass){e.move(r,safeIntercept(e,r),dt,1.12);q.phase='Atacar trayectoria';return;}if(e.ball.lastActor===r&&r.x>q.lineX-8){m.throughReceptions++;q.repSuccess=true;q.phase='Ruptura encontrada';}}
function crossing(e,dt){const q=e.trainingQualityV5,m=e.trainingMetricsV5,[near,far,cutback]=e.mates,[wide,box]=e.defenders;observe(e);e.move(near,{x:720,y:220},dt,.95);e.move(far,{x:755,y:305},dt,.95);e.move(cutback,{x:650,y:350},dt,.95);defend(e,wide,{x:wide.x,y:wide.y},dt,.1);defend(e,box,{x:box.x,y:box.y},dt,.1);
  if(!q.deliveryChoice){q.phase='Desbordar y leer';e.dribbleTo(e.player,{x:620,y:428},dt);if(e.ball.x>575){const blocked=wide.y>390&&Math.abs(wide.x-e.ball.x)<75;if(blocked)q.deliveryChoice='cutback';else q.deliveryChoice=openness(far,[box])>openness(near,[box])+5?'far-cross':'near-cross';branch(e,q.deliveryChoice);m.deliveryChoices.add(q.deliveryChoice);}return;}
  if(!q.delivered){let target,to,kind='cross';if(q.deliveryChoice==='cutback'){target=cutback;to=cutback;kind='cutback';}else if(q.deliveryChoice==='far-cross'){target=far;to=far;}else{target=near;to=near;}q.target=target;q.phase=kind==='cutback'?'Pase atrás':'Centro al área';q.delivered=kickToward(e,e.player,target,5.7,kind,to,1.1);if(q.delivered)m.deliveries++;return;}
  e.move(e.player,{x:735,y:432},dt,1.08);if(q.pendingPass){for(const a of [near,far,cutback])e.move(a,safeIntercept(e,a),dt,1.03);return;}if([near,far,cutback].includes(e.ball.lastActor)){m.deliveryReceptions++;q.repSuccess=true;q.phase='Entrega encontrada';}}
function finishing(e,dt){const q=e.trainingQualityV5,m=e.trainingMetricsV5,server=e.mates[0],[marker,gk]=e.defenders;observe(e);defend(e,marker,{x:e.player.x+42,y:e.player.y+10},dt,.72);defend(e,gk,{x:830,y:clamp(e.ball.y,210,310)},dt,.45);let target;if(q.serviceType==='cutback')target={x:575,y:320};else if(q.serviceType==='through')target={x:625,y:270};else target={x:605,y:215};
  if(!q.service){q.phase=`Servicio ${q.serviceType}`;q.service=kickToward(e,server,target,q.serviceType==='cross'?5.3:4.9,'service',e.player,1.02);return;}
  if(q.pendingPass){q.phase='Anticipar trayectoria';e.move(e.player,safeIntercept(e,e.player),dt,1.12);return;}
  if(!q.finishShot&&(e.ball.lastActor===e.player||dist(e.player,e.ball)<e.player.r+e.ball.r+4)){q.target={x:852,y:gk.y<CY?305:215};q.phase='Definir lejos del arquero';q.finishShot=kickToward(e,e.player,q.target,6.35,'shot',null,1.08);return;}
  if(q.finishShot){q.phase='Seguir remate';if(e.ball.x>825&&e.ball.lastActor!==gk){m.goals++;q.repSuccess=true;}}}
function freeKick(e,dt){const q=e.trainingQualityV5,m=e.trainingMetricsV5,gk=e.defenders.at(-1),wall=e.defenders.slice(0,-1);if(!q.target){const targetY=gk.y<CY?305:215;q.target={x:852,y:targetY};const name=targetY<CY?'upper-corner':'lower-corner';branch(e,name);m.targetZones.add(targetY<CY?'top':'bottom');}if(!q.finishShot){q.phase='Perfil y golpeo';q.finishShot=kickToward(e,e.player,q.target,6.65,'free-kick',null,1.0);return;}q.phase='Trayectoria';if(e.ball.lastActor&&wall.includes(e.ball.lastActor))q.wallHit=true;if(e.ball.x>825&&e.ball.lastActor!==gk&&!q.wallHit){m.goals++;q.repSuccess=true;q.phase='Superó barrera y arquero';}}

TrainingEngine.prototype.scenario=function trainingV5Scenario(dt){this.__trainingDt=dt;state(this);observe(this);switch(this.drill?.kind){case'cones':return cones(this,dt);case'1v1':return oneVOne(this,dt);case'2v2':return twoVTwo(this,dt);case'3v3':return threeVThree(this,dt);case'through':return through(this,dt);case'cross':return crossing(this,dt);case'finish':return finishing(this,dt);case'free-kick':return freeKick(this,dt);default:this.trainingQualityV5.phase='Trabajo técnico';return this.dribbleTo(this.player,{x:620,y:CY},dt);}};

const priorStep=TrainingEngine.prototype.step;
TrainingEngine.prototype.step=function trainingV5Step(dt){if(this.finished)return;const before=this.finished;priorStep.call(this,dt);for(const a of [this.player,...this.mates,...this.defenders]){if(!finite(a)){throw new Error(`training actor became non-finite in ${this.drill?.id||this.drill?.kind}`);}}if(!finite(this.ball))throw new Error(`training ball became non-finite in ${this.drill?.id||this.drill?.kind}`);if(!before&&this.finished)finalize(this);};
TrainingEngine.prototype.sessionResult=function trainingV5Result(){finalize(this);const q=state(this),reps=Math.max(1,this.result?.reps||q.repResults.length||1),successes=q.repResults.filter(r=>r.success).length,ratio=successes/reps,base=Number(this.result?.quality)||60,quality=clamp(Math.round(base*.52+ratio*100*.48),35,98);return{...this.result,quality,grade:gradeFor(quality),reps,successes,actual:true,repResults:[...q.repResults]};};

const priorDraw=TrainingEngine.prototype.draw;
TrainingEngine.prototype.draw=function trainingV5Draw(ctx,width=900,height=520){priorDraw.call(this,ctx,width,height);const q=state(this),sx=width/900,sy=height/520;ctx.save();ctx.scale(sx,sy);if(this.drill?.kind==='cones'&&q.gates?.[q.gateIndex]){const g=q.gates[q.gateIndex];ctx.strokeStyle='#d8ff4c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(g.x,g.y-g.w/2);ctx.lineTo(g.x,g.y+g.w/2);ctx.stroke();}if(this.drill?.kind==='through'&&q.lineX){ctx.setLineDash([8,6]);ctx.strokeStyle='rgba(255,220,90,.9)';ctx.beginPath();ctx.moveTo(q.lineX,TOP);ctx.lineTo(q.lineX,BOTTOM);ctx.stroke();ctx.setLineDash([]);}if(q.target&&finite(q.target)){ctx.strokeStyle='rgba(216,255,76,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.target.x,q.target.y,13,0,Math.PI*2);ctx.stroke();}const done=q.repResults.filter(r=>r.success).length+(q.repSuccess&&q.finalizedRep!==q.activeRep?1:0);ctx.fillStyle='rgba(5,15,10,.9)';ctx.fillRect(LEFT+10,BOTTOM-67,500,53);ctx.fillStyle='#d8ff4c';ctx.font='800 12px system-ui';ctx.textAlign='left';ctx.fillText(q.phase,LEFT+22,BOTTOM-45);ctx.fillStyle='#fff';ctx.font='11px system-ui';ctx.fillText(q.objective,LEFT+22,BOTTOM-27);ctx.textAlign='right';ctx.fillStyle='#d8ff4c';ctx.fillText(`Éxitos ${done}/${this.result.reps}`,RIGHT-18,BOTTOM-27);ctx.restore();};

export const __trainingDrillsV5={laneOpen,openness,gradeFor,kickToward,safeIntercept};
