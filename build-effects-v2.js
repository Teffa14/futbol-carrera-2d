import {MatchEngine} from './engine.js';
import {BUILDS,SKILLS} from './data.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const BUILD_BY_ID=()=>new Map(BUILDS.map(b=>[b.id,b]));
function effect(player,key){let total=0;for(const id of player?.data?.skills||[]){const s=SKILLS.find(x=>x.id===id);total+=Number(s?.effects?.[key]||0);}return total;}
export function runtimeModsFor(player){const id=player?.data?.build||player?.build;return{...(BUILD_BY_ID().get(id)?.runtime||{})};}
function temporaryStats(p,extra={}){
  const mods={...runtimeModsFor(p),...extra},keys=['pace','shooting','passing','dribbling','defense','physical','ballControl','vision','stamina','composure'],before={};
  for(const key of keys){before[key]=p.data[key];if(Number.isFinite(Number(mods[key])))p.data[key]=clamp(Number(p.data[key]??65)+Number(mods[key]),20,99);}
  return()=>{for(const key of keys)p.data[key]=before[key];};
}

const previousMakeTeam=MatchEngine.prototype.makeTeam;
MatchEngine.prototype.makeTeam=function buildIdentityTeam(lineup,team){
  const before=this.players.length,result=previousMakeTeam.call(this,lineup,team);
  for(const p of this.players.slice(before)){p.buildRuntime=runtimeModsFor(p);p.buildId=p.data.build||null;}
  return result;
};

const previousPrepare=MatchEngine.prototype.prepareBallAction;
MatchEngine.prototype.prepareBallAction=function buildAwareDecision(p){
  if(!p)return previousPrepare.call(this,p);const mods=runtimeModsFor(p),restore=temporaryStats(p);
  const oldInstructions=p.data.instructions;p.data.instructions={...(oldInstructions||{})};
  if(mods.shotBias)p.data.instructions.shoot=clamp(Number(p.data.instructions.shoot??55)+mods.shotBias*100,0,100);
  if(mods.dribbleBias)p.data.instructions.dribble=clamp(Number(p.data.instructions.dribble??55)+mods.dribbleBias*100,0,100);
  if(mods.passBias)p.data.instructions.risk=clamp(Number(p.data.instructions.risk??55)+mods.passBias*100,0,100);
  try{return previousPrepare.call(this,p);}finally{p.data.instructions=oldInstructions;restore();}
};

const previousMove=MatchEngine.prototype.movePlayer;
MatchEngine.prototype.movePlayer=function buildAwareMovement(p,target,dt,track){
  if(!p)return previousMove.call(this,p,target,dt,track);const mods=runtimeModsFor(p),restore=temporaryStats(p),motion=p.motion?{...p.motion}:null,beforeFatigue=Number(p.fatigue||0);
  if(p.motion){p.motion={...p.motion,acceleration:clamp(Number(p.motion.acceleration||65)+Number(mods.acceleration||0),20,99),sprintSpeed:clamp(Number(p.motion.sprintSpeed||65)+Number(mods.sprint||0),20,99),agility:clamp(Number(p.motion.agility||65)+Number(mods.turning||0),20,99)};}
  try{return previousMove.call(this,p,target,dt,track);}finally{
    if(Number.isFinite(Number(mods.fatigueDrain))&&p.fatigue>beforeFatigue)p.fatigue=beforeFatigue+(p.fatigue-beforeFatigue)*mods.fatigueDrain;
    if(motion)p.motion=motion;restore();
  }
};

const previousSkill=MatchEngine.prototype.attemptSkillMove;
MatchEngine.prototype.attemptSkillMove=function buildAwareSkill(p,defender){
  if(!p)return previousSkill.call(this,p,defender);const mods=runtimeModsFor(p),restore=temporaryStats(p,{dribbling:Number(mods.turning||0)*.35,ballControl:Number(mods.turning||0)*.30});
  try{return previousSkill.call(this,p,defender);}finally{restore();}
};

const previousExecute=MatchEngine.prototype.executeKick;
MatchEngine.prototype.executeKick=function buildAwareKick(p,normal){
  if(!p)return previousExecute.call(this,p,normal);const mods=runtimeModsFor(p),kind=p.kickIntent?.type,extra={};
  if(kind==='shot'){extra.shooting=Number(mods.shooting||0);extra.composure=Number(mods.composure||0);}
  else{extra.passing=Number(mods.passing||0)+effect(p,'pass')*.25;extra.vision=Number(mods.vision||0);extra.ballControl=Number(mods.ballControl||0);}
  const restore=temporaryStats(p,extra);try{return previousExecute.call(this,p,normal);}finally{restore();}
};

const previousResolvePlayers=MatchEngine.prototype.resolvePlayerCollisions;
MatchEngine.prototype.resolvePlayerCollisions=function buildAwareDuels(){
  const restorers=[];for(const p of this.players||[]){const mods=runtimeModsFor(p);if(mods.duel||mods.shield){restorers.push(temporaryStats(p,{physical:Number(mods.duel||0)*.45+Number(mods.shield||0)*.35,defense:Number(mods.duel||0)*.35}));}}
  try{return previousResolvePlayers.call(this);}finally{for(const restore of restorers.reverse())restore();}
};

export const __buildEffectsV2={runtimeModsFor};
