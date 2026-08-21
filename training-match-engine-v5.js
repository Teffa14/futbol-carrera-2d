import {TrainingMatchEngine as TrainingMatchEngineV4} from './training-match-engine-v4.js';

export const TRAINING_MATCH_ENGINE_VERSION=5;
const pressureIds=new Set(['w-isolation','cam-pressure-escape','mid-pressure-escape']);
const profiledPassIds=new Set(['w-cross-choice','cam-scan-receive','mid-support','def-build']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};

function markSuccess(e,text='RESUELTO'){
  const q=e.trainingQualityV6;if(q.repSuccess)return;q.repSuccess=true;e.flashTraining(text);
}

function tightenWideCarry(e){
  const q=e.trainingQualityV6,side=e.rep%2?1:-1,startY=q.gates?.[0]?.y??e.player.y;
  const old=q.gates||[];
  q.gates=[245,325,405,485].map((x,i)=>({x,y:old[i]?.y??clamp(startY+(i%2?side*-24:side*10),120,580),w:old[i]?.w??118}));
  q.exit={x:555,y:clamp(q.gates[3].y-side*16,120,580)};
  q.gateIndex=0;q.gatePrev={x:e.ball.x,y:e.ball.y};
  e.cones=q.gates.flatMap(g=>[{x:g.x,y:g.y-g.w/2},{x:g.x,y:g.y+g.w/2}]);
}

export class TrainingMatchEngine extends TrainingMatchEngineV4{
  constructor(drill,result,player){super(drill,result,player);this.trainingEngineVersion=5;}

  resetRep(rep,initial=false){
    super.resetRep(rep,initial);
    if(this.drill?.id==='w-wide-carry')tightenWideCarry(this);
  }

  tryKick(p,target,power,kind='pass',receiver=null,dt=.016){
    if(this.lastTrainingKick?.rep===this.rep&&this.lastTrainingKick.by===p?.id&&this.lastTrainingKick.kind===kind){
      return super.tryKick(p,target,power,kind,receiver,dt);
    }
    if(!profiledPassIds.has(this.drill?.id)||!p||!target){
      return super.tryKick(p,target,power,kind,receiver,dt);
    }

    const d=unit(target.x-this.ball.x,target.y-this.ball.y);
    const stagingDistance=p.r+this.ball.r+2.2;
    const spot={x:this.ball.x-d.x*stagingDistance,y:this.ball.y-d.y*stagingDistance};
    const facing=p.facingX*d.x+p.facingY*d.y;
    const staged=dist(p,spot)<=2.6;

    if(!staged||facing<.955){
      p.kickIntent=null;
      this.move(p,spot,dt);
      this.turnPlayer(p,d,dt);
      return false;
    }

    return super.tryKick(p,target,power,kind,receiver,dt);
  }

  scenario(dt){
    const out=super.scenario(dt),id=this.drill?.id,q=this.trainingQualityV6;
    if(pressureIds.has(id)&&q?.beatDefender&&this.ball.lastPlayerId===this.player.id&&this.ball.x>(q.engagementX||650)+34){
      markSuccess(this,'VENTAJA CONSERVADA');
    }
    return out;
  }

  sessionResult(){const out=super.sessionResult();return{...out,engineVersion:5};}
}

export const __trainingMatchEngineV5={profiledPassIds,pressureIds};
