import {MatchEngine} from './engine.js';
import {evaluatePassOptions,armIntentPass} from './passing-intelligence-v2.js';
import {engineHierarchy,enginePairChemistry} from './team-chemistry-v1.js';
import {FIELD} from './football-rules-v2.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function dist(a,b){return Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));}

export function chemistryAdjustedPassOptions(engine,p){
  return evaluatePassOptions(engine,p).map(option=>{
    const chemistry=enginePairChemistry(p,option.player),hierarchy=engineHierarchy(option.player),chemSignal=(chemistry-50)/50,focalSignal=(hierarchy-.45)/.55,baseViability=clamp((option.score+.15)/.8,0,1),openSignal=clamp((option.open-8)/55,0,1);
    const combination=['support','progressive','through','lob-through','cutback'].includes(option.kind),chemistryBonus=chemSignal*(combination?.105:.055)*(0.55+baseViability*.45),focalBonus=clamp(focalSignal,-.6,1)*.115*baseViability*(.55+openSignal*.45),adjustedScore=option.score+chemistryBonus+focalBonus;
    return{...option,chemistry,hierarchy,chemistryBonus,focalBonus,adjustedScore};
  }).sort((a,b)=>b.adjustedScore-a.adjustedScore);
}

function coordinatedAim(option){
  const m=option.player,chemSignal=(option.chemistry-50)/50,kindScale=option.kind==='through'||option.kind==='lob-through'?3.1:option.kind==='progressive'||option.kind==='support'?1.7:.9;
  return{...option,aim:{x:clamp(option.aim.x+(m.vx||0)*chemSignal*kindScale,FIELD.left+18,FIELD.right-18),y:clamp(option.aim.y+(m.vy||0)*chemSignal*kindScale,FIELD.top+16,FIELD.bottom-16)}};
}

export function armChemistryPass(engine,p,rawOption){
  const option=coordinatedAim(rawOption),ok=armIntentPass(engine,p,option);if(!ok)return false;const receiver=option.player,delay=Math.round(clamp((58-option.chemistry)/7,0,6));
  if(receiver.receiveIntent){receiver.receiveIntent.chemistry=option.chemistry;receiver.receiveIntent.hierarchy=option.hierarchy;receiver.receiveIntent.readyTick=engine.tick+delay;receiver.receiveIntent.coordinationDelay=delay;}
  if(p.passIntent){p.passIntent.chemistry=option.chemistry;p.passIntent.hierarchy=option.hierarchy;}
  return true;
}

function clearOldPassIntent(engine,p,receiverId){
  if(receiverId){const old=engine.playerById(receiverId);if(old?.receiveIntent?.fromId===p.id)old.receiveIntent=null;}p.kickIntent=null;p.passIntent=null;
}

const previousPrepare=MatchEngine.prototype.prepareBallAction;
MatchEngine.prototype.prepareBallAction=function chemistryHierarchyDecision(p){
  if(!p)return previousPrepare.call(this,p);const hadKick=Boolean(p.kickIntent),hadDribble=Boolean(p.dribbleIntent),result=previousPrepare.call(this,p);if(hadKick||hadDribble)return result;
  const options=chemistryAdjustedPassOptions(this,p),best=options[0];if(!best)return result;
  const currentReceiverId=p.kickIntent?.type==='pass'?p.kickIntent.receiverId:null,current=options.find(o=>o.player.id===currentReceiverId);
  if(current){const meaningfulUpgrade=best.player.id!==current.player.id&&best.adjustedScore>current.adjustedScore+.035&&best.score>current.score-.11;if(meaningfulUpgrade){clearOldPassIntent(this,p,currentReceiverId);return armChemistryPass(this,p,best);}if(p.kickIntent&&current.player.id===currentReceiverId){const delay=Math.round(clamp((58-current.chemistry)/7,0,6)),receiver=current.player;receiver.receiveIntent&&(receiver.receiveIntent.readyTick=this.tick+delay,receiver.receiveIntent.chemistry=current.chemistry,receiver.receiveIntent.hierarchy=current.hierarchy);}}
  if(!p.kickIntent&&p.dribbleIntent&&best.hierarchy>.72&&best.adjustedScore>.58&&best.score>.10&&dist(p,best.player)>42){p.dribbleIntent=null;return armChemistryPass(this,p,best);}
  return result;
};

const previousAiTarget=MatchEngine.prototype.aiTarget;
MatchEngine.prototype.aiTarget=function chemistryRecognitionTiming(p,pressers,actor,possession){
  const intent=p?.receiveIntent;if(intent&&Number.isFinite(intent.readyTick)&&this.tick<intent.readyTick){p.receiveIntent=null;const target=previousAiTarget.call(this,p,pressers,actor,possession);p.receiveIntent=intent;return target;}return previousAiTarget.call(this,p,pressers,actor,possession);
};

export const __chemistryDecisionTest={coordinatedAim};
