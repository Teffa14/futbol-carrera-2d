const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const n=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;

function hashSeed(seed){let h=2166136261;for(const ch of String(seed)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function identity(player){return player?.instanceId||player?.id||player?.name||'player';}
function retirementBase(player){return player?.developmentProfile?.retirement||{};}
function physicalScore(player){return Math.round((n(player?.pace,50)+n(player?.physical,50)+n(player?.stamina,50))/3);}

export function retirementWindow(player){
  const base=retirementBase(player),eligibleFrom=clamp(Math.round(n(base.eligibleFrom,34)),30,40);
  const offset=5+(hashSeed(`${identity(player)}|retirement-window`)%4);
  return{eligibleFrom,mandatoryFrom:clamp(eligibleFrom+offset,36,45)};
}

export function retirementAssessment(player,{injuryBurden=0,clubOpportunityCount=null,playerChoice=false}={}){
  const age=clamp(Math.round(n(player?.age??player?.developmentProfile?.age,18)),15,60);
  const {eligibleFrom,mandatoryFrom}=retirementWindow(player),body=physicalScore(player),injuries=clamp(n(injuryBurden),0,100);
  const noClubOpportunities=clubOpportunityCount===0;
  const reasons=[];
  if(age>=eligibleFrom)reasons.push('age');
  if(age>=eligibleFrom-1&&body<=58)reasons.push('physical_decline');
  if(injuries>=70)reasons.push('injuries');
  if(noClubOpportunities&&age>=eligibleFrom)reasons.push('no_club_opportunities');
  if(playerChoice)reasons.push('player_choice');

  let pressure=0;
  pressure+=clamp((age-eligibleFrom)*9,0,45);
  pressure+=clamp((62-body)*2.5,0,28);
  pressure+=injuries*.22;
  if(noClubOpportunities)pressure+=22;
  if(playerChoice)pressure=100;
  pressure=Math.round(clamp(pressure,0,100));

  const forcedByAge=age>=mandatoryFrom;
  const forcedByContext=(injuries>=95)||(noClubOpportunities&&age>=mandatoryFrom-2&&body<=55);
  const forced=forcedByAge||forcedByContext;
  const eligible=playerChoice||age>=eligibleFrom||injuries>=82||(noClubOpportunities&&age>=eligibleFrom-1);
  const recommendation=forced?'retire':pressure>=65?'strongly_consider':eligible?'available':'continue';

  return{age,eligibleFrom,mandatoryFrom,physicalScore:body,injuryBurden:injuries,noClubOpportunities,eligible,forced,pressure,reasons,recommendation};
}

export function shouldAutoRetire(player,context={}){
  const assessment=retirementAssessment(player,context);
  return{retire:assessment.forced,reason:assessment.reasons.find(r=>r!=='player_choice')||'age',assessment};
}

export function careerRetirementSnapshot(state,{reason='player_choice',context={}}={}){
  const player=state?.player||{},history=Array.isArray(state?.history)?state.history:[],assessment=retirementAssessment(player,{...context,playerChoice:reason==='player_choice'});
  let appearances=0,goals=0,assists=0;
  for(const entry of history){
    if(entry?.appeared)appearances++;
    goals+=n(entry?.goals);
    assists+=n(entry?.assists);
  }
  return{
    status:'retired',
    reason,
    date:state?.clock?.currentDate||null,
    season:Math.max(1,Math.round(n(state?.season,1))),
    clubId:state?.clubId||null,
    age:assessment.age,
    rating:Math.round(n(player?.rating,0)),
    totals:{appearances,goals,assists},
    assessment,
  };
}
