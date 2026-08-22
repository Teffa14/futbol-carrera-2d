const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const num=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

function blankSeason(season=1){
  return{
    season:Math.max(1,Math.floor(num(season,1))),
    fixtures:0,
    squadSelections:0,
    starts:0,
    benchSelections:0,
    reserveSelections:0,
    appearances:0,
    minutes:0,
    unavailableInjured:0,
  };
}

function blankCareer(){
  return{fixtures:0,squadSelections:0,starts:0,benchSelections:0,reserveSelections:0,appearances:0,minutes:0,unavailableInjured:0};
}

export function ensureCareerOpportunity(state){
  if(!state||typeof state!=='object')return null;
  const season=Math.max(1,Math.floor(num(state.season,1)));
  if(!state.opportunity||typeof state.opportunity!=='object'){
    state.opportunity={season:blankSeason(season),career:blankCareer(),processedFixtures:[],recent:[]};
    return state.opportunity;
  }
  state.opportunity.career={...blankCareer(),...(state.opportunity.career||{})};
  state.opportunity.processedFixtures=Array.isArray(state.opportunity.processedFixtures)?state.opportunity.processedFixtures:[];
  state.opportunity.recent=Array.isArray(state.opportunity.recent)?state.opportunity.recent:[];
  if(!state.opportunity.season||Number(state.opportunity.season.season)!==season)state.opportunity.season=blankSeason(season);
  else state.opportunity.season={...blankSeason(season),...state.opportunity.season,season};
  return state.opportunity;
}

export function resolvePlayedMinutes(performance={},squadStatus='reserve'){
  if(!performance)return 0;
  const explicit=[performance.minutesPlayed,performance.minutes].find(value=>Number.isFinite(Number(value)));
  if(explicit!==undefined)return clamp(Math.round(Number(explicit)),0,120);
  const entered=Number(performance.enteredAtMinute),left=Number(performance.leftAtMinute??performance.subbedOffMinute);
  if(Number.isFinite(entered)||Number.isFinite(left)){
    const start=Number.isFinite(entered)?clamp(entered,0,120):0;
    const end=Number.isFinite(left)?clamp(left,0,120):90;
    return clamp(Math.round(end-start),0,120);
  }
  if(squadStatus==='starter')return 90;
  if(squadStatus==='bench')return 25;
  return 0;
}

export function recordCareerOpportunity(state,{
  fixtureId,
  squadStatus='reserve',
  appeared=false,
  performance=null,
  injured=false,
  date=null,
}={}){
  const ledger=ensureCareerOpportunity(state);
  if(!ledger||!fixtureId)return null;
  const key=String(fixtureId);
  if(ledger.processedFixtures.includes(key))return careerOpportunitySnapshot(state);
  const status=['starter','bench','reserve'].includes(squadStatus)?squadStatus:'reserve';
  const didAppear=Boolean(appeared||performance);
  const minutes=didAppear?resolvePlayedMinutes(performance||{},status):0;
  const selected=status==='starter'||status==='bench';
  const event={fixtureId:key,season:Math.max(1,Math.floor(num(state.season,1))),date:date||null,squadStatus:status,appeared:didAppear,minutes,injured:Boolean(injured)};
  for(const target of [ledger.season,ledger.career]){
    target.fixtures++;
    if(selected)target.squadSelections++;
    if(status==='starter')target.starts++;
    if(status==='bench')target.benchSelections++;
    if(status==='reserve')target.reserveSelections++;
    if(didAppear)target.appearances++;
    target.minutes+=minutes;
    if(injured)target.unavailableInjured++;
  }
  ledger.processedFixtures.push(key);
  if(ledger.processedFixtures.length>300)ledger.processedFixtures.splice(0,ledger.processedFixtures.length-300);
  ledger.recent.unshift(event);
  if(ledger.recent.length>10)ledger.recent.length=10;
  return careerOpportunitySnapshot(state);
}

function rates(bucket){
  const fixtures=Math.max(0,num(bucket?.fixtures,0));
  const selections=Math.max(0,num(bucket?.squadSelections,0));
  return{
    squadRate:fixtures?selections/fixtures:0,
    startRate:fixtures?Math.max(0,num(bucket?.starts,0))/fixtures:0,
    appearanceRate:fixtures?Math.max(0,num(bucket?.appearances,0))/fixtures:0,
    minuteShare:fixtures?clamp(Math.max(0,num(bucket?.minutes,0))/(fixtures*90),0,1):0,
  };
}

export function careerOpportunitySnapshot(state){
  const ledger=ensureCareerOpportunity(state);
  if(!ledger)return null;
  const seasonRates=rates(ledger.season),careerRates=rates(ledger.career);
  const recent=ledger.recent||[];
  const healthyRecent=recent.filter(event=>!event.injured);
  const recentAppearances=healthyRecent.filter(event=>event.appeared).length;
  const opportunityPressure=clamp(Math.round((1-seasonRates.minuteShare)*55+(1-seasonRates.startRate)*25+(1-seasonRates.squadRate)*20),0,100);
  return{
    season:{...ledger.season,...seasonRates},
    career:{...ledger.career,...careerRates},
    recent:[...recent],
    recentHealthyAppearanceRate:healthyRecent.length?recentAppearances/healthyRecent.length:0,
    opportunityPressure,
  };
}

export function opportunitySignals(state){
  const snapshot=careerOpportunitySnapshot(state);
  if(!snapshot)return{marketPerformance:50,loanNeed:50,retirementOpportunityPressure:0};
  const season=snapshot.season;
  const evidence=season.appearances>=3||season.fixtures>=5;
  const marketPerformance=evidence?clamp(Math.round(35+season.minuteShare*30+season.startRate*20+snapshot.recentHealthyAppearanceRate*15),20,100):50;
  const loanNeed=evidence?clamp(Math.round(40+snapshot.opportunityPressure*.6),30,100):50;
  return{marketPerformance,loanNeed,retirementOpportunityPressure:evidence?snapshot.opportunityPressure:0};
}
