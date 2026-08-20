import {roleFamily} from './role-contract-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export const ROLE_RATING_WEIGHTS={
  keeper:{universal:1,goalkeeping:1.55,defending:1.15,passing:.9,possession:.85,offBall:.85,dribbling:.55,shooting:.35,errors:1},
  'centre-back':{universal:1,goalkeeping:.25,defending:1.5,passing:1.05,possession:1.1,offBall:1.18,dribbling:.62,shooting:.45,errors:1.08},
  fullback:{universal:1,goalkeeping:.25,defending:1.28,passing:1.08,possession:1.02,offBall:1.14,dribbling:.95,shooting:.62,errors:1.04},
  midfielder:{universal:1,goalkeeping:.25,defending:.98,passing:1.35,possession:1.28,offBall:1.2,dribbling:1.02,shooting:.78,errors:1.08},
  winger:{universal:1,goalkeeping:.25,defending:.62,passing:1.08,possession:1.02,offBall:1.12,dribbling:1.38,shooting:1.12,errors:1.08},
  striker:{universal:1,goalkeeping:.25,defending:.55,passing:.9,possession:.92,offBall:1.18,dribbling:1.15,shooting:1.48,errors:1.1},
};

export function ratingWeightFor(role,category){
  const family=roleFamily(role),weights=ROLE_RATING_WEIGHTS[family]||ROLE_RATING_WEIGHTS.midfielder;
  return Number(weights[category]??1);
}

const PASS_KIND_VALUE={support:.02,progressive:.09,through:.18,'lob-through':.15,switch:.11,cross:.13,cutback:.2,wall:.12};

export function passFootballValue({role='CM',forward=0,distance=100,open=35,targetSpace=45,kind='support',pressure=0}={}){
  const family=roleFamily(role),progress=clamp(forward/230,-.55,1.1),lane=clamp((open-10)/62,-.45,1.05),target=clamp((targetSpace-15)/78,-.35,1),security=1-clamp(pressure,0,1),distanceCost=clamp((distance-260)/650,0,.22);
  const familyBias=family==='midfielder'?.08:family==='centre-back'?.045:family==='striker'&&forward>45?.04:0;
  return clamp(progress*.30+lane*.24+target*.22+security*.10+(PASS_KIND_VALUE[kind]||0)+familyBias-distanceCost,-.75,1.25);
}

export function dribbleFootballValue({role='CM',forwardSpace=60,pressure=.3,progress=.5,dribbling=65,control=65,defenderDistance=45}={}){
  const family=roleFamily(role),space=clamp((forwardSpace-24)/90,-.45,1),technical=clamp((dribbling+control-110)/90,-.35,1),duel=clamp((58-defenderDistance)/42,-.2,1),risk=clamp(pressure,0,1),roleBias=family==='winger'?.16:family==='striker'?.10:family==='centre-back'?-.12:0;
  return clamp(space*.30+technical*.24+duel*.12+clamp(progress,0,1)*.12+roleBias-risk*.28,-.8,1.15);
}

export function shotFootballValue({role='ST',progress=.7,central=.7,pressure=.3,shooting=65,goalDistance=240}={}){
  const family=roleFamily(role),tech=clamp((shooting-45)/55,0,1),distance=1-clamp((goalDistance-90)/360,0,1),roleBias=family==='striker'?.13:family==='winger'?.06:family==='centre-back'?-.10:0;
  return clamp(clamp(progress,0,1)*.24+clamp(central,0,1)*.18+tech*.24+distance*.24+roleBias-clamp(pressure,0,1)*.18,-.65,1.2);
}

export function defensiveFootballValue({role='CB',won=false,shielding=false,intensity=.5,forcedBackward=false}={}){
  const family=roleFamily(role),roleBias=['centre-back','fullback'].includes(family)?.12:family==='midfielder'?.05:0;
  return clamp((won?.36:-.12)+(shielding?.08:0)+(forcedBackward?.16:0)+clamp(intensity,0,1)*.18+roleBias,-.45,.9);
}

export const __footballValueV1={clamp,PASS_KIND_VALUE};
