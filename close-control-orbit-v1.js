import {MatchEngine} from './engine.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;

export function closeControlOrbitVelocity({ballVx=0,ballVy=0,playerVx=0,playerVy=0,radialX=1,radialY=0,exitX=1,exitY=0,quality=70}={}){
  const radial=unit(radialX,radialY),exit=unit(exitX,exitY),q=clamp(Number(quality)||70,20,99);
  const signed=cross(radial.x,radial.y,exit.x,exit.y),alignment=dot(radial.x,radial.y,exit.x,exit.y),side=signed===0?1:Math.sign(signed),tangent={x:-radial.y*side,y:radial.x*side};
  const needTurn=clamp((1-alignment)*.62+Math.abs(signed)*.72,0,1.45),orbit=clamp(.16+needTurn*(.34+q*.0038),.16,.92),release=clamp(.055+(100-q)*.0028,.055,.28),carry=.56+q*.0031;
  const targetVx=playerVx*carry+tangent.x*orbit+radial.x*release,targetVy=playerVy*carry+tangent.y*orbit+radial.y*release,blend=clamp(.34+(q-45)*.0065,.34,.69);
  return{vx:ballVx*(1-blend)+targetVx*blend,vy:ballVy*(1-blend)+targetVy*blend,orbit,release,side,needTurn};
}

const previousResolve=MatchEngine.prototype.resolveBallPlayerCollisions;
MatchEngine.prototype.resolveBallPlayerCollisions=function closeControlOrbitContacts(){
  const before=this.players?.map(p=>({p,d:Math.hypot((this.ball?.x??0)-p.x,(this.ball?.y??0)-p.y),x:(this.ball?.x??0)-p.x,y:(this.ball?.y??0)-p.y}))||[];
  const result=previousResolve.call(this);if(!this.ball)return result;
  const candidates=before.filter(c=>c.d<=c.p.r+this.ball.r+1.1).sort((a,b)=>a.d-b.d);
  for(const c of candidates){
    const p=c.p,plan=p.receptionPlan,controlled=p.lastReceptionControlTick===this.tick||plan&&this.tick<=plan.untilTick;
    if(!controlled||p.kickIntent)continue;
    const gap=Math.hypot(this.ball.x-p.x,this.ball.y-p.y),relative=Math.hypot(this.ball.vx-p.vx,this.ball.vy-p.vy);if(gap>p.r+this.ball.r+2.2||relative>3.25)continue;
    const exit=plan?unit(plan.x,plan.y):unit(p.facingX,p.facingY),radial=unit(this.ball.x-p.x,this.ball.y-p.y),touch=closeControlOrbitVelocity({ballVx:this.ball.vx,ballVy:this.ball.vy,playerVx:p.vx,playerVy:p.vy,radialX:radial.x,radialY:radial.y,exitX:exit.x,exitY:exit.y,quality:plan?.quality??p.lastControlQuality??p.data?.ballControl??65});
    if(touch.needTurn<.18)continue;
    this.ball.vx=touch.vx;this.ball.vy=touch.vy;p.orbitControlUntilTick=this.tick+12;p.action='acomoda con el cuerpo';p.actionTimer=Math.max(p.actionTimer||0,.28);break;
  }
  return result;
};

export const __closeControlOrbitV1={closeControlOrbitVelocity};