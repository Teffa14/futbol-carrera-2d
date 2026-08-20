import {MatchEngine} from './engine.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mag=(x,y)=>Math.hypot(Number(x)||0,Number(y)||0);
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;

export function staminaRemaining(player){
  const fitness=clamp(Number(player?.data?.fitness??100),35,100);
  const fatigue=clamp(Number(player?.fatigue??0),0,100);
  return clamp(fitness-fatigue,0,100);
}

export function receptionTouchVelocity({ballVx=0,ballVy=0,playerVx=0,playerVy=0,normalX=1,normalY=0,ballControl=65,composure=65,dribbling=65,fatigue=0,intended=false}={}){
  const speed=mag(ballVx-playerVx,ballVy-playerVy),control=clamp(Number(ballControl)||65,20,99),calm=clamp(Number(composure)||65,20,99),dribble=clamp(Number(dribbling)||65,20,99);
  const quality=clamp(control*.62+calm*.20+dribble*.12+(intended?7:0)-Math.max(0,speed-4.5)*2.2-clamp(Number(fatigue)||0,0,100)*.10,20,99);
  const nx=Number(normalX)||0,ny=Number(normalY)||0,relX=ballVx-playerVx,relY=ballVy-playerVy,normalSpeed=dot(relX,relY,nx,ny),tangentX=relX-nx*normalSpeed,tangentY=relY-ny*normalSpeed;
  const residual=clamp(.64-quality*.0051+Math.max(0,speed-2)*.018,.09,.58)*(intended?.82:1);
  const release=clamp(speed*(.30-quality*.00245),.08,1.35)*(intended?.78:1);
  const carry=.34+quality*.0042;
  return{
    vx:playerVx*carry+tangentX*residual+nx*release,
    vy:playerVy*carry+tangentY*residual+ny*release,
    quality,
    residual,
    release,
  };
}

const originalResolveBallPlayerCollisions=MatchEngine.prototype.resolveBallPlayerCollisions;
MatchEngine.prototype.resolveBallPlayerCollisions=function controlledFirstTouchCollisions(){
  if(!this?.ball||!Array.isArray(this.players))return originalResolveBallPlayerCollisions.call(this);
  const ball=this.ball,overlapping=this.players
    .map(p=>({p,d:Math.hypot(ball.x-p.x,ball.y-p.y)}))
    .filter(({p,d})=>d<=(p.r+ball.r+.35))
    .sort((a,b)=>{
      const ai=ball.intendedReceiverId===a.p.id?1:0,bi=ball.intendedReceiverId===b.p.id?1:0;
      return bi-ai||a.d-b.d;
    });
  const hit=overlapping[0];
  if(hit){
    const p=hit.p,d=hit.d||.0001,min=p.r+ball.r,nx=(ball.x-p.x)/d,ny=(ball.y-p.y)/d,relativeInto=-dot(ball.vx-p.vx,ball.vy-p.vy,nx,ny),speed=mag(ball.vx-p.vx,ball.vy-p.vy);
    const eligible=!p.kickIntent&&p.lastReceptionControlTick!==this.tick&&relativeInto>.22&&speed>.72;
    if(eligible){
      const intended=ball.intendedReceiverId===p.id,ownPass=ball.passerId&&ball.lastTeam===p.team;
      const touch=receptionTouchVelocity({
        ballVx:ball.vx,ballVy:ball.vy,playerVx:p.vx,playerVy:p.vy,normalX:nx,normalY:ny,
        ballControl:p.data?.ballControl??65,composure:p.data?.composure??65,dribbling:p.data?.dribbling??65,fatigue:p.fatigue??0,intended:intended||ownPass,
      });
      ball.vx=touch.vx;ball.vy=touch.vy;p.lastReceptionControlTick=this.tick;p.lastControlQuality=touch.quality;
      p.action=touch.quality>=78?'control':'toque';p.actionTimer=Math.max(p.actionTimer||0,.38);
      if(intended&&p.id===this.userId&&speed>2.4)this.pushEvent(touch.quality>=78?'Buen control orientado':'Control largo bajo presión',p.team,'user');
      // Keep the ball physically separate. The normal collision resolver still performs separation,
      // but now it sees the cushioned relative velocity instead of a full-speed incoming pass.
      if(hit.d<min-.2){ball.x=p.x+nx*(min-.2);ball.y=p.y+ny*(min-.2);}
    }
  }
  return originalResolveBallPlayerCollisions.call(this);
};

const originalExecuteKick=MatchEngine.prototype.executeKick;
MatchEngine.prototype.executeKick=function firstTimeTechniqueKick(p,contactNormal=null){
  const firstTime=!!p?.kickIntent?.firstTime;
  if(!firstTime)return originalExecuteKick.call(this,p,contactNormal);
  const originalShooting=p.data.shooting,shot=Number(originalShooting??60),control=Number(p.data.ballControl??60),composure=Number(p.data.composure??65);
  p.data.shooting=clamp(Math.round(shot*.66+control*.24+composure*.10),30,99);
  try{return originalExecuteKick.call(this,p,contactNormal);}finally{p.data.shooting=originalShooting;}
};

const originalUserPerformance=MatchEngine.prototype.userPerformance;
MatchEngine.prototype.userPerformance=function staminaAwareUserPerformance(){
  const out=originalUserPerformance.call(this),p=this.playerById(this.userId);if(!out||!p)return out;
  return{...out,staminaRemaining:Math.round(staminaRemaining(p)),staminaStat:Math.round(Number(p.data?.stamina??p.data?.physical??70))};
};

const originalDrawUserBadge=MatchEngine.prototype.drawUserBadge;
MatchEngine.prototype.drawUserBadge=function staminaAwareBadge(ctx,user,width,height){
  originalDrawUserBadge.call(this,ctx,user,width,height);
  const remaining=staminaRemaining(user),x=12,y=height-76,w=300,h=11;
  ctx.save();ctx.fillStyle='rgba(5,15,10,.88)';ctx.fillRect(x,y,w,h);ctx.fillStyle='#14291d';ctx.fillRect(x+2,y+2,w-4,h-4);
  ctx.fillStyle=remaining>55?'#d7ff4a':remaining>28?'#ffd166':'#ff6b6b';ctx.fillRect(x+2,y+2,(w-4)*remaining/100,h-4);
  ctx.fillStyle='#dfe9e2';ctx.font='800 9px system-ui';ctx.textAlign='left';ctx.fillText(`STAMINA ${Math.round(remaining)}% · ATR ${Math.round(Number(user.data?.stamina??user.data?.physical??70))}`,x+7,y-3);ctx.restore();
};

export const __physicalTechniqueTest={staminaRemaining,receptionTouchVelocity};
