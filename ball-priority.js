import {MatchEngine} from './engine.js';

const FIELD={top:45,bottom:655,left:55,right:1045};
const mag=(x,y)=>Math.hypot(x,y);
const unit=(x,y)=>{const l=mag(x,y)||1;return{x:x/l,y:y/l};};
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hashString(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function pairSide(a,b){return(hashString([String(a?.id),String(b?.id)].sort().join('|'))&1)?1:-1;}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function nearestOpponent(engine,p){let opponent=null,best=Infinity;for(const candidate of engine.players){if(candidate===p||candidate.team===p.team)continue;const d=distance(p,candidate);if(d<best){opponent=candidate;best=d;}}return{opponent,distance:best};}
function touchline(ball){const top=ball.y-FIELD.top,bottom=FIELD.bottom-ball.y;if(top<62&&top<=bottom)return{side:'top',y:FIELD.top,inside:1};if(bottom<62)return{side:'bottom',y:FIELD.bottom,inside:-1};return null;}

const originalAiTarget=MatchEngine.prototype.aiTarget;
const originalPrepareBallAction=MatchEngine.prototype.prepareBallAction;

function expireWallPlay(engine,p){p.wallPlay=null;p.wallPlayCooldownUntil=engine.tick+34;}

function wallPlayTarget(engine,p){
  const play=p.wallPlay;if(!play)return null;
  if(engine.tick-play.startedTick>80){expireWallPlay(engine,p);return null;}
  if(engine.ball.lastTeam!==null&&engine.ball.lastTeam!==p.team&&engine.ball.lastTouchTick>=play.startedTick){expireWallPlay(engine,p);return null;}
  if(p.kickIntent){return engine.approachBallTarget(p,{x:p.kickIntent.aimX,y:p.kickIntent.aimY});}
  if(play.stage==='bank'&&engine.ball.lastPlayerId===p.id&&engine.ball.lastTouchTick>=play.startedTick){play.stage='rebound';play.kickedTick=engine.tick;}
  if(play.stage!=='rebound')return null;
  const age=engine.tick-(play.kickedTick||play.startedTick);
  if(age>46||distance(p,engine.ball)>165){expireWallPlay(engine,p);return null;}
  const lead=clamp(7+mag(engine.ball.vx,engine.ball.vy)*1.7,7,14);
  const predicted={x:engine.ball.x+engine.ball.vx*lead,y:engine.ball.y+engine.ball.vy*lead};
  const tx=predicted.x*.66+play.reboundX*.34,ty=predicted.y*.66+play.reboundY*.34;
  return engine.boundarySafeTarget(p,{x:clamp(tx,FIELD.left+18,FIELD.right-18),y:clamp(ty,FIELD.top+18,FIELD.bottom-18)});
}

function canUseWall(engine,p,opponent,opponentDistance){
  if(!p||!opponent||p.role==='GK'||engine.restart?.active)return false;
  if((p.wallPlayCooldownUntil||0)>engine.tick||p.wallPlay)return false;
  const wall=touchline(engine.ball);if(!wall)return false;
  const ballDistance=distance(p,engine.ball),ballSpeed=mag(engine.ball.vx,engine.ball.vy);
  if(ballDistance>38||opponentDistance>35||ballSpeed>3.1)return false;
  const toBall=unit(engine.ball.x-p.x,engine.ball.y-p.y),toOpponent=unit(opponent.x-p.x,opponent.y-p.y),attack={x:p.team===0?1:-1,y:0};
  const bodyLock=opponentDistance<=(p.r||10)+(opponent.r||10)+5;
  const blocksBall=dot(toBall.x,toBall.y,toOpponent.x,toOpponent.y)>.18;
  const blocksProgress=dot(attack.x,attack.y,toOpponent.x,toOpponent.y)>.12;
  return bodyLock||blocksBall||blocksProgress;
}

function startWallPlay(engine,p,opponent){
  const wall=touchline(engine.ball);if(!wall)return false;
  const dir=p.team===0?1:-1,control=p.data.ballControl??65,dribbling=p.data.dribbling??65;
  const forward=30+dribbling*.18,reboundDepth=42+control*.13;
  const aim={x:clamp(engine.ball.x+dir*forward,FIELD.left+20,FIELD.right-20),y:wall.y-wall.inside*82};
  const power=clamp(1.82+control*.009+dribbling*.004,2.05,2.95);
  const reboundX=clamp(engine.ball.x+dir*(46+dribbling*.22),FIELD.left+24,FIELD.right-24),reboundY=wall.y+wall.inside*reboundDepth;
  p.wallPlay={side:wall.side,stage:'bank',startedTick:engine.tick,reboundX,reboundY,opponentId:opponent?.id||null};
  p.dribbleIntent=null;
  engine.armKick(p,aim,power,'wall',{wallSide:wall.side});
  p.kickCooldown=Math.max(Number(p.kickCooldown)||0,.12);
  p.decisionCooldown=.32;
  engine.flash(p,'pared');
  if(p.id===engine.userId)engine.pushEvent('Tu jugador busca el rebote contra la banda',p.team,'user');
  return true;
}

MatchEngine.prototype.prepareBallAction=function ballFirstPrepareBallAction(p){
  if(!p)return originalPrepareBallAction.call(this,p);
  if(p.wallPlay){wallPlayTarget(this,p);if(p.wallPlay)return;}
  if(p.decisionCooldown<=0&&!p.kickIntent&&!p.dribbleIntent){
    const near=nearestOpponent(this,p);
    if(canUseWall(this,p,near.opponent,near.distance)&&startWallPlay(this,p,near.opponent))return;
  }
  return originalPrepareBallAction.call(this,p);
};

MatchEngine.prototype.aiTarget=function ballFirstAiTarget(p,pressers,actor,possession){
  const base=originalAiTarget.call(this,p,pressers,actor,possession);
  if(!p||p.role==='GK'||this.restart?.active)return base;

  const wallTarget=wallPlayTarget(this,p);if(wallTarget)return wallTarget;

  const ball=this.ball;
  const ballDistance=distance(p,ball);
  const near=nearestOpponent(this,p),opponent=near.opponent,opponentDistance=near.distance;
  if(!opponent)return base;

  const contactRange=(p.r||10)+(opponent.r||10)+4;
  const inBodyContact=opponentDistance<=contactRange;
  const ballOutsideDuel=ballDistance>(p.r||10)+(ball.r||6)+13;
  const isActor=actor?.id===p.id;
  const isPresser=Array.isArray(pressers)&&pressers.includes(p.id);
  const loose=possession===null;
  const shouldAttackBall=isActor||isPresser||(loose&&ballDistance<105);

  if(inBodyContact&&ballOutsideDuel){
    const toBall=unit(ball.x-p.x,ball.y-p.y);
    const toOpponent=unit(opponent.x-p.x,opponent.y-p.y);
    const side=pairSide(p,opponent);
    const tangent={x:-toBall.y*side,y:toBall.x*side};

    if(shouldAttackBall){
      const opponentBlocksBall=dot(toBall.x,toBall.y,toOpponent.x,toOpponent.y)>.34;
      const chase=unit(
        toBall.x+(opponentBlocksBall?tangent.x*.64:tangent.x*.12),
        toBall.y+(opponentBlocksBall?tangent.y*.64:tangent.y*.12)
      );
      p.contactEscapeX=chase.x;p.contactEscapeY=chase.y;
      p.contactEscapeTicks=Math.max(Number(p.contactEscapeTicks)||0,9);
      p.contactDriveTicks=0;p.contactShieldExitTicks=0;
      return this.boundarySafeTarget(p,{x:p.x+chase.x*54,y:p.y+chase.y*54});
    }

    const away=unit(p.x-opponent.x,p.y-opponent.y);
    const baseDirection=unit(base.x-p.x,base.y-p.y);
    const support=unit(baseDirection.x*.72+away.x*.88,baseDirection.y*.72+away.y*.88);
    p.contactEscapeX=support.x;p.contactEscapeY=support.y;
    p.contactEscapeTicks=Math.max(Number(p.contactEscapeTicks)||0,7);
    return this.boundarySafeTarget(p,{x:p.x+support.x*42,y:p.y+support.y*42});
  }

  if(loose&&isActor){
    const attackDirection=p.team===0?1:-1;
    return this.approachBallTarget(p,{x:ball.x+attackDirection*42,y:ball.y});
  }

  if(opponentDistance<30&&ballDistance>38){
    const towardBase=unit(base.x-p.x,base.y-p.y);
    const towardOpponent=unit(opponent.x-p.x,opponent.y-p.y);
    if(dot(towardBase.x,towardBase.y,towardOpponent.x,towardOpponent.y)>.48){
      const away=unit(p.x-opponent.x,p.y-opponent.y),side=pairSide(p,opponent),lateral={x:-away.y*side,y:away.x*side};
      const exit=unit(away.x*.82+towardBase.x*.48+lateral.x*.24,away.y*.82+towardBase.y*.48+lateral.y*.24);
      return this.boundarySafeTarget(p,{x:p.x+exit.x*38,y:p.y+exit.y*38});
    }
  }

  return base;
};
