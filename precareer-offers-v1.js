import {COUNTRIES} from './data.js';
import {buildScoutingProfile,preCareerReadiness} from './precareer-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ROLE_ORDER=['reserve','development','rotation','first-team-competition'];
const ROLE_WEIGHT={reserve:55,development:64,rotation:73,'first-team-competition':82};
const ROLE_WAGE={reserve:.58,development:.72,rotation:.9,'first-team-competition':1.08};
const COUNTRY_WAGE_BASE={ARB:120,AR:180,BR:260,PT:520,FR:950,DE:1250,IT:1150,ES:1250,EN:1650};

function hash(seed){let h=2166136261;for(const ch of String(seed)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function noise(seed,span=8){return (hash(seed)%10001)/10000*span-span/2;}
function round50(value){return Math.max(50,Math.round(Number(value||0)/50)*50);}
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function roleFamily(position){if(['ST','CF','LW','RW'].includes(position))return'FWD';if(['CB','LB','RB','LWB','RWB'].includes(position))return'DEF';if(position==='GK')return'GK';return'MID';}

export function clubsFromCountries(countries=COUNTRIES){
  const out=[];
  for(const country of countries||[])for(const club of country.clubs||[])out.push({...club,countryId:country.id,league:country.league});
  return out;
}

export function positionCompetition(club,position,candidateOverall){
  const roster=Array.isArray(club?.roster)?club.roster:[];
  const exact=roster.filter(player=>player.position===position);
  const family=roleFamily(position),sameFamily=roster.filter(player=>roleFamily(player.position)===family);
  const ratings=exact.map(player=>Number(player.rating)||0).filter(Boolean).sort((a,b)=>b-a);
  const expectedSquadOverall=clamp(Math.round(Number(club?.reputation||78)-12),50,84);
  const strongestOverall=ratings[0]||expectedSquadOverall;
  const referenceOverall=ratings.length?ratings.slice(0,3).reduce((sum,value)=>sum+value,0)/Math.min(3,ratings.length):expectedSquadOverall;
  const projectedRank=1+ratings.filter(rating=>rating>candidateOverall).length;
  const shortageBonus=clamp((2-exact.length)*4,-4,8);
  return{exactPositionCount:exact.length,sameFamilyCount:sameFamily.length,strongestOverall,referenceOverall:+referenceOverall.toFixed(1),projectedRank,shortageBonus};
}

export function projectedSquadRole({candidateOverall,club,competition}){
  const reference=Number(competition?.referenceOverall??(Number(club?.reputation||78)-12));
  const gap=Number(candidateOverall||0)-reference;
  if(gap>=4)return'first-team-competition';
  if(gap>=0)return'rotation';
  if(gap>=-5)return'development';
  return'reserve';
}

function contractForOffer(club,role,interest,seed){
  const countryId=club.countryId||club.country||'AR';
  const base=COUNTRY_WAGE_BASE[countryId]||500;
  const reputation=clamp(Number(club.reputation||78),62,94);
  const prestigeFactor=.72+(reputation-62)/32*1.18;
  const interestFactor=.88+clamp((interest-50)/50,0,.35);
  const weeklyWageUsd=round50(base*prestigeFactor*ROLE_WAGE[role]*interestFactor);
  const years=2+(hash(`${seed}|years`)%3);
  return{years,weeklyWageUsd,squadRole:role,professional:true};
}

function offerCandidate(state,club,index){
  const profile=state.scouting?.profile||buildScoutingProfile(state);
  const playerOverall=Number(state.player?.overall||50);
  const observedOverall=playerOverall*.45+Number(profile.overall||50)*.55;
  const competition=positionCompetition(club,state.player?.position||'CM',observedOverall);
  const role=projectedSquadRole({candidateOverall:observedOverall,club,competition});
  const reputation=Number(club.reputation||78);
  const prestigePenalty=Math.max(0,reputation-80)*Math.max(0,(70-Number(profile.overall||50))*.08);
  const pathwayFit=ROLE_WEIGHT[role];
  const interest=clamp(Math.round(
    Number(profile.overall||50)*.47+
    playerOverall*.23+
    pathwayFit*.22+
    competition.shortageBonus-
    prestigePenalty+
    noise(`${state.seed}|${club.id}|${index}`,8)
  ),0,100);
  const contract=contractForOffer(club,role,interest,`${state.seed}|${club.id}`);
  return{
    id:`offer-${club.countryId||club.country||'xx'}-${club.id}`,
    clubId:club.id,
    clubName:club.name,
    countryId:club.countryId||club.country||null,
    league:club.league||null,
    clubReputation:reputation,
    interest,
    projectedRole:role,
    competition,
    contract,
    scoutingFit:{observedOverall:+observedOverall.toFixed(1),scoutingOverall:Number(profile.overall||50),confidence:Number(profile.confidence||state.scouting?.confidence||0)},
  };
}

function diversifyOffers(candidates,count){
  const selected=[],used=new Set(),byRole=new Map();
  for(const role of ROLE_ORDER)byRole.set(role,candidates.filter(offer=>offer.projectedRole===role));
  for(const role of ROLE_ORDER){const best=byRole.get(role)?.[0];if(best&&selected.length<count){selected.push(best);used.add(best.id);}}
  for(const offer of candidates){if(selected.length>=count)break;if(!used.has(offer.id)){selected.push(offer);used.add(offer.id);}}
  return selected.sort((a,b)=>b.interest-a.interest||b.clubReputation-a.clubReputation||a.clubName.localeCompare(b.clubName));
}

export function generatePreCareerOffers(state,{clubs=clubsFromCountries(),count=5,minInterest=42}={}){
  if(!state||state.signed)throw new Error('Pre-career state is not open for offers');
  if(!preCareerReadiness(state).readyForOffers)throw new Error('Pre-career assessment must be complete before offers');
  const pool=(clubs||[]).filter(club=>club?.id&&club?.name).map((club,index)=>offerCandidate(state,club,index)).filter(offer=>offer.interest>=minInterest).sort((a,b)=>b.interest-a.interest||b.clubReputation-a.clubReputation||a.clubName.localeCompare(b.clubName));
  if(!pool.length)throw new Error('No eligible clubs produced an offer');
  const next=clone(state),offers=diversifyOffers(pool,clamp(Math.round(Number(count)||5),1,8));
  next.offers=offers;next.status='offers-received';next.stage='awaiting-offers';
  return next;
}

export function acceptPreCareerOffer(state,offerId){
  if(!state||state.signed)throw new Error('Pre-career state is already signed');
  const id=String(offerId||'').trim(),offer=(state.offers||[]).find(entry=>entry.id===id);
  if(!offer)throw new Error('Offer not found');
  const next=clone(state);
  next.signed=true;next.status='signed';next.stage='signed';next.selectedOffer=clone(offer);next.contract=clone(offer.contract);next.clubId=offer.clubId;next.countryId=offer.countryId;
  return next;
}
