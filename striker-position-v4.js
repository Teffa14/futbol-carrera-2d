import {MatchEngine} from './engine.js';
import {FIELD,secondLastDefenderLine} from './football-rules-v2.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hashString(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function noise(key,salt=''){let h=hashString(`${key}|${salt}`);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;return((h>>>0)%10000)/9999;}
function key(p){return String(p?.id||p?.data?.instanceId||p?.data?.name||'st');}
function attackProgress(engine,team){const raw=(engine.ball.x-FIELD.left)/(FIELD.right-FIELD.left);return team===0?raw:1-raw;}
export function exactOffsideLine(engine,team,ballX=engine.ball.x){const defender=secondLastDefenderLine(engine,team);return team===0?Math.max(FIELD.centerX,ballX,defender):Math.min(FIELD.centerX,ballX,defender);}
export function legalStrikerEdge(engine,p,buffer=2.4){const line=exactOffsideLine(engine,p.team);return p.team===0?line-buffer:line+buffer;}

export function strikerSpatialTarget(engine,p,base,possession){
  if(!p||p.role!=='ST'||!base||engine.restart?.active)return base;const dir=p.team===0?1:-1,our=possession===p.team,loose=possession===null;if(!our&&!loose)return base;
  if(p.receiveIntent||p.anticipationTarget?.reason==='receive-pass'||p.anticipationTarget?.reason==='intercept')return base;
  const line=exactOffsideLine(engine,p.team),legal=legalStrikerEdge(engine,p),progress=attackProgress(engine,p.team),pace=Number(p.data?.pace??70),vision=Number(p.data?.vision??60),ballGap=dir*(engine.ball.x-p.x),cycle=Math.floor(engine.tick/64),profile=noise(key(p),`run-${cycle}`),ballWide=Math.abs(engine.ball.y-FIELD.centerY)>150;
  let mode='pin';if(progress<.30||ballGap<-185)mode='connect';else if(progress>.70)mode='box';else if(profile<.16)mode='check';else if(profile>.42)mode='depth';
  let x;if(mode==='connect')x=engine.ball.x+dir*clamp(105+(vision-55)*.45,92,132);else if(mode==='check')x=line-dir*clamp(26+(vision-55)*.28,22,38);else if(mode==='depth')x=legal;else if(mode==='box')x=dir>0?FIELD.right-112:FIELD.left+112;else x=line-dir*clamp(5+(82-pace)*.08,4,10);
  if(dir>0)x=Math.min(x,legal);else x=Math.max(x,legal);
  const central=engine.players.filter(o=>o.team!==p.team&&o.role!=='GK').sort((a,b)=>Math.abs(a.y-FIELD.centerY)-Math.abs(b.y-FIELD.centerY)).slice(0,2);let y=FIELD.centerY;
  if(ballWide){const ballSide=Math.sign(engine.ball.y-FIELD.centerY)||1;y=FIELD.centerY-ballSide*(mode==='box'?44:30);}else if(central.length>=2){const mid=(central[0].y+central[1].y)/2,side=noise(key(p),'channel')>.5?1:-1;y=mid+side*clamp(30+pace*.18,38,52);}else y=FIELD.centerY+(noise(key(p),'channel')>.5?1:-1)*34;
  if(mode==='connect')y=FIELD.centerY+(engine.ball.y-FIELD.centerY)*.28;y=clamp(y,FIELD.goalTop-100,FIELD.goalBottom+100);p.strikerRunMode=mode;p.strikerReferenceLine=line;return{x:clamp(x,FIELD.left+(p.r||7.25),FIELD.right-(p.r||7.25)),y};
}

const previousAiTarget=MatchEngine.prototype.aiTarget;
MatchEngine.prototype.aiTarget=function correctedStrikerSpace(p,pressers,actor,possession){const base=previousAiTarget.call(this,p,pressers,actor,possession);if(!p||p.role!=='ST'||actor?.id===p.id)return base;const primary=possession!==null&&possession!==p.team&&Array.isArray(pressers)&&pressers[0]===p.id;if(primary)return base;return strikerSpatialTarget(this,p,base,possession);};

export const __strikerPositionV4={exactOffsideLine,legalStrikerEdge,strikerSpatialTarget};
