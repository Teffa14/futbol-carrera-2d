import {MatchEngine} from './engine.js';

const mag=(x,y)=>Math.hypot(x,y);
const unit=(x,y)=>{const l=mag(x,y)||1;return{x:x/l,y:y/l};};
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;
function hashString(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function pairSide(a,b){return(hashString([String(a?.id),String(b?.id)].sort().join('|'))&1)?1:-1;}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}

const originalAiTarget=MatchEngine.prototype.aiTarget;

MatchEngine.prototype.aiTarget=function ballFirstAiTarget(p,pressers,actor,possession){
  const base=originalAiTarget.call(this,p,pressers,actor,possession);
  if(!p||p.role==='GK'||this.restart?.active)return base;

  const ball=this.ball;
  const ballDistance=distance(p,ball);
  let opponent=null,opponentDistance=Infinity;
  for(const candidate of this.players){
    if(candidate===p||candidate.team===p.team)continue;
    const d=distance(p,candidate);
    if(d<opponentDistance){opponent=candidate;opponentDistance=d;}
  }
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
