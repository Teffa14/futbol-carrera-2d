import {TrainingMatchEngine} from './training-match-engine-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const AREA={left:180,right:900,top:120,bottom:580};
function attackDir(team){return team===0?1:-1;}
function constrain(p,t){return{x:clamp(t?.x??p.x,AREA.left+p.r,AREA.right-p.r),y:clamp(t?.y??p.y,AREA.top+p.r,AREA.bottom-p.r)};}
function closest(point,list){return [...list].sort((a,b)=>dist(a,point)-dist(b,point))[0]||null;}
function supportPoint(e,p,actor,index){const dir=attackDir(p.team),side=index%2?1:-1,baseX=e.ball.x+dir*(p.role==='ST'||p.role==='RW'||p.role==='LW'?125:82),baseY=e.ball.y+side*(105+index*18);return constrain(p,{x:baseX,y:baseY});}
function coverPoint(e,p,actor,attackers,index){const threat=closest({x:e.ball.x+attackDir(actor?.team??0)*120,y:e.ball.y},attackers)||attackers[index%Math.max(1,attackers.length)];if(!threat)return constrain(p,{x:e.ball.x+attackDir(p.team)*55,y:e.ball.y});const goalX=p.team===0?AREA.left:AREA.right;return constrain(p,{x:(threat.x+goalX)*.5,y:(threat.y+e.ball.y)*.5});}
function meta(e){return e.smallSidedV8??={rep:-1,passStart:[0,0],lastTouch:null,receivers:new Set(),matchAiTargets:0,matchActions:0,pressFrames:0,coverFrames:0};}
function resetMeta(e){const s=meta(e);s.rep=e.rep;s.passStart=[e.stats.passesCompleted[0],e.stats.passesCompleted[1]];s.lastTouch=e.ball.lastPlayerId;s.receivers=new Set();s.matchAiTargets=0;s.matchActions=0;s.pressFrames=0;s.coverFrames=0;return s;}

const baseReset=TrainingMatchEngine.prototype.resetRep;
TrainingMatchEngine.prototype.resetRep=function smallSidedReset(rep,initial=false){const out=baseReset.call(this,rep,initial);if(this.drill?.kind==='2v2'||this.drill?.kind==='3v3')resetMeta(this);return out;};

function smallSided(e,dt){
  const s=meta(e);if(s.rep!==e.rep)resetMeta(e);const q=e.trainingQualityV6,m=e.trainingMetricsV6,poss=e.inferPossessionTeam(),actors=[e.ballActor(0),e.ballActor(1)],pressers=[e.selectPressers(0),e.selectPressers(1)];
  e.observeTouches();
  if(e.ball.lastPlayerId&&e.ball.lastPlayerId!==s.lastTouch){const p=e.playerById(e.ball.lastPlayerId);if(p?.team===0)s.receivers.add(p.id);s.lastTouch=e.ball.lastPlayerId;}
  for(const p of e.players){
    const actor=actors[p.team],teamMates=e.players.filter(x=>x.team===p.team&&x.id!==p.id),opponents=e.players.filter(x=>x.team!==p.team);let target;
    if(actor?.id===p.id){
      if(dist(p,e.ball)<p.r+e.ball.r+8&&!p.kickIntent&&!p.dribbleIntent&&p.decisionCooldown<=0){if(e.prepareBallAction(p))s.matchActions++;}
      target=e.aiTarget(p,pressers[p.team],actor,poss);s.matchAiTargets++;
    }else if(p.receiveIntent&&p.receiveIntent.untilTick>=e.tick){
      target={x:p.receiveIntent.aimX,y:p.receiveIntent.aimY};s.matchAiTargets++;
    }else if(poss===p.team){
      const idx=teamMates.filter(x=>x.id!==actor?.id).findIndex(x=>x.id===p.id),matchTarget=e.aiTarget(p,pressers[p.team],actor,poss),support=supportPoint(e,p,actor,Math.max(0,idx));target={x:matchTarget.x*.42+support.x*.58,y:matchTarget.y*.42+support.y*.58};s.matchAiTargets++;
    }else{
      const primary=pressers[p.team]?.some?.(x=>x.id===p.id)||closest(e.ball,e.players.filter(x=>x.team===p.team))?.id===p.id;
      if(primary){target={x:e.ball.x,y:e.ball.y};s.pressFrames++;}
      else{const matchTarget=e.aiTarget(p,pressers[p.team],actor,poss),cover=coverPoint(e,p,actors[1-p.team],opponents,teamMates.indexOf(p));target={x:matchTarget.x*.35+cover.x*.65,y:matchTarget.y*.35+cover.y*.65};s.coverFrames++;s.matchAiTargets++;}
    }
    e.move(p,constrain(p,target),dt);
  }
  const completed=e.stats.passesCompleted[0]-s.passStart[0],progress=attackDir(0)*(e.ball.x-(e.repOrigin?.bx??e.ball.x));m.passesCompleted=Math.max(m.passesCompleted,completed);for(const id of s.receivers)m.receivers.add(id);
  q.phase=poss===0?'Jugar y crear ventaja':poss===1?'Reaccionar tras pérdida':'Atacar la pelota libre';q.objective=e.drill?.kind==='2v2'?'Jugá el 2v2: fijá, pasá al movimiento y atacá el espacio que se abre':'Jugá el 3v3: circulá, ofrecé líneas, progresá y reaccioná tras pérdida';
  if((e.drill?.kind==='2v2'&&completed>=1&&progress>75)||(e.drill?.kind==='3v3'&&completed>=2&&s.receivers.size>=2&&progress>55)){q.repSuccess=true;}
}

const previousScenario=TrainingMatchEngine.prototype.scenario;
TrainingMatchEngine.prototype.scenario=function matchLikeSmallSidedScenario(dt){const k=this.drill?.kind;if(k==='2v2'||k==='3v3')return smallSided(this,dt);return previousScenario.call(this,dt);};

export const __trainingSmallSidedV8={smallSided,meta,resetMeta,supportPoint,coverPoint,constrain};
