import {MatchEngine} from './engine.js';
import {readActiveIdentity,deriveAIProfile,identityMechanicalMods} from './player-identity-progression-v1.js';
import {tacticalProfileFromDecisionProfile} from './tactical-profile-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function activeFor(p){const id=readActiveIdentity();if(!id||!p?.data?.isUser)return null;if(id.playerName!==p.data.name||id.position!==p.data.position)return null;return id;}
function profileFor(p){const id=p?.identityProgression||activeFor(p);return id?deriveAIProfile(id):null;}
function withStats(p,mods,fn){const before={};for(const [k,v] of Object.entries(mods||{})){if(!Number.isFinite(Number(v))||!v)continue;before[k]=p.data[k];p.data[k]=clamp(Number(p.data[k]??60)+Number(v),20,99);}try{return fn();}finally{for(const [k,v] of Object.entries(before))p.data[k]=v;}}
function attackDir(p){return p.team===0?1:-1;}
function forwardDistance(p,target){return attackDir(p)*(Number(target?.x??p.x)-p.x);}

const previousMakeTeam=MatchEngine.prototype.makeTeam;
MatchEngine.prototype.makeTeam=function identityAwareTeam(lineup,team){
  const before=this.players.length,result=previousMakeTeam.call(this,lineup,team);
  for(const p of this.players.slice(before)){
    if(!p.data?.isUser)continue;
    const identity=activeFor(p);if(!identity)continue;
    p.identityProgression=identity;
    p.tacticalProfile=tacticalProfileFromDecisionProfile(deriveAIProfile(identity),p.role||p.data.position);
    p.legacyCareerSkills=[...(p.data.skills||[])];
    // Legacy equipable perks no longer govern the user player. Identity traits are permanent and evidence-driven.
    p.data.skills=[];
    p.identityRunCooldown=0;
  }
  return result;
};

const previousPrepare=MatchEngine.prototype.prepareBallAction;
MatchEngine.prototype.prepareBallAction=function identityDecisionPolicy(p){
  const profile=profileFor(p);if(!profile)return previousPrepare.call(this,p);
  const old=p.data.instructions;p.data.instructions={...(old||{})};
  p.data.instructions.shoot=clamp(Math.round(profile.shootIntent??old?.shoot??55),0,100);
  p.data.instructions.dribble=clamp(Math.round(profile.dribbleIntent??old?.dribble??55),0,100);
  p.data.instructions.risk=clamp(Math.round(profile.passRisk??old?.risk??55),0,100);
  try{return previousPrepare.call(this,p);}finally{p.data.instructions=old;}
};

const previousTarget=MatchEngine.prototype.aiTarget;
MatchEngine.prototype.aiTarget=function identityOffBallTarget(p,pressers,actor,possession){
  const base=previousTarget.call(this,p,pressers,actor,possession),profile=profileFor(p);if(!profile||!base||p.role==='GK')return base;
  const dir=attackDir(p),out={x:base.x,y:base.y},teamHasBall=possession===p.team,ballProgress=p.team===0?(this.ball.x-55)/990:(1045-this.ball.x)/990;
  if(teamHasBall&&actor?.id!==p.id){
    const run=Number(profile.runBehind||0),feet=Number(profile.showFeet||0),box=Number(profile.boxAttack||0),width=Number(profile.width||0);
    if(run>52&&forwardDistance(p,out)>5){out.x+=dir*clamp((run-50)*.55,0,28);if(run>70&&forwardDistance(p,out)>55&&this.tick>(p.identityRunCooldown||0)){p.burstTimer=Math.max(p.burstTimer||0,.24);p.identityRunCooldown=this.tick+55;p.action='pica';p.actionTimer=Math.max(p.actionTimer||0,.55);}}
    if(feet>run+10&&actor){const supportX=actor.x+dir*52,supportY=actor.y+(p.y-actor.y)*.35;out.x=out.x*.72+supportX*.28;out.y=out.y*.72+supportY*.28;}
    if(box>58&&ballProgress>.62){const goalX=p.team===0?1045:55;out.x=out.x*.70+(goalX-dir*92)*.30;out.y=out.y*.72+350*.28;}
    if(width>55){const side=Math.sign((p.homeY??p.y)-350)||Math.sign(p.y-350)||1,targetY=350+side*(185+width*.65);out.y=out.y*.76+clamp(targetY,70,630)*.24;}
  }else if(possession!==null&&possession!==p.team&&Number(profile.press||0)>55){const press=(profile.press-55)/45,tx=actor?.x??this.ball.x,ty=actor?.y??this.ball.y,blend=clamp(.08+press*.14,.08,.22);out.x=out.x*(1-blend)+tx*blend;out.y=out.y*(1-blend)+ty*blend;}
  return this.boundarySafeTarget?this.boundarySafeTarget(p,out):out;
};

const previousMove=MatchEngine.prototype.movePlayer;
MatchEngine.prototype.movePlayer=function identityRunCommitment(p,target,dt,track){
  const profile=profileFor(p);if(profile&&p.role!=='GK'&&target&&forwardDistance(p,target)>62&&Number(profile.runBehind||0)>66&&this.inferPossessionTeam?.()===p.team){p.action=p.action||'pica';p.actionTimer=Math.max(p.actionTimer||0,.35);}
  return previousMove.call(this,p,target,dt,track);
};

const previousKick=MatchEngine.prototype.executeKick;
MatchEngine.prototype.executeKick=function identityTechnique(p,normal){
  const identity=p?.identityProgression||activeFor(p);if(!identity)return previousKick.call(this,p,normal);const mods=identityMechanicalMods(identity),kind=p.kickIntent?.type,extra={};
  if(kind==='shot'){extra.shooting=mods.shooting||0;extra.composure=mods.composure||0;}
  else if(kind==='pass'||kind==='restart'){extra.passing=mods.passing||0;extra.vision=mods.vision||0;extra.ballControl=Math.floor((mods.ballControl||0)*.5);}
  return withStats(p,extra,()=>previousKick.call(this,p,normal));
};

const previousSkill=MatchEngine.prototype.attemptSkillMove;
MatchEngine.prototype.attemptSkillMove=function identityDuelTechnique(p,defender){
  const identity=p?.identityProgression||activeFor(p);if(!identity)return previousSkill.call(this,p,defender);const mods=identityMechanicalMods(identity);return withStats(p,{dribbling:mods.dribbling||0,ballControl:mods.ballControl||0,physical:mods.physical||0},()=>previousSkill.call(this,p,defender));
};

const previousGkTarget=MatchEngine.prototype.goalkeeperTarget;
if(previousGkTarget)MatchEngine.prototype.goalkeeperTarget=function identityKeeperTarget(p,...args){const base=previousGkTarget.call(this,p,...args),profile=profileFor(p);if(!profile||p.role!=='GK'||!base)return base;const sweep=Number(profile.gkSweep||0);if(sweep>55&&this.ball){const dir=attackDir(p),ownGoalX=p.team===0?55:1045,danger=Math.abs(this.ball.x-ownGoalX);if(danger>125&&danger<330){const n=(sweep-55)/45;base.x+=dir*clamp(12+n*20,12,32);}}return base;};

export const __identityRuntimeV1={profileFor,withStats,forwardDistance};
