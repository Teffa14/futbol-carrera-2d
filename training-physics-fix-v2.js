import {TrainingEngine} from './training-engine-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};

const previousReset=TrainingEngine.prototype.resetRep;
TrainingEngine.prototype.resetRep=function physicalCrossReset(rep,initial=false){
  if(this.drill?.kind==='cross'){
    this.repLength=Math.max(Number(this.repLength)||0,5.2);
    this.duration=this.repLength*Math.max(1,this.result?.reps||1);
  }
  const out=previousReset.call(this,rep,initial);
  if(this.drill?.kind==='cross'){
    this.player.x=500;this.player.y=435;this.player.vx=0;this.player.vy=0;
    Object.assign(this.ball,{x:516,y:435,vx:0,vy:0,lastActor:null,lastKick:null});
    this.repOrigin={px:this.player.x,py:this.player.y,bx:this.ball.x,by:this.ball.y};
    this.stage=0;this.flags={};
  }
  return out;
};

TrainingEngine.prototype.approachKick=function contactValidatedApproach(a,target,dt,power,kind='pass',scale=1){
  if(!a||!target)return false;
  const d=unit(target.x-this.ball.x,target.y-this.ball.y),contact=a.r+this.ball.r-.6;
  const spot={x:this.ball.x-d.x*contact,y:this.ball.y-d.y*contact};
  this.move(a,spot,dt,scale);
  // The steering point is a preparation cue, not another hidden possession rule.
  // kick() remains the source of truth and fires only from real disc/ball contact.
  return this.kick(a,target,power,kind);
};

const previousScenario=TrainingEngine.prototype.scenario;
TrainingEngine.prototype.scenario=function physicalCrossScenario(dt){
  if(this.drill?.kind!=='cross')return previousScenario.call(this,dt);
  const t=this.repProgress(),good=this.repGood(),[near,far]=this.mates;
  this.move(near,{x:790,y:250},dt,1.04);
  this.move(far,{x:770,y:315},dt,1.02);
  this.defenders.forEach((d,i)=>this.defend(d,{x:700+i*45,y:285+i*30},dt));

  if(!this.flags.cross){
    if(t<.42&&this.player.x<610){
      this.dribbleTo(this.player,{x:635,y:425},dt);
    }else{
      const target=good?far:near;
      this.flags.cross=this.approachKick(this.player,{x:target.x+35,y:target.y},dt,5.7,'cross',1.08);
    }
  }else{
    this.move(this.player,{x:735,y:425},dt,1.07);
    this.move(near,this.projectedIntercept(near),dt,1.02);
    this.move(far,this.projectedIntercept(far),dt,1.02);
  }

  // If the initial dribble was slower than expected, do not fake the cross.
  // Keep physically chasing the striking side of the ball until contact occurs.
  if(!this.flags.cross&&t>.72){
    const target=good?far:near;
    this.flags.cross=this.approachKick(this.player,{x:target.x+35,y:target.y},dt,5.7,'cross',1.14);
  }

  // Track the actual movement produced by this repetition for regression tests.
  this.metrics.maxPlayerTravel=Math.max(this.metrics.maxPlayerTravel,dist(this.player,{x:this.repOrigin.px,y:this.repOrigin.py}));
  this.metrics.maxBallTravel=Math.max(this.metrics.maxBallTravel,dist(this.ball,{x:this.repOrigin.bx,y:this.repOrigin.by}));
};

export const __trainingPhysicsFixV2={clamp,dist,unit};
