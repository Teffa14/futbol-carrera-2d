const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const AVG_KEYS=['technical','tactical','physical','mentality'];
const ROLE_ATTRS={
  GK:['defense','composure','ballControl','physical'],
  ST:['shooting','composure','ballControl','physical'],
  LW:['dribbling','pace','ballControl','shooting'],RW:['dribbling','pace','ballControl','shooting'],
  CAM:['passing','vision','ballControl','dribbling'],CM:['passing','vision','stamina','ballControl'],CDM:['defense','physical','stamina','passing'],
  LB:['pace','stamina','defense','passing'],RB:['pace','stamina','defense','passing'],CB:['defense','physical','composure','stamina'],
};
function scoreAverage(scores={}){return AVG_KEYS.reduce((sum,key)=>sum+(Number(scores[key])||0),0)/AVG_KEYS.length;}
function growthState(player){player.preCareerGrowth??={total:0,byAttribute:{},events:[]};return player.preCareerGrowth;}
function grant(player,attrs,maxGains,label,score){const growth=growthState(player),gained=[];for(const attr of attrs){if(gained.length>=maxGains||growth.total>=4)break;const used=Number(growth.byAttribute[attr]||0);if(used>=2||!Number.isFinite(Number(player[attr]))||Number(player[attr])>=95)continue;player[attr]=clamp(Math.round(Number(player[attr]))+1,30,99);growth.byAttribute[attr]=used+1;growth.total++;gained.push(attr);}growth.events.push({label,score:Math.round(score),gained:[...gained]});growth.events=growth.events.slice(-8);return gained;}
export function applyPreCareerDrillGrowth(player,drill,scores={},calculateOverall=null){const score=scoreAverage(scores);if(score<78)return{player,gained:[],score:Math.round(score)};const attrs=Object.entries(drill?.attrs||{}).sort((a,b)=>b[1]-a[1]).map(([key])=>key),maxGains=score>=90?2:1,gained=grant(player,attrs,maxGains,`drill:${drill?.id||'unknown'}`,score);if(typeof calculateOverall==='function')player.rating=calculateOverall(player);return{player,gained,score:Math.round(score)};}
export function applyPreCareerTrialGrowth(player,scores={},calculateOverall=null){const score=scoreAverage(scores);if(score<80)return{player,gained:[],score:Math.round(score)};const attrs=ROLE_ATTRS[player?.position]||ROLE_ATTRS.CM,maxGains=score>=92?2:1,gained=grant(player,attrs,maxGains,'trial-match',score);if(typeof calculateOverall==='function')player.rating=calculateOverall(player);return{player,gained,score:Math.round(score)};}
export function preCareerGrowthSummary(player){const growth=growthState(player);return{total:growth.total,byAttribute:{...growth.byAttribute},events:[...growth.events]};}
