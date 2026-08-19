import {SKILLS} from './data.js';
import {MatchEngine} from './engine.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const unit=(x,y)=>{const l=Math.hypot(x,y)||1;return{x:x/l,y:y/l};};
function gaussianish(r){return r()+r()+r()+r()-2;}
function skillEffect(p,key){let total=0;for(const id of p.data.skills||[]){const s=SKILLS.find(x=>x.id===id);total+=s?.effects?.[key]||0;}return total;}

MatchEngine.prototype.executeKick=function executeFacingKick(p){
  const k=p.kickIntent;if(!k)return false;
  const facing=unit(Number(p.facingX)||0,Number(p.facingY)||0),passing=(p.data.passing??60)+skillEffect(p,'pass'),shooting=(p.data.shooting??60)+skillEffect(p,'shotPower')*.25,tech=k.type==='shot'?shooting:passing,composure=p.data.composure??65,opp=this.nearestOpponent(p),pressure=opp?clamp((42-Math.hypot(opp.x-p.x,opp.y-p.y))/42,0,1):0;
  const angleError=gaussianish(this.rng)*(100-(tech*.8+composure*.2))*.00125*(1+pressure*.65),cs=Math.cos(angleError),sn=Math.sin(angleError),dx=facing.x*cs-facing.y*sn,dy=facing.x*sn+facing.y*cs,powerError=1+gaussianish(this.rng)*(100-tech)*.0015,power=Math.max(.8,k.power*powerError);
  this.ball.vx=dx*power+p.vx*.12;this.ball.vy=dy*power+p.vy*.12;
  if(k.type==='pass'||k.type==='restart'){
    this.ball.passerId=p.id;this.ball.intendedReceiverId=k.receiverId||null;this.ball.assistCandidateId=p.id;this.ball.shotById=null;p.perf.passesAttempted++;this.stats.passes[p.team]++;this.flash(p,'pase');if(p.id===this.userId)this.pushEvent('Tu jugador patea un pase',p.team,'user');
  }else if(k.type==='shot'){
    this.ball.shotById=p.id;this.ball.intendedReceiverId=null;p.perf.shots++;this.stats.shots[p.team]++;this.adjustRating(p,.05);this.flash(p,'remate');this.pushEvent(`${p.data.name} remata`,p.team,p.id===this.userId?'user':'shot');
    const goalX=p.team===0?1045:55,travel=(goalX-this.ball.x)/(this.ball.vx||.0001),crossY=this.ball.y+this.ball.vy*travel;if(travel>0&&crossY>295&&crossY<405){p.perf.shotsOnTarget++;this.stats.shotsOnTarget[p.team]++;}
  }
  this.registerPhysicalTouch(p,'kick');p.kickIntent=null;p.dribbleIntent=null;p.kickCooldown=.16;p.touchCooldown=.085;return true;
};
