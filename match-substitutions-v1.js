import {MatchEngine} from './engine.js';

const perfTemplate=()=>({rating:6,touches:0,passesAttempted:0,passesCompleted:0,dribblesAttempted:0,dribblesCompleted:0,shots:0,shotsOnTarget:0,goals:0,assists:0,tackles:0,interceptions:0,turnovers:0,bodyDuels:0,bodyDuelsWon:0,shieldingDuels:0,shieldingWins:0,distance:0});
const playerId=p=>p?.instanceId||p?.id||null;

function ensureRuntime(engine){
  if(!engine.substitutionLog)engine.substitutionLog=[];
  if(!engine.subbedOutPerformances)engine.subbedOutPerformances=new Map();
}

function incomingRuntime(outgoing,data,minute){
  return {
    ...outgoing,
    id:playerId(data),
    data,
    x:outgoing.x,
    y:outgoing.y,
    vx:0,
    vy:0,
    facingX:outgoing.facingX,
    facingY:outgoing.facingY,
    desiredFacingX:outgoing.facingX,
    desiredFacingY:outgoing.facingY,
    kickIntent:null,
    dribbleIntent:null,
    kickCooldown:0,
    touchCooldown:0,
    decisionCooldown:.25,
    duelCooldown:0,
    burstTimer:0,
    burstX:0,
    burstY:0,
    action:'',
    actionTimer:0,
    fatigue:0,
    enteredMinute:minute,
    perf:perfTemplate(),
  };
}

MatchEngine.prototype.substitutePlayer=function substitutePlayer(outId,incomingData,{minute=this.minute,reason='coach'}={}){
  ensureRuntime(this);
  if(this.finished)return{ok:false,reason:'match_finished'};
  const incomingId=playerId(incomingData);
  if(!incomingId)return{ok:false,reason:'incoming_missing_id'};
  if(incomingId===outId||this.players.some(p=>p.id===incomingId))return{ok:false,reason:'incoming_already_active'};
  if(this.subbedOutPerformances.has(incomingId))return{ok:false,reason:'incoming_already_used'};
  const index=this.players.findIndex(p=>p.id===outId);
  if(index<0)return{ok:false,reason:'outgoing_not_active'};
  const outgoing=this.players[index];
  if(outgoing.role==='GK'&&(incomingData.engineRole||incomingData.position)!=='GK')return{ok:false,reason:'keeper_role_mismatch'};
  if(outgoing.role!=='GK'&&(incomingData.engineRole||incomingData.position)==='GK')return{ok:false,reason:'keeper_role_mismatch'};

  const record={
    minute:Math.max(0,Math.min(90,Math.round(minute))),
    team:outgoing.team,
    role:outgoing.role,
    outId:outgoing.id,
    outName:outgoing.data.name,
    inId:incomingId,
    inName:incomingData.name,
    reason,
  };
  this.subbedOutPerformances.set(outgoing.id,{...outgoing.perf,rating:Math.round(outgoing.perf.rating*100)/100,staminaUsed:Math.round(outgoing.fatigue),enteredMinute:outgoing.enteredMinute??0,exitedMinute:record.minute});
  this.players[index]=incomingRuntime(outgoing,incomingData,record.minute);
  this.substitutionLog.push(record);
  this.pushEvent(`Cambio: ${record.inName} por ${record.outName}`,record.team,'substitution');
  return{ok:true,change:record,player:this.players[index]};
};

MatchEngine.prototype.applyCoachSubstitution=function applyCoachSubstitution(change,bench=[]){
  if(!change)return{ok:false,reason:'missing_change'};
  const incoming=bench.find(p=>playerId(p)===change.inId);
  if(!incoming)return{ok:false,reason:'incoming_not_on_bench'};
  return this.substitutePlayer(change.outId,incoming,{minute:change.minute??this.minute,reason:change.reason||'coach'});
};

const originalUserPerformance=MatchEngine.prototype.userPerformance;
MatchEngine.prototype.userPerformance=function userPerformanceWithSubstitutions(){
  const active=originalUserPerformance.call(this);
  if(active)return active;
  ensureRuntime(this);
  const archived=this.subbedOutPerformances.get(this.userId);
  return archived?{...archived}:null;
};

const originalReport=MatchEngine.prototype.report;
MatchEngine.prototype.report=function reportWithSubstitutions(){
  ensureRuntime(this);
  const report=originalReport.call(this);
  return {...report,substitutions:this.substitutionLog.map(change=>({...change}))};
};
