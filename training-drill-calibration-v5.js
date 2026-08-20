import {TrainingEngine} from './training-engine-v1.js';
import {__trainingDrillsV5 as v5} from './training-drills-v5.js';

const CY=260,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

const previousReset=TrainingEngine.prototype.resetRep;
TrainingEngine.prototype.resetRep=function calibratedTrainingReset(rep,initial=false){
  const out=previousReset.call(this,rep,initial),q=this.trainingQualityV5;
  if(!q)return out;
  if(this.drill?.kind==='cones'){
    const flip=rep%2?1:-1;
    q.gates=[
      {x:152,y:395,w:54},
      {x:192,y:360+flip*18,w:54},
      {x:234,y:325-flip*20,w:54},
      {x:278,y:288+flip*18,w:54},
    ];
    this.cones=q.gates.flatMap(g=>[{x:g.x,y:g.y-g.w/2},{x:g.x,y:g.y+g.w/2}]);
    this.resetActor(this.player,105,405);Object.assign(this.ball,{x:118,y:405,vx:0,vy:0,lastActor:null,lastKick:null});
    q.gateIndex=0;q.objective='Encadená cuatro puertas: toque corto, cambio de dirección y salida';q.previousBall={x:this.ball.x,y:this.ball.y};
    this.repOrigin={px:this.player.x,py:this.player.y,bx:this.ball.x,by:this.ball.y};
  }
  if(this.drill?.kind==='1v1')q.defenderCommitTime=0;
  return out;
};

const previousScenario=TrainingEngine.prototype.scenario;
TrainingEngine.prototype.scenario=function calibratedTrainingScenario(dt){
  const q=this.trainingQualityV5,m=this.trainingMetricsV5;
  if(!q||!m)return previousScenario.call(this,dt);
  if(this.drill?.kind==='cones'){
    const g=q.gates[q.gateIndex];
    if(!g){q.phase='Salida después del slalom';q.repSuccess=true;this.dribbleTo(this.player,{x:355,y:270},dt,1.04);return;}
    q.phase=`Puerta ${q.gateIndex+1}/${q.gates.length}`;
    this.dribbleTo(this.player,g,dt,1.03);
    const reachedX=this.ball.x>=g.x-7;
    const insideY=Math.abs(this.ball.y-g.y)<=g.w*.66;
    if(reachedX&&insideY){q.gateIndex++;m.gatesCleared++;this.flash='PUERTA';this.flashTimer=.22;}
    q.previousBall={x:this.ball.x,y:this.ball.y};return;
  }
  if(this.drill?.kind==='1v1'){
    const d=this.defenders[0];
    if(!q.branch&&d.x-this.ball.x<118){
      const lane=this.ball.y>d.y?'outside':'inside';q.branch=lane;m.branches.add(lane);
      q.target={x:505,y:clamp(this.ball.y+(lane==='outside'?88:-88),95,425)};
      q.defenderCommitY=clamp(d.y+(lane==='outside'?-42:42),90,430);q.defenderCommitTime=0;
    }
    if(!q.branch){q.phase='Fijar defensor';this.dribbleTo(this.player,{x:340,y:this.ball.y},dt,1.03);this.move(d,{x:400,y:this.ball.y+(d.y<this.ball.y?-18:18)},dt,.62);return;}
    q.defenderCommitTime+=dt;q.phase=q.beatDefender?'Atacar después del 1v1':`Cambio hacia ${q.branch}`;
    this.dribbleTo(this.player,q.target,dt,1.1);
    if(q.defenderCommitTime<.78)this.move(d,{x:405,y:q.defenderCommitY},dt,.62);
    else this.move(d,{x:this.ball.x+24,y:this.ball.y},dt,.58);
    if(!q.beatDefender&&(this.ball.x>d.x+8||(this.ball.x>d.x-12&&Math.abs(this.ball.y-d.y)>58))){q.beatDefender=true;m.duelsBeaten++;this.flash='SUPERADO';this.flashTimer=.26;}
    if(q.beatDefender&&!q.finishShot){q.finishShot=v5.kickToward(this,this.player,{x:852,y:this.ball.y<CY?305:215},6.1,'shot',null,1.08);if(q.finishShot)q.phase='Finalizar';}
    if(q.finishShot&&this.ball.x>825)q.repSuccess=true;
    return;
  }
  return previousScenario.call(this,dt);
};

export const __trainingDrillCalibrationV5={};