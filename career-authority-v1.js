const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const n=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;

export function deriveTacticalInfluence({
  reputation=0,
  tenureSeasons=0,
  leadership=0,
  captaincy=false,
  contractImportance=0,
  tacticalIQ=0,
  teamSuccess=0,
  sustainedPerformance=0,
}={}){
  const tenureScore=clamp(n(tenureSeasons)*14,0,100);
  const captainScore=captaincy?100:0;
  return Math.round(clamp(
    clamp(n(reputation),0,100)*.19+
    tenureScore*.15+
    clamp(n(leadership),0,100)*.15+
    captainScore*.10+
    clamp(n(contractImportance),0,100)*.12+
    clamp(n(tacticalIQ),0,100)*.14+
    clamp(n(teamSuccess),0,100)*.07+
    clamp(n(sustainedPerformance),0,100)*.08,
  0,100));
}

export function authorityPermissions({coachTrust=0,tacticalInfluence=0}={}){
  const trust=clamp(n(coachTrust),0,100),influence=clamp(n(tacticalInfluence),0,100);
  const roleSecurity=trust>=72?'trusted':trust>=48?'established':trust>=28?'fragile':'unproven';
  const tacticalFreedom=clamp(Math.round(trust*.58+influence*.42),0,100);
  return{
    coachTrust:trust,
    tacticalInfluence:influence,
    roleSecurity,
    tacticalFreedom,
    canRequestPersonalAdjustment:trust>=35&&influence>=25,
    canSuggestRelationshipPattern:trust>=48&&influence>=45,
    canProposeStructuralAdjustment:trust>=62&&influence>=70,
    canControlLineup:false,
    canControlTransfers:false,
    canSetTeamFormation:false,
  };
}

export function careerAuthoritySnapshot(input={}){
  const tacticalInfluence=input.tacticalInfluence==null?deriveTacticalInfluence(input):clamp(n(input.tacticalInfluence),0,100);
  return authorityPermissions({coachTrust:input.coachTrust,tacticalInfluence});
}
