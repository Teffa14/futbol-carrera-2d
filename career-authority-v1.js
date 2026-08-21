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

export function coachTrustAssessment({
  currentTrust=25,
  matchRating=6,
  tacticalRating=6,
  errorCost=0,
  appeared=true,
}={}){
  const before=clamp(n(currentTrust,25),0,100);
  if(!appeared)return{
    before,
    after:before,
    delta:0,
    tacticalSignal:0,
    performanceSignal:0,
    errorPenalty:0,
    assessment:'not-assessed',
  };

  const tacticalSignal=clamp((n(tacticalRating,6)-6)/2.5,-1,1);
  const performanceSignal=clamp((n(matchRating,6)-6)/4,-1,1);
  const errorPenalty=clamp(Math.max(0,n(errorCost,0))/2,0,1);
  const raw=tacticalSignal*.65+performanceSignal*.25-errorPenalty*.10;
  const delta=clamp(Math.round(raw*5),-5,5);
  const after=clamp(before+delta,0,100);
  const assessment=delta>=3?'strong-positive':delta>0?'positive':delta<=-3?'strong-negative':delta<0?'negative':'neutral';

  return{
    before,
    after,
    delta:after-before,
    tacticalSignal:Math.round(tacticalSignal*1000)/1000,
    performanceSignal:Math.round(performanceSignal*1000)/1000,
    errorPenalty:Math.round(errorPenalty*1000)/1000,
    assessment,
  };
}

export function ensureCareerAuthority(state){
  if(!state||typeof state!=='object')return null;
  const current=state.authority&&typeof state.authority==='object'?state.authority:{};
  state.authority={
    coachTrust:clamp(n(current.coachTrust,25),0,100),
    tacticalInfluence:clamp(n(current.tacticalInfluence,0),0,100),
    coachAssessments:Array.isArray(current.coachAssessments)?current.coachAssessments:[],
  };
  return state.authority;
}

export function applyCoachTrustToCareer(state,{matchRating=6,tacticalRating=6,errorCost=0,appeared=true,fixtureId=null,date=null}={}){
  const authority=ensureCareerAuthority(state);
  if(!authority)return null;
  const result=coachTrustAssessment({currentTrust:authority.coachTrust,matchRating,tacticalRating,errorCost,appeared});
  authority.coachTrust=result.after;
  if(appeared){
    authority.coachAssessments.push({fixtureId,date,...result});
    if(authority.coachAssessments.length>30)authority.coachAssessments.splice(0,authority.coachAssessments.length-30);
  }
  return result;
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
