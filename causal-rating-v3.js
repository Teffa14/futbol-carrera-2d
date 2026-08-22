import {MatchEngine} from './engine.js';
import {FIELD} from './football-rules-v2.js';
import {bestAttackingSpace} from './collective-space-play-v1.js';
import {chemistryAdjustedPassOptions} from './chemistry-decision-v1.js';
import {__evaluationV2} from './match-evaluation-v2.js';
import './causal-positional-rating-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const add=(engine,p,cat,value,label,key='',cooldown=0)=>__evaluationV2.add(engine,p,cat,value,label,key,cooldown);
function progress(team,x){return team===0?(x-FIELD.left)/(FIELD.right-FIELD.left):(FIELD.right-x)/(FIELD.right-FIELD.left);}

export function shotQuality(engine,p,start={x:p?.x??FIELD.centerX,y:p?.y??FIELD.centerY}){
  if(!p)return 0;const goalX=p.team===0?FIELD.right:FIELD.left,goalDistance=Math.abs(goalX-start.x),central=1-clamp(Math.abs(start.y-FIELD.centerY)/255,0,1),prog=clamp(progress(p.team,start.x),0,1),nearest=Math.min(...engine.players.filter(o=>o.team!==p.team&&o.role!=='GK').map(o=>dist(o,start)),140),pressure=clamp((62-nearest)/62,0,1),keeper=engine.players.find(o=>o.team!==p.team&&o.role==='GK'),keeperOff=keeper?clamp(Math.abs(keeper.y-FIELD.centerY)/90,0,1):0,shooting=Number(p.data?.shooting??60),composure=Number(p.data?.composure??65);
  return clamp(.04+prog*.27+central*.19+(1-clamp(goalDistance/560,0,1))*.20+shooting/100*.14+composure/100*.08+keeperOff*.08-pressure*.17,0,.92);
}

export function spaceContribution(engine,p,actor=null){
  if(!p||p.role==='GK'||!actor||actor.team!==p.team||actor.id===p.id)return{value:0,option:null,space:null};
  const options=chemistryAdjustedPassOptions(engine,actor),option=options.find(o=>o.player.id===p.id)||null,space=bestAttackingSpace(engine,p,actor),near=space?clamp(1-dist(p,space)/115,0,1):0,passSignal=option?clamp((option.adjustedScore+.05)/.72,0,1):0,arrival=space?clamp((space.arrivalAdvantage+.35)/1.7,0,1):0,runKind=p.spaceRun?.kind||'';let runBonus=0;if(runKind==='pass-and-run'||runKind==='attack-cross-trajectory')runBonus=.18;else if(runKind==='occupy-space')runBonus=.08;
  return{value:clamp(near*.30+passSignal*.39+arrival*.23+runBonus,0,1),option,space};
}

function evaluateSpaces(engine){
  const possession=engine.inferPossessionTeam?.();if(possession!==0&&possession!==1)return;const actor=engine.ballActor(possession);if(!actor)return;
  for(const p of engine.players){if(p.team!==possession||p.id===actor.id||p.role==='GK')continue;const c=spaceContribution(engine,p,actor);if(c.value>.55)add(engine,p,'offBall',.018+(c.value-.55)*.075,c.option?.kind==='through'||c.option?.kind==='lob-through'?'Ruptura que ofrece pase profundo':'Ocupa un espacio útil',`space-${p.id}`,42);if(c.option?.adjustedScore>.43&&c.option.open>18)add(engine,p,'tactical',.018+clamp(c.option.adjustedScore-.43,0,.35)*.08,'Se ofrece en una línea de pase',`lane-${p.id}`,54);}
}

const previousExecuteKick=MatchEngine.prototype.executeKick;
MatchEngine.prototype.executeKick=function causalShotChoice(p,contactNormal){
  const intent=p?.kickIntent?{...p.kickIntent}:null,start={x:this.ball.x,y:this.ball.y},beforeOnTarget=p?.perf?.shotsOnTarget??0,result=previousExecuteKick.call(this,p,contactNormal);if(!result||!p)return result;
  if(intent?.type==='shot'){
    const quality=shotQuality(this,p,start),onTarget=(p.perf?.shotsOnTarget??0)>beforeOnTarget;this.ball.causalShot={shooterId:p.id,quality,onTarget,tick:this.tick};
    const choice=.012+quality*.055;add(this,p,'shooting',choice,quality>.58?'Remate desde una buena situación':'Remate con amenaza',`shot-quality-${this.tick}`,1);
    if(onTarget)add(this,p,'shooting',.025+quality*.065,'Remate al arco',`shot-target-${this.tick}`,1);
  }
  return result;
};

const previousTouch=MatchEngine.prototype.registerPhysicalTouch;
MatchEngine.prototype.registerPhysicalTouch=function causalPassAndShotTouch(p,type='touch'){
  const ep=this.ball?.evaluationPass?{...this.ball.evaluationPass}:null,shot=this.ball?.causalShot?{...this.ball.causalShot}:null,result=previousTouch.call(this,p,type);
  if(ep&&ep.receiverId===p?.id){const passer=this.playerById(ep.passerId);if(passer?.team===p.team){const gain=Math.max(0,Number(ep.value)||0),bonus=.012+gain*.16;add(this,passer,'passing',bonus,gain>.14?'Pase que rompe y mejora la jugada':gain>.06?'Pase progresivo útil':'Pase útil',`causal-pass-${ep.tick}`,1);}}
  if(shot&&p?.team!==this.playerById(shot.shooterId)?.team){const shooter=this.playerById(shot.shooterId);if(shooter&&p.role==='GK')add(this,shooter,'shooting',.025+shot.quality*.075,'Remate que obliga a atajar',`forced-save-${shot.tick}`,1);this.ball.causalShot=null;}
  if(p&&this.ball?.causalShot&&this.tick-this.ball.causalShot.tick>85)this.ball.causalShot=null;
  return result;
};

const previousPushEvent=MatchEngine.prototype.pushEvent;
MatchEngine.prototype.pushEvent=function causalMajorEvent(text,team=null,type='info'){
  if(/palo/i.test(String(text||''))&&this.ball?.causalShot){const shot=this.ball.causalShot,shooter=this.playerById(shot.shooterId);if(shooter)add(this,shooter,'shooting',.07+shot.quality*.07,'Remate al palo',`post-${shot.tick}`,1);}
  return previousPushEvent.call(this,text,team,type);
};

const previousStep=MatchEngine.prototype.step;
MatchEngine.prototype.step=function causalSpaceStep(dt){const result=previousStep.call(this,dt);if(!this.finished&&this.tick%18===0&&!this.restart?.active)evaluateSpaces(this);return result;};

export const __causalRatingV3={shotQuality,spaceContribution,evaluateSpaces};
