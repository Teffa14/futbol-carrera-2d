const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export const CREATION_ATTRIBUTES=['pace','shooting','passing','dribbling','defense','physical','ballControl','vision','stamina','composure'];
export const CREATION_BUDGET=15;
export const CREATION_ATTRIBUTE_CAP=70;

export const CREATION_FAMILIES={
  speed:{label:'Velocidad',effects:{pace:3,stamina:1,dribbling:1}},
  technique:{label:'Técnica',effects:{dribbling:3,ballControl:3,passing:1,composure:1}},
  distribution:{label:'Distribución',effects:{passing:3,vision:3,ballControl:1,composure:1}},
  finishing:{label:'Finalización',effects:{shooting:3,composure:2,ballControl:1}},
  defending:{label:'Defensa',effects:{defense:3,physical:1,composure:1,vision:1}},
  athleticism:{label:'Físico',effects:{physical:3,stamina:3,pace:1}},
  mentality:{label:'Mentalidad',effects:{composure:3,vision:2,stamina:1,passing:1}},
};

const POSITION_FAMILY_CAPS={
  GK:{finishing:0,speed:2,technique:3,athleticism:4,mentality:4,distribution:4,defending:4},
  ST:{finishing:4,speed:3,technique:3,athleticism:3,mentality:3,distribution:2,defending:1},
  LW:{speed:4,technique:4,finishing:3,distribution:3,mentality:3,athleticism:2,defending:1},
  RW:{speed:4,technique:4,finishing:3,distribution:3,mentality:3,athleticism:2,defending:1},
  CAM:{technique:4,distribution:4,mentality:4,finishing:3,speed:2,athleticism:2,defending:2},
  CM:{distribution:4,mentality:4,technique:3,athleticism:3,defending:3,speed:2,finishing:2},
  CDM:{defending:4,distribution:4,mentality:4,athleticism:3,technique:2,speed:2,finishing:1},
  LB:{speed:4,athleticism:4,defending:4,distribution:3,technique:2,mentality:2,finishing:1},
  RB:{speed:4,athleticism:4,defending:4,distribution:3,technique:2,mentality:2,finishing:1},
  CB:{defending:4,athleticism:4,mentality:3,distribution:3,speed:2,technique:1,finishing:1},
};

const RANK_COST=[0,1,2,2,3];
export function familyRankCost(nextRank){return RANK_COST[clamp(Math.round(Number(nextRank)||1),1,4)]??3;}
export function familyCap(position,family){return POSITION_FAMILY_CAPS[position]?.[family]??POSITION_FAMILY_CAPS.CM[family]??2;}
export function createAllocationState(position='CM',budget=CREATION_BUDGET){const ranks={};for(const family of Object.keys(CREATION_FAMILIES))ranks[family]=0;return{position,budget:Math.max(0,Math.round(Number(budget)||0)),spent:0,ranks};}
export function allocationCost(ranks={}){let total=0;for(const family of Object.keys(CREATION_FAMILIES)){const rank=clamp(Math.round(Number(ranks[family])||0),0,4);for(let n=1;n<=rank;n++)total+=familyRankCost(n);}return total;}
export function canIncreaseFamily(state,family){if(!CREATION_FAMILIES[family])return{ok:false,reason:'unknown-family'};const current=clamp(Math.round(Number(state?.ranks?.[family])||0),0,4),cap=familyCap(state?.position||'CM',family);if(current>=cap)return{ok:false,reason:'position-cap'};const cost=familyRankCost(current+1),spent=allocationCost(state?.ranks||{}),budget=Math.max(0,Number(state?.budget??CREATION_BUDGET));if(spent+cost>budget)return{ok:false,reason:'budget',cost};return{ok:true,cost,nextRank:current+1};}
export function increaseFamily(state,family){const check=canIncreaseFamily(state,family);if(!check.ok)return{ok:false,state,reason:check.reason};const next={...state,ranks:{...state.ranks,[family]:check.nextRank}};next.spent=allocationCost(next.ranks);return{ok:true,state:next,cost:check.cost};}
export function decreaseFamily(state,family){if(!CREATION_FAMILIES[family])return{ok:false,state,reason:'unknown-family'};const current=clamp(Math.round(Number(state?.ranks?.[family])||0),0,4);if(current<=0)return{ok:false,state,reason:'minimum'};const next={...state,ranks:{...state.ranks,[family]:current-1}};next.spent=allocationCost(next.ranks);return{ok:true,state:next,refund:familyRankCost(current)};}
export function applyCreationAllocation(baseAttributes,state,{attributeCap=CREATION_ATTRIBUTE_CAP}={}){const result={};for(const key of CREATION_ATTRIBUTES)result[key]=Math.round(Number(baseAttributes?.[key])||50);for(const [family,rankRaw] of Object.entries(state?.ranks||{})){const def=CREATION_FAMILIES[family];if(!def)continue;const rank=clamp(Math.round(Number(rankRaw)||0),0,familyCap(state?.position||'CM',family));for(const [key,perRank] of Object.entries(def.effects))result[key]=(result[key]||50)+perRank*rank;}for(const key of CREATION_ATTRIBUTES)result[key]=clamp(Math.round(result[key]),30,attributeCap);return result;}
export function allocationSummary(state){const ranks=state?.ranks||{},spent=allocationCost(ranks),budget=Math.max(0,Number(state?.budget??CREATION_BUDGET));const activeFamilies=Object.entries(ranks).filter(([,rank])=>Number(rank)>0).map(([family])=>family);return{spent,remaining:Math.max(0,budget-spent),activeFamilies,activeFamilyCount:activeFamilies.length};}
export function validateCreationAllocation(state,{minimumFamilies=3}={}){const summary=allocationSummary(state);if(summary.spent>Number(state?.budget??CREATION_BUDGET))return{ok:false,reason:'budget-exceeded',summary};for(const [family,rankRaw] of Object.entries(state?.ranks||{}))if(Number(rankRaw)>familyCap(state?.position||'CM',family))return{ok:false,reason:'position-cap',family,summary};if(summary.activeFamilyCount<minimumFamilies)return{ok:false,reason:'too-concentrated',summary};return{ok:true,summary};}
