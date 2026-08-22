const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export const ROLE_SPACE_DECISION={
  CB:{progression:.18,width:.06,centrality:.72,support:.64,depthRisk:.08,defensiveSecurity:.92},
  LB:{progression:.52,width:.92,centrality:.16,support:.74,depthRisk:.42,defensiveSecurity:.62},
  RB:{progression:.52,width:.92,centrality:.16,support:.74,depthRisk:.42,defensiveSecurity:.62},
  CDM:{progression:.34,width:.18,centrality:.88,support:.94,depthRisk:.14,defensiveSecurity:.88},
  CM:{progression:.54,width:.34,centrality:.68,support:.86,depthRisk:.34,defensiveSecurity:.58},
  CAM:{progression:.78,width:.28,centrality:.82,support:.62,depthRisk:.68,defensiveSecurity:.24},
  LW:{progression:.84,width:.94,centrality:.22,support:.46,depthRisk:.76,defensiveSecurity:.16},
  RW:{progression:.84,width:.94,centrality:.22,support:.46,depthRisk:.76,defensiveSecurity:.16},
  ST:{progression:.96,width:.14,centrality:.90,support:.34,depthRisk:.94,defensiveSecurity:.08}
};

export function roleSpaceDecisionProfile(role){
  return ROLE_SPACE_DECISION[role]||ROLE_SPACE_DECISION.CM;
}

export function roleSpaceCandidateBias({role,attackDirection=1,anchor,target,field,hasPossession=false,defending=false}={}){
  if(!anchor||!target||!field)return 0;
  const p=roleSpaceDecisionProfile(role),dir=attackDirection>=0?1:-1;
  const spanX=Math.max(1,field.right-field.left),spanY=Math.max(1,field.bottom-field.top);
  const forward=clamp(((target.x-anchor.x)*dir)/spanX,-1,1);
  const lateral=Math.abs(target.y-field.centerY)/(spanY*.5);
  const central=1-clamp(lateral,0,1);
  const anchorDistance=Math.hypot(target.x-anchor.x,target.y-anchor.y);
  const support=1-clamp(anchorDistance/(spanX*.22),0,1);
  let score=0;
  if(hasPossession){
    score+=forward*(.42*p.progression+.22*p.depthRisk);
    score+=lateral*.28*p.width+central*.24*p.centrality+support*.12*p.support;
  }
  if(defending){
    score+=central*.24*p.defensiveSecurity+support*.18*p.support;
    score-=Math.max(0,forward)*.30*p.defensiveSecurity;
  }
  return score;
}
