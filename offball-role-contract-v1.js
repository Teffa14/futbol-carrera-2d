import {createRoleContract,primaryResponsibility} from './role-contract-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;

function attackDir(team){return team===0?1:-1;}
function wideLaneY(player,field){
  const homeY=player.homeY??player.y??((field.top+field.bottom)/2);
  const side=Math.sign(homeY-(field.top+field.bottom)/2)||1;
  return side>0?field.bottom-(player.r||10)-14:field.top+(player.r||10)+14;
}
function clampTarget(player,target,field){
  const r=player.r||10;
  return{
    x:clamp(target.x,field.left+r,field.right-r),
    y:clamp(target.y,field.top+r,field.bottom-r),
  };
}

export function resolveOffBallRoleInstruction({player,tacticalState,tactics={},trust=0,influence=0}={}){
  if(!player||!tacticalState?.phase)return null;
  const contract=createRoleContract({role:player.role||player.position||'CM',tactics,trust,influence});
  const responsibility=primaryResponsibility(contract,tacticalState.phase);
  return responsibility?{...responsibility,creativeFreedom:contract.creativeFreedom,roleDiscipline:contract.roleDiscipline}:null;
}

export function applyOffBallRoleContract({target,player,ball,tacticalState,tactics={},field={left:55,right:1045,top:45,bottom:655},trust=0,influence=0}={}){
  if(!target||!player||!ball)return target;
  const instruction=resolveOffBallRoleInstruction({player,tacticalState,tactics,trust,influence});
  if(!instruction)return clampTarget(player,{...target},field);

  const next={...target};
  const dir=attackDir(player.team);
  const action=instruction.action||'';
  const discipline=clamp((instruction.roleDiscipline??70)/100,.48,.94);
  const strength=.42+.34*discipline;
  const anchorX=player.homeX??player.x??target.x;
  const anchorY=player.homeY??player.y??target.y;

  if(/width|outside/.test(action)){
    next.y=lerp(next.y,wideLaneY(player,field),strength);
  }
  if(/pin-centre-backs|preserve-depth|threaten-depth|attack-centre-back-blindside|finishing-lane/.test(action)){
    const depth=Math.max(anchorX+dir*72,ball.x+dir*58);
    next.x=lerp(next.x,depth,strength);
  }
  if(/stay-behind-ball|rest-defence|secure-recycle|protect-central/.test(action)){
    const safeX=dir===1?Math.min(anchorX+26,ball.x-58):Math.max(anchorX-26,ball.x+58);
    next.x=lerp(next.x,safeX,strength);
    next.y=lerp(next.y,(field.top+field.bottom)/2,.18*strength);
  }
  if(/show-between|passing-angle|support|line-break|third-man/.test(action)){
    const supportX=ball.x-dir*54;
    next.x=lerp(next.x,supportX,.46*strength);
    const offset=Math.sign(anchorY-ball.y)||Math.sign(anchorY-(field.top+field.bottom)/2)||1;
    next.y=lerp(next.y,ball.y+offset*56,.32*strength);
  }
  if(/recover-to-wide-midfield-line|protect-wide-channel|back-post/.test(action)){
    next.x=lerp(next.x,anchorX-dir*28,.58*strength);
    next.y=lerp(next.y,anchorY,.62*strength);
  }
  if(/screen-centre|protect-depth|maintain-defensive-line/.test(action)){
    next.y=lerp(next.y,(field.top+field.bottom)/2,.36*strength);
    next.x=lerp(next.x,anchorX-dir*18,.35*strength);
  }
  if(/counterpress/.test(action)&&tacticalState?.transition){
    next.x=lerp(next.x,ball.x,.22*strength);
    next.y=lerp(next.y,ball.y,.22*strength);
  }

  return clampTarget(player,next,field);
}
