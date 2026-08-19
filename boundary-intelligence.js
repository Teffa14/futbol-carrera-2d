import {MatchEngine} from './engine.js';

const FIELD={left:55,right:1045,top:45,bottom:655,goalTop:295,goalBottom:405,centerX:550,centerY:350};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;
const lerp=(a,b,t)=>a+(b-a)*t;
function hashString(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function rand01(key,salt){let h=hashString(`${key}|${salt}`);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;return((h>>>0)%10000)/9999;}

export function playerIdentity(p){
  const key=String(p?.id||p?.data?.instanceId||p?.data?.name||'player');
  return{
    width:rand01(key,'width')*2-1,
    depth:rand01(key,'depth')*2-1,
    roam:rand01(key,'roam')*2-1,
    support:rand01(key,'support'),
    aggression:rand01(key,'aggression'),
    wallAffinity:rand01(key,'wall'),
    cutInside:rand01(key,'cut')
  };
}

function inGoalMouth(y,margin=0){return y>FIELD.goalTop+margin&&y<FIELD.goalBottom-margin;}
function wallGap(ball,edge){
  if(edge==='top')return ball.y-ball.r-FIELD.top;
  if(edge==='bottom')return FIELD.bottom-ball.y-ball.r;
  if(edge==='left')return ball.x-ball.r-FIELD.left;
  return FIELD.right-ball.x-ball.r;
}
function edgeNormal(edge){
  if(edge==='top')return{x:0,y:1};
  if(edge==='bottom')return{x:0,y:-1};
  if(edge==='left')return{x:1,y:0};
  return{x:-1,y:0};
}
function edgeTangent(edge){return edge==='top'||edge==='bottom'?{x:1,y:0}:{x:0,y:1};}
function isOpenGoalEdge(ball,edge){return(edge==='left'||edge==='right')&&inGoalMouth(ball.y,ball.r+4);}

export function nearbyPlayableEdges(ball,threshold=44){
  const edges=[];
  for(const edge of ['top','bottom','left','right']){
    if(isOpenGoalEdge(ball,edge))continue;
    const gap=wallGap(ball,edge);
    if(gap<=threshold)edges.push({edge,gap,normal:edgeNormal(edge),tangent:edgeTangent(edge)});
  }
  return edges.sort((a,b)=>a.gap-b.gap);
}

function physicalClamp(p,target){
  const r=p?.r??10;
  return{x:clamp(target.x,FIELD.left+r,FIELD.right-r),y:clamp(target.y,FIELD.top+r,FIELD.bottom-r)};
}

function desiredBallDirection(engine,p,desired){
  if(p.kickIntent)return unit(p.kickIntent.aimX-engine.ball.x,p.kickIntent.aimY-engine.ball.y);
  if(p.dribbleIntent)return unit(p.dribbleIntent.targetX-engine.ball.x,p.dribbleIntent.targetY-engine.ball.y);
  if(desired)return unit(desired.x-engine.ball.x,desired.y-engine.ball.y);
  return{x:p.team===0?1:-1,y:0};
}

export function feasibleContactTarget(engine,p,desired=null){
  const ball=engine.ball,contact=(p.r??10)+(ball.r??5)-.7,desiredDir=desiredBallDirection(engine,p,desired);
  const identity=playerIdentity(p),opponents=engine.players.filter(q=>q.team!==p.team);
  const candidates=[];
  for(let i=0;i<48;i++){
    const a=i/48*Math.PI*2,nx=Math.cos(a),ny=Math.sin(a);
    const x=ball.x-nx*contact,y=ball.y-ny*contact;
    const minX=FIELD.left+(p.r??10),maxX=FIELD.right-(p.r??10),minY=FIELD.top+(p.r??10),maxY=FIELD.bottom-(p.r??10);
    if(x<minX-.1||x>maxX+.1||y<minY-.1||y>maxY+.1)continue;
    const normal={x:nx,y:ny};
    const approachCost=Math.hypot(x-p.x,y-p.y)/160;
    const directionScore=dot(normal.x,normal.y,desiredDir.x,desiredDir.y)*2.35;
    let nearestOpp=140;
    for(const o of opponents)nearestOpp=Math.min(nearestOpp,Math.hypot(x-o.x,y-o.y));
    const spaceScore=clamp((nearestOpp-18)/52,-.8,1.1);
    const lateral={x:-desiredDir.y,y:desiredDir.x};
    const sideScore=dot(normal.x,normal.y,lateral.x,lateral.y)*identity.roam*.30;
    const currentSide=unit(p.x-ball.x,p.y-ball.y);
    const continuity=dot(-normal.x,-normal.y,currentSide.x,currentSide.y)*.20;
    candidates.push({x,y,score:directionScore+spaceScore+sideScore+continuity-approachCost});
  }
  if(!candidates.length)return physicalClamp(p,{x:ball.x-(p.team===0?1:-1)*contact,y:ball.y});
  candidates.sort((a,b)=>b.score-a.score);
  return{x:candidates[0].x,y:candidates[0].y};
}

function edgeStage(engine,p){
  const edges=nearbyPlayableEdges(engine.ball,34);if(!edges.length)return null;
  const primary=edges[0],corner=edges.length>1&&edges[1].gap<24;
  return{...primary,corner,other:corner?edges[1]:null};
}

function updateEdgeStall(engine,p,stage){
  if(!stage){p._edgeStall=null;return 0;}
  const key=stage.corner?[stage.edge,stage.other.edge].sort().join('+'):stage.edge;
  const m=p._edgeStall;
  if(!m||m.key!==key){p._edgeStall={key,x:engine.ball.x,y:engine.ball.y,tick:engine.tick,stuck:0};return 0;}
  if(engine.tick-m.tick>=8){
    const moved=Math.hypot(engine.ball.x-m.x,engine.ball.y-m.y);
    m.stuck=moved<2.4?m.stuck+8:Math.max(0,m.stuck-12);
    m.x=engine.ball.x;m.y=engine.ball.y;m.tick=engine.tick;
  }
  return m.stuck;
}

function edgeExitDirection(engine,p,stage){
  const identity=playerIdentity(p),attack={x:p.team===0?1:-1,y:0};
  if(stage.corner){
    const n1=stage.normal,n2=stage.other.normal;
    return unit(n1.x+n2.x+attack.x*.55,n1.y+n2.y+identity.roam*.55);
  }
  if(stage.edge==='top'||stage.edge==='bottom'){
    const tangent=stage.tangent,forward={x:tangent.x*(p.team===0?1:-1),y:0};
    return unit(forward.x*.84+stage.normal.x*(.36+identity.cutInside*.32),forward.y+stage.normal.y*(.36+identity.cutInside*.32));
  }
  const inward=stage.normal;
  const towardCentre={x:0,y:FIELD.centerY-engine.ball.y};
  const centre=unit(towardCentre.x,towardCentre.y);
  const attackingEnd=(p.team===0&&stage.edge==='right')||(p.team===1&&stage.edge==='left');
  if(attackingEnd)return unit(inward.x*(.55+identity.cutInside*.35)+centre.x*.55,inward.y*(.55+identity.cutInside*.35)+centre.y*.72);
  return unit(inward.x*.84+attack.x*.28,centre.y*.42);
}

function armBoundaryBank(engine,p,stage){
  const identity=playerIdentity(p),normal=stage.normal;
  const aim={x:engine.ball.x-normal.x*90,y:engine.ball.y-normal.y*90};
  const power=clamp(1.75+(p.data.ballControl??65)*.006+(p.data.dribbling??65)*.004+identity.wallAffinity*.35,1.9,2.75);
  const exit=edgeExitDirection(engine,p,stage);
  p.boundaryPlay={kind:'bank',started:engine.tick,edge:stage.edge,corner:stage.corner,exitX:exit.x,exitY:exit.y};
  p.dribbleIntent=null;
  engine.armKick(p,aim,power,'wall',{wallSide:stage.edge});
  p.decisionCooldown=.30;
  engine.flash(p,'pared');
  return true;
}

function boundaryPlayTarget(engine,p){
  const play=p.boundaryPlay;if(!play)return null;
  const age=engine.tick-play.started;
  if(age>70){p.boundaryPlay=null;return null;}
  if(p.kickIntent)return feasibleContactTarget(engine,p,{x:p.kickIntent.aimX,y:p.kickIntent.aimY});
  if(engine.ball.lastPlayerId===p.id&&engine.ball.lastTouchTick>=play.started){
    const lead=clamp(8+Math.hypot(engine.ball.vx,engine.ball.vy)*1.8,8,18);
    const predicted={x:engine.ball.x+engine.ball.vx*lead,y:engine.ball.y+engine.ball.vy*lead};
    return physicalClamp(p,{x:predicted.x+play.exitX*26,y:predicted.y+play.exitY*26});
  }
  return feasibleContactTarget(engine,p,{x:engine.ball.x-play.exitX*60,y:engine.ball.y-play.exitY*60});
}

function roleBoundaryTarget(engine,p,possession,base){
  const id=playerIdentity(p),dir=p.team===0?1:-1,our=possession===p.team,enemy=possession!==null&&possession!==p.team;
  const r=p.r??10,top=FIELD.top+r+2,bottom=FIELD.bottom-r-2,left=FIELD.left+r+2,right=FIELD.right-r-2;
  const ballHigh=engine.ball.y<FIELD.centerY,ballSide=ballHigh?'top':'bottom',sameSide=(p.homeY??p.y)<FIELD.centerY?ballSide==='top':ballSide==='bottom';
  let x=base.x,y=base.y;
  const wide=['LW','RW','LB','RB'].includes(p.role),forward=['LW','RW','ST','CAM'].includes(p.role),mid=['CM','CDM','CAM'].includes(p.role);
  if(our&&wide&&sameSide){
    const hug=clamp(.45+id.width*.22+id.wallAffinity*.30,.18,.94);
    y=lerp(y,ballSide==='top'?top:bottom,hug);
    if(['LW','RW'].includes(p.role)&&((p.team===0&&engine.ball.x>FIELD.centerX+210)||(p.team===1&&engine.ball.x<FIELD.centerX-210))){
      const byline=p.team===0?right:left;
      x=lerp(x,byline,.28+id.depth*.10+id.aggression*.18);
    }
  }
  if(our&&forward){
    const byline=p.team===0?right:left,finalThird=p.team===0?engine.ball.x>FIELD.centerX+180:engine.ball.x<FIELD.centerX-180;
    if(finalThird)x=lerp(x,byline,.10+id.aggression*.20);
  }
  if(our&&mid){
    const cutbackX=p.team===0?Math.min(engine.ball.x-70,FIELD.right-150):Math.max(engine.ball.x+70,FIELD.left+150);
    x=lerp(x,cutbackX,.10+id.support*.18);
    y=lerp(y,FIELD.centerY,.08+id.cutInside*.10);
  }
  if(enemy&&['CB','LB','RB','CDM'].includes(p.role)){
    const ownLine=p.team===0?left:right,deep=p.team===0?engine.ball.x<FIELD.left+170:engine.ball.x>FIELD.right-170;
    if(deep)x=lerp(x,ownLine,.16+id.aggression*.10);
  }
  x+=id.depth*6*dir;y+=id.roam*7;
  return physicalClamp(p,{x,y});
}

const previousBoundarySafeTarget=MatchEngine.prototype.boundarySafeTarget;
const previousApproachBallTarget=MatchEngine.prototype.approachBallTarget;
const previousAiTarget=MatchEngine.prototype.aiTarget;
const previousPrepareBallAction=MatchEngine.prototype.prepareBallAction;
const previousDribbleTarget=MatchEngine.prototype.dribbleTarget;

MatchEngine.prototype.boundarySafeTarget=function playableBoundaryTarget(p,target){
  if(!p||!target)return target;
  // The wall itself is playable. Only the player's radius is forbidden, not an
  // arbitrary 24-34 px buffer inside the pitch.
  return physicalClamp(p,target);
};

MatchEngine.prototype.approachBallTarget=function reachableContactApproach(p,desired){
  if(nearbyPlayableEdges(this.ball,46).length)return feasibleContactTarget(this,p,desired);
  return previousApproachBallTarget.call(this,p,desired);
};

MatchEngine.prototype.dribbleTarget=function edgeAwareDribbleTarget(p){
  const stage=edgeStage(this,p);
  if(!stage)return previousDribbleTarget.call(this,p);
  const exit=edgeExitDirection(this,p,stage),pace=p.data.pace??70,dribbling=p.data.dribbling??65;
  return physicalClamp(p,{x:p.x+exit.x*(48+pace*.32+dribbling*.18),y:p.y+exit.y*(48+pace*.32+dribbling*.18)});
};

MatchEngine.prototype.prepareBallAction=function boundaryDecision(p){
  if(!p)return previousPrepareBallAction.call(this,p);
  const stage=edgeStage(this,p),ballDistance=dist(p,this.ball);
  if(stage&&ballDistance<=(p.r??10)+(this.ball.r??5)+9&&!p.kickIntent&&!p.boundaryPlay&&p.decisionCooldown<=0){
    const stall=updateEdgeStall(this,p,stage),nearest=this.nearestOpponent(p),pressure=nearest?dist(p,nearest):999,id=playerIdentity(p);
    const blocked=pressure<31,forceBank=stall>=24,preferBank=id.wallAffinity>.58&&blocked;
    if(forceBank||preferBank){armBoundaryBank(this,p,stage);return;}
  }
  return previousPrepareBallAction.call(this,p);
};

MatchEngine.prototype.aiTarget=function fourWallFootballAi(p,pressers,actor,possession){
  const base=previousAiTarget.call(this,p,pressers,actor,possession);
  if(!p||p.role==='GK'||this.restart?.active)return base;
  const isActor=actor?.id===p.id;
  if(isActor){
    const stage=edgeStage(this,p);updateEdgeStall(this,p,stage);
    const active=boundaryPlayTarget(this,p);if(active)return active;
    if(stage&&dist(p,this.ball)<150){
      const desired=p.kickIntent?{x:p.kickIntent.aimX,y:p.kickIntent.aimY}:p.dribbleIntent?{x:p.dribbleIntent.targetX,y:p.dribbleIntent.targetY}:{x:this.ball.x+(p.team===0?1:-1)*80,y:this.ball.y};
      return feasibleContactTarget(this,p,desired);
    }
    return base;
  }
  const primaryPresser=possession!==null&&possession!==p.team&&Array.isArray(pressers)&&pressers[0]===p.id;
  if(primaryPresser)return base;
  return roleBoundaryTarget(this,p,possession,base);
};

// Exposed for deterministic regression tests.
export const __boundaryTest={FIELD,physicalClamp,edgeStage,edgeExitDirection,roleBoundaryTarget};
