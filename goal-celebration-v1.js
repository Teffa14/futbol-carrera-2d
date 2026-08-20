import {MatchEngine} from './engine.js';

const FIELD={left:55,right:1045,top:45,bottom:655,goalTop:295,goalBottom:405,centerX:550,centerY:350};
const CELEBRATION_SECONDS=2.75;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const nowMs=()=>globalThis.performance?.now?.()??Date.now();
const browserClock=()=>typeof window!=='undefined'&&typeof document!=='undefined';

function goalTeam(engine){
  if(engine.ball.y<FIELD.goalTop||engine.ball.y>FIELD.goalBottom)return null;
  if(engine.ball.x<FIELD.left-9)return 1;
  if(engine.ball.x>FIELD.right+9)return 0;
  return null;
}

function playerLabel(player){return player?.data?.name||'Jugador';}

function goalIdentity(engine,team,snapshot){
  const shot=engine.playerById(snapshot.shotById),touch=engine.playerById(snapshot.lastPlayerId),assist=engine.playerById(snapshot.assistCandidateId);
  const scorer=shot?.team===team?shot:touch?.team===team?touch:null;
  const ownGoal=!scorer&&touch&&touch.team!==team?touch:null;
  const validAssist=assist?.team===team&&assist.id!==scorer?.id?assist:null;
  return{
    scorerId:scorer?.id||null,
    scorerName:scorer?playerLabel(scorer):ownGoal?`Gol en contra · ${playerLabel(ownGoal)}`:'Gol',
    assistId:validAssist?.id||null,
    assistName:validAssist?playerLabel(validAssist):null,
  };
}

function celebrationTarget(engine,player,celebration,index){
  const dir=celebration.team===0?1:-1,baseX=celebration.team===0?FIELD.right-70:FIELD.left+70;
  const scorer=engine.playerById(celebration.scorerId),baseY=clamp(scorer?.y??FIELD.centerY,FIELD.top+72,FIELD.bottom-72);
  if(player.id===celebration.scorerId){
    const side=baseY<FIELD.centerY?-1:1;
    return{x:baseX-dir*6,y:clamp(baseY+side*38,FIELD.top+58,FIELD.bottom-58)};
  }
  const offsets=[[-26,-24],[-34,22],[-52,-5],[-18,42]];
  const o=offsets[index%offsets.length];
  return{x:baseX-dir*Math.abs(o[0]),y:clamp(baseY+o[1],FIELD.top+55,FIELD.bottom-55)};
}

function moveForCelebration(player,target,dt){
  const dx=target.x-player.x,dy=target.y-player.y,d=Math.hypot(dx,dy)||1,speed=1.15+Math.min(1.1,d/95),frame=dt*60;
  player.vx=dx/d*speed;player.vy=dy/d*speed;
  player.x=clamp(player.x+player.vx*frame,FIELD.left+player.r,FIELD.right-player.r);
  player.y=clamp(player.y+player.vy*frame,FIELD.top+player.r,FIELD.bottom-player.r);
  player.facingX=dx/d;player.facingY=dy/d;player.desiredFacingX=player.facingX;player.desiredFacingY=player.facingY;
  player.action='GOL';player.actionTimer=.35;
}

function createCelebration(engine,team,resetFn,resetArgs,snapshot){
  const identity=goalIdentity(engine,team,snapshot),scorer=engine.playerById(identity.scorerId),anchor=scorer||{x:team===0?FIELD.right-60:FIELD.left+60,y:FIELD.centerY};
  const celebrants=engine.players.filter(p=>p.team===team&&p.role!=='GK').sort((a,b)=>dist(a,anchor)-dist(b,anchor)).slice(0,4).map(p=>p.id);
  const start=nowMs(),wallClock=browserClock();
  engine.ball.vx=0;engine.ball.vy=0;
  engine.goalCelebration={
    active:true,team,scorerId:identity.scorerId,scorerName:identity.scorerName,assistId:identity.assistId,assistName:identity.assistName,
    score:[...engine.score],minute:Math.max(1,Math.round(engine.minute)),celebrants,
    ballX:engine.ball.x,ballY:engine.ball.y,resetFn,resetArgs:resetArgs?.length?resetArgs:[1-team,false],
    wallClock,startMs:start,lastMs:start,untilMs:start+CELEBRATION_SECONDS*1000,remaining:CELEBRATION_SECONDS,total:CELEBRATION_SECONDS,
  };
  for(const p of engine.players){p.kickIntent=null;p.dribbleIntent=null;p.decisionCooldown=Math.max(p.decisionCooldown||0,.35);if(p.team===team&&celebrants.includes(p.id)){p.action='GOL';p.actionTimer=.8;}}
  return engine.goalCelebration;
}

export function goalCelebrationSnapshot(engine){
  const c=engine?.goalCelebration;if(!c?.active)return null;
  const now=c.wallClock?nowMs():null,remaining=c.wallClock?Math.max(0,(c.untilMs-now)/1000):Math.max(0,c.remaining);
  return{active:true,team:c.team,scorerId:c.scorerId,scorerName:c.scorerName,assistName:c.assistName,score:[...c.score],minute:c.minute,remaining:+remaining.toFixed(2),progress:clamp(1-remaining/c.total,0,1)};
}

export function advanceGoalCelebration(engine,dt){
  const c=engine?.goalCelebration;if(!c?.active)return false;
  let frameDt=dt;
  if(c.wallClock){const now=nowMs();frameDt=clamp((now-c.lastMs)/1000,0,.05);c.lastMs=now;}else c.remaining=Math.max(0,c.remaining-dt);
  engine.ball.x=c.ballX;engine.ball.y=c.ballY;engine.ball.vx=0;engine.ball.vy=0;
  for(const p of engine.players){
    if(p.team===c.team&&c.celebrants.includes(p.id))moveForCelebration(p,celebrationTarget(engine,p,c,c.celebrants.indexOf(p.id)),frameDt);
    else{p.vx*=.72;p.vy*=.72;}
  }
  const expired=c.wallClock?nowMs()>=c.untilMs:c.remaining<=0;
  if(!expired)return true;
  c.active=false;
  const reset=c.resetFn,args=c.resetArgs;
  engine.goalCelebration=null;
  reset.apply(engine,args);
  return true;
}

const originalCheckGoal=MatchEngine.prototype.checkGoal;
MatchEngine.prototype.checkGoal=function checkGoalWithCelebration(){
  if(this.goalCelebration?.active)return false;
  const team=goalTeam(this);if(team===null)return originalCheckGoal.call(this);
  const before=[...this.score],snapshot={shotById:this.ball.shotById,lastPlayerId:this.ball.lastPlayerId,assistCandidateId:this.ball.assistCandidateId};
  const resetFn=this.resetPositions;let resetArgs=null;
  this.resetPositions=(...args)=>{resetArgs=args;};
  let result;
  try{result=originalCheckGoal.call(this);}finally{this.resetPositions=resetFn;}
  if(this.score[team]===before[team]+1)createCelebration(this,team,resetFn,resetArgs,snapshot);
  return result;
};

const originalStep=MatchEngine.prototype.step;
MatchEngine.prototype.step=function stepWithGoalPause(dt){
  if(this.goalCelebration?.active){advanceGoalCelebration(this,dt);return;}
  return originalStep.call(this,dt);
};

function drawGoalOverlay(ctx,width,height,engine){
  const c=goalCelebrationSnapshot(engine);if(!c)return;
  const w=Math.min(width-40,590),h=Math.min(132,height*.24),x=(width-w)/2,y=Math.max(26,height*.075),teamColor=engine.colors[c.team]||'#75aadb';
  const pulse=1+Math.sin(c.progress*Math.PI*5)*.018;
  ctx.save();ctx.translate(width/2,y+h/2);ctx.scale(pulse,pulse);ctx.translate(-width/2,-(y+h/2));
  ctx.fillStyle='rgba(4,11,17,.94)';ctx.fillRect(x,y,w,h);ctx.fillStyle=teamColor;ctx.fillRect(x,y,8,h);
  ctx.strokeStyle='rgba(255,255,255,.42)';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  ctx.textAlign='left';ctx.fillStyle='#f7f2e7';ctx.font='900 46px Bahnschrift, Aptos Display, Segoe UI, sans-serif';ctx.fillText('GOL',x+28,y+51);
  ctx.font='800 21px Bahnschrift, Aptos, Segoe UI, sans-serif';ctx.fillText(c.scorerName,x+29,y+82);
  ctx.fillStyle='#9ec9e8';ctx.font='700 13px Aptos, Segoe UI, sans-serif';ctx.fillText(`${engine.names[c.team]} · ${c.score[0]} - ${c.score[1]} · ${c.minute}'`,x+29,y+106);
  if(c.assistName){ctx.textAlign='right';ctx.fillStyle='#d8b96b';ctx.fillText(`Asistencia: ${c.assistName}`,x+w-24,y+106);}
  ctx.restore();
}

const originalDraw=MatchEngine.prototype.draw;
MatchEngine.prototype.draw=function drawWithGoalCelebration(ctx,width=1100,height=700,options={}){
  const result=originalDraw.call(this,ctx,width,height,options);drawGoalOverlay(ctx,width,height,this);return result;
};

const originalReport=MatchEngine.prototype.report;
MatchEngine.prototype.report=function reportWithGoalCelebration(){const report=originalReport.call(this);report.goalCelebration=goalCelebrationSnapshot(this);return report;};

export const __goalCelebrationTest={goalTeam,goalIdentity,CELEBRATION_SECONDS};
