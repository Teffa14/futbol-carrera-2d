import {MatchEngine} from './engine.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const FIELD={left:55,right:1045,top:45,bottom:655,centerX:550,centerY:350};
const FWD=new Set(['ST','LW','RW','CAM']);
const MID=new Set(['CDM','CM','CAM','LM','RM']);
const DEF=new Set(['LB','RB','CB']);
function dir(team){return team===0?1:-1;}
function roleBand(p){return FWD.has(p.role)?'FWD':MID.has(p.role)?'MID':DEF.has(p.role)?'DEF':'MID';}
function poss(engine){return engine.inferPossessionTeam?.();}
function blend(a,b,t){return a+(b-a)*t;}

function prioritizeCalls(engine){
  const possession=poss(engine);if(possession!==0&&possession!==1)return;
  const candidates=engine.players.filter(p=>p.team===possession&&p.callForPass&&p.callForPass.untilTick>=engine.tick).sort((a,b)=>(b.callForPass.score||0)-(a.callForPass.score||0));
  const primary=candidates[0]||null;
  for(const p of candidates){
    if(p.id===primary?.id){
      p.callForPass.primary=true;p.action=p.callForPass.label||'¡DÁMELA!';p.actionTimer=Math.max(p.actionTimer||0,.55);
      if(p.callForPass.kind==='ahead'){
        p.burstTimer=Math.max(p.burstTimer||0,.62);
        p.offBallCommit={targetX:p.callForPass.targetX,targetY:p.callForPass.targetY,untilTick:engine.tick+58,team:p.team};
      }
    }else{
      p.callForPass.primary=false;
      if(/^¡/.test(p.action||''))p.action='';
    }
  }
}

function dampPatternRepetition(engine){
  engine._patternHistory??=[null,null];
  engine._patternSeen??=[null,null];
  for(let team=0;team<2;team++){
    const seq=engine.teamSequences?.[team];if(!seq)continue;
    const key=`${seq.type}:${seq.started}`;
    if(engine._patternSeen[team]===key)continue;engine._patternSeen[team]=key;
    const last=engine._patternHistory[team];
    if(last&&last.type===seq.type&&engine.minute-last.minute<9){
      engine.teamSequences[team]=null;
      if(engine._sequenceCooldown)engine._sequenceCooldown[team]=Math.max(engine._sequenceCooldown[team]||0,engine.tick+360);
      const e=engine.events?.[0];if(e?.type==='pattern'&&/Patrón preparado/i.test(e.text||''))engine.events.shift();
      continue;
    }
    engine._patternHistory[team]={type:seq.type,minute:engine.minute};
  }
}

const previousAi=MatchEngine.prototype.aiTarget;
MatchEngine.prototype.aiTarget=function coherentTeamTarget(p,pressers,actor,possession){
  let base=previousAi.call(this,p,pressers,actor,possession);if(!p||p.role==='GK'||this.restart?.active)return base;
  const d=dir(p.team),ours=possession===p.team,enemy=possession!==null&&possession!==p.team;
  if(p.offBallCommit){
    if(p.offBallCommit.untilTick<this.tick||possession!==p.team)p.offBallCommit=null;
    else if(!p.kickIntent&&!p.dribbleIntent){base={x:blend(base.x,clamp(p.offBallCommit.targetX,FIELD.left+p.r,FIELD.right-p.r),.82),y:blend(base.y,clamp(p.offBallCommit.targetY,FIELD.top+p.r,FIELD.bottom-p.r),.72)};}
  }
  const primary=p.callForPass?.primary||p.offBallCommit;
  if(!primary&&ours){
    const band=roleBand(p),anchor=band==='FWD'?this.ball.x+d*135:band==='MID'?this.ball.x+d*30:this.ball.x-d*125;
    base.x=blend(base.x,clamp(anchor,FIELD.left+p.r,FIELD.right-p.r),band==='DEF'?.18:.14);
  }else if(enemy){
    const band=roleBand(p),anchor=band==='FWD'?this.ball.x-d*35:band==='MID'?this.ball.x-d*105:this.ball.x-d*190;
    base.x=blend(base.x,clamp(anchor,FIELD.left+p.r,FIELD.right-p.r),.16);
  }
  return base;
};

const previousStep=MatchEngine.prototype.step;
MatchEngine.prototype.step=function teamCoherenceStep(dt){const out=previousStep.call(this,dt);if(!this.finished){dampPatternRepetition(this);prioritizeCalls(this);}return out;};

const previousDrawPlayer=MatchEngine.prototype.drawPlayer;
MatchEngine.prototype.drawPlayer=function quieterCalls(ctx,p){
  const hidden=p?.callForPass&&!p.callForPass.primary&&/^¡/.test(p.action||'');
  const old=hidden?p.action:null;if(hidden)p.action='';const out=previousDrawPlayer.call(this,ctx,p);if(hidden)p.action=old;return out;
};

export const __teamCoherenceV2={prioritizeCalls,dampPatternRepetition};
