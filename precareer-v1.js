const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const SCORE_KEYS=['technical','tactical','physical','mentality'];

function normalizeScore(value,fallback=50){return clamp(Math.round(Number(value)||fallback),0,100);}
function normalizeScores(scores={}){const out={};for(const key of SCORE_KEYS)out[key]=normalizeScore(scores[key]);return out;}
function average(values){return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;}
function weightedAverage(parts){let value=0,weight=0;for(const part of parts){if(!part||!Number.isFinite(part.value)||part.weight<=0)continue;value+=part.value*part.weight;weight+=part.weight;}return weight?value/weight:0;}
function identityFromPlayer(player={}){return{id:player.instanceId||player.id||'user-player',name:String(player.name||'Jugador'),position:String(player.position||'CM'),age:Math.round(Number(player.age)||17),overall:Math.round(Number(player.rating)||50),nationality:String(player.country||player.nationality||'AR')};}

export const PRECAREER_DEFAULTS=Object.freeze({requiredDrills:3,requiredTrialMatches:2});

export function createPreCareerState({player,seed='precareer',requiredDrills=PRECAREER_DEFAULTS.requiredDrills,requiredTrialMatches=PRECAREER_DEFAULTS.requiredTrialMatches}={}){
  return{
    version:1,
    seed:String(seed),
    status:'prospect',
    stage:'assessment',
    signed:false,
    player:identityFromPlayer(player),
    requirements:{requiredDrills:Math.max(1,Math.round(requiredDrills)),requiredTrialMatches:Math.max(1,Math.round(requiredTrialMatches))},
    drills:[],
    trialMatches:[],
    scouting:{visibility:0,confidence:0,profile:null},
  };
}

function cloneState(state){return{...state,player:{...state.player},requirements:{...state.requirements},drills:[...state.drills],trialMatches:[...state.trialMatches],scouting:{...state.scouting,profile:state.scouting?.profile?{...state.scouting.profile}:null}};}

export function preCareerReadiness(state){
  const distinctDrills=new Set((state?.drills||[]).map(result=>result.drillId)).size;
  const trialCount=(state?.trialMatches||[]).length;
  const requiredDrills=state?.requirements?.requiredDrills??PRECAREER_DEFAULTS.requiredDrills;
  const requiredTrialMatches=state?.requirements?.requiredTrialMatches??PRECAREER_DEFAULTS.requiredTrialMatches;
  return{
    drillsComplete:distinctDrills>=requiredDrills,
    trialsComplete:trialCount>=requiredTrialMatches,
    distinctDrills,
    trialCount,
    requiredDrills,
    requiredTrialMatches,
    readyForOffers:distinctDrills>=requiredDrills&&trialCount>=requiredTrialMatches,
  };
}

function updateStage(state){
  const ready=preCareerReadiness(state);
  state.stage=ready.readyForOffers?'awaiting-offers':ready.drillsComplete?'trial-matches':'assessment';
  return state;
}

export function recordPreCareerDrill(state,{drillId,scores,completed=true,notes=null}={}){
  if(!state||state.signed)throw new Error('Pre-career state is not open for assessment');
  const id=String(drillId||'').trim();
  if(!id)throw new Error('drillId is required');
  const next=cloneState(state);
  const result={drillId:id,scores:normalizeScores(scores),completed:Boolean(completed),notes:notes==null?null:String(notes)};
  const existing=next.drills.findIndex(entry=>entry.drillId===id);
  if(existing>=0)next.drills[existing]=result;else next.drills.push(result);
  return refreshScouting(updateStage(next));
}

export function recordTrialMatch(state,{matchId,scores,minutes=90,role=null,notes=null}={}){
  if(!state||state.signed)throw new Error('Pre-career state is not open for trials');
  const id=String(matchId||'').trim();
  if(!id)throw new Error('matchId is required');
  if(!preCareerReadiness(state).drillsComplete)throw new Error('Required drills must be completed before trial matches');
  const next=cloneState(state);
  const result={matchId:id,scores:normalizeScores(scores),minutes:clamp(Math.round(Number(minutes)||0),1,120),role:role==null?null:String(role),notes:notes==null?null:String(notes)};
  const existing=next.trialMatches.findIndex(entry=>entry.matchId===id);
  if(existing>=0)next.trialMatches[existing]=result;else next.trialMatches.push(result);
  return refreshScouting(updateStage(next));
}

function categoryAverage(entries,key){return average(entries.map(entry=>entry.scores[key]));}

export function buildScoutingProfile(state){
  const drills=(state?.drills||[]).filter(entry=>entry.completed!==false);
  const trials=state?.trialMatches||[];
  const scores={};
  for(const key of SCORE_KEYS){
    const drillValue=categoryAverage(drills,key),trialValue=categoryAverage(trials,key);
    scores[key]=Math.round(weightedAverage([
      drills.length?{value:drillValue,weight:.4}:null,
      trials.length?{value:trialValue,weight:.6}:null,
    ]));
  }
  const overall=Math.round(weightedAverage([
    {value:scores.technical,weight:.35},
    {value:scores.tactical,weight:.30},
    {value:scores.physical,weight:.20},
    {value:scores.mentality,weight:.15},
  ]));
  const evidence=drills.length+trials.length*2;
  const confidence=clamp(Math.round(evidence/Math.max(1,(state?.requirements?.requiredDrills||3)+(state?.requirements?.requiredTrialMatches||2)*2)*100),0,100);
  return{
    ...scores,
    overall,
    confidence,
    evidence:{drills:drills.length,trialMatches:trials.length},
    tier:overall>=78?'standout':overall>=66?'strong':overall>=54?'developing':'raw',
  };
}

export function refreshScouting(state){
  const next=cloneState(state);
  const profile=buildScoutingProfile(next);
  next.scouting={visibility:clamp(profile.confidence,0,100),confidence:profile.confidence,profile};
  return next;
}

export function completePreCareerAssessment(state){
  const ready=preCareerReadiness(state);
  if(!ready.readyForOffers)throw new Error('Pre-career assessment is incomplete');
  const next=refreshScouting(cloneState(state));
  next.stage='awaiting-offers';
  next.status='scouted';
  return next;
}
