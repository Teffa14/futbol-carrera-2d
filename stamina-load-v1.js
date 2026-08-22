import {MatchEngine} from './engine.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const speed=p=>Math.hypot(Number(p?.vx)||0,Number(p?.vy)||0);

export function staminaProfile(player){
  const stamina=clamp(Number(player?.data?.stamina??player?.data?.physical??70),30,99);
  return{
    stamina,
    loadResistance:.62+stamina/100*.58,
    recoveryPerSecond:.13+stamina/100*.18,
    repeatEffort:.72+stamina/100*.42,
  };
}

export function effortLoad({speedRatio=0,acceleration=0,burst=false,pressing=false}={}){
  const running=Math.pow(clamp(speedRatio,0,1.35),2)*.50;
  const accel=clamp(acceleration,0,2.5)*.20;
  const burstCost=burst?.34:0;
  const pressCost=pressing?.18:0;
  return running+accel+burstCost+pressCost;
}

export function fatigueMovementFactor(fatigue=0,stamina=70){
  const tired=clamp(Number(fatigue)||0,0,100)/100;
  const resilience=.72+clamp(Number(stamina)||70,30,99)/100*.28;
  const lateLoss=Math.pow(tired,1.55)*(1.02-resilience*.35);
  return clamp(1-lateLoss,.58,1);
}

const originalMovePlayer=MatchEngine.prototype.movePlayer;
MatchEngine.prototype.movePlayer=function staminaAwareMove(p,target,dt,track){
  if(!p)return originalMovePlayer.call(this,p,target,dt,track);
  const beforeFatigue=Number(p.fatigue)||0,beforeSpeed=speed(p),profile=staminaProfile(p);
  const result=originalMovePlayer.call(this,p,target,dt,track);
  if(!track)return result;

  const afterSpeed=speed(p),pace=clamp(Number(p.data?.pace)||70,30,99),estimatedTop=2.55+pace/100*1.95;
  const speedRatio=afterSpeed/Math.max(.1,estimatedTop),acceleration=Math.max(0,afterSpeed-beforeSpeed)/Math.max(.001,dt*60);
  const action=String(p.action||'').toLowerCase();
  const pressing=/pres|press|entrada|tackle/.test(action)||p._pressing===true;
  const load=effortLoad({speedRatio,acceleration,burst:p.burstTimer>0,pressing});
  const baseDelta=Math.max(0,(Number(p.fatigue)||0)-beforeFatigue);
  const active=load>.075;
  const extra=active?dt*load*8.2/profile.loadResistance:0;
  const recovery=!active||speedRatio<.24?dt*profile.recoveryPerSecond*(1-speedRatio*.7):0;
  p.fatigue=clamp(beforeFatigue+baseDelta*.58+extra-recovery,0,100);
  p.staminaState={
    load:+load.toFixed(3),
    intensity:speedRatio>.88?'sprint':speedRatio>.58?'high':speedRatio>.28?'medium':'low',
    movementFactor:+fatigueMovementFactor(p.fatigue,profile.stamina).toFixed(3),
    fatigue:+p.fatigue.toFixed(2),
  };
  return result;
};

const originalTurnPlayer=MatchEngine.prototype.turnPlayer;
MatchEngine.prototype.turnPlayer=function fatigueAwareTurn(p,desired,dt){
  if(!p)return originalTurnPlayer.call(this,p,desired,dt);
  const stamina=Number(p.data?.stamina??p.data?.physical??70),factor=fatigueMovementFactor(p.fatigue,stamina);
  return originalTurnPlayer.call(this,p,desired,dt*(.78+.22*factor));
};

export const __staminaLoadV1={staminaProfile,effortLoad,fatigueMovementFactor};
