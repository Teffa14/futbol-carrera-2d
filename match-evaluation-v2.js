import {MatchEngine} from './engine.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const FIELD={left:55,right:1045,top:45,bottom:655,centerX:550,centerY:350};
const CATS=['passing','dribbling','shooting','defending','offBall','tactical'];
const WEIGHTS={
  GK:{passing:.10,dribbling:.02,shooting:0,defending:.50,offBall:.08,tactical:.30},
  CB:{passing:.16,dribbling:.04,shooting:.02,defending:.40,offBall:.12,tactical:.26},
  FB:{passing:.17,dribbling:.12,shooting:.03,defending:.28,offBall:.18,tactical:.22},
  MID:{passing:.30,dribbling:.15,shooting:.09,defending:.14,offBall:.14,tactical:.18},
  CAM:{passing:.29,dribbling:.20,shooting:.16,defending:.04,offBall:.17,tactical:.14},
  W:{passing:.20,dribbling:.29,shooting:.16,defending:.04,offBall:.20,tactical:.11},
  ST:{passing:.12,dribbling:.17,shooting:.31,defending:.03,offBall:.25,tactical:.12},
};
function family(role){if(role==='GK')return'GK';if(role==='CB')return'CB';if(['LB','RB','LWB','RWB'].includes(role))return'FB';if(['LW','RW','LM','RM'].includes(role))return'W';if(role==='CAM')return'CAM';if(role==='ST')return'ST';return'MID';}
function attackDir(p){return p.team===0?1:-1;}
function progressX(p,x){return attackDir(p)*(x-FIELD.centerX);}
function state(engine){return engine.matchEvaluationV2??={players:new Map(),eventKeys:new Map(),offBall:new Map()};}
function ledger(engine,p){const s=state(engine);if(!s.players.has(p.id))s.players.set(p.id,{passing:0,dribbling:0,shooting:0,defending:0,offBall:0,tactical:0,general:0,error:0,notes:[],cooldowns:new Map()});return s.players.get(p.id);}
function add(engine,p,cat,value,label='',key='',cooldown=0){if(!p||!Number.isFinite(value)||!value)return false;const l=ledger(engine,p);if(key&&cooldown){const last=l.cooldowns.get(key)??-Infinity;if(engine.tick-last<cooldown)return false;l.cooldowns.set(key,engine.tick);}if(cat==='general'||cat==='error')l[cat]+=value;else if(CATS.includes(cat))l[cat]+=value;if(label)l.notes.unshift({tick:engine.tick,label,value,cat});if(l.notes.length>24)l.notes.length=24;return true;}
function threat(p,x,y){const dir=attackDir(p),goalX=p.team===0?FIELD.right:FIELD.left,goalDist=Math.abs(goalX-x),central=1-clamp(Math.abs(y-FIELD.centerY)/300,0,1),progress=clamp((progressX(p,x)+495)/990,0,1);return clamp(progress*.58+central*.16+(1-goalDist/990)*.26,0,1);}
export function passFootballValue(p,start,aim){const before=threat(p,start.x,start.y),after=threat(p,aim.x,aim.y),forward=attackDir(p)*(aim.x-start.x),lineBreak=forward>75?.06:forward>35?.025:0;return clamp((after-before)*1.25+lineBreak,-.18,.34);}
function ratingFor(engine,p){const l=ledger(engine,p),w=WEIGHTS[family(p.role)]||WEIGHTS.MID;let contribution=0;for(const c of CATS)contribution+=l[c]*(w[c]||0);const rating=clamp(6+contribution+l.general+l.error,3,10);const breakdown={};for(const c of CATS)breakdown[c]=Math.round(clamp(6+l[c],3,10)*100)/100;breakdown.general=Math.round(l.general*100)/100;breakdown.errors=Math.round(l.error*100)/100;return{rating:Math.round(rating*100)/100,breakdown,notes:l.notes.slice(0,8)};}
export function expectedRoleValue(engine,p,kind,context={}){const f=family(p.role);let v=Number(context.base||0);if(kind==='progressive-pass'||kind==='through')v+=(f==='MID'||f==='CAM'?0.18:0.10)+(context.threatGain||0);if(kind==='dribble')v+=(f==='W'||f==='CAM'?0.18:0.08)+(context.spaceGain||0);if(kind==='shot')v+=(f==='ST'?0.20:f==='W'||f==='CAM'?0.12:0.04)+(context.shotQuality||0);if(kind==='interception'||kind==='tackle')v+=(f==='CB'||f==='FB'?0.20:f==='MID'?0.11:0.03);if(kind==='run')v+=(f==='ST'||f==='W'?0.16:0.08)+(context.spaceGain||0);return v-(context.turnoverRisk||0);}

const originalPushEvent=MatchEngine.prototype.pushEvent;
MatchEngine.prototype.pushEvent=function groupedMeaningfulEvent(text,team=null,type='info'){
  const raw=String(text||''),lower=raw.toLowerCase();
  const major=/(gol|final|offside|palo|sustit|expuls|penal|ataja|desvía)/i.test(raw);
  const semantic=/regate/.test(lower)?'dribble':/duelo|cuerpo|forcejeo/.test(lower)?'duel':/pase/.test(lower)?'pass':/remata|tiro/.test(lower)?'shot':raw.replace(/\d+/g,'#').slice(0,46);
  const key=`${team}:${type}:${semantic}`,s=state(this),last=s.eventKeys.get(key);
  if(!major&&last&&this.tick-last.tick<32){last.count++;return false;}
  s.eventKeys.set(key,{tick:this.tick,count:1});return originalPushEvent.call(this,raw,team,type);
};

const originalExecuteKick=MatchEngine.prototype.executeKick;
MatchEngine.prototype.executeKick=function evaluatedKick(p,contactNormal){
  const k=p?.kickIntent?{...p.kickIntent}:null,start={x:this.ball.x,y:this.ball.y};const result=originalExecuteKick.call(this,p,contactNormal);
  if(!result||!k||!p)return result;
  if(k.type==='pass'||k.type==='restart')this.ball.evaluationPass={passerId:p.id,receiverId:k.receiverId||null,start,aim:{x:k.aimX,y:k.aimY},value:passFootballValue(p,start,{x:k.aimX,y:k.aimY}),kind:k.passKind||'pass',tick:this.tick};
  if(k.type==='shot'){const q=threat(p,start.x,start.y);add(this,p,'shooting',.035+q*.055,'Remate desde zona útil','shot-choice',6);}
  return result;
};

const originalTouch=MatchEngine.prototype.registerPhysicalTouch;
MatchEngine.prototype.registerPhysicalTouch=function evaluatedTouch(p,type='touch'){
  const ep=this.ball.evaluationPass?{...this.ball.evaluationPass}:null,previousTeam=this.ball.lastTeam;const result=originalTouch.call(this,p,type);
  if(ep){const passer=this.playerById(ep.passerId);if(ep.receiverId===p.id&&passer&&passer.team===p.team){const value=.035+Math.max(0,ep.value);add(this,passer,'passing',value,ep.value>.09?'Pase que genera ventaja':'Pase completado',`pass-${ep.tick}`,1);if(ep.value>.11&&passer.id===this.userId)this.pushEvent('Pase progresivo: generó ventaja',passer.team,'user');this.ball.evaluationPass=null;}else if(previousTeam!==null&&p.team!==previousTeam&&passer){const risk=Math.max(0,.055-ep.value*.12);add(this,passer,'error',-risk,'Pérdida en pase',`turnover-${ep.tick}`,1);this.ball.evaluationPass=null;}}
  return result;
};

const originalSkill=MatchEngine.prototype.attemptSkillMove;
MatchEngine.prototype.attemptSkillMove=function evaluatedSkillMove(p,defender){
  if(!p||!defender)return originalSkill.call(this,p,defender);const l=ledger(this,p),key=`dribble-${defender.id}`,last=l.cooldowns.get(key)??-Infinity;
  if(this.tick-last<34)return !!p._lastDribbleEpisodeSuccess;l.cooldowns.set(key,this.tick);
  const beforeA=p.perf.dribblesAttempted,beforeC=p.perf.dribblesCompleted,result=originalSkill.call(this,p,defender),success=p.perf.dribblesCompleted>beforeC;
  if(p.perf.dribblesAttempted>beforeA)add(this,p,'dribbling',success?.13:-.045,success?'Defensor superado':'Regate neutralizado','',0);p._lastDribbleEpisodeSuccess=success;return result;
};

const originalDuel=MatchEngine.prototype.registerDuelEvent;
MatchEngine.prototype.registerDuelEvent=function evaluatedDuel(duel){const result=originalDuel.call(this,duel),winner=this.playerById(duel?.winnerId),loser=this.playerById(duel?.loserId);if(winner)add(this,winner,'defending',.045+(duel?.intensity||0)*.025,'Duelo ganado',`duel-${duel?.loserId}`,18);if(loser)add(this,loser,'error',-.012,'Duelo perdido',`duel-loss-${duel?.winnerId}`,18);return result;};

const originalGoal=MatchEngine.prototype.checkGoal;
MatchEngine.prototype.checkGoal=function evaluatedGoal(){const before=new Map(this.players.map(p=>[p.id,{g:p.perf.goals,a:p.perf.assists}]));const score=[...this.score],result=originalGoal.call(this);if(this.score[0]!==score[0]||this.score[1]!==score[1])for(const p of this.players){const b=before.get(p.id);if(p.perf.goals>b.g)add(this,p,'general',1.05,'Gol');if(p.perf.assists>b.a)add(this,p,'general',.52,'Asistencia');}return result;};

function evaluateOffBall(engine){const possession=engine.inferPossessionTeam?.();for(const p of engine.players){const s=state(engine),prev=s.offBall.get(p.id)||{x:p.x,y:p.y,tick:engine.tick};if(engine.tick-prev.tick<24)continue;s.offBall.set(p.id,{x:p.x,y:p.y,tick:engine.tick});if(possession!==p.team||engine.ball.lastPlayerId===p.id)continue;const dir=attackDir(p),forward=(p.x-prev.x)*dir,role=family(p.role);if(forward>18&&(role==='ST'||role==='W'||role==='CAM'))add(engine,p,'offBall',.035,'Ruptura que ataca profundidad','depth-run',70);const wide=Math.abs(p.y-FIELD.centerY)>205;if(wide&&(role==='W'||role==='FB')&&dist(p,engine.ball)>90)add(engine,p,'tactical',.018,'Fija amplitud','width',100);}}
const originalStep=MatchEngine.prototype.step;
MatchEngine.prototype.step=function evaluatedStep(dt){const out=originalStep.call(this,dt);if(this.tick%12===0)evaluateOffBall(this);return out;};

const originalUserPerformance=MatchEngine.prototype.userPerformance;
MatchEngine.prototype.userPerformance=function evaluatedUserPerformance(){const base=originalUserPerformance.call(this);if(!base)return base;const p=this.playerById(this.userId),r=ratingFor(this,p);return{...base,rating:r.rating,ratingBreakdown:r.breakdown,ratingNotes:r.notes};};

export const __evaluationV2={family,threat,ledger,ratingFor,add,evaluateOffBall};
