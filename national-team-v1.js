import {COUNTRIES} from './data.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const FAMILY_ORDER=['GK','DEF','MID','FWD'];
export const DEFAULT_NATIONAL_SQUAD_MINIMUMS={GK:2,DEF:6,MID:6,FWD:4};

function normalize(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();}
function playerOf(candidate){return candidate?.player||candidate||{};}
function contextOf(candidate){return candidate?.context||candidate?.careerContext||{};}
function playerId(player){return String(player?.instanceId||player?.id||player?.name||'unknown');}

export function nationalTeamId(value){
  const key=normalize(value?.id??value);
  if(!key)return null;
  const country=COUNTRIES.find(item=>normalize(item.id)===key||normalize(item.name)===key);
  return country?.id||null;
}

export function positionFamily(position){
  const pos=String(position||'').toUpperCase();
  if(pos==='GK')return'GK';
  if(['CB','LB','RB','LWB','RWB'].includes(pos))return'DEF';
  if(['CDM','CM','CAM','LM','RM'].includes(pos))return'MID';
  return'FWD';
}

export function eligibleNationalTeams(player,{capTiedTeamId=null}={}){
  const source=player?.data||player||{};
  const raw=[...(Array.isArray(source.nationalityIds)?source.nationalityIds:[]),source.nationalityId,source.countryCode,source.nationality,source.country];
  const ids=[];
  for(const value of raw){const id=nationalTeamId(value);if(id&&!ids.includes(id))ids.push(id);}
  const tied=nationalTeamId(capTiedTeamId||source.international?.capTiedTeamId);
  if(tied)return ids.includes(tied)?[tied]:[];
  return ids;
}

export function nationalCallUpScore(candidate){
  const player=playerOf(candidate),context=contextOf(candidate);
  const rating=Number(player.rating??player.overall??60),form=Number(player.form??context.form??0),fitness=Number(player.fitness??context.fitness??100);
  const apps=Number(context.apps??context.appearances??0),minutes=Number(context.minutes??0),reputation=Number(context.reputation??0),coachTrust=Number(context.coachTrust??50),tactical=Number(player.tacticalIQ??player.vision??60);
  const availability=fitness<45?-25:fitness<65?-7:0;
  return +(rating*.68+form*1.45+clamp(fitness,0,100)*.055+Math.min(6,apps)*.35+Math.min(1800,minutes)/1800*3+Math.min(100,reputation)*.025+clamp(coachTrust,0,100)*.012+tactical*.045+availability).toFixed(3);
}

export function rankNationalCandidates(teamId,candidates=[]){
  const id=nationalTeamId(teamId);if(!id)return[];
  return candidates
    .filter(candidate=>{const player=playerOf(candidate),international=candidate?.international||player?.international||{};return eligibleNationalTeams(player,{capTiedTeamId:international.capTiedTeamId}).includes(id);})
    .map(candidate=>({candidate,player:playerOf(candidate),score:nationalCallUpScore(candidate),family:positionFamily(playerOf(candidate).position)}))
    .filter(item=>Number(item.player.fitness??100)>=35)
    .sort((a,b)=>b.score-a.score||String(a.player.name||'').localeCompare(String(b.player.name||'')));
}

export function selectNationalSquad(teamId,candidates=[],options={}){
  const id=nationalTeamId(teamId);if(!id)return{teamId:null,selected:[],alternates:[],byFamily:{GK:[],DEF:[],MID:[],FWD:[]}};
  const squadSize=Math.max(1,Math.round(Number(options.squadSize)||23)),minimums={...DEFAULT_NATIONAL_SQUAD_MINIMUMS,...(options.minimums||{})},ranked=rankNationalCandidates(id,candidates),selected=[],taken=new Set();
  const take=item=>{const key=playerId(item.player);if(taken.has(key)||selected.length>=squadSize)return false;taken.add(key);selected.push(item);return true;};
  for(const family of FAMILY_ORDER){let need=Math.max(0,Math.round(Number(minimums[family])||0));for(const item of ranked){if(need<=0||selected.length>=squadSize)break;if(item.family===family&&take(item))need--;}}
  for(const item of ranked){if(selected.length>=squadSize)break;take(item);}
  const byFamily={GK:[],DEF:[],MID:[],FWD:[]};for(const item of selected)byFamily[item.family].push(item.player);
  const selectedIds=new Set(selected.map(item=>playerId(item.player))),alternates=ranked.filter(item=>!selectedIds.has(playerId(item.player))).map(item=>item.player);
  return{teamId:id,selected:selected.map(item=>item.player),alternates,byFamily};
}

export function ensureInternationalCareer(state){
  if(!state?.player)throw new Error('Career state requires a player');
  state.international??={};const international=state.international;
  international.capTiedTeamId=nationalTeamId(international.capTiedTeamId);
  international.eligibleTeamIds=eligibleNationalTeams(state.player,{capTiedTeamId:international.capTiedTeamId});
  international.caps=Math.max(0,Number(international.caps)||0);international.goals=Math.max(0,Number(international.goals)||0);international.assists=Math.max(0,Number(international.assists)||0);international.minutes=Math.max(0,Number(international.minutes)||0);
  international.history=Array.isArray(international.history)?international.history:[];international.currentCallUp=international.currentCallUp||null;
  return international;
}

export function evaluateUserCallUp(state,candidates=[],options={}){
  const international=ensureInternationalCareer(state),teamId=nationalTeamId(options.teamId||international.capTiedTeamId||international.eligibleTeamIds[0]);
  if(!teamId)return{ok:false,calledUp:false,reason:'no-eligible-team',squad:null};
  const userId=playerId(state.player),pool=[...candidates];if(!pool.some(candidate=>playerId(playerOf(candidate))===userId))pool.push({player:state.player,context:options.userContext||{}});
  const squad=selectNationalSquad(teamId,pool,options),calledUp=squad.selected.some(player=>playerId(player)===userId);
  if(calledUp){const cycleId=String(options.cycleId||`s${state.season||1}-w${state.week||1}-${teamId}`);international.currentCallUp={teamId,cycleId,competition:options.competition||'friendly',selectedAt:{season:state.season||1,week:state.week||1}};}
  return{ok:true,calledUp,reason:calledUp?'selected':'competition',squad};
}

export function recordInternationalAppearance(state,{teamId,competition='friendly',official=false,goals=0,assists=0,minutes=0,date=null}={}){
  const international=ensureInternationalCareer(state),id=nationalTeamId(teamId||international.currentCallUp?.teamId);
  if(!id||!eligibleNationalTeams(state.player,{capTiedTeamId:international.capTiedTeamId}).includes(id))return{ok:false,reason:'ineligible'};
  if(international.capTiedTeamId&&international.capTiedTeamId!==id)return{ok:false,reason:'cap-tied'};
  international.caps++;international.goals+=Math.max(0,Math.round(Number(goals)||0));international.assists+=Math.max(0,Math.round(Number(assists)||0));international.minutes+=Math.max(0,Math.round(Number(minutes)||0));
  if(official)international.capTiedTeamId=id;
  international.eligibleTeamIds=eligibleNationalTeams(state.player,{capTiedTeamId:international.capTiedTeamId});
  const appearance={teamId:id,competition,official:Boolean(official),goals:Math.max(0,Math.round(Number(goals)||0)),assists:Math.max(0,Math.round(Number(assists)||0)),minutes:Math.max(0,Math.round(Number(minutes)||0)),season:state.season||1,week:state.week||1,date};
  international.history.push(appearance);international.currentCallUp=null;return{ok:true,appearance,capTiedTeamId:international.capTiedTeamId};
}
