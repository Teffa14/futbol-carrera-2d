import {TrainingEngine} from './training-engine-v1.js';
import {__trainingDrillsV5 as v5} from './training-drills-v5.js';

const CY=260,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const previousReset=TrainingEngine.prototype.resetRep;
TrainingEngine.prototype.resetRep=function calibratedTrainingReset(rep,initial=false){
  const out=previousReset.call(this,rep,initial),q=this.trainingQualityV5;
  if(!q)return out;
  if(this.drill?.kind==='cones'){
    const flip=rep%2?1:-1;
    // Micro-gates measure actual close-control touches. Each gate still requires
    // the free ball to physically advance and change its lateral line.
    q.gates=[
      {x:128,y:405,w:64},
      {x:141,y:399+flip*4,w:64},
      {x:156,y:391-flip*5,w:64},
      {x:173,y:382+flip*5,w:64},
    ];
    this.cones=q.gates.flatMap(g=>[{x:g.x,y:g.y-g.w/2},{x:g.x,y:g.y+g.w/2}]);
    this.resetActor(this.player,105,405);Object.assign(this.ball,{x:118,y:405,vx:0,vy:0,lastActor:null,lastKick:null});
    q.gateIndex=0;q.objective='Cuatro microtoques entre conos y aceleración de salida';q.previousBall={x:this.ball.x,y:this.ball.y};
    this.repLength=Math.max(this.repLength,5.0);this.duration=this.repLength*Math.max(1,this.result?.reps||1);
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
    if(!g){q.phase='Aceleración de salida';q.repSuccess=true;this.dribbleTo(this.player,{x:270,y:330},dt,1.08);return;}
    q.phase=`Microtoque ${q.gateIndex+1}/${q.gates.length}`;
    this.dribbleTo(this.player,g,dt,1.04);
    const reachedX=this.ball.x>=g.x-7;
    const insideY=Math.abs(this.ball.y-g.y)<=g.w*.66;
    if(reachedX&&insideY){q.gateIndex++;m.gatesCleared++;this.flash='TOQUE';this.flashTimer=.2;}
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