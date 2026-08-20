import {MatchEngine} from './engine.js';
const FIELD={left:55,right:1045,top:45,bottom:655,centerX:550,centerY:350,goalTop:295,goalBottom:405};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function mem(p,key){return clamp(Number(p?.data?.trainingMemory?.[key]?.familiarity)||0,0,100);}
function attackProgress(p){return p.team===0?(p.x-FIELD.left)/(FIELD.right-FIELD.left):(FIELD.right-p.x)/(FIELD.right-FIELD.left);}
function forwardDelta(a,b){return(b.x-a.x)*(a.team===0?1:-1);}
function central(p){return p.y>FIELD.goalTop-90&&p.y<FIELD.goalBottom+90;}
function wide(p){return p.y<FIELD.top+155||p.y>FIELD.bottom-155;}
function contactReady(engine,p){return dist(p,engine.ball)<=(p.r||7.25)+(engine.ball.r||4.35)+7;}
function active(engine,team){const s=engine.teamSequences?.[team];if(!s)return null;if(engine.tick>s.expires||engine.restart?.active){engine.teamSequences[team]=null;return null;}return s;}
function teammates(engine,p){return engine.players.filter(x=>x.team===p.team&&x.id!==p.id&&x.role!=='GK');}
function opponents(engine,p){return engine.players.filter(x=>x.team!==p.team);}
function nearestSpace(engine,p){return Math.min(...opponents(engine,p).map(o=>dist(p,o)),180);}
function passPower(a,b){return clamp(3.15+dist(a,b)/105,3.2,6.4);}
function armPatternPass(engine,p,target,kind,aim=target){engine.armKick(p,{x:aim.x,y:aim.y},passPower(p,aim),'pass',{receiverId:target.id,passKind:kind,plannedDistance:dist(p,aim),loft:kind==='lob-through'});p.decisionCooldown=.34;return true;}

function tryUpBackThrough(engine,p){
  if(attackProgress(p)<.27||attackProgress(p)>.72)return null;const mates=teammates(engine,p),dir=p.team===0?1:-1;
  const set=mates.filter(m=>['CM','CAM','ST','CDM'].includes(m.role)&&Math.abs(m.y-p.y)<125&&dist(p,m)>35&&dist(p,m)<165).sort((a,b)=>Math.abs(forwardDelta(p,a))-Math.abs(forwardDelta(p,b)))[0];
  const runner=mates.filter(m=>['ST','LW','RW','CAM'].includes(m.role)&&m.id!==set?.id&&forwardDelta(p,m)>65&&nearestSpace(engine,m)>24).sort((a,b)=>forwardDelta(p,b)-forwardDelta(p,a))[0];if(!set||!runner)return null;
  const learned=Math.max(mem(p,'third-man'),mem(p,'wall-pass'),mem(p,'through-ball')),chance=.18+learned/155;if(engine.rng()>chance)return null;
  return{type:'up-back-through',stage:'source',sourceId:p.id,setId:set.id,runnerId:runner.id,team:p.team,expires:engine.tick+170,started:engine.tick,dir};
}
function tryOverlap(engine,p){
  if(!wide(p)||attackProgress(p)<.46)return null;const mates=teammates(engine,p),side=Math.sign(p.y-FIELD.centerY)||1;
  const runner=mates.filter(m=>['LB','RB','LW','RW','CM'].includes(m.role)&&Math.sign(m.y-FIELD.centerY)===side&&forwardDelta(p,m)>-70&&forwardDelta(p,m)<125).sort((a,b)=>dist(p,a)-dist(p,b))[0];
  const finisher=mates.filter(m=>['ST','CAM','LW','RW'].includes(m.role)&&m.id!==runner?.id&&central(m)).sort((a,b)=>forwardDelta(p,b)-forwardDelta(p,a))[0];if(!runner||!finisher)return null;
  const learned=Math.max(mem(p,'overlap'),mem(p,'cross'),mem(p,'cutback')),chance=.16+learned/150;if(engine.rng()>chance)return null;
  return{type:'overlap-cross',stage:'release',sourceId:p.id,runnerId:runner.id,finisherId:finisher.id,team:p.team,expires:engine.tick+190,started:engine.tick,side};
}
function maybeStart(engine,p){engine.teamSequences??=[null,null];if(active(engine,p.team)||engine._sequenceCooldown?.[p.team]>engine.tick||!contactReady(engine,p))return null;let seq=tryOverlap(engine,p)||tryUpBackThrough(engine,p);if(seq){engine.teamSequences[p.team]=seq;engine._sequenceCooldown??=[0,0];engine._sequenceCooldown[p.team]=engine.tick+150;engine.pushEvent(seq.type==='overlap-cross'?'Patrón preparado: desborde y centro':'Patrón preparado: pared y pase profundo',p.team,'pattern');}return seq;}
function abort(engine,seq,reason='Se corta el patrón'){engine.teamSequences[seq.team]=null;engine.pushEvent(reason,seq.team,'pattern');}

const previousPrepare=MatchEngine.prototype.prepareBallAction;
MatchEngine.prototype.prepareBallAction=function chainedPatternDecision(p){
  if(!p)return previousPrepare.call(this,p);let seq=active(this,p.team)||maybeStart(this,p);if(!seq)return previousPrepare.call(this,p);
  if(!contactReady(this,p))return previousPrepare.call(this,p);
  if(seq.type==='up-back-through'){
    const set=this.playerById(seq.setId),runner=this.playerById(seq.runnerId);if(!set||!runner){abort(this,seq);return previousPrepare.call(this,p);}
    if(seq.stage==='source'&&p.id===seq.sourceId){seq.stage='wait-set';return armPatternPass(this,p,set,'support');}
    if(seq.stage==='set'&&p.id===seq.setId){const lead=clamp(55+(runner.data.pace??70)*.45,70,105),aim={x:clamp(runner.x+seq.dir*lead,FIELD.left+18,FIELD.right-18),y:clamp(runner.y+(runner.vy||0)*5,FIELD.top+18,FIELD.bottom-18)};seq.stage='wait-runner';seq.runAim=aim;this.pushEvent('Devolución y pase en profundidad',p.team,'pattern');return armPatternPass(this,p,runner,'through',aim);}
  }
  if(seq.type==='overlap-cross'){
    const runner=this.playerById(seq.runnerId),finisher=this.playerById(seq.finisherId);if(!runner||!finisher){abort(this,seq);return previousPrepare.call(this,p);}
    if(seq.stage==='release'&&p.id===seq.sourceId){seq.stage='wait-runner';const aim={x:runner.x+(p.team===0?1:-1)*45,y:clamp(runner.y+seq.side*25,FIELD.top+12,FIELD.bottom-12)};this.pushEvent('Se libera el desborde',p.team,'pattern');return armPatternPass(this,p,runner,'progressive',aim);}
    if(seq.stage==='cross'&&p.id===seq.runnerId){const byline=p.team===0?p.x>FIELD.right-205:p.x<FIELD.left+205,cut=byline&&Math.abs(finisher.x-p.x)>95,kind=cut?'cutback':'cross',aim={x:cut?(p.team===0?FIELD.right-180:FIELD.left+180):finisher.x,y:clamp(finisher.y,FIELD.goalTop-70,FIELD.goalBottom+70)};seq.stage='wait-finish';this.pushEvent(cut?'Pase atrás preparado':'Centro preparado',p.team,'pattern');return armPatternPass(this,p,finisher,kind,aim);}
  }
  return previousPrepare.call(this,p);
};

const previousTouch=MatchEngine.prototype.registerPhysicalTouch;
MatchEngine.prototype.registerPhysicalTouch=function sequenceAwareTouch(p,type='touch'){
  const result=previousTouch.call(this,p,type);if(this.restart?.active)return result;const seq=active(this,p.team);if(!seq)return result;
  if(seq.type==='up-back-through'){
    if(seq.stage==='wait-set'&&p.id===seq.setId){seq.stage='set';p.decisionCooldown=0;}
    else if(seq.stage==='wait-runner'&&p.id===seq.runnerId){this.teamSequences[p.team]=null;this.pushEvent('La ruptura recibe detrás de la línea',p.team,'pattern');}
  }else if(seq.type==='overlap-cross'){
    if(seq.stage==='wait-runner'&&p.id===seq.runnerId){seq.stage='cross';p.decisionCooldown=0;}
    else if(seq.stage==='wait-finish'&&p.id===seq.finisherId){this.teamSequences[p.team]=null;this.pushEvent('El área recibe la jugada preparada',p.team,'pattern');}
  }
  return result;
};

const previousTarget=MatchEngine.prototype.aiTarget;
MatchEngine.prototype.aiTarget=function patternRunTarget(p,pressers,actor,possession){
  const base=previousTarget.call(this,p,pressers,actor,possession),seq=active(this,p?.team);if(!seq||!p||this.restart?.active)return base;const dir=p.team===0?1:-1;
  if(seq.type==='up-back-through'&&p.id===seq.runnerId){const aim=seq.runAim||{x:clamp(p.x+dir*105,FIELD.left+p.r,FIELD.right-p.r),y:p.y};return{x:aim.x,y:aim.y};}
  if(seq.type==='overlap-cross'&&p.id===seq.runnerId){const targetX=p.team===0?FIELD.right-28:FIELD.left+28,targetY=clamp(FIELD.centerY+seq.side*245,FIELD.top+p.r,FIELD.bottom-p.r);return{x:targetX,y:targetY};}
  if(seq.type==='overlap-cross'&&p.id===seq.finisherId&&['wait-runner','cross','wait-finish'].includes(seq.stage)){return{x:p.team===0?FIELD.right-125:FIELD.left+125,y:FIELD.centerY-seq.side*55};}
  return base;
};
