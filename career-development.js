const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function hashSeed(seed){let h=2166136261;for(const ch of String(seed)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function seeded(seed){let h=hashSeed(seed);return()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

export const DEVELOPMENT_STAGES=[
  {id:'academy',minAge:15,maxAge:17},
  {id:'rookie',minAge:18,maxAge:20},
  {id:'development',minAge:21,maxAge:23},
  {id:'prime',minAge:24,maxAge:29},
  {id:'veteran',minAge:30,maxAge:34},
  {id:'decline',minAge:35,maxAge:99},
];

export function developmentStage(age){
  const n=clamp(Math.round(Number(age)||18),15,50);
  return DEVELOPMENT_STAGES.find(s=>n>=s.minAge&&n<=s.maxAge)?.id||'rookie';
}

const START_LEVEL={
  academy:{base:51,spread:6},
  reserve:{base:55,spread:6},
  third:{base:57,spread:7},
  second:{base:60,spread:7},
  first_small:{base:62,spread:7},
};

const BACKGROUND={
  local_academy:{start:0,potential:2},
  elite_academy:{start:3,potential:6},
  street:{start:-1,potential:4},
  late_bloomer:{start:-3,potential:7},
};

export function createDevelopmentProfile({seed='career',age=17,entryLevel='reserve',background='local_academy'}={}){
  const r=seeded(`${seed}|${age}|${entryLevel}|${background}`),level=START_LEVEL[entryLevel]||START_LEVEL.reserve,bg=BACKGROUND[background]||BACKGROUND.local_academy;
  const startOverall=clamp(Math.round(level.base+bg.start+(r()-.5)*level.spread),45,68);
  const potentialGap=12+Math.round(r()*15)+bg.potential;
  const potential=clamp(startOverall+potentialGap,62,94);
  const year=2026-clamp(Math.round(age),15,22),month=1+Math.floor(r()*12),day=1+Math.floor(r()*28);
  return{
    age:clamp(Math.round(age),15,22),
    birthDate:`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
    stage:developmentStage(age),
    entryLevel,
    background,
    startingOverall:startOverall,
    potential,
    dynamicPotential:potential,
    development:{technical:0,tactical:0,physical:0,experience:0},
    peakWindow:{from:24+Math.floor(r()*2),to:28+Math.floor(r()*3)},
    retirement:{eligibleFrom:33+Math.floor(r()*3),retired:false,reason:null},
  };
}

const EARLY=new Set(['pace','physical','stamina']);
const LATE=new Set(['vision','composure','tacticalIQ','anticipation','positioning']);

export function ageDevelopmentWeight(attribute,age){
  const a=clamp(Number(age)||18,15,45);
  if(EARLY.has(attribute)){
    if(a<=20)return 1.2;
    if(a<=25)return 1;
    if(a<=29)return .55;
    if(a<=32)return .1;
    return -.45-Math.min(.35,(a-33)*.04);
  }
  if(LATE.has(attribute)){
    if(a<=20)return .72;
    if(a<=24)return 1;
    if(a<=29)return 1.08;
    if(a<=33)return .55;
    return .08-Math.min(.28,(a-34)*.035);
  }
  if(a<=20)return 1;
  if(a<=25)return 1.05;
  if(a<=30)return .75;
  if(a<=33)return .3;
  return -.22-Math.min(.28,(a-34)*.03);
}

export function developmentHeadroom(profile,currentOverall){
  const ceiling=Number(profile?.dynamicPotential??profile?.potential??currentOverall);
  return Math.max(0,ceiling-Number(currentOverall||0));
}
