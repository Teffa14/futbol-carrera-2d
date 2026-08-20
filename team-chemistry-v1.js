import {MatchEngine} from './engine.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hashString(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function family(pos){if(pos==='GK')return'GK';if(['CB','LB','RB','LWB','RWB'].includes(pos))return'DEF';if(['CDM','CM','CAM','LM','RM'].includes(pos))return'MID';return'FWD';}
function playerId(p){return String(p?.instanceId||p?.id||p?.name||'player');}
function stableVariation(a,b){const key=[playerId(a),playerId(b)].sort().join('|');return (hashString(key)%9)-4;}

export function ensureChemistryState(state){
  if(!state)return null;
  state.campaign??={coachTrust:50,lockerRoom:50,media:50,relationships:{},seenEvents:[],currentEvent:null,resolved:[]};
  const c=state.campaign;c.relationships??={};c.chemistryHistory??=[];c.processedChemistryFixtures??=[];
  const roster=state.world?.[state.clubId]?.roster||[],user=roster.find(p=>p.isUser)||state.player;
  const baseline=clamp(48+(Number(c.lockerRoom??50)-50)*.14,42,58);
  for(const mate of roster){
    if(mate.isUser||playerId(mate)===playerId(user))continue;
    const id=playerId(mate),old=c.relationships[id];
    if(typeof old==='number')c.relationships[id]={chemistry:clamp(old,0,100),matches:0,completedPasses:0,lastWeek:0,history:[]};
    else if(!old)c.relationships[id]={chemistry:baseline,matches:0,completedPasses:0,lastWeek:0,history:[]};
    else{old.chemistry=clamp(Number(old.chemistry??baseline),0,100);old.matches??=0;old.completedPasses??=0;old.lastWeek??=0;old.history??=[];}
  }
  return c;
}

export function relationshipValue(state,teammateId){
  const c=ensureChemistryState(state),r=c?.relationships?.[String(teammateId)];
  return clamp(Number(typeof r==='number'?r:r?.chemistry??50),0,100);
}

export function adjustRelationship(state,teammateId,delta,reason='career',meta={}){
  const c=ensureChemistryState(state),id=String(teammateId||'');if(!c||!id)return null;
  const roster=state.world?.[state.clubId]?.roster||[],mate=roster.find(p=>playerId(p)===id);if(!mate||mate.isUser)return null;
  const r=c.relationships[id]||{chemistry:50,matches:0,completedPasses:0,lastWeek:0,history:[]},before=Number(r.chemistry??50),after=clamp(before+Number(delta||0),0,100);
  r.chemistry=+after.toFixed(1);r.lastWeek=state.week||0;if(meta.match)r.matches=(r.matches||0)+1;if(meta.completedPasses)r.completedPasses=(r.completedPasses||0)+meta.completedPasses;
  r.history??=[];r.history.unshift({season:state.season||1,week:state.week||1,delta:+(after-before).toFixed(1),reason});r.history=r.history.slice(0,12);c.relationships[id]=r;
  c.chemistryHistory.unshift({season:state.season||1,week:state.week||1,teammateId:id,delta:+(after-before).toFixed(1),reason});c.chemistryHistory=c.chemistryHistory.slice(0,60);return r;
}

function hierarchyScores(roster,state=null){
  const active=roster.filter(Boolean),mean=active.reduce((s,p)=>s+Number(p.rating||60),0)/Math.max(1,active.length),max=Math.max(...active.map(p=>Number(p.rating||60)),mean),rep=Number(state?.progress?.reputation||0);
  return new Map(active.map(p=>{
    const ratingEdge=(Number(p.rating||60)-mean)/Math.max(8,max-mean+6),form=clamp(Number(p.form||0)/8,-.25,.45),userWeight=p.isUser?clamp((rep-18)/85,-.08,.22):0,score=clamp(.38+ratingEdge*.42+form+userWeight,0,1);
    return[playerId(p),score];
  }));
}

export function syncCareerChemistryState(state){
  const c=ensureChemistryState(state),roster=state?.world?.[state.clubId]?.roster||[];if(!c||!roster.length)return state;
  const user=roster.find(p=>p.isUser)||state.player,relations=roster.filter(p=>!p.isUser).map(p=>relationshipValue(state,playerId(p))),avgRelation=relations.length?relations.reduce((a,b)=>a+b,0)/relations.length:50;
  const teamChemistry=clamp(40+Number(c.lockerRoom??50)*.18+avgRelation*.12,35,85),hierarchy=hierarchyScores(roster,state);c.teamChemistry=+teamChemistry.toFixed(1);
  for(const p of roster){
    const id=playerId(p);p.teamChemistry=c.teamChemistry;p.teamHierarchy=+Number(hierarchy.get(id)||.4).toFixed(3);p.chemistryMap={};
    for(const mate of roster){if(mate===p)continue;const mid=playerId(mate);let chem=teamChemistry+stableVariation(p,mate);if(p.isUser||mate.isUser){const other=p.isUser?mid:id;chem=relationshipValue(state,other);}else if(family(p.position)===family(mate.position))chem+=3;p.chemistryMap[mid]=+clamp(chem,20,95).toFixed(1);}
  }
  const rosterUser=roster.find(p=>p.isUser);if(rosterUser&&state.player){state.player.teamChemistry=rosterUser.teamChemistry;state.player.teamHierarchy=rosterUser.teamHierarchy;state.player.chemistryMap={...rosterUser.chemistryMap};}
  return state;
}

export function teamHierarchySnapshot(state,limit=5){
  syncCareerChemistryState(state);const roster=state?.world?.[state.clubId]?.roster||[],user=roster.find(p=>p.isUser);return[...roster].sort((a,b)=>Number(b.teamHierarchy||0)-Number(a.teamHierarchy||0)||Number(b.rating||0)-Number(a.rating||0)).slice(0,limit).map((p,index)=>({id:playerId(p),name:p.name,position:p.position,rating:p.rating,rank:index+1,hierarchy:Number(p.teamHierarchy||0),chemistryToUser:p.isUser?100:relationshipValue(state,playerId(p)),isUser:Boolean(p.isUser),sameUnit:user?family(user.position)===family(p.position):false}));
}

export function teammateRelationshipSnapshot(state,limit=6){
  ensureChemistryState(state);const roster=state?.world?.[state.clubId]?.roster||[];return roster.filter(p=>!p.isUser).map(p=>({id:playerId(p),name:p.name,position:p.position,rating:p.rating,chemistry:relationshipValue(state,playerId(p)),hierarchy:Number(p.teamHierarchy||0)})).sort((a,b)=>b.chemistry-a.chemistry||b.rating-a.rating).slice(0,limit);
}

export function applyLatestMatchChemistry(state){
  const c=ensureChemistryState(state),match=state?.lastMatch;if(!c||!match?.fixtureId||c.processedChemistryFixtures.includes(match.fixtureId))return{changed:false};
  c.processedChemistryFixtures.push(match.fixtureId);c.processedChemistryFixtures=c.processedChemistryFixtures.slice(-40);const perf=match.userPerformance;if(!perf)return{changed:false};
  const links=Array.isArray(perf.chemistryLinks)?perf.chemistryLinks:[],rating=Number(perf.rating||6),goalDiff=(match.score?.[0]??0)-(match.score?.[1]??0),teamResult=goalDiff===0?.15:goalDiff>0?.35:-.12;let changed=false;
  for(const link of links){const completed=Number(link.completed||0);if(completed<=0)continue;const gain=clamp(.35+completed*.24+(rating-6)*.16+teamResult,-.5,2.6);const r=adjustRelationship(state,link.teammateId,gain,'shared-match',{match:true,completedPasses:completed});if(r)changed=true;}
  if(rating>=7.7)c.lockerRoom=clamp(Number(c.lockerRoom??50)+.4,0,100);else if(rating<5.5)c.lockerRoom=clamp(Number(c.lockerRoom??50)-.3,0,100);syncCareerChemistryState(state);return{changed,links:links.length};
}

export function enginePairChemistry(p,m){return clamp(Number(p?.data?.chemistryMap?.[m?.id]??p?.data?.teamChemistry??50),0,100);}
export function engineHierarchy(p){return clamp(Number(p?.data?.teamHierarchy??.4),0,1);}

const previousMakeTeam=MatchEngine.prototype.makeTeam;
MatchEngine.prototype.makeTeam=function chemistryAwareTeam(lineup,team){
  const before=this.players.length,result=previousMakeTeam.call(this,lineup,team),created=this.players.slice(before);if(!created.length)return result;const scores=hierarchyScores(created.map(p=>p.data));
  for(const p of created){p.data.teamHierarchy=Number.isFinite(Number(p.data.teamHierarchy))?Number(p.data.teamHierarchy):Number(scores.get(playerId(p.data))||.4);p.data.teamChemistry=clamp(Number(p.data.teamChemistry??55),20,95);p.data.chemistryMap??={};}
  return result;
};

const previousRegisterTouch=MatchEngine.prototype.registerPhysicalTouch;
MatchEngine.prototype.registerPhysicalTouch=function chemistryPassLedger(p,type='touch'){
  const passerId=this.ball?.passerId,receiverId=this.ball?.intendedReceiverId,passer=passerId?this.playerById(passerId):null,isCompletion=Boolean(passer&&receiverId&&p?.id===receiverId&&passer.team===p.team);
  if(isCompletion&&(passer.id===this.userId||p.id===this.userId)){
    const mate=passer.id===this.userId?p:passer;this.chemistryLedger??={};const row=this.chemistryLedger[mate.id]||{teammateId:mate.id,name:mate.data?.name||mate.id,completed:0,given:0,received:0};row.completed++;if(passer.id===this.userId)row.given++;else row.received++;this.chemistryLedger[mate.id]=row;
  }
  return previousRegisterTouch.call(this,p,type);
};

const previousUserPerformance=MatchEngine.prototype.userPerformance;
MatchEngine.prototype.userPerformance=function chemistryPerformance(){const perf=previousUserPerformance.call(this);if(!perf)return perf;return{...perf,chemistryLinks:Object.values(this.chemistryLedger||{}).map(x=>({...x}))};};

export const __chemistryTest={family,hierarchyScores,stableVariation};
