import {recordPreCareerDrill,recordTrialMatch} from './precareer-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pct=(a,b,fallback=50)=>Number(b)>0?clamp(Number(a||0)/Number(b)*100,0,100):fallback;
const mix=parts=>{let sum=0,w=0;for(const [value,weight] of parts){if(Number.isFinite(value)&&weight>0){sum+=value*weight;w+=weight;}}return clamp(Math.round(w?sum/w:50),0,100);};
const setSize=v=>v instanceof Set?v.size:Array.isArray(v)?new Set(v).size:0;
const ratingScore=v=>Number.isFinite(Number(v))?clamp(Math.round(50+(Number(v)-6)*12.5),15,100):50;

function userPerformance(source){
  if(typeof source?.userPerformance==='function')return source.userPerformance()||{};
  return source?.userPerformance||source?.performance||source?.report?.userPerformance||{};
}

export function scoutingScoresFromTrainingEngine(engine){
  if(!engine)throw new Error('Training engine is required');
  const kind=String(engine.drill?.kind||'generic');
  const m=engine.trainingMetricsV6||engine.trainingMetricsV5||engine.trainingMetricsV4||{};
  const q=engine.trainingQualityV6||engine.trainingQualityV5||engine.trainingQualityV4||{};
  const reps=Math.max(1,Math.round(Number(engine.result?.reps)||1));
  const repResults=Array.isArray(q.repResults)?q.repResults:[];
  const successes=repResults.length?repResults.filter(x=>x?.success).length:Math.max(0,Math.round(Number(engine.result?.successes)||0));
  const completion=pct(successes,repResults.length||reps,0);
  const quality=clamp(Number(engine.result?.quality)||50,0,100);
  const passAccuracy=pct(m.passesCompleted,m.passesAttempted,quality);
  const shotConversion=pct(m.goals,m.shots,completion);
  const duelConversion=clamp(Number(m.duelsBeaten||0)/reps*100,0,100);
  const gateCompletion=clamp(Number(m.gatesCleared||0)/(reps*4)*100,0,100);
  const touches=Number(m.physicalTouches??engine.metrics?.touches??0);
  const activity=clamp(40+touches*2,0,100);
  const variety=clamp((setSize(m.branches)+setSize(m.receivers)+setSize(m.serviceTypes)+setSize(m.deliveryChoices))*18,0,100);
  const rating=ratingScore(userPerformance(engine).rating);
  let technical,tactical,physical,mentality;

  if(kind==='cones'){
    technical=mix([[gateCompletion,.4],[completion,.3],[quality,.3]]);
    tactical=mix([[completion,.5],[gateCompletion,.3],[quality,.2]]);
  }else if(kind==='1v1'){
    technical=mix([[duelConversion,.35],[completion,.3],[shotConversion,.2],[quality,.15]]);
    tactical=mix([[completion,.45],[duelConversion,.3],[variety,.1],[rating,.15]]);
  }else if(['2v2','3v3','through','cross'].includes(kind)){
    technical=mix([[passAccuracy,.4],[completion,.3],[quality,.2],[rating,.1]]);
    tactical=mix([[completion,.4],[passAccuracy,.25],[variety,.2],[rating,.15]]);
  }else if(['finish','free-kick'].includes(kind)){
    technical=mix([[shotConversion,.45],[completion,.3],[quality,.15],[rating,.1]]);
    tactical=mix([[completion,.5],[variety,.15],[rating,.2],[quality,.15]]);
  }else{
    technical=mix([[completion,.4],[quality,.35],[rating,.25]]);
    tactical=mix([[completion,.45],[variety,.2],[rating,.2],[quality,.15]]);
  }
  physical=mix([[completion,.45],[activity,.35],[rating,.2]]);
  mentality=mix([[completion,.45],[rating,.35],[quality,.2]]);
  return{technical,tactical,physical,mentality};
}

function roleFamily(role){
  if(['ST','LW','RW','CF'].includes(role))return'attack';
  if(['CB','LB','RB','LWB','RWB'].includes(role))return'defence';
  if(role==='GK')return'keeper';
  return'midfield';
}

export function scoutingScoresFromTrialMatch(source,{role=null}={}){
  const p=userPerformance(source),resolved=String(role||p.engineRole||p.role||p.position||'CM'),family=roleFamily(resolved);
  const base=ratingScore(p.rating);
  const passing=Number.isFinite(Number(p.passPct))?clamp(Number(p.passPct),0,100):pct(p.passesCompleted??p.passes,p.passesAttempted,base);
  const dribbling=Number.isFinite(Number(p.dribblePct))?clamp(Number(p.dribblePct),0,100):pct(p.dribblesCompleted??p.dribbles,p.dribblesAttempted,base);
  const shots=Number(p.shots||0),goals=Number(p.goals||0),finishing=shots>0?clamp(42+goals/shots*55,0,100):base;
  const minutes=clamp(Number(p.minutesPlayed??p.minutes??90)||90,1,120),per90=90/minutes;
  const defending=clamp(48+(Number(p.tackles||0)*5+Number(p.interceptions||0)*6)*per90,0,100);
  const losses=Number(p.turnovers??p.possessionLost??p.errors??0),security=clamp(82-losses*6*per90,20,100);
  let technical,tactical;
  if(family==='attack'){
    technical=mix([[base,.3],[dribbling,.25],[finishing,.27],[passing,.18]]);
    tactical=mix([[base,.55],[passing,.2],[security,.15],[finishing,.1]]);
  }else if(family==='defence'){
    technical=mix([[base,.35],[passing,.3],[defending,.25],[dribbling,.1]]);
    tactical=mix([[base,.48],[defending,.34],[security,.18]]);
  }else{
    technical=mix([[base,.35],[passing,.3],[dribbling,.2],[defending,.15]]);
    tactical=mix([[base,.48],[passing,.22],[defending,.15],[security,.15]]);
  }
  const actions=clamp(45+(Number(p.dribblesAttempted??p.dribbles??0)*3+Number(p.tackles||0)*4+Number(p.interceptions||0)*4)*per90,25,100);
  return{technical,tactical,physical:mix([[base,.5],[actions,.3],[defending,.2]]),mentality:mix([[base,.55],[security,.3],[passing,.15]])};
}

export function recordTrainingEngineEvidence(state,engine,{drillId=null,notes=null}={}){
  const id=String(drillId||engine?.drill?.id||engine?.drill?.kind||'').trim();
  if(!id)throw new Error('A drill id is required');
  return recordPreCareerDrill(state,{drillId:id,scores:scoutingScoresFromTrainingEngine(engine),completed:Boolean(engine?.finished??true),notes});
}

export function recordTrialMatchEvidence(state,source,{matchId,role=null,minutes=null,notes=null}={}){
  const id=String(matchId||'').trim();if(!id)throw new Error('matchId is required');
  const p=userPerformance(source);
  return recordTrialMatch(state,{matchId:id,scores:scoutingScoresFromTrialMatch(source,{role}),minutes:minutes??p.minutesPlayed??p.minutes??90,role:role??p.engineRole??p.role??null,notes});
}
