const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const round1=v=>+Number(v||0).toFixed(1);

function normalizeId(value,fallback='unknown'){return String(value??fallback).trim()||fallback;}
function pairKey(a,b){return[normalizeId(a),normalizeId(b)].sort().join('|');}
function average(values,fallback=0){const clean=values.filter(Number.isFinite);return clean.length?clean.reduce((a,b)=>a+b,0)/clean.length:fallback;}
function entry(value=0,week=0){return{familiarity:round1(clamp(Number(value)||0,0,100)),reps:0,lastWeek:Math.max(0,Number(week)||0)};}

export function ensureTacticalFamiliarity(state){
  if(!state)return null;
  state.tacticalFamiliarity??={concepts:{},pairs:{},patterns:{},lastDecayWeek:0};
  const root=state.tacticalFamiliarity;
  root.concepts??={};root.pairs??={};root.patterns??={};root.lastDecayWeek=Math.max(0,Number(root.lastDecayWeek)||0);
  return root;
}

function ensureBucketEntry(bucket,key,week=0){
  bucket[key]??=entry(0,week);
  const row=bucket[key];
  row.familiarity=round1(clamp(Number(row.familiarity)||0,0,100));row.reps=Math.max(0,Number(row.reps)||0);row.lastWeek=Math.max(0,Number(row.lastWeek)||0);
  return row;
}

function applyPractice(row,{quality=70,reps=1,week=0,multiplier=1}={}){
  const q=clamp(Number(quality)||0,0,100),n=Math.max(1,Number(reps)||1),before=row.familiarity;
  const learning=(1.7+q*.055+Math.min(6,n)*.3)*Math.max(0,Number(multiplier)||0);
  const diminishing=Math.max(.18,1-before/122);
  row.familiarity=round1(clamp(before+learning*diminishing,0,100));row.reps+=n;row.lastWeek=Math.max(row.lastWeek,Number(week)||0);
  return round1(row.familiarity-before);
}

export function conceptFamiliarity(state,playerId,conceptId){
  const root=ensureTacticalFamiliarity(state);if(!root)return 0;
  return ensureBucketEntry(root.concepts,`${normalizeId(playerId)}:${normalizeId(conceptId)}`).familiarity;
}

export function pairFamiliarity(state,a,b){
  const root=ensureTacticalFamiliarity(state);if(!root)return 0;
  return ensureBucketEntry(root.pairs,pairKey(a,b)).familiarity;
}

export function patternFamiliarity(state,patternId){
  const root=ensureTacticalFamiliarity(state);if(!root)return 0;
  return ensureBucketEntry(root.patterns,normalizeId(patternId)).familiarity;
}

export function practiceConcept(state,{playerId,conceptId,quality=70,reps=1,week=0}={}){
  const root=ensureTacticalFamiliarity(state),key=`${normalizeId(playerId)}:${normalizeId(conceptId)}`;
  const row=ensureBucketEntry(root.concepts,key,week),gain=applyPractice(row,{quality,reps,week,multiplier:1});
  return{key,gain,familiarity:row.familiarity};
}

export function practicePair(state,{playerA,playerB,quality=70,reps=1,week=0}={}){
  const root=ensureTacticalFamiliarity(state),key=pairKey(playerA,playerB),row=ensureBucketEntry(root.pairs,key,week),gain=applyPractice(row,{quality,reps,week,multiplier:.86});
  return{key,gain,familiarity:row.familiarity};
}

export function practicePattern(state,{patternId,participants=[],concepts=[],quality=70,reps=1,week=0}={}){
  const root=ensureTacticalFamiliarity(state),id=normalizeId(patternId),row=ensureBucketEntry(root.patterns,id,week),patternGain=applyPractice(row,{quality,reps,week,multiplier:.78});
  const unique=[...new Set(participants.map(x=>normalizeId(x)).filter(Boolean))];
  const pairGains=[];for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++)pairGains.push(practicePair(state,{playerA:unique[i],playerB:unique[j],quality,reps,week}));
  const conceptGains=[];for(const playerId of unique)for(const conceptId of concepts)conceptGains.push(practiceConcept(state,{playerId,conceptId,quality,reps,week}));
  return{patternId:id,patternGain,familiarity:row.familiarity,pairGains,conceptGains};
}

export function effectivePatternFamiliarity(state,{patternId,participants=[],concepts=[]}={}){
  const ids=[...new Set(participants.map(x=>normalizeId(x)).filter(Boolean))],pattern=patternFamiliarity(state,patternId);
  const pairs=[];for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)pairs.push(pairFamiliarity(state,ids[i],ids[j]));
  const conceptScores=[];for(const playerId of ids)for(const conceptId of concepts)conceptScores.push(conceptFamiliarity(state,playerId,conceptId));
  const pairAvg=average(pairs,pattern),conceptAvg=average(conceptScores,pattern),bottleneck=Math.min(pattern,pairAvg,conceptAvg);
  const effective=clamp(pattern*.42+pairAvg*.30+conceptAvg*.20+bottleneck*.08,0,100);
  return{effective:round1(effective),pattern:round1(pattern),pair:round1(pairAvg),concept:round1(conceptAvg),bottleneck:round1(bottleneck)};
}

export function coordinationTimingProfile(familiarity){
  const f=clamp(Number(familiarity)||0,0,100),lack=1-f/100;
  return{
    anticipationDelayMs:Math.round(45+lack*310),
    runTimingToleranceMs:Math.round(150+f*2.4),
    branchRecognitionDelayMs:Math.round(70+lack*380),
    duplicatedSpaceRisk:round1(clamp(.04+lack*.28,.04,.32)),
    orientationErrorRisk:round1(clamp(.03+lack*.22,.03,.25))
  };
}

function decayBucket(bucket,currentWeek,{grace=3,rate=.7,floor=0}={}){
  for(const row of Object.values(bucket)){const stale=Math.max(0,currentWeek-Number(row.lastWeek||0)-grace);if(!stale)continue;row.familiarity=round1(Math.max(floor,Number(row.familiarity||0)-stale*rate));}
}

export function decayTacticalFamiliarity(state,currentWeek){
  const root=ensureTacticalFamiliarity(state),week=Math.max(0,Number(currentWeek)||0);if(!root||week<=root.lastDecayWeek)return root;
  decayBucket(root.concepts,week,{grace:5,rate:.45});
  decayBucket(root.pairs,week,{grace:3,rate:.8});
  decayBucket(root.patterns,week,{grace:3,rate:.65});
  root.lastDecayWeek=week;return root;
}

export function tacticalFamiliaritySnapshot(state){
  const root=ensureTacticalFamiliarity(state);return{
    concepts:Object.fromEntries(Object.entries(root?.concepts||{}).map(([k,v])=>[k,round1(v.familiarity)])),
    pairs:Object.fromEntries(Object.entries(root?.pairs||{}).map(([k,v])=>[k,round1(v.familiarity)])),
    patterns:Object.fromEntries(Object.entries(root?.patterns||{}).map(([k,v])=>[k,round1(v.familiarity)]))
  };
}

export const __tacticalFamiliarityTest={pairKey,applyPractice};
