import {TrainingMatchEngine as TrainingMatchEngineV14} from './training-match-engine-v14.js';

export const TRAINING_MATCH_ENGINE_VERSION=15;

const GOAL={x:1045,top:295,bottom:405};
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function resolveSuccessfulRep(engine,text,reason){
  const q=engine.trainingQualityV6;
  if(q.repTerminal)return;
  q.repSuccess=true;
  q.repTerminal=true;
  q.repTerminalAt=engine.time;
  q.terminalReason=reason;
  engine.flashTraining(text);
}

function rememberPhysicalShot(engine){
  const q=engine.trainingQualityV6;
  if(q.shotTick==null||q.v15ObservedShotTick===q.shotTick)return;
  q.v15ObservedShotTick=q.shotTick;
  const vx=engine.ball.vx||0,vy=engine.ball.vy||0;
  q.v15ShotVx=vx;q.v15ShotVy=vy;
  if(vx<=.05){q.v15ShotOnTarget=false;return;}
  const frames=Math.max(0,(GOAL.x-engine.ball.x)/vx);
  const crossingY=engine.ball.y+vy*frames;
  q.v15ShotCrossingY=crossingY;
  q.v15ShotTravelSeconds=frames/60;
  q.v15ShotOnTarget=crossingY>GOAL.top+2&&crossingY<GOAL.bottom-2;
}

export class TrainingMatchEngine extends TrainingMatchEngineV14{
  constructor(drill,result,player){super(drill,result,player);this.trainingEngineVersion=15;}

  resetRep(rep,initial=false){
    const out=super.resetRep(rep,initial);
    if(this.drill?.id==='st-press'){
      const q=this.trainingQualityV6,[carrier,wide]=this.defenders;
      if(carrier&&wide){
        const side=q.side||1;
        this.resetActor(wide,825,350+side*115,'RB');
        const bx=865,by=350,d=unit(wide.x-bx,wide.y-by),contact=carrier.r+this.ball.r-.55;
        this.resetActor(carrier,bx-d.x*(contact+1.2),by-d.y*(contact+1.2),'CB');
        carrier.facingX=d.x;carrier.facingY=d.y;carrier.desiredFacingX=d.x;carrier.desiredFacingY=d.y;
        carrier.kickCooldown=0;carrier.touchCooldown=0;
        this.resetBall(bx,by);
        q.wideTarget={x:wide.x,y:wide.y};
        q.possessionId=carrier.id;
        this.repOrigin={px:this.player.x,py:this.player.y,bx:this.ball.x,by:this.ball.y};
      }
    }
    return out;
  }

  scenario(dt){
    const out=super.scenario(dt),q=this.trainingQualityV6,id=this.drill?.id;

    if(id==='st-one-touch'&&q.shotTick!=null&&!q.repTerminal){
      rememberPhysicalShot(this);
      const elapsed=this.time-(q.shotTime??this.time);
      const resolvedAfter=Math.max(.22,Math.min(.8,(q.v15ShotTravelSeconds??.45)+.08));
      if(q.v15ShotOnTarget&&elapsed>=resolvedAfter){
        resolveSuccessfulRep(this,'AL ARCO','physical-on-target');
      }
    }

    if(id==='st-wall-run'&&q.customStage==='lane'&&!q.repTerminal){
      if((this.ball.vx||0)>0&&this.ball.x>(q.lineX??775)-30){
        q.customStage='attack-return';
        q.stageAt=this.time;
        q.phase='Atacar devolución';
      }
    }

    if(id==='st-press'&&q.customStage==='screen'&&!q.repTerminal&&dist(this.player,q.screen)<10){
      q.customStage='force-wide';
      q.stageAt=this.time;
      q.phase='2. Orientar a banda';
    }

    return out;
  }

  sessionResult(){return{...super.sessionResult(),engineVersion:15};}
}
