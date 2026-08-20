import {MatchEngine} from './engine.js';
import {FIELD,onsideLimit,secondLastDefenderLine} from './football-rules-v2.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function hashString(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function noise(key,salt=''){let h=hashString(`${key}|${salt}`);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;return((h>>>0)%10000)/9999;}
function key(p){return String(p?.id||p?.data?.instanceId||p?.data?.name||'player');}
function unit(x,y){const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};}
function attackProgress(engine,team){const raw=(engine.ball.x-FIELD.left)/(FIELD.right-FIELD.left);return team===0?raw:1-raw;}
function nearestOpponent(engine,p){let best=null,bd=Infinity;for(const o of engine.players){if(o.team===p.team)continue;const d=dist(p,o);if(d<bd){best=o;bd=d;}}return{player:best,distance:bd};}
function forwardSpace(engine,p){const dir=p.team===0?1:-1;let gap=170;for(const o of engine.players){if(o.team===p.team)continue;const dx=(o.x-p.x)*dir;if(dx<=0||dx>145||Math.abs(o.y-p.y)>62)continue;gap=Math.min(gap,dist(p,o));}return gap;}

export function strikerLineTarget(engine,p,base,possession){
  if(!p||p.role!=='ST'||!base||engine.restart?.active)return base;
  const dir=p.team===0?1:-1,r=p.r||7.25,our=possession===p.team,loose=possession===null;
  if(!our&&!loose)return base;
  const limit=onsideLimit(engine,p.team),defLine=secondLastDefenderLine(engine,p.team),progress=attackProgress(engine,p.team),pace=Number(p.data?.pace??70),shoot=Number(p.data?.shooting??65),aggression=(pace+shoot)/200;
  const lineMargin=clamp(13-aggression*7,5,11);
  let lineX=limit-dir*lineMargin;
  const minimumHigh=FIELD.centerX+dir*(progress<.28?70:progress<.55?105:135);
  if(dir>0)lineX=Math.max(lineX,minimumHigh);else lineX=Math.min(lineX,minimumHigh);
  const legalEdge=limit-dir*3;
  if(dir>0)lineX=Math.min(lineX,legalEdge);else lineX=Math.max(lineX,legalEdge);

  // The striker references the opposition line, not ball.x. He can check short
  // occasionally, but the default job is to pin and threaten depth.
  const cycle=Math.floor(engine.tick/72),profile=noise(key(p),`run-${cycle}`),ballWide=Math.abs(engine.ball.y-FIELD.centerY)>155;
  let mode='pin';
  if(our&&progress>.30&&profile>.34)mode='depth';
  if(our&&progress>.48&&profile<.13)mode='check';
  if(loose)mode='pin';

  let x=lineX;
  if(mode==='depth')x=lineX+dir*clamp(8+(pace-60)*.24,8,18);
  if(mode==='check'){
    const supportX=engine.ball.x+dir*clamp(78+(Number(p.data?.vision??60)-60)*.35,68,92);
    x=dir>0?Math.min(lineX,supportX):Math.max(lineX,supportX);
  }
  if(dir>0)x=Math.min(x,legalEdge);else x=Math.max(x,legalEdge);

  const side=noise(key(p),'channel')>.5?1:-1;
  let y=FIELD.centerY+side*(18+noise(key(p),'halfspace')*42);
  if(ballWide){
    const nearSide=Math.sign(engine.ball.y-FIELD.centerY)||1;
    // Attack the inside channel/opposite shoulder rather than standing on top
    // of the wide ball carrier.
    y=FIELD.centerY-nearSide*(20+noise(key(p),'far-post')*54);
  }
  y=clamp(y,FIELD.goalTop-105,FIELD.goalBottom+105);
  p.strikerRunMode=mode;p.strikerReferenceLine=defLine;
  return{x:clamp(x,FIELD.left+r,FIELD.right-r),y};
}

export function shouldAttackOneVOne(engine,p){
  if(!p||!['ST','LW','RW','CAM'].includes(p.role)||engine.restart?.active)return false;
  if(p.kickIntent||p.dribbleIntent||p.decisionCooldown>0)return false;
  const contact=(p.r||7.25)+(engine.ball.r||4.35)+7;
  if(dist(p,engine.ball)>contact)return false;
  const near=nearestOpponent(engine,p);if(!near.player||near.distance<15||near.distance>52)return false;
  const dribbling=Number(p.data?.dribbling??60),control=Number(p.data?.ballControl??60),instruction=Number(p.data?.instructions?.dribble??55),space=forwardSpace(engine,p),progress=attackProgress(engine,p.team);
  if(dribbling<57||control<56||space<38)return false;
  const appetite=clamp(.18+(dribbling-55)/115+(control-55)/180+(instruction-50)/125+(progress>.55?.11:0),.15,.82);
  return noise(key(p),`1v1-${Math.floor(engine.tick/28)}`)<appetite;
}

const previousAiTarget=MatchEngine.prototype.aiTarget;
MatchEngine.prototype.aiTarget=function strikerDepthTarget(p,pressers,actor,possession){
  const base=previousAiTarget.call(this,p,pressers,actor,possession);
  if(!p||p.role!=='ST'||this.restart?.active||actor?.id===p.id)return base;
  const primaryPresser=possession!==null&&possession!==p.team&&Array.isArray(pressers)&&pressers[0]===p.id;
  if(primaryPresser||p.receiveIntent)return base;
  return strikerLineTarget(this,p,base,possession);
};

const previousPrepare=MatchEngine.prototype.prepareBallAction;
MatchEngine.prototype.prepareBallAction=function attackerOneVOneBalance(p){
  if(shouldAttackOneVOne(this,p)){
    const near=nearestOpponent(this,p),dir=p.team===0?1:-1,side=noise(key(p),`side-${Math.floor(this.tick/28)}`)>.5?1:-1;
    const target={x:clamp(p.x+dir*(40+Number(p.data?.pace??70)*.22),FIELD.left+p.r,FIELD.right-p.r),y:clamp(p.y+side*(22+Number(p.data?.dribbling??65)*.20),FIELD.top+p.r,FIELD.bottom-p.r)};
    p.dribbleIntent={targetX:target.x,targetY:target.y,ttl:.30+Number(p.data?.ballControl??65)/390};
    p.lastDribbleDecisionTick=this.tick;p.lastDribbleDefenderId=near.player?.id||null;p.decisionCooldown=.25;
    if(near.player&&near.distance<43)this.attemptSkillMove(p,near.player);
    return true;
  }
  return previousPrepare.call(this,p);
};

export const __strikerTest={attackProgress,forwardSpace};
