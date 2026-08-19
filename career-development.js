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

const POSITION_WEIGHTS={
  ST:{shooting:.29,pace:.16,dribbling:.16,ballControl:.14,composure:.13,physical:.08,passing:.04},
  LW:{pace:.23,dribbling:.22,ballControl:.15,shooting:.14,passing:.10,vision:.07,stamina:.05,composure:.04},
  RW:{pace:.23,dribbling:.22,ballControl:.15,shooting:.14,passing:.10,vision:.07,stamina:.05,composure:.04},
  CAM:{passing:.20,vision:.18,dribbling:.17,ballControl:.17,shooting:.11,composure:.08,pace:.05,stamina:.04},
  CM:{passing:.18,vision:.14,ballControl:.13,stamina:.13,dribbling:.10,defense:.10,physical:.09,composure:.07,pace:.04,shooting:.02},
  CDM:{defense:.22,physical:.17,stamina:.15,passing:.13,ballControl:.09,vision:.08,composure:.07,pace:.05,dribbling:.04},
  LB:{pace:.18,stamina:.17,defense:.17,physical:.13,passing:.12,dribbling:.09,ballControl:.07,vision:.04,composure:.03},
  RB:{pace:.18,stamina:.17,defense:.17,physical:.13,passing:.12,dribbling:.09,ballControl:.07,vision:.04,composure:.03},
  CB:{defense:.29,physical:.24,composure:.12,pace:.10,stamina:.08,passing:.07,ballControl:.05,vision:.03,dribbling:.02},
};
const DEVELOPMENT_ATTRIBUTES=['pace','shooting','passing','dribbling','defense','physical','ballControl','vision','stamina','composure'];

function weightedOverall(attributes,position){
  const weights=POSITION_WEIGHTS[position]||POSITION_WEIGHTS.CM;
  let sum=0,total=0;
  for(const [key,weight] of Object.entries(weights)){sum+=(Number(attributes[key])||50)*weight;total+=weight;}
  return total?sum/total:50;
}

export function scaleAttributesToDevelopmentLevel(attributes,targetOverall,position='CM'){
  const target=clamp(Math.round(Number(targetOverall)||55),45,68);
  const result={};
  for(const key of DEVELOPMENT_ATTRIBUTES)result[key]=clamp(Math.round(Number(attributes?.[key])||50),30,88);

  // Apply the same first-order shift to every attribute so position/build identity remains intact.
  // A few correction passes compensate only for bounds such as a young attacker's low defending.
  for(let pass=0;pass<5;pass++){
    const error=target-weightedOverall(result,position);
    if(Math.abs(error)<.35)break;
    for(const key of DEVELOPMENT_ATTRIBUTES)result[key]=clamp(Math.round(result[key]+error),30,88);
  }
  return result;
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
