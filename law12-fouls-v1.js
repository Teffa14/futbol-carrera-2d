import {MatchEngine} from './engine.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mag=(x,y)=>Math.hypot(x,y);
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;
const unit=(x,y)=>{const d=mag(x,y)||1;return{x:x/d,y:y/d};};
const FIELD={left:55,right:1045,top:45,bottom:655};

function distance(a,b){return Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0));}
function pairKey(a,b){return[String(a?.id),String(b?.id)].sort().join('|');}

export function adjudicateContactFoul({contact,ball,lastPossessionTeam}){
  if(!contact?.a||!contact?.b||!ball)return null;
  const {a,b}=contact;
  if(a.team===b.team||lastPossessionTeam==null)return null;
  const victim=a.team===lastPossessionTeam?a:b.team===lastPossessionTeam?b:null;
  if(!victim)return null;
  const offender=victim===a?b:a;
  const victimBall=distance(victim,ball),offenderBall=distance(offender,ball);
  if(victimBall>30||offenderBall<victimBall+7)return null;

  const towardVictim=unit(victim.x-offender.x,victim.y-offender.y);
  const towardOffender=unit(offender.x-victim.x,offender.y-victim.y);
  const offenderApproach=Math.max(0,dot(offender.vx||0,offender.vy||0,towardVictim.x,towardVictim.y));
  const victimApproach=Math.max(0,dot(victim.vx||0,victim.vy||0,towardOffender.x,towardOffender.y));
  const lateGap=offenderApproach-victimApproach;
  if(offenderApproach<1.15||lateGap<.42)return null;

  const shielding=clamp(victim===a?contact.leverageA:contact.leverageB,0,.34);
  const ballMiss=clamp((offenderBall-victimBall-7)/28,0,1);
  const intensity=clamp((offenderApproach-1.15)/2.7*.52+lateGap/2.5*.30+ballMiss*.28-shielding*.22,0,1);
  if(intensity<.18)return null;

  return{
    kind:'direct-free-kick',
    team:victim.team,
    offenderId:offender.id,
    victimId:victim.id,
    x:clamp((a.x+b.x)/2,FIELD.left+18,FIELD.right-18),
    y:clamp((a.y+b.y)/2,FIELD.top+18,FIELD.bottom-18),
    intensity,
    reason:'late-contact',
    pairId:pairKey(a,b),
  };
}

export function awardDirectFreeKick(engine,foul){
  if(!engine||!foul)return false;
  const team=foul.team,x=foul.x,y=foul.y;
  const kicker=engine.players.filter(p=>p.team===team&&p.role!=='GK').sort((a,b)=>distance(a,{x,y})-distance(b,{x,y}))[0]||engine.players.find(p=>p.team===team);
  if(!kicker)return false;
  for(const p of engine.players){p.kickIntent=null;p.dribbleIntent=null;p.receiveIntent=null;p.vx*=.12;p.vy*=.12;}
  const dir=team===0?1:-1,contact=(kicker.r||10)+(engine.ball.r||6)-.7;
  kicker.x=x-dir*contact;kicker.y=y;kicker.vx=0;kicker.vy=0;kicker.facingX=dir;kicker.facingY=0;kicker.desiredFacingX=dir;kicker.desiredFacingY=0;
  Object.assign(engine.ball,{x,y,z:0,vz:0,vx:0,vy:0,lastTeam:team,lastPlayerId:kicker.id,passerId:null,intendedReceiverId:null,shotById:null,assistCandidateId:null,lastTouchTick:engine.tick});
  engine.lastPossessionTeam=team;
  engine.stats.foulsCommitted??=[0,0];engine.stats.foulsWon??=[0,0];
  engine.stats.foulsCommitted[1-team]++;engine.stats.foulsWon[team]++;
  engine.restart={active:true,kind:'free-kick',timer:.58,team,kickerId:kicker.id,x,y,reason:'foul'};
  const offender=engine.playerById?.(foul.offenderId);
  const victim=engine.playerById?.(foul.victimId);
  engine.pushEvent?.(`Falta${offender?.data?.name?` de ${offender.data.name}`:''}${victim?.data?.name?` sobre ${victim.data.name}`:''}`,team,'foul');
  return true;
}

export function processContactFouls(engine,contacts=[]){
  if(!engine||engine.restart?.active)return null;
  engine._law12PairTicks??=new Map();
  for(const contact of contacts){
    const foul=adjudicateContactFoul({contact,ball:engine.ball,lastPossessionTeam:engine.lastPossessionTeam});
    if(!foul)continue;
    const last=engine._law12PairTicks.get(foul.pairId)??-999;
    if(engine.tick-last<24)continue;
    engine._law12PairTicks.set(foul.pairId,engine.tick);
    if(awardDirectFreeKick(engine,foul))return foul;
  }
  return null;
}

const originalResolvePlayerCollisions=MatchEngine.prototype.resolvePlayerCollisions;
if(!MatchEngine.prototype.__law12ContactFoulsV1){
  MatchEngine.prototype.resolvePlayerCollisions=function law12AwarePlayerCollisions(){
    const contacts=originalResolvePlayerCollisions.call(this);
    processContactFouls(this,contacts);
    return contacts;
  };
  MatchEngine.prototype.__law12ContactFoulsV1=true;
}
