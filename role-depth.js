import {MatchEngine} from './engine.js';

const FIELD={left:55,right:1045,top:45,bottom:655};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const DEPTH={
  CB:{behind:250,weight:.52},LB:{behind:185,weight:.50},RB:{behind:185,weight:.50},
  CDM:{behind:175,weight:.58},CM:{behind:112,weight:.70},CAM:{behind:62,weight:.74},
  LW:{behind:34,weight:.72},RW:{behind:34,weight:.72},ST:{behind:22,weight:.76}
};

export function ballRelativeDepthTarget(p,ball,base,ourPossession){
  if(!p||!base||!ourPossession||p.role==='GK')return base;
  const rule=DEPTH[p.role]||DEPTH.CM,dir=p.team===0?1:-1,r=p.r??10;
  const wantedX=clamp(ball.x-dir*rule.behind,FIELD.left+r,FIELD.right-r);
  let x=lerp(base.x,wantedX,rule.weight);
  // Hard ordering guard: deeper roles cannot drift past the support line that
  // belongs to the role ahead of them when the ball reaches the final third.
  const minimumBehind={CB:205,LB:145,RB:145,CDM:135,CM:78,CAM:42,LW:14,RW:14,ST:8}[p.role]??78;
  const limit=ball.x-dir*minimumBehind;
  if(dir>0)x=Math.min(x,limit);else x=Math.max(x,limit);
  return{x:clamp(x,FIELD.left+r,FIELD.right-r),y:base.y};
}

const previousAiTarget=MatchEngine.prototype.aiTarget;
MatchEngine.prototype.aiTarget=function orderedRoleDepth(p,pressers,actor,possession){
  const base=previousAiTarget.call(this,p,pressers,actor,possession);
  if(!p||this.restart?.active||actor?.id===p.id)return base;
  const primaryPresser=possession!==null&&possession!==p.team&&Array.isArray(pressers)&&pressers[0]===p.id;
  if(primaryPresser)return base;
  return ballRelativeDepthTarget(p,this.ball,base,possession===p.team);
};
