import {createCareer,createUserPlayer,calculateOverall} from './career.js';
import {applyCreationAllocation,allocationSummary,createAllocationState,validateCreationAllocation} from './character-creation-v1.js';

function normalizedText(value,fallback=''){const text=String(value??'').trim();return text||fallback;}
function copyAllocation(state){return{position:state.position,budget:state.budget,spent:state.spent,ranks:{...state.ranks}};}

export function creationIdentitySeed(input={}){
  const name=normalizedText(input.playerName||input.name,'Jugador');
  const nationality=normalizedText(input.nationality,'AR');
  const position=normalizedText(input.position,'CM');
  const build=normalizedText(input.build,'creator');
  const age=Math.round(Number(input.age??17));
  const entryLevel=normalizedText(input.entryLevel,'reserve');
  const background=normalizedText(input.background,'local_academy');
  return `creation|${name}|${nationality}|${position}|${build}|${age}|${entryLevel}|${background}`;
}

export function normalizeCreationAllocation(position='CM',allocation=null){
  if(!allocation||allocation.position!==position)return createAllocationState(position);
  const base=createAllocationState(position,allocation.budget);
  for(const family of Object.keys(base.ranks))base.ranks[family]=Math.max(0,Math.round(Number(allocation.ranks?.[family])||0));
  base.spent=allocationSummary(base).spent;
  return base;
}

export function creationReadiness(allocation,{requireFullBudget=true}={}){
  const validation=validateCreationAllocation(allocation);
  if(!validation.ok)return validation;
  if(requireFullBudget&&validation.summary.remaining>0)return{ok:false,reason:'unspent-points',summary:validation.summary};
  return validation;
}

export function previewCreatedPlayer(input={}){
  const position=input.position||'CM';
  const allocation=normalizeCreationAllocation(position,input.creationAllocation||input.allocation);
  const development={
    seed:creationIdentitySeed(input),
    age:input.age??17,
    entryLevel:input.entryLevel||'reserve',
    background:input.background||'local_academy',
  };
  const player=createUserPlayer({
    name:input.playerName||input.name,
    nationality:input.nationality||'AR',
    position,
    build:input.build||'creator',
    development,
  });
  Object.assign(player,applyCreationAllocation(player,allocation));
  player.rating=calculateOverall(player);
  player.creationAllocation=copyAllocation(allocation);
  return player;
}

export function createCareerFromCharacter(input={}){
  const allocation=normalizeCreationAllocation(input.position||'CM',input.creationAllocation||input.allocation);
  const ready=creationReadiness(allocation);
  if(!ready.ok)throw new Error(`Creación incompleta: ${ready.reason}`);
  const state=createCareer({...input,creationAllocation:allocation});
  const original=state.player;
  const player=previewCreatedPlayer({...input,creationAllocation:allocation});
  player.team=original.team;
  state.player=player;
  const roster=state.world?.[state.clubId]?.roster;
  if(roster){const index=roster.findIndex(p=>p.isUser||p.instanceId==='user-player');if(index>=0)roster[index]=player;else roster.push(player);}
  state.creation={completed:true,allocation:copyAllocation(allocation),identitySeed:creationIdentitySeed(input)};
  return state;
}
