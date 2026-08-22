import {MatchEngine} from './engine.js';
import {FIELD} from './football-rules-v2.js';
import {chemistryAdjustedPassOptions} from './chemistry-decision-v1.js';
import {passFootballValue,__evaluationV2} from './match-evaluation-v2.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const add=(engine,p,cat,value,label,key='',cooldown=0)=>__evaluationV2.add(engine,p,cat,value,label,key,cooldown);
const roleFamily=role=>role==='GK'?'GK':role==='CB'?'CB':['LB','RB','LWB','RWB'].includes(role)?'FB':['CDM','CM','CAM','LM','RM'].includes(role)?'MID':['LW','RW'].includes(role)?'W':'ST';
const attackDir=team=>team===0?1:-1;

function pointSegmentDistance(p,a,b){
  const vx=(b?.x??0)-(a?.x??0),vy=(b?.y??0)-(a?.y??0),wx=(p?.x??0)-(a?.x??0),wy=(p?.y??0)-(a?.y??0),vv=vx*vx+vy*vy;
  if(vv<1e-6)return dist(p,a);
  const t=clamp((wx*vx+wy*vy)/vv,0,1),x=(a?.x??0)+vx*t,y=(a?.y??0)+vy*t;
  return Math.hypot((p?.x??0)-x,(p?.y??0)-y);
}

export function defensiveLaneValue(engine,defender,actor=null){
  if(!engine||!defender||defender.role==='GK')return{value:0,option:null,laneDistance:Infinity};
  const possession=actor?.team??engine.inferPossessionTeam?.();
  actor=actor||((possession===0||possession===1)?engine.ballActor(possession):null);
  if(!actor||actor.team===defender.team)return{value:0,option:null,laneDistance:Infinity};
  const options=chemistryAdjustedPassOptions(engine,actor).filter(o=>o?.player&&o.player.team===actor.team&&o.player.id!==actor.id);
  let best={value:0,option:null,laneDistance:Infinity};
  for(const option of options){
    const receiver=option.player,laneDistance=pointSegmentDistance(defender,actor,receiver),corridor=clamp(1-laneDistance/42,0,1);
    if(corridor<=0)continue;
    const forward=attackDir(actor.team)*(receiver.x-actor.x),progression=clamp(forward/260,0,1),threatGain=Math.max(0,passFootballValue(actor,{x:actor.x,y:actor.y},{x:receiver.x,y:receiver.y}));
    const openness=clamp(Number(option.open||0)/70,0,1),optionQuality=clamp((Number(option.adjustedScore||0)+.08)/.72,0,1);
    const value=clamp(corridor*(.28+progression*.24+threatGain*.78+optionQuality*.20+openness*.10),0,1);
    if(value>best.value)best={value,option,laneDistance};
  }
  return best;
}

export function supportOutletValue(engine,p,actor=null){
  if(!engine||!p||p.role==='GK')return{value:0,option:null};
  const possession=actor?.team??engine.inferPossessionTeam?.();
  actor=actor||((possession===0||possession===1)?engine.ballActor(possession):null);
  if(!actor||actor.team!==p.team||actor.id===p.id)return{value:0,option:null};
  const family=roleFamily(p.role);
  if(!['CB','FB','MID'].includes(family))return{value:0,option:null};
  const option=chemistryAdjustedPassOptions(engine,actor).find(o=>o?.player?.id===p.id)||null;
  if(!option)return{value:0,option:null};
  const dir=attackDir(p.team),relativeProgress=dir*(p.x-actor.x),recycleShape=clamp((45-relativeProgress)/150,0,1),lateral=clamp(Math.abs(p.y-actor.y)/190,0,1),open=clamp(Number(option.open||0)/70,0,1),quality=clamp((Number(option.adjustedScore||0)+.05)/.68,0,1);
  const ballProgress=clamp(dir*(actor.x-FIELD.centerX)/495,-1,1),securityNeed=clamp(.55-ballProgress*.22,0,.8);
  return{value:clamp(recycleShape*.30+lateral*.15+open*.20+quality*.25+securityNeed*.10,0,1),option};
}

export function turnoverSeverity(player,at={x:FIELD.centerX,y:FIELD.centerY},context={}){
  if(!player)return 0;
  const dir=attackDir(player.team),ownGoalX=player.team===0?FIELD.left:FIELD.right,ownGoalDistance=Math.abs((at?.x??FIELD.centerX)-ownGoalX),ownThird=clamp(1-ownGoalDistance/360,0,1),central=1-clamp(Math.abs((at?.y??FIELD.centerY)-FIELD.centerY)/300,0,1),pressure=clamp(Number(context.pressure||0),0,1),escape=clamp(Number(context.escapeOptions||0)/3,0,1),forwardLoss=clamp(dir*((at?.x??FIELD.centerX)-FIELD.centerX)/495,0,1);
  return clamp(.035+ownThird*.095+central*ownThird*.035+forwardLoss*.018+escape*.025-pressure*.018,.025,.18);
}

function evaluatePositioning(engine){
  const possession=engine.inferPossessionTeam?.();
  if(possession!==0&&possession!==1)return;
  const actor=engine.ballActor(possession);
  if(!actor)return;
  for(const p of engine.players){
    if(p.role==='GK'||p.id===actor.id)continue;
    if(p.team!==possession){
      const lane=defensiveLaneValue(engine,p,actor);
      if(lane.value>.48){
        add(engine,p,'defending',.014+(lane.value-.48)*.065,lane.value>.68?'Niega una línea de pase peligrosa':'Cierra una línea de pase',`lane-denial-${p.id}`,54);
        if(lane.value>.62)add(engine,p,'tactical',.010+(lane.value-.62)*.035,'Sostiene cobertura y sombra de pase',`cover-shadow-${p.id}`,72);
      }
    }else{
      const outlet=supportOutletValue(engine,p,actor);
      if(outlet.value>.58)add(engine,p,'offBall',.012+(outlet.value-.58)*.055,'Da una salida de apoyo para continuar la jugada',`support-outlet-${p.id}`,60);
      if(outlet.value>.70)add(engine,p,'tactical',.010+(outlet.value-.70)*.035,'Equilibra la circulación por detrás de la jugada',`recycle-support-${p.id}`,84);
    }
  }
}

const previousTouch=MatchEngine.prototype.registerPhysicalTouch;
MatchEngine.prototype.registerPhysicalTouch=function causalPossessionTurnoverTouch(p,type='touch'){
  const previousTeam=this.ball?.lastTeam,previousPlayerId=this.ball?.lastPlayerId,ep=this.ball?.evaluationPass?{...this.ball.evaluationPass}:null,at={x:this.ball?.x??FIELD.centerX,y:this.ball?.y??FIELD.centerY};
  const previousPlayer=previousPlayerId?this.playerById(previousPlayerId):null,contactDistance=previousPlayer&&p?dist(previousPlayer,p):Infinity;
  const result=previousTouch.call(this,p,type);
  if(!p||previousTeam===null||previousTeam===p.team||!previousPlayer||previousPlayer.team===p.team)return result;
  if(ep){
    const value=Math.max(0,Number(ep.value)||0),interception=.025+value*.075;
    add(this,p,'defending',interception,value>.10?'Intercepción de un pase que podía progresar':'Intercepción de pase',`interception-${ep.tick}`,1);
    return result;
  }
  const contested=contactDistance<62;
  const severity=turnoverSeverity(previousPlayer,at,{pressure:contested?1:.3,escapeOptions:0});
  add(this,previousPlayer,'error',-severity,contested?'Pérdida bajo duelo físico':'Pérdida de posesión',`possession-loss-${previousPlayer.id}-${this.tick}`,1);
  add(this,p,'defending',contested?.040:.025,contested?'Recuperación en disputa':'Recuperación de pelota',`recovery-${p.id}-${this.tick}`,1);
  return result;
};

const previousStep=MatchEngine.prototype.step;
MatchEngine.prototype.step=function causalPositionalRatingStep(dt){
  const result=previousStep.call(this,dt);
  if(!this.finished&&!this.restart?.active&&this.tick%18===0)evaluatePositioning(this);
  return result;
};

export const __causalPositionalRatingV1={pointSegmentDistance,defensiveLaneValue,supportOutletValue,turnoverSeverity,evaluatePositioning};
