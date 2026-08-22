const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const num=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

function hashSeed(seed){let h=2166136261;for(const ch of String(seed)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function seeded(seed){let h=hashSeed(seed);return()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function playerKey(player){return player?.instanceId||player?.id||player?.name||'player';}

export const INJURY_SEVERITIES={
  knock:{minDays:2,maxDays:6,burden:5},
  minor:{minDays:7,maxDays:21,burden:14},
  moderate:{minDays:22,maxDays:56,burden:28},
  major:{minDays:57,maxDays:180,burden:52},
};

export function assessInjuryRisk(player,{
  workload=50,
  liveFatigue=0,
  contactIntensity=0,
  sprintLoad=0,
  recoveryDays=6,
  recentInjuries=0,
}={}){
  const fitness=clamp(num(player?.fitness,100),0,100);
  const stamina=clamp(num(player?.stamina,65),30,99);
  const physical=clamp(num(player?.physical,65),30,99);
  const age=clamp(num(player?.age,24),15,50);
  const load=clamp(num(workload,50),0,100);
  const fatigue=clamp(num(liveFatigue,0),0,100);
  const contact=clamp(num(contactIntensity,0),0,100);
  const sprint=clamp(num(sprintLoad,0),0,100);
  const recovery=clamp(num(recoveryDays,6),0,14);
  const history=clamp(num(recentInjuries,0),0,8);

  const components={
    workload:Math.max(0,load-55)*.18,
    fatigue:fatigue*.20,
    lowFitness:Math.max(0,78-fitness)*.28,
    sprint:sprint*.10,
    contact:contact*.11,
    recovery:Math.max(0,5-recovery)*2.3,
    history:history*3.5,
    age:Math.max(0,age-30)*.65,
    resilience:-Math.max(0,stamina-60)*.08-Math.max(0,physical-60)*.05,
  };
  const score=clamp(4+Object.values(components).reduce((sum,value)=>sum+value,0),0,92);
  return{
    score:Math.round(score*10)/10,
    probability:Math.round((score/100)*10000)/10000,
    components,
    state:score>=55?'critical':score>=30?'high':score>=15?'elevated':'normal',
  };
}

function chooseSeverity(riskScore,r){
  const score=clamp(num(riskScore),0,100),roll=r();
  if(score>=55&&roll>.82)return'major';
  if(score>=30&&roll>.70)return'moderate';
  if(score>=15&&roll>.58)return'minor';
  return'knock';
}

function chooseKind({contactIntensity=0,sprintLoad=0},r){
  const contact=clamp(num(contactIntensity),0,100),sprint=clamp(num(sprintLoad),0,100),roll=r();
  if(contact>=65&&roll<.62)return'impact';
  if(sprint>=65&&roll<.70)return'muscle';
  if(roll<.34)return'joint';
  if(roll<.67)return'muscle';
  return'impact';
}

export function createInjuryFromExposure(player,{
  exposureId,
  date=null,
  workload=50,
  liveFatigue=0,
  contactIntensity=0,
  sprintLoad=0,
  recoveryDays=6,
  recentInjuries=0,
}={}){
  if(!exposureId)throw new Error('exposureId is required');
  const risk=assessInjuryRisk(player,{workload,liveFatigue,contactIntensity,sprintLoad,recoveryDays,recentInjuries});
  const r=seeded(`${playerKey(player)}|injury|${exposureId}`);
  const occurs=r()<risk.probability;
  if(!occurs)return{occurred:false,risk,injury:null};
  const severity=chooseSeverity(risk.score,r),config=INJURY_SEVERITIES[severity];
  const kind=chooseKind({contactIntensity,sprintLoad},r);
  const days=Math.round(config.minDays+r()*(config.maxDays-config.minDays));
  return{
    occurred:true,
    risk,
    injury:{
      id:`inj-${hashSeed(`${playerKey(player)}|${exposureId}`).toString(36)}`,
      kind,
      severity,
      startedAt:date,
      expectedDays:days,
      remainingDays:days,
      status:'active',
      exposureId:String(exposureId),
    },
  };
}

export function advanceInjuryRecovery(injury,days){
  if(!injury)return null;
  if(injury.status==='recovered')return{...injury};
  const elapsed=Math.max(0,Math.round(num(days)));
  const remaining=Math.max(0,Math.round(num(injury.remainingDays,injury.expectedDays))-elapsed);
  return{
    ...injury,
    remainingDays:remaining,
    status:remaining===0?'recovered':'active',
  };
}

export function playerInjuryAvailability(player){
  const injury=player?.injury;
  if(!injury||injury.status==='recovered'||num(injury.remainingDays)<=0)return{available:true,training:true,match:true,remainingDays:0};
  const remaining=Math.max(1,Math.round(num(injury.remainingDays)));
  const training=injury.severity==='knock'&&remaining<=2;
  return{available:false,training,match:false,remainingDays:remaining,severity:injury.severity,kind:injury.kind};
}

export function injuryBurden({activeInjury=null,history=[]}={}){
  let burden=0;
  if(activeInjury&&activeInjury.status!=='recovered'){
    const cfg=INJURY_SEVERITIES[activeInjury.severity]||INJURY_SEVERITIES.minor;
    burden+=cfg.burden+Math.min(18,num(activeInjury.remainingDays)*.12);
  }
  const recent=(Array.isArray(history)?history:[]).slice(-8);
  for(const item of recent){
    const cfg=INJURY_SEVERITIES[item?.severity]||INJURY_SEVERITIES.minor;
    burden+=cfg.burden*.34+Math.min(8,num(item?.expectedDays)*.035);
  }
  return Math.round(clamp(burden,0,100));
}
