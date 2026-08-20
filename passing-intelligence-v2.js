import {MatchEngine} from './engine.js';
import {FIELD,isOffsidePosition} from './football-rules-v2.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function hashString(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function noise(key,salt=''){let h=hashString(`${key}|${salt}`);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;return((h>>>0)%10000)/9999;}
function playerKey(p){return String(p?.id||p?.data?.instanceId||p?.data?.name||'player');}
function roleFamily(role){if(role==='GK')return'GK';if(['CB','LB','RB'].includes(role))return'DEF';if(['CDM','CM','CAM'].includes(role))return'MID';return'FWD';}
function distanceToSegment(px,py,x1,y1,x2,y2){const A=px-x1,B=py-y1,C=x2-x1,D=y2-y1,len=C*C+D*D;let t=len?(A*C+B*D)/len:0;t=clamp(t,0,1);return Math.hypot(px-(x1+t*C),py-(y1+t*D));}
function nearestOpponent(engine,p){let best=null,bd=Infinity;for(const o of engine.players){if(o.team===p.team)continue;const d=dist(p,o);if(d<bd){bd=d;best=o;}}return{player:best,distance:bd};}
function laneOpen(engine,p,target){let best=180;for(const o of engine.players){if(o.team===p.team)continue;best=Math.min(best,distanceToSegment(o.x,o.y,p.x,p.y,target.x,target.y));}return best;}
function attackProgress(p){return p.team===0?(p.x-FIELD.left)/(FIELD.right-FIELD.left):(FIELD.right-p.x)/(FIELD.right-FIELD.left);}
function wideZone(p){return p.y<FIELD.top+145||p.y>FIELD.bottom-145;}
function centralZone(p){return p.y>FIELD.goalTop-45&&p.y<FIELD.goalBottom+45;}
function nearAttackingByline(p){return p.team===0?p.x>FIELD.right-125:p.x<FIELD.left+125;}

function passKindFor(p,m,distance,forward,open){
  const oppositeFlank=Math.abs(m.y-p.y)>250;
  if(nearAttackingByline(p)&&wideZone(p)&&m.x*(p.team===0?1:-1)<p.x*(p.team===0?1:-1)-35&&centralZone(m))return'cutback';
  if(attackProgress(p)>.70&&wideZone(p)&&centralZone(m)&&distance>100)return'cross';
  if(oppositeFlank&&distance>240)return'switch';
  if(forward>70&&distance>105)return open<18?'lob-through':'through';
  if(forward>20)return'progressive';
  return'support';
}

function passAim(p,m,kind){
  const dir=p.team===0?1:-1,speed=Math.hypot(m.vx||0,m.vy||0),pace=Number(m.data?.pace??70);
  if(kind==='through'||kind==='lob-through'){
    const lead=clamp(34+(pace-45)*.9+speed*8,35,96);
    return{x:clamp(m.x+dir*lead,FIELD.left+18,FIELD.right-18),y:clamp(m.y+(m.vy||0)*7,FIELD.top+16,FIELD.bottom-16)};
  }
  if(kind==='cross')return{x:p.team===0?FIELD.right-105:FIELD.left+105,y:clamp(lerp(m.y,FIELD.centerY,.62),FIELD.goalTop-45,FIELD.goalBottom+45)};
  if(kind==='cutback')return{x:p.team===0?FIELD.right-190:FIELD.left+190,y:clamp(lerp(m.y,FIELD.centerY,.72),FIELD.goalTop-80,FIELD.goalBottom+80)};
  if(kind==='switch')return{x:clamp(m.x+(m.vx||0)*8,FIELD.left+20,FIELD.right-20),y:clamp(m.y+(m.vy||0)*8,FIELD.top+16,FIELD.bottom-16)};
  return{x:clamp(m.x+(m.vx||0)*6,FIELD.left+18,FIELD.right-18),y:clamp(m.y+(m.vy||0)*6,FIELD.top+16,FIELD.bottom-16)};
}

export function evaluatePassOptions(engine,p){
  const vision=Number(p.data.vision??p.data.passing??65),passing=Number(p.data.passing??65),dir=p.team===0?1:-1,perception=190+vision*3.2,opps=engine.players.filter(x=>x.team!==p.team),options=[];
  for(const m of engine.players){
    if(m.team!==p.team||m.id===p.id||(m.role==='GK'&&roleFamily(p.role)==='FWD'))continue;
    const distance=dist(p,m);if(distance<28||distance>perception||isOffsidePosition(engine,m,engine.ball.x))continue;
    const forward=(m.x-p.x)*dir,open=laneOpen(engine,p,m),kind=passKindFor(p,m,distance,forward,open),aim=passAim(p,m,kind),aimOpen=Math.min(...opps.map(o=>dist(o,aim)),180);
    const roleBonus=roleFamily(m.role)==='FWD'?.10:roleFamily(m.role)==='MID'?.055:0,progressive=clamp(forward/250,-.55,1.15),space=clamp((open-10)/70,-.35,1.15),targetSpace=clamp((aimOpen-18)/85,-.25,.9),distanceCost=distance/900;
    const kindBonus={support:.05,progressive:.15,through:.29,'lob-through':.24,switch:.17,cross:.23,cutback:.34}[kind]||0;
    const score=space*.36+targetSpace*.22+progressive*.30+roleBonus+kindBonus+(vision+passing-130)/500-distanceCost;
    options.push({player:m,kind,aim,distance,forward,open,score,loft:kind==='lob-through'||(kind==='cross'&&open<15)});
  }
  return options.sort((a,b)=>b.score-a.score);
}

export function armIntentPass(engine,p,option){
  const passing=Number(p.data.passing??65),distance=dist(p,option.aim);let power=clamp(2.85+distance/92+(passing-60)*.012,2.9,7.15);
  if(option.kind==='support')power*=.82;if(option.kind==='cutback')power*=.88;if(option.kind==='switch')power*=1.06;if(option.loft)power*=.92;
  option.player.receiveIntent={fromId:p.id,aimX:option.aim.x,aimY:option.aim.y,createdTick:engine.tick,untilTick:engine.tick+85,waitForKick:true,kind:option.kind};
  p.passIntent={kind:option.kind,receiverId:option.player.id,createdTick:engine.tick};
  engine.armKick(p,option.aim,power,'pass',{receiverId:option.player.id,passKind:option.kind,loft:option.loft,plannedDistance:distance});
  p.decisionCooldown=.30+noise(playerKey(p),`pass-${engine.tick}`)*.10;
  engine.flash(p,option.kind==='through'||option.kind==='lob-through'?'profundo':option.kind==='switch'?'cambio':option.kind==='cross'?'centro':option.kind==='cutback'?'cutback':'pase');return true;
}

function shotOpportunity(engine,p){
  const goalX=p.team===0?FIELD.right:FIELD.left,goalDistance=Math.abs(goalX-p.x),progress=attackProgress(p),shooting=Number(p.data.shooting??55),composure=Number(p.data.composure??65),pressure=clamp((55-nearestOpponent(engine,p).distance)/55,0,1),central=1-clamp(Math.abs(p.y-FIELD.centerY)/260,0,1);
  return{score:progress*.40+shooting/100*.28+composure/100*.13+central*.18-pressure*.20-(goalDistance>340?.16:0),goalDistance,progress,central,pressure,shooting};
}
function shouldShoot(p,shot,bestPass){
  const fam=roleFamily(p.role),attacker=fam==='FWD'||p.role==='CAM',midfielder=fam==='MID',threshold=attacker?.52:midfielder?.58:.67;
  const finalThird=shot.progress>.64&&shot.goalDistance<375,goodBoxWindow=shot.progress>.76&&shot.goalDistance<255,passDominates=(bestPass?.score??-1)>shot.score+.22;
  if(goodBoxWindow&&shot.shooting>=48&&shot.score>.46)return true;
  if(finalThird&&shot.score>threshold&&!passDominates)return true;
  return false;
}
function clearForwardSpace(engine,p){const dir=p.team===0?1:-1;let nearest=160;for(const o of engine.players){if(o.team===p.team)continue;const dx=(o.x-p.x)*dir;if(dx<0||dx>110||Math.abs(o.y-p.y)>55)continue;nearest=Math.min(nearest,dist(p,o));}return nearest;}
function startIndependentDribble(engine,p,defender){
  const dir=p.team===0?1:-1,key=playerKey(p),side=noise(key,`dribble-${Math.floor(engine.tick/20)}`)>.5?1:-1,space=clearForwardSpace(engine,p),dribbling=Number(p.data.dribbling??65),control=Number(p.data.ballControl??65),stride=clamp(34+(dribbling-50)*.45+space*.16,38,82),lateral=defender?side*(22+(control-50)*.22):side*8;
  const target={x:clamp(p.x+dir*stride,FIELD.left+p.r,FIELD.right-p.r),y:clamp(p.y+lateral,FIELD.top+p.r,FIELD.bottom-p.r)};
  p.dribbleIntent={targetX:target.x,targetY:target.y,ttl:.32+control/360};p.lastDribbleDecisionTick=engine.tick;p.lastDribbleDefenderId=defender?.id||null;
  if(defender&&dist(p,defender)<45)engine.attemptSkillMove(p,defender);p.decisionCooldown=.22+noise(key,`decision-${engine.tick}`)*.12;return true;
}
function edgeBank(engine,p){
  const near=nearestOpponent(engine,p);if(!near.player||near.distance>29)return false;
  const gaps={top:engine.ball.y-FIELD.top,bottom:FIELD.bottom-engine.ball.y,left:engine.ball.x-FIELD.left,right:FIELD.right-engine.ball.x},edge=Object.entries(gaps).sort((a,b)=>a[1]-b[1])[0];if(edge[1]>24)return false;
  const side=edge[0],normal=side==='top'?{x:0,y:1}:side==='bottom'?{x:0,y:-1}:side==='left'?{x:1,y:0}:{x:-1,y:0},dir=p.team===0?1:-1;
  if((side==='left'||side==='right')&&engine.ball.y>FIELD.goalTop&&engine.ball.y<FIELD.goalBottom)return false;
  const aim={x:engine.ball.x-normal.x*86,y:engine.ball.y-normal.y*86},centreY=(FIELD.centerY-engine.ball.y)/220,len=Math.hypot(normal.x+dir*.70,normal.y+centreY)||1,exit={x:(normal.x+dir*.70)/len,y:(normal.y+centreY)/len};
  p.boundaryPlay={kind:'bank',started:engine.tick,edge:side,corner:false,exitX:exit.x,exitY:exit.y};engine.armKick(p,aim,2.15+(Number(p.data.ballControl??65)-50)*.008,'wall',{wallSide:side});p.decisionCooldown=.34;engine.flash(p,'pared');return true;
}

const originalPrepare=MatchEngine.prototype.prepareBallAction;
MatchEngine.prototype.prepareBallAction=function footballDecision(p){
  if(!p)return originalPrepare.call(this,p);if(p.boundaryPlay||p.wallPlay)return originalPrepare.call(this,p);if(p.decisionCooldown>0||p.kickIntent||p.dribbleIntent)return false;
  const contact=(p.r||7.25)+(this.ball.r||4.35)+7;if(dist(p,this.ball)>contact)return false;if(edgeBank(this,p))return true;
  const near=nearestOpponent(this,p),pressure=clamp((70-near.distance)/70,0,1),shot=shotOpportunity(this,p),passes=evaluatePassOptions(this,p),best=passes[0],fam=roleFamily(p.role),dribbling=Number(p.data.dribbling??60),control=Number(p.data.ballControl??60),vision=Number(p.data.vision??p.data.passing??60),forwardSpace=clearForwardSpace(this,p);
  if(shouldShoot(p,shot,best)){this.armShot(p,shot.goalDistance);p.decisionCooldown=.38;return true;}
  const passPreference=(fam==='MID'?.16:fam==='DEF'?.20:.04)+(vision-60)/260+pressure*.18,dribbleScore=.25+dribbling/180+control/340+forwardSpace/420-pressure*.20+(fam==='FWD'?.08:0);
  if(best&&(best.score+passPreference>.46||pressure>.46||fam==='DEF'||(fam==='MID'&&best.score>.12)))return armIntentPass(this,p,best);
  if(dribbling>=58&&forwardSpace>38&&dribbleScore>(best?.score??-.2)+.10)return startIndependentDribble(this,p,near.player);
  if(best)return armIntentPass(this,p,best);return startIndependentDribble(this,p,near.player);
};

export const __passingTest={passKindFor,passAim,clearForwardSpace,shotOpportunity,shouldShoot};
