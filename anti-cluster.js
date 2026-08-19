import {MatchEngine} from './engine.js';

const FIELD={left:55,right:1045,top:45,bottom:655,centerX:550,centerY:350};
const mag=(x,y)=>Math.hypot(x,y);
const unit=(x,y)=>{const l=mag(x,y)||1;return{x:x/l,y:y/l};};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function hashString(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function pairSide(a,b){return(hashString([String(a?.id),String(b?.id)].sort().join('|'))&1)?1:-1;}
function nearestOpponent(engine,p){let opponent=null,best=Infinity;for(const candidate of engine.players){if(candidate===p||candidate.team===p.team)continue;const d=distance(p,candidate);if(d<best){opponent=candidate;best=d;}}return{opponent,distance:best};}
function safe(engine,p,target){return engine.boundarySafeTarget(p,{x:clamp(target.x,FIELD.left+18,FIELD.right-18),y:clamp(target.y,FIELD.top+18,FIELD.bottom-18)});}

const previousAiTarget=MatchEngine.prototype.aiTarget;
const previousPrepareBallAction=MatchEngine.prototype.prepareBallAction;
const previousStartDribble=MatchEngine.prototype.startDribble;

MatchEngine.prototype.prepareBallAction=function contactReadyBallAction(p){
  if(!p)return previousPrepareBallAction.call(this,p);
  const ready=(p.r||10)+(this.ball.r||5)+8,ballDistance=distance(p,this.ball);
  if(ballDistance>ready){
    // A player 40-50px away from the free ball must run to it, not announce REGATE.
    if(ballDistance>ready+12)p.dribbleIntent=null;
    return;
  }
  return previousPrepareBallAction.call(this,p);
};

MatchEngine.prototype.startDribble=function noInfiniteSameDefenderDribble(p,defender){
  if(!p)return previousStartDribble.call(this,p,defender);
  const repeated=defender&&p.lastDribbleDefenderId===defender.id&&this.tick-(p.lastDribbleDecisionTick??-999)<34;
  if(repeated){
    // Do not count/flash the same failed 1v1 over and over. Change the plan.
    const pass=this.bestPass(p);
    if(pass&&pass.score>0.08){
      p.dribbleIntent=null;
      this.armPass(p,pass.player);
      p.decisionCooldown=.30;
      return true;
    }
    const dir=p.team===0?1:-1,toBall=unit(this.ball.x-p.x,this.ball.y-p.y),side=pairSide(p,defender)*(p.team===0?1:-1),lateral={x:-toBall.y*side,y:toBall.x*side};
    const escape=unit(dir*.38+lateral.x*.94,toBall.y*.22+lateral.y*.94);
    const target=safe(this,p,{x:p.x+escape.x*48,y:p.y+escape.y*48});
    p.dribbleIntent={targetX:target.x,targetY:target.y,ttl:.28};
    p.contactEscapeX=escape.x;p.contactEscapeY=escape.y;p.contactEscapeTicks=Math.max(Number(p.contactEscapeTicks)||0,10);
    p.decisionCooldown=.24;
    p.lastDribbleDecisionTick=this.tick;
    return true;
  }
  if(defender){p.lastDribbleDefenderId=defender.id;p.lastDribbleDecisionTick=this.tick;}
  return previousStartDribble.call(this,p,defender);
};

MatchEngine.prototype.aiTarget=function antiClusterAiTarget(p,pressers,actor,possession){
  const base=previousAiTarget.call(this,p,pressers,actor,possession);
  if(!p||p.role==='GK'||this.restart?.active)return base;

  const ball=this.ball,ballDistance=distance(p,ball),near=nearestOpponent(this,p),opponent=near.opponent,opponentDistance=near.distance;
  if(!opponent)return base;

  const isActor=actor?.id===p.id;
  const primaryPresser=possession!==null&&possession!==p.team&&Array.isArray(pressers)&&pressers[0]===p.id;
  const secondPresser=possession!==null&&possession!==p.team&&Array.isArray(pressers)&&pressers.slice(1).includes(p.id);
  const loose=possession===null;
  const contactRange=(p.r||10)+(opponent.r||10)+5;
  const inBodyContact=opponentDistance<=contactRange;
  const ballOutsideBodies=ballDistance>(p.r||10)+(ball.r||5)+12;

  // Body contact is never an objective when the free ball is somewhere else.
  if(inBodyContact&&ballOutsideBodies){
    if(isActor||primaryPresser){
      const toBall=unit(ball.x-p.x,ball.y-p.y);
      // Opposing actors deliberately take opposite lanes around the same collision.
      const side=pairSide(p,opponent)*(p.team===0?1:-1),tangent={x:-toBall.y*side,y:toBall.x*side};
      const chase=unit(toBall.x*.92+tangent.x*.86,toBall.y*.92+tangent.y*.86);
      p.contactEscapeX=chase.x;p.contactEscapeY=chase.y;p.contactEscapeTicks=Math.max(Number(p.contactEscapeTicks)||0,13);
      p.contactDriveTicks=0;p.contactShieldExitTicks=0;
      return safe(this,p,{x:p.x+chase.x*64,y:p.y+chase.y*64});
    }
    const away=unit(p.x-opponent.x,p.y-opponent.y),home=unit((p.homeX??p.x)-p.x,(p.homeY??p.y)-p.y),support=unit(away.x*1.05+home.x*.72,away.y*1.05+home.y*.72);
    p.contactEscapeX=support.x;p.contactEscapeY=support.y;p.contactEscapeTicks=Math.max(Number(p.contactEscapeTicks)||0,10);
    return safe(this,p,{x:p.x+support.x*52,y:p.y+support.y*52});
  }

  if(loose){
    if(isActor){
      // Exactly one outfield actor per team attacks a divided ball.
      const attackDir=p.team===0?1:-1;
      if(opponentDistance<38){
        const toBall=unit(ball.x-p.x,ball.y-p.y),side=pairSide(p,opponent)*(p.team===0?1:-1),tangent={x:-toBall.y*side,y:toBall.x*side};
        const lane=unit(toBall.x+tangent.x*.58,toBall.y+tangent.y*.58);
        return safe(this,p,{x:p.x+lane.x*Math.min(70,Math.max(34,ballDistance)),y:p.y+lane.y*Math.min(70,Math.max(34,ballDistance))});
      }
      return this.approachBallTarget(p,{x:ball.x+attackDir*42,y:ball.y});
    }
    // Everyone else keeps football spacing instead of collapsing onto the same point.
    let x=(p.homeX??p.x)+(ball.x-FIELD.centerX)*.07,y=(p.homeY??p.y)+(ball.y-FIELD.centerY)*.09;
    if(ballDistance<105){const away=unit(p.x-ball.x,p.y-ball.y);x+=away.x*34;y+=away.y*34;}
    return safe(this,p,{x,y});
  }

  if(secondPresser){
    // The second defender covers the next lane; only the primary presser attacks the ball carrier.
    const ownGoalX=p.team===0?FIELD.left:FIELD.right,coverX=ball.x+(ownGoalX-ball.x)*.18;
    const laneY=(ball.y+(p.homeY??p.y))/2;
    return safe(this,p,{x:coverX,y:laneY});
  }

  return base;
};
