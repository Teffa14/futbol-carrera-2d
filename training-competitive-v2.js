import {TrainingMatchEngine} from './training-match-engine-v1.js';
import {FIELD} from './football-rules-v2.js';
import {crossTrajectoryTarget,bestAttackingSpace} from './collective-space-play-v1.js';
import {chemistryAdjustedPassOptions,armChemistryPass} from './chemistry-decision-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const LIVE_KINDS=new Set(['1v1','2v2','3v3']);
function attackDir(team){return team===0?1:-1;}
function isAttacker(p){return p?.team===0&&p.role!=='GK';}
function nearestOpponent(e,p){return e.players.filter(o=>o.team!==p.team&&o.role!=='GK').sort((a,b)=>dist(a,p)-dist(b,p))[0]||null;}
function activeKeeper(e){return e.players.find(p=>p.team===1&&p.role==='GK')||e.defenderPool?.find?.(p=>p.role==='GK')||null;}
function goalDistance(p){return Math.abs((p.team===0?FIELD.right:FIELD.left)-p.x);}

function ensureKeeper(e){
  const keeper=e.defenderPool?.find?.(p=>p.role==='GK');if(!keeper)return null;if(!e.players.includes(keeper))e.players.push(keeper);e.trainingKeeper=keeper;e.resetActor(keeper,FIELD.right-27,FIELD.centerY,'GK');return keeper;
}

export function competitiveObjective(kind){
  if(kind==='1v1')return'Ganale el duelo, conservá la ventaja y terminá la jugada en gol';
  if(kind==='2v2')return'Creá una ventaja de 2v2, pasá y movete, y terminá en gol. Si la perdés, recuperala';
  if(kind==='3v3')return'Mové la defensa, atacá el espacio libre y terminá en gol. La posesión puede cambiar';
  if(kind==='cross')return'Generá el centro que pide la jugada y atacá su trayectoria hasta rematar';
  return'';
}

const previousReset=TrainingMatchEngine.prototype.resetRep;
TrainingMatchEngine.prototype.resetRep=function competitiveTrainingReset(rep,initial=false){
  const out=previousReset.call(this,rep,initial),k=this.drill?.kind,q=this.trainingQualityV6;if(!LIVE_KINDS.has(k)&&k!=='cross')return out;
  const lengths={'1v1':10.5,'2v2':12.0,'3v3':13.0,cross:11.5};this.repLength=lengths[k]||this.repLength;this.duration=this.repLength*Math.max(1,this.result?.reps||1);this.repStart=rep*this.repLength;q.objective=competitiveObjective(k);q.repSuccess=false;q.goal=false;q.finishShot=false;q.pendingPass=null;q.possessionId='training-user';
  const keeper=ensureKeeper(this);if(keeper){const offset=(rep%3-1)*22;keeper.y=clamp(FIELD.centerY+offset,FIELD.goalTop+15,FIELD.goalBottom-15);keeper.homeY=keeper.y;}
  if(k==='1v1'){
    const side=rep%2?1:-1;this.resetActor(this.player,610,FIELD.centerY+side*105,'RW');this.resetBall(628,this.player.y);const d=this.defenders[0];this.resetActor(d,755,FIELD.centerY+side*42,'CB');q.branch=null;
  }else if(k==='2v2'){
    this.resetActor(this.player,565,475,'CM');this.resetActor(this.mates[0],650,250,'ST');this.resetBall(582,475);this.resetActor(this.defenders[0],700,430,'CB');this.resetActor(this.defenders[1],790,300,'CB');
  }else if(k==='3v3'){
    this.resetActor(this.player,525,490,'CM');this.resetActor(this.mates[0],635,245,'CAM');this.resetActor(this.mates[1],685,500,'RW');this.resetBall(542,490);this.resetActor(this.defenders[0],680,410,'CB');this.resetActor(this.defenders[1],770,285,'CB');this.resetActor(this.defenders[2],820,500,'LB');
  }else if(k==='cross'){
    const side=rep%2?1:-1,wideY=FIELD.centerY+side*245;this.resetActor(this.player,710,wideY,'RW');this.resetBall(727,wideY);this.resetActor(this.mates[0],820,FIELD.centerY-side*42,'ST');this.resetActor(this.mates[1],850,FIELD.centerY+side*68,'ST');this.resetActor(this.mates[2],760,FIELD.centerY+side*125,'CAM');this.resetActor(this.defenders[0],770,wideY-side*34,'RB');this.resetActor(this.defenders[1],865,FIELD.centerY+side*8,'CB');q.deliveryChoice=null;q.delivered=false;
  }
  this.repOrigin={px:this.player.x,py:this.player.y,bx:this.ball.x,by:this.ball.y};return out;
};

function markRealGoal(e){const q=e.trainingQualityV6,m=e.trainingMetricsV6;if(!e.goalScored())return false;if(!q.goal){q.goal=true;q.repSuccess=true;m.goals++;e.flashTraining('GOL');}return true;}
function openShot(e,p){if(!p||p.team!==0||goalDistance(p)>270)return false;const opp=nearestOpponent(e,p),pressure=opp?dist(opp,p):120,central=Math.abs(p.y-FIELD.centerY)<145;return pressure>22&&(central||goalDistance(p)<175);}

function liveContest(e,dt){
  const q=e.trainingQualityV6;if(markRealGoal(e))return;e.observeTouches();const possession=e.inferPossessionTeam(),actors=[e.ballActor(0),e.ballActor(1)],pressers=[e.selectPressers(0),e.selectPressers(1)];q.phase=possession===0?'Crear ventaja y terminar':possession===1?'Transición: recuperar':'Pelota dividida';
  for(const p of e.players){const actor=actors[p.team];if(actor?.id===p.id&&dist(p,e.ball)<p.r+e.ball.r+9&&!p.kickIntent&&!p.dribbleIntent&&p.decisionCooldown<=0){if(isAttacker(p)&&openShot(e,p)){e.armShot(p,goalDistance(p));p.decisionCooldown=.34;q.finishShot=true;}else e.prepareBallAction(p);}const target=e.aiTarget(p,pressers[p.team],actor,possession);e.move(p,target,dt);}
  const defenderActor=actors[1];if(defenderActor&&dist(defenderActor,e.ball)<defenderActor.r+e.ball.r+10&&e.ball.x<470){q.phase='La oposición salió de la zona';q.repSuccess=false;}
}

export function chooseCrossOption(e,crosser){
  const options=chemistryAdjustedPassOptions(e,crosser).filter(o=>['cross','cutback'].includes(o.kind)&&o.player.team===0);if(options.length)return options[0];const mates=e.mates.filter(isAttacker),keeper=activeKeeper(e),side=Math.sign(crosser.y-FIELD.centerY)||1,near=mates.slice().sort((a,b)=>Math.abs(a.y-(FIELD.centerY-side*38))-Math.abs(b.y-(FIELD.centerY-side*38)))[0],far=mates.slice().sort((a,b)=>Math.abs(a.y-(FIELD.centerY+side*58))-Math.abs(b.y-(FIELD.centerY+side*58)))[0],cut=mates.slice().sort((a,b)=>a.x-b.x)[0],boxDef=e.defenders.find(d=>d.role!=='GK'&&Math.abs(d.y-FIELD.centerY)<95),nearCrowded=near&&boxDef&&dist(near,boxDef)<55,keeperNear=keeper&&Math.abs(keeper.y-(near?.y??FIELD.centerY))<42,receiver=(nearCrowded||keeperNear?far:near)||cut||mates[0],kind=receiver===cut&&dist(cut,{x:FIELD.right-170,y:FIELD.centerY})<155?'cutback':'cross',aim=kind==='cutback'?{x:FIELD.right-175,y:clamp(FIELD.centerY+side*45,FIELD.goalTop-65,FIELD.goalBottom+65)}:{x:FIELD.right-92,y:clamp(receiver?.y??FIELD.centerY,FIELD.goalTop-50,FIELD.goalBottom+50)};return receiver?{player:receiver,kind,aim,open:60,score:.48,adjustedScore:.48,chemistry:50,hierarchy:.5,loft:kind==='cross'}:null;
}

function crossContest(e,dt){
  const q=e.trainingQualityV6;if(markRealGoal(e))return;e.observeTouches();const crosser=e.player,wideDef=e.defenders[0],keeper=activeKeeper(e),ballActor=e.ballActor(0);
  if(!q.delivered){q.phase='Ganar línea y leer el área';const laneOpen=!wideDef||dist(wideDef,e.ball)>60||e.ball.x>wideDef.x+8;if(!laneOpen||e.ball.x<FIELD.right-235){e.dribbleTo(crosser,{x:FIELD.right-175,y:clamp(crosser.y,FIELD.top+28,FIELD.bottom-28)},dt);if(wideDef)e.defend(wideDef,{x:e.ball.x+35,y:e.ball.y+(FIELD.centerY-e.ball.y)*.08},dt);for(const mate of e.mates)e.move(mate,bestAttackingSpace(e,mate,crosser),dt);if(keeper)e.move(keeper,e.aiTarget(keeper,[],e.ballActor(1),0),dt);return;}const option=chooseCrossOption(e,crosser);if(option&&!crosser.kickIntent){q.deliveryChoice=option.kind;e.trainingMetricsV6.deliveryChoices.add(option.kind);q.delivered=armChemistryPass(e,crosser,option);if(q.delivered){e.trainingMetricsV6.deliveries++;e.pending(crosser,option.player,option.kind);e.ball.flightKind=option.kind;e.ball.flightReceiverId=option.player.id;e.ball.flightAttackingTeam=0;e.ball.flightStartedTick=e.tick;}}
  }
  q.phase='Atacar trayectoria y rematar';const possession=e.inferPossessionTeam(),actors=[e.ballActor(0),e.ballActor(1)],pressers=[e.selectPressers(0),e.selectPressers(1)];for(const p of e.players){let target;if(p.team===0&&p.id!==crosser.id){const trajectory=crossTrajectoryTarget(e,p);target=trajectory||e.aiTarget(p,pressers[p.team],actors[p.team],possession);}else target=e.aiTarget(p,pressers[p.team],actors[p.team],possession);if(actors[p.team]?.id===p.id&&p.team===0&&p.id!==crosser.id&&dist(p,e.ball)<p.r+e.ball.r+11&&!p.kickIntent){if(openShot(e,p)||p.x>FIELD.right-205){e.armShot(p,goalDistance(p));q.finishShot=true;}else e.prepareBallAction(p);}e.move(p,target,dt);}
}

const previousScenario=TrainingMatchEngine.prototype.scenario;
TrainingMatchEngine.prototype.scenario=function competitiveTrainingScenario(dt){const k=this.drill?.kind;if(LIVE_KINDS.has(k))return liveContest(this,dt);if(k==='cross')return crossContest(this,dt);return previousScenario.call(this,dt);};

export const __trainingCompetitiveV2={competitiveObjective,chooseCrossOption,liveContest,crossContest,ensureKeeper,openShot};
