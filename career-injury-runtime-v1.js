import {createInjuryFromExposure,advanceInjuryRecovery,playerInjuryAvailability} from './career-injury-v1.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const num=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

function userRosterPlayer(state){
  const roster=state?.world?.[state?.clubId]?.roster;
  return Array.isArray(roster)?roster.find(player=>player?.isUser):null;
}

export function ensureCareerInjuryState(state){
  if(!state?.player)return null;
  if(!Array.isArray(state.player.injuryHistory))state.player.injuryHistory=[];
  const rosterPlayer=userRosterPlayer(state);
  if(rosterPlayer&&rosterPlayer!==state.player){
    rosterPlayer.injury=state.player.injury??null;
    rosterPlayer.injuryHistory=state.player.injuryHistory;
  }
  return state.player;
}

export function careerMatchEligible(player){
  return num(player?.fitness,100)>20&&playerInjuryAvailability(player).match;
}

export function careerTrainingAvailability(state){
  ensureCareerInjuryState(state);
  return playerInjuryAvailability(state?.player).training;
}

function inferredExposure(performance={}){
  const supplied=performance?.injuryExposure||{};
  const staminaUsed=clamp(num(performance?.staminaUsed,15),0,100);
  const contacts=Math.max(0,num(performance?.bodyDuels,performance?.duels||0))+Math.max(0,num(performance?.tackles,0));
  return{
    workload:clamp(num(supplied.workload,45+staminaUsed*.8),0,100),
    liveFatigue:clamp(num(supplied.liveFatigue,staminaUsed*1.15),0,100),
    contactIntensity:clamp(num(supplied.contactIntensity,contacts*7),0,100),
    sprintLoad:clamp(num(supplied.sprintLoad,staminaUsed*.9),0,100),
    recoveryDays:clamp(num(supplied.recoveryDays,6),0,14),
  };
}

export function applyCareerMatchInjuryExposure(state,{fixtureId,date,performance}={}){
  const player=ensureCareerInjuryState(state);
  if(!player||!fixtureId||!performance)return{occurred:false,risk:null,injury:null};
  if(!playerInjuryAvailability(player).match)return{occurred:false,risk:null,injury:player.injury||null,skipped:'already-injured'};
  const exposure=inferredExposure(performance);
  const outcome=createInjuryFromExposure(player,{
    exposureId:`${fixtureId}:career-match`,
    date:date||state?.clock?.currentDate||null,
    ...exposure,
    recentInjuries:player.injuryHistory.slice(-8).length,
  });
  if(outcome.occurred)player.injury=outcome.injury;
  const rosterPlayer=userRosterPlayer(state);
  if(rosterPlayer&&rosterPlayer!==player)rosterPlayer.injury=player.injury??null;
  return{...outcome,exposure};
}

export function advanceCareerInjuryDays(state,days,{date=null}={}){
  const player=ensureCareerInjuryState(state);
  if(!player?.injury)return null;
  const before=player.injury;
  const after=advanceInjuryRecovery(before,days);
  player.injury=after;
  if(before.status!=='recovered'&&after.status==='recovered'&&!player.injuryHistory.some(item=>item?.id===after.id)){
    player.injuryHistory.push({...after,recoveredAt:date||state?.clock?.currentDate||null});
    if(player.injuryHistory.length>24)player.injuryHistory.splice(0,player.injuryHistory.length-24);
  }
  const rosterPlayer=userRosterPlayer(state);
  if(rosterPlayer&&rosterPlayer!==player){
    rosterPlayer.injury=player.injury;
    rosterPlayer.injuryHistory=player.injuryHistory;
  }
  return after;
}
