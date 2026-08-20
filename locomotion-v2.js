import {MatchEngine} from './engine.js';
import {FIELD,PLAYER_RADIUS,BALL_RADIUS} from './football-rules-v2.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const mag=(x,y)=>Math.hypot(x,y);
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
function hashString(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function noise(key,salt=''){let h=hashString(`${key}|${salt}`);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;return((h>>>0)%10000)/9999;}
function playerKey(p){return String(p?.id||p?.data?.instanceId||p?.data?.name||'player');}

export function motionProfile(p){
  const d=p?.data||p||{},pace=Number(d.pace??70),dribbling=Number(d.dribbling??65),control=Number(d.ballControl??65),stamina=Number(d.stamina??d.physical??68),physical=Number(d.physical??65),vision=Number(d.vision??d.passing??65),composure=Number(d.composure??65),defense=Number(d.defense??50),n=noise(playerKey(p),'motion')-.5;
  return{
    acceleration:clamp(pace*.68+dribbling*.16+control*.12+stamina*.04+n*9,28,99),
    sprintSpeed:clamp(pace*.86+stamina*.07+physical*.07+n*6,28,99),
    agility:clamp(dribbling*.48+control*.34+pace*.18+n*7,28,99),
    reaction:clamp(vision*.30+composure*.26+control*.22+defense*.12+pace*.10+n*8,28,99),
  };
}

export function goalkeeperTarget(engine,p){
  const ownLeft=p.team===0,goalX=ownLeft?FIELD.left:FIELD.right,dir=ownLeft?1:-1,ballProgress=ownLeft?engine.ball.x-FIELD.left:FIELD.right-engine.ball.x;
  const y=clamp(lerp(FIELD.centerY,engine.ball.y,.54),FIELD.goalTop+16,FIELD.goalBottom-16);
  const defenders=engine.players.filter(q=>q.team===p.team&&q.role!=='GK'),nearestDef=Math.min(...defenders.map(q=>dist(q,engine.ball)),999),ballDistance=dist(p,engine.ball);
  const looseDanger=ballProgress<118&&nearestDef>ballDistance+16&&mag(engine.ball.vx,engine.ball.vy)<6.2;
  const depth=looseDanger?clamp(30+(118-ballProgress)*.34,30,78):30+clamp((150-ballProgress)*.08,0,22);
  return{x:goalX+dir*depth,y};
}

const originalMakeTeam=MatchEngine.prototype.makeTeam;
const originalResetPositions=MatchEngine.prototype.resetPositions;
const originalShapeTarget=MatchEngine.prototype.shapeTarget;
const originalMovePlayer=MatchEngine.prototype.movePlayer;
const originalAiTarget=MatchEngine.prototype.aiTarget;
const originalBallActor=MatchEngine.prototype.ballActor;
const originalDraw=MatchEngine.prototype.draw;

MatchEngine.prototype.makeTeam=function footballSizedTeam(lineup,team){
  const before=this.players.length,result=originalMakeTeam.call(this,lineup,team);
  for(const p of this.players.slice(before)){p.r=PLAYER_RADIUS;p.motion=motionProfile(p);p.brainTarget=null;p.brainUntil=0;p.brainPossession='unset';}
  if(this.ball)this.ball.r=BALL_RADIUS;return result;
};

function enforceKickoffHalf(engine){
  if(!engine.restart?.active||engine.restart.kind!=='kickoff')return;
  for(const p of engine.players){
    p.r=PLAYER_RADIUS;if(p.id===engine.restart.kickerId)continue;
    if(p.team===0)p.x=Math.min(p.x,FIELD.centerX-p.r-5);else p.x=Math.max(p.x,FIELD.centerX+p.r+5);
    const dx=p.x-FIELD.centerX,dy=p.y-FIELD.centerY,d=Math.hypot(dx,dy);
    if(p.team!==engine.restart.team&&d<78){const n=unit(dx||(p.team===0?-1:1),dy);p.x=FIELD.centerX+n.x*82;p.y=FIELD.centerY+n.y*82;}
    p.homeX=p.x;p.homeY=p.y;
  }
}

MatchEngine.prototype.resetPositions=function lawfulKickoff(...args){
  const result=originalResetPositions.apply(this,args);this.ball.r=BALL_RADIUS;this.ball.z=0;this.ball.vz=0;this.pendingOffside=null;
  for(const p of this.players){
    p.r=PLAYER_RADIUS;p.y=clamp(FIELD.centerY+(p.y-FIELD.centerY)*1.15,FIELD.top+p.r,FIELD.bottom-p.r);p.x=clamp(FIELD.centerX+(p.x-FIELD.centerX)*1.055,FIELD.left+p.r,FIELD.right-p.r);p.homeX=p.x;p.homeY=p.y;p.receiveIntent=null;p.passIntent=null;p.brainUntil=0;
  }
  enforceKickoffHalf(this);return result;
};

MatchEngine.prototype.shapeTarget=function kickoffShape(p){
  const t=originalShapeTarget.call(this,p);
  if(this.restart?.active&&this.restart.kind==='kickoff'&&p.id!==this.restart.kickerId){if(p.team===0)t.x=Math.min(t.x,FIELD.centerX-p.r-5);else t.x=Math.max(t.x,FIELD.centerX+p.r+5);}
  return t;
};

MatchEngine.prototype.movePlayer=function attributeLocomotion(p,target,dt,track){
  p.motion=p.motion||motionProfile(p);const m=p.motion,oldPace=p.data.pace,current=Math.hypot(p.vx||0,p.vy||0),blend=clamp((current-1.1)/3.15,0,1),effective=lerp(m.acceleration,m.sprintSpeed,blend);
  p.data.pace=clamp(55+(effective-55)*1.52,22,99);const result=originalMovePlayer.call(this,p,target,dt,track);p.data.pace=oldPace;
  const turnDrag=clamp(.983+(m.agility-50)*.00025,.972,.996);p.vx*=turnDrag;p.vy*=turnDrag;return result;
};

MatchEngine.prototype.ballActor=function goalkeeperDisciplinedActor(team){
  const chosen=originalBallActor.call(this,team);if(!chosen||chosen.role!=='GK')return chosen;
  const outfield=this.players.filter(p=>p.team===team&&p.role!=='GK').sort((a,b)=>dist(a,this.ball)-dist(b,this.ball))[0];if(!outfield)return chosen;
  const defensiveDepth=team===0?this.ball.x-FIELD.left:FIELD.right-this.ball.x;
  return defensiveDepth<105&&dist(chosen,this.ball)<dist(outfield,this.ball)-10?chosen:outfield;
};

MatchEngine.prototype.aiTarget=function restrainedGoalkeeperAi(p,pressers,actor,possession){if(p?.role==='GK'&&!this.restart?.active)return goalkeeperTarget(this,p);return originalAiTarget.call(this,p,pressers,actor,possession);};

MatchEngine.prototype.draw=function widerPlayerCamera(ctx,width=1100,height=700,options={}){
  if(options.camera!=='player')return originalDraw.call(this,ctx,width,height,options);
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#07130d';ctx.fillRect(0,0,width,height);const user=this.playerById(this.userId);if(!user)return originalDraw.call(this,ctx,width,height,{...options,camera:'full'});
  const zoom=1.10,viewW=width/zoom,viewH=height/zoom,cx=lerp(user.x,this.ball.x,.18),cy=lerp(user.y,this.ball.y,.15),camX=clamp(cx-viewW/2,FIELD.left-35,FIELD.right+35-viewW),camY=clamp(cy-viewH/2,FIELD.top-35,FIELD.bottom+35-viewH);
  ctx.save();ctx.scale(zoom,zoom);ctx.translate(-camX,-camY);this.drawPitch(ctx);for(const p of this.players)this.drawPlayer(ctx,p);this.drawBall(ctx);ctx.restore();this.drawMiniMap(ctx,width,height);if(user)this.drawUserBadge(ctx,user,width,height);
};

export const __locomotionTest={enforceKickoffHalf};