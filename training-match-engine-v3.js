import {TrainingMatchEngine as TrainingMatchEngineV2} from './training-match-engine-v2.js';
import {CROSSBAR_HEIGHT} from './set-piece-height-v2.js';

export const TRAINING_MATCH_ENGINE_VERSION=3;
const FIELD={left:55,right:1045,top:45,bottom:655,goalTop:295,goalBottom:405,centerX:550,centerY:350};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function goal(e){return e.ball.x>FIELD.right+8&&e.ball.y>FIELD.goalTop&&e.ball.y<FIELD.goalBottom&&(e.ball.z||0)<=CROSSBAR_HEIGHT;}
function keeperTouch(e,q,keeper){return !!keeper&&q.shotTick!=null&&e.tick>q.shotTick&&e.ball.lastPlayerId===keeper.id;}
function cleanFinish(e,q,keeper){if(goal(e)||keeperTouch(e,q,keeper))return true;if(q.shotTick==null)return false;const towardGoal=e.ball.vx>1.1||e.ball.x>q.shotStartX+35;return towardGoal&&e.ball.x>FIELD.right-165&&Math.abs(e.ball.y-FIELD.centerY)<135;}

function setupBoxDuel(e,rep){
  const q=e.trainingQualityV6,[def,keeper]=e.defenders,side=rep%2?1:-1;
  e.resetActor(e.player,748,FIELD.centerY+side*42,e.playerData?.position||'ST');
  e.resetActor(def,716,FIELD.centerY+side*48,'CB');
  e.resetActor(keeper,FIELD.right-28,FIELD.centerY-side*18,'GK');
  // A bad striker faces a development-level defender, not a finished senior stopper.
  const user=Math.round(((e.playerData?.physical||50)+(e.playerData?.ballControl||50)+(e.playerData?.dribbling||50))/3);
  const opposition=clamp(Math.round(42+(user-40)*.55),42,70);
  Object.assign(def.data,{defense:opposition,physical:opposition,pace:Math.max(44,opposition-4),composure:opposition});
  Object.assign(keeper.data,{defense:clamp(opposition+5,48,75),pace:Math.max(50,opposition-8),composure:opposition});
  e.resetBall(e.player.x+15,e.player.y);e.ball.z=0;e.ball.vz=0;e.ball.spin=0;
  Object.assign(q,{boxPhase:'protect',protectTime:0,turnComplete:false,shotTick:null,shotStartX:null,goal:false,repSuccess:false});
  q.objective='Protegé de espaldas, sacá al central de la línea, girá hacia el lado libre y terminá la ventaja con un remate';
  e.trainingIntelligenceV7??={};e.trainingIntelligenceV7.coachCue='Primero sostené la pelota. El giro vale cuando tu cuerpo queda entre el central y la pelota; recién después atacá el arco.';
  e.repOrigin={px:e.player.x,py:e.player.y,bx:e.ball.x,by:e.ball.y};
}

function boxDuelScenario(e,dt){
  const q=e.trainingQualityV6,m=e.trainingMetricsV6,[def,keeper]=e.defenders,side=e.rep%2?1:-1;
  if(goal(e)){if(!q.goal){q.goal=true;m.goals=(m.goals||0)+1;}q.repSuccess=true;e.flashTraining('GOL');return;}
  if(q.shotTick!=null){q.phase='Seguir la finalización';if(cleanFinish(e,q,keeper)){q.repSuccess=true;e.flashTraining('GIRO + REMATE');}if(keeper)e.move(keeper,{x:FIELD.right-28,y:clamp(e.ball.y,FIELD.goalTop+16,FIELD.goalBottom-16)},dt);return;}

  if(q.boxPhase==='protect'){
    q.phase='Proteger de espaldas';
    const shieldLane={x:775,y:clamp(FIELD.centerY+side*105,220,480)};
    e.dribbleTo(e.player,shieldLane,dt);
    e.defend(def,{x:e.ball.x-28,y:e.ball.y+side*8},dt);
    if(e.ball.lastPlayerId===e.player.id||dist(e.player,e.ball)<e.player.r+e.ball.r+7)q.protectTime+=dt;
    if(q.protectTime>=.72||e.repProgress()>.24){q.boxPhase='turn';e.flashTraining('PROTEGIDA');}
    return;
  }

  if(q.boxPhase==='turn'){
    q.phase='Girar hacia el lado libre';
    const turnLane={x:850,y:clamp(FIELD.centerY-side*72,245,455)};
    e.dribbleTo(e.player,turnLane,dt);
    // The defender trails the hip instead of teleporting across the striker's turn lane.
    e.defend(def,{x:e.ball.x-24,y:e.ball.y+side*32},dt);
    if(e.ball.x>812&&(dist(e.player,def)>22||Math.abs(e.ball.y-def.y)>38||e.repProgress()>.52)){
      q.turnComplete=true;q.boxPhase='finish';m.duelsBeaten=(m.duelsBeaten||0)+1;e.flashTraining('GIRO');
    }
    return;
  }

  q.phase='Terminar la ventaja';
  if(keeper)e.move(keeper,{x:FIELD.right-28,y:clamp(e.ball.y,FIELD.goalTop+16,FIELD.goalBottom-16)},dt);
  e.defend(def,{x:e.ball.x-20,y:e.ball.y+side*18},dt);
  const target={x:FIELD.right+26,y:keeper?.y<FIELD.centerY?FIELD.goalBottom-20:FIELD.goalTop+20};
  if(e.tryKick(e.player,target,7.35,'shot',null,dt)){
    q.shotTick=e.tick;q.shotStartX=e.ball.x;m.shots=Math.max(1,m.shots||0);
    // Completing protection + turn + a clean shot is the football objective; a goal is bonus evidence.
    if(q.turnComplete&&e.ball.vx>0){q.repSuccess=true;e.flashTraining('REMATE');}
  }
}

export class TrainingMatchEngine extends TrainingMatchEngineV2{
  constructor(drill,result,player){super(drill,result,player);this.trainingEngineVersion=3;}
  resetRep(rep,initial=false){super.resetRep(rep,initial);if(this.drill?.id==='st-box-duel')setupBoxDuel(this,rep);}
  scenario(dt){if(this.drill?.id==='st-box-duel')return boxDuelScenario(this,dt);return super.scenario(dt);}
  sessionResult(){const out=super.sessionResult();return{...out,engineVersion:3};}
}

export const __trainingMatchEngineV3={setupBoxDuel,boxDuelScenario,cleanFinish};
