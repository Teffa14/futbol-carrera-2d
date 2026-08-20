import {TrainingEngine} from './training-engine-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const dist=(a,b)=>finite(a)&&finite(b)?Math.hypot(a.x-b.x,a.y-b.y):Infinity;
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

// A stationary carrier must accelerate through the ball line to create the first
// touch. The ball remains completely free: only resolveContacts transfers force.
TrainingEngine.prototype.dribbleTo=function physicalCarry(a,target,dt,scale=1){
  if(!a||!finite(target)||!finite(this.ball))return;
  const d=unit(target.x-this.ball.x,target.y-this.ball.y),contact=a.r+this.ball.r-.4;
  const behind={x:this.ball.x-d.x*contact,y:this.ball.y-d.y*contact};
  const touching=dist(a,this.ball)<=a.r+this.ball.r+2.2;
  if(!touching&&dist(a,behind)>4.5){this.move(a,behind,dt,scale);return;}
  // Aim beyond the free ball so the player's own velocity produces the touch.
  const drive={x:this.ball.x+d.x*52,y:this.ball.y+d.y*52};
  this.move(a,drive,dt,scale);
};

TrainingEngine.prototype.approachKick=function contactValidatedApproach(a,target,dt,power,kind='pass',scale=1){
  if(!a||!finite(target)||!finite(this.ball))return false;
  const threshold=a.r+this.ball.r+2;
  // If contact already exists, kick before steering can move the actor away.
  if(dist(a,this.ball)<=threshold&&a.kickCooldown<=0)return this.kick(a,target,power,kind);
  const d=unit(target.x-this.ball.x,target.y-this.ball.y),contact=a.r+this.ball.r-.6;
  const spot={x:this.ball.x-d.x*contact,y:this.ball.y-d.y*contact};
  this.move(a,spot,dt,scale);
  return dist(a,this.ball)<=threshold+1?this.kick(a,target,power,kind):false;
};

const previousProjected=TrainingEngine.prototype.projectedIntercept;
TrainingEngine.prototype.projectedIntercept=function finiteProjectedIntercept(a){
  let p=null;try{p=previousProjected.call(this,a);}catch{}
  return finite(p)?p:{x:this.ball.x,y:this.ball.y};
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

  if(!this.flags.cross&&t>.72){
    const target=good?far:near;
    this.flags.cross=this.approachKick(this.player,{x:target.x+35,y:target.y},dt,5.7,'cross',1.14);
  }

  this.metrics.maxPlayerTravel=Math.max(this.metrics.maxPlayerTravel,dist(this.player,{x:this.repOrigin.px,y:this.repOrigin.py}));
  this.metrics.maxBallTravel=Math.max(this.metrics.maxBallTravel,dist(this.ball,{x:this.repOrigin.bx,y:this.repOrigin.by}));
};

export const __trainingPhysicsFixV2={clamp,dist,unit};