const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export const TACTICAL_PROFILES=Object.freeze({
  'isolation-winger':Object.freeze({width:.92,halfSpace:-.35,depth:.30,support:-.18,combination:-.30,dribble:.86,directness:.48,roam:.08}),
  'combinative-winger':Object.freeze({width:.28,halfSpace:.88,depth:.08,support:.72,combination:.92,dribble:.18,directness:-.18,roam:.54}),
  'direct-striker':Object.freeze({width:-.20,halfSpace:.18,depth:.95,support:-.42,combination:-.18,dribble:.28,directness:.88,roam:.12}),
  'linking-striker':Object.freeze({width:-.12,halfSpace:.42,depth:.34,support:.88,combination:.82,dribble:.10,directness:-.16,roam:.45}),
  'playmaking-midfielder':Object.freeze({width:-.18,halfSpace:.62,depth:.18,support:.84,combination:.88,dribble:.16,directness:.20,roam:.58}),
  'holding-midfielder':Object.freeze({width:-.28,halfSpace:.18,depth:-.48,support:.72,combination:.56,dribble:-.42,directness:-.30,roam:-.38}),
  'overlapping-fullback':Object.freeze({width:.90,halfSpace:-.22,depth:.70,support:.32,combination:.44,dribble:.40,directness:.36,roam:.14}),
  'conservative-fullback':Object.freeze({width:.52,halfSpace:-.08,depth:-.36,support:.68,combination:.34,dribble:-.44,directness:-.18,roam:-.52}),
  'ball-playing-centre-back':Object.freeze({width:-.26,halfSpace:.12,depth:-.18,support:.76,combination:.64,dribble:.02,directness:.38,roam:-.56}),
  'stopper-centre-back':Object.freeze({width:-.34,halfSpace:-.10,depth:-.52,support:.20,combination:-.12,dribble:-.72,directness:.10,roam:-.68}),
});

function neutralProfile(){return{width:0,halfSpace:0,depth:0,support:0,combination:0,dribble:0,directness:0,roam:0};}

export function tacticalProfileId(player){
  const explicit=player?.tacticalProfile??player?.data?.tacticalProfile??player?.data?.tacticalProfileId;
  return typeof explicit==='string'&&TACTICAL_PROFILES[explicit]?explicit:null;
}

export function tacticalProfile(player){
  const explicit=player?.tacticalProfile??player?.data?.tacticalProfile;
  if(explicit&&typeof explicit==='object'){
    const base=neutralProfile();
    for(const key of Object.keys(base))base[key]=clamp(Number(explicit[key])||0,-1,1);
    return base;
  }
  const id=tacticalProfileId(player);
  return id?TACTICAL_PROFILES[id]:neutralProfile();
}

function normalizedLane(target,field){
  const half=Math.max(1,(field.bottom-field.top)*.5);
  return clamp(Math.abs(target.y-field.centerY)/half,0,1);
}

export function tacticalSpaceBias({player,target,anchor,field,hasPossession=false,defending=false}={}){
  if(!player||!target||!anchor||!field||player.role==='GK')return 0;
  const profile=tacticalProfile(player);
  const direction=player.team===0?1:-1;
  const forward=clamp(((target.x-anchor.x)*direction)/70,-1,1);
  const lane=normalizedLane(target,field);
  const halfSpaceFit=1-Math.min(1,Math.abs(lane-.48)/.48);
  const wideFit=clamp((lane-.48)/.52,0,1);
  const supportDistance=Math.hypot(target.x-anchor.x,target.y-anchor.y);
  const supportFit=1-clamp(supportDistance/90,0,1);
  let bias=0;

  if(hasPossession){
    bias+=profile.width*wideFit*.72;
    bias+=profile.halfSpace*halfSpaceFit*.62;
    bias+=profile.depth*forward*.58;
    bias+=profile.support*supportFit*.34;
    bias+=profile.directness*Math.max(0,forward)*.28;
    bias+=profile.roam*(1-supportFit)*.18;
  }else if(defending){
    bias+=profile.support*supportFit*.20;
    bias-=Math.max(0,profile.depth)*Math.max(0,forward)*.20;
    bias+=Math.min(0,profile.depth)*Math.max(0,forward)*.22;
  }else{
    bias+=profile.width*wideFit*.28+profile.halfSpace*halfSpaceFit*.24+profile.support*supportFit*.18;
  }

  return clamp(bias,-1,1);
}

export const __tacticalProfileTest={normalizedLane,neutralProfile};
