const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function roleFamily(role){
  if(role==='GK')return'GK';
  if(role==='CB')return'CB';
  if(['LB','RB','LWB','RWB'].includes(role))return'FB';
  if(role==='CDM')return'CDM';
  if(role==='CM')return'CM';
  if(role==='CAM')return'CAM';
  if(['LW','RW','LM','RM'].includes(role))return'W';
  return'ST';
}

function progress(player,field){
  const width=Math.max(1,field.right-field.left);
  return player.team===0?(player.x-field.left)/width:(field.right-player.x)/width;
}

function laneProfile(player,candidate,field){
  const aim=candidate?.aim||candidate?.target||player;
  const fieldHeight=Math.max(1,field.bottom-field.top);
  const wide=Math.abs((aim.y-field.centerY)/(fieldHeight*.5))>.58;
  const dir=player.team===0?1:-1;
  const forward=(aim.x-player.x)*dir;
  const lateral=Math.abs(aim.y-player.y);
  return{wide,forward,lateral};
}

export function roleDecisionContext({player,candidate,field,pressure=0}={}){
  const phaseProgress=clamp(progress(player,field),0,1);
  const lane=laneProfile(player,candidate,field);
  return{
    family:roleFamily(player.role),
    progress:phaseProgress,
    pressure:clamp(Number(pressure)||0,0,1),
    defensiveThird:phaseProgress<.34,
    middleThird:phaseProgress>=.34&&phaseProgress<.67,
    finalThird:phaseProgress>=.67,
    ...lane,
  };
}

export function applyRoleDecisionPolicy({player,candidate,field,pressure=0}={}){
  if(!player||!candidate||!field)return{...candidate,allowed:true,roleDelta:0,roleReason:'neutral'};
  const c=roleDecisionContext({player,candidate,field,pressure});
  let allowed=true,delta=0,reason='neutral';
  const type=candidate.type;

  if(c.family==='GK'){
    if(type==='shot'||type==='dribble'){allowed=false;reason='keeper-safety';}
    else if(type==='pass'){delta+=candidate.kind==='support'?.13:.04;reason='keeper-distribution';}
  }

  if(c.family==='CB'){
    if(type==='dribble'&&c.defensiveThird&&c.pressure>.42){allowed=false;reason='centre-back-protects-central-loss';}
    else if(type==='shot'&&!c.finalThird){allowed=false;reason='centre-back-holds-structure';}
    else if(type==='pass'){
      if(c.forward>28)delta+=.12;
      if(candidate.kind==='support'&&c.pressure>.55)delta+=.08;
      reason='centre-back-progress-or-secure';
    }
  }

  if(c.family==='FB'){
    if(type==='dribble'){
      if(c.wide&&c.forward>12&&c.pressure<.68)delta+=.13;
      if(!c.wide&&c.defensiveThird&&c.pressure>.48)delta-=.18;
      reason='fullback-uses-wide-lane';
    }else if(type==='pass'&&c.forward>24){delta+=.08;reason='fullback-progresses-outside';}
  }

  if(c.family==='CDM'){
    if(type==='dribble'&&c.pressure>.48){delta-=.24;reason='pivot-avoids-central-turnover';}
    else if(type==='pass'){
      if(candidate.kind==='progressive'||candidate.kind==='through')delta+=.15;
      else if(c.pressure>.58)delta+=.09;
      reason='pivot-connects-lines';
    }
  }

  if(c.family==='CM'){
    if(type==='pass'&&(candidate.kind==='progressive'||candidate.kind==='through')){delta+=.14;reason='midfielder-breaks-line';}
    else if(type==='dribble'&&c.middleThird&&c.pressure<.45){delta+=.06;reason='midfielder-carries-into-space';}
  }

  if(c.family==='CAM'){
    if(type==='pass'&&candidate.kind==='through'){delta+=.17;reason='creator-attacks-last-line';}
    else if(type==='dribble'&&c.finalThird&&c.pressure<.7){delta+=.12;reason='creator-commits-defender';}
    else if(type==='shot'&&c.finalThird){delta+=.08;reason='creator-finishing-window';}
  }

  if(c.family==='W'){
    if(type==='dribble'&&c.wide&&c.finalThird&&c.pressure<.78){delta+=.18;reason='winger-isolation';}
    else if(type==='pass'&&candidate.kind==='through'&&c.finalThird){delta+=.08;reason='winger-releases-runner';}
    else if(type==='shot'&&c.finalThird&&!c.wide){delta+=.11;reason='winger-inside-finishing';}
  }

  if(c.family==='ST'){
    if(type==='shot'&&c.finalThird){delta+=.19;reason='striker-finishes';}
    else if(type==='pass'&&candidate.kind==='support'&&c.pressure>.52){delta+=.11;reason='striker-layoff-under-contact';}
    else if(type==='dribble'&&c.finalThird&&c.pressure<.55){delta+=.06;reason='striker-attacks-last-defender';}
  }

  const value=Number(candidate.value||0)+delta;
  return{...candidate,allowed,value,roleDelta:delta,roleReason:reason,roleContext:c};
}

export function rankRoleAwareCandidates({player,candidates=[],field,pressure=0}={}){
  return candidates
    .map(candidate=>applyRoleDecisionPolicy({player,candidate,field,pressure}))
    .filter(candidate=>candidate.allowed)
    .sort((a,b)=>b.value-a.value);
}

export const __roleDecisionPolicyTest={roleFamily,progress,laneProfile};
