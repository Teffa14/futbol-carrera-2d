import {MatchEngine} from './engine.js';

export const FIELD={left:55,right:1045,top:45,bottom:655,goalTop:295,goalBottom:405,centerX:550,centerY:350};
export const PLAYER_RADIUS=6.7;
export const BALL_RADIUS=4.35;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};

export function secondLastDefenderLine(engine,attackingTeam){
  const xs=engine.players.filter(p=>p.team!==attackingTeam).map(p=>p.x).sort((a,b)=>a-b);
  if(xs.length<2)return attackingTeam===0?FIELD.right:FIELD.left;
  return attackingTeam===0?xs[xs.length-2]:xs[1];
}

export function isOffsidePosition(engine,p,ballX=engine.ball.x){
  if(!p||p.role==='GK')return false;
  if(p.team===0){
    if(p.x<=FIELD.centerX)return false;
    const line=Math.max(FIELD.centerX,ballX,secondLastDefenderLine(engine,0));
    return p.x>line+1.5;
  }
  if(p.x>=FIELD.centerX)return false;
  const line=Math.min(FIELD.centerX,ballX,secondLastDefenderLine(engine,1));
  return p.x<line-1.5;
}

export function onsideLimit(engine,team){
  if(team===0)return Math.max(FIELD.centerX,engine.ball.x,secondLastDefenderLine(engine,0))-10;
  return Math.min(FIELD.centerX,engine.ball.x,secondLastDefenderLine(engine,1))+10;
}

const originalExecuteKick=MatchEngine.prototype.executeKick;
const originalRegisterTouch=MatchEngine.prototype.registerPhysicalTouch;
const originalUpdateFreeBall=MatchEngine.prototype.updateFreeBall;
const originalResolveBallPlayers=MatchEngine.prototype.resolveBallPlayerCollisions;
const originalCheckGoal=MatchEngine.prototype.checkGoal;
const originalDrawBall=MatchEngine.prototype.drawBall;

function angleDelta(ax,ay,bx,by){const a=Math.atan2(ay,ax),b=Math.atan2(by,bx);let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d;}

MatchEngine.prototype.executeKick=function footballIntentKick(p,contactNormal){
  const k=p.kickIntent;if(!k)return false;
  const desired=unit(k.aimX-p.x,k.aimY-p.y);
  if(Math.abs(angleDelta(p.facingX,p.facingY,desired.x,desired.y))>.34){p.desiredFacingX=desired.x;p.desiredFacingY=desired.y;return false;}
  const receiver=k.receiverId?this.playerById(k.receiverId):null;
  const offside=receiver&&k.type==='pass'?isOffsidePosition(this,receiver,this.ball.x):false;
  const snapshot={...k};
  const result=originalExecuteKick.call(this,p,contactNormal);
  if(result&&snapshot.type==='pass'){
    if(offside)this.pendingOffside={attackingTeam:p.team,receiverId:receiver.id,kickTick:this.tick,x:receiver.x,y:receiver.y};
    if(snapshot.loft){this.ball.z=1.2;this.ball.vz=clamp(.42+(snapshot.plannedDistance||120)/850,.45,.82);}
    if(p.id===this.userId){const label={through:'Pase profundo','lob-through':'Globo al espacio',switch:'Cambio de frente',cross:'Centro',cutback:'Pase atrás',progressive:'Pase progresivo',support:'Pase de apoyo'}[snapshot.passKind];if(label)this.pushEvent(label,p.team,'user');}
  }
  return result;
};

export function awardOffside(engine,pending){
  const team=1-pending.attackingTeam,x=clamp(pending.x,FIELD.left+60,FIELD.right-60),y=clamp(pending.y,FIELD.top+40,FIELD.bottom-40);
  const kicker=engine.players.filter(p=>p.team===team&&p.role!=='GK').sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]||engine.players.find(p=>p.team===team);
  if(!kicker)return false;
  for(const p of engine.players){p.kickIntent=null;p.dribbleIntent=null;p.receiveIntent=null;p.vx*=.15;p.vy*=.15;}
  const dir=team===0?1:-1,contact=kicker.r+engine.ball.r-.6;
  kicker.x=x-dir*contact;kicker.y=y;kicker.vx=0;kicker.vy=0;kicker.facingX=dir;kicker.facingY=0;kicker.desiredFacingX=dir;kicker.desiredFacingY=0;
  Object.assign(engine.ball,{x,y,z:0,vz:0,vx:0,vy:0,lastTeam:team,lastPlayerId:kicker.id,passerId:null,intendedReceiverId:null,shotById:null,assistCandidateId:null,lastTouchTick:engine.tick});
  engine.lastPossessionTeam=team;engine.restart={active:true,kind:'free-kick',timer:.48,team,kickerId:kicker.id,x,y};engine.pushEvent('Offside',pending.attackingTeam,'offside');engine.pendingOffside=null;return true;
}

MatchEngine.prototype.registerPhysicalTouch=function offsideAwareTouch(p,type='touch'){
  const pending=this.pendingOffside;
  if(pending&&this.tick>pending.kickTick){
    if(p.id===pending.receiverId&&p.team===pending.attackingTeam){awardOffside(this,pending);return;}
    if(p.team!==pending.attackingTeam)this.pendingOffside=null;
  }
  return originalRegisterTouch.call(this,p,type);
};

MatchEngine.prototype.updateFreeBall=function loftedBallPhysics(dt){
  const result=originalUpdateFreeBall.call(this,dt),frame=dt*60;
  if((this.ball.z||0)>0||(this.ball.vz||0)!==0){
    this.ball.vz=(this.ball.vz||0)-.026*frame;this.ball.z=(this.ball.z||0)+this.ball.vz*frame;
    if(this.ball.z<=0){this.ball.z=0;if(Math.abs(this.ball.vz)>.18)this.ball.vz=-this.ball.vz*.22;else this.ball.vz=0;}
  }
  return result;
};

MatchEngine.prototype.resolveBallPlayerCollisions=function aerialBallContacts(){if((this.ball.z||0)>7.5)return;return originalResolveBallPlayers.call(this);};
MatchEngine.prototype.checkGoal=function heightAwareGoal(){if((this.ball.z||0)>8){if(this.ball.x<FIELD.left){this.ball.x=FIELD.left+this.ball.r;this.ball.vx=Math.abs(this.ball.vx)*.48;}if(this.ball.x>FIELD.right){this.ball.x=FIELD.right-this.ball.r;this.ball.vx=-Math.abs(this.ball.vx)*.48;}return;}return originalCheckGoal.call(this);};
MatchEngine.prototype.drawBall=function liftedBall(ctx){const z=this.ball.z||0;if(z<=.05)return originalDrawBall.call(this,ctx);ctx.save();ctx.beginPath();ctx.ellipse(this.ball.x,this.ball.y,this.ball.r*1.05,this.ball.r*.52,0,0,Math.PI*2);ctx.fillStyle='rgba(0,0,0,.28)';ctx.fill();const oy=this.ball.y;this.ball.y=oy-z*.72;originalDrawBall.call(this,ctx);this.ball.y=oy;ctx.restore();};