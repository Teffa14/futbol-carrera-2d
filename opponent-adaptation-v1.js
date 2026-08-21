const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const round3=v=>+Number(v||0).toFixed(3);
const id=v=>String(v??'unknown').trim()||'unknown';

export function createOpponentAdaptationState(){return{matchTick:0,opponents:{}};}

export function ensureOpponentAdaptation(state){
  if(!state)return null;
  state.opponentAdaptation??=createOpponentAdaptationState();
  state.opponentAdaptation.matchTick=Math.max(0,Number(state.opponentAdaptation.matchTick)||0);
  state.opponentAdaptation.opponents??={};
  return state.opponentAdaptation;
}

function opponentRow(root,opponentId){
  const key=id(opponentId);
  root.opponents[key]??={behaviors:{},recent:[]};
  root.opponents[key].behaviors??={};root.opponents[key].recent??=[];
  return root.opponents[key];
}

function behaviorRow(row,context,behavior){
  const key=`${id(context)}:${id(behavior)}`;
  row.behaviors[key]??={count:0,successes:0,lastTick:0};
  return row.behaviors[key];
}

export function observeOpponentBehavior(state,{opponentId,context='general',behavior,success=false,tick}={}){
  if(!behavior)return null;
  const root=ensureOpponentAdaptation(state),now=Math.max(root.matchTick,Number(tick)||root.matchTick+1);root.matchTick=now;
  const row=opponentRow(root,opponentId),stat=behaviorRow(row,context,behavior);
  stat.count+=1;stat.successes+=success?1:0;stat.lastTick=now;
  row.recent.push({context:id(context),behavior:id(behavior),success:!!success,tick:now});
  if(row.recent.length>24)row.recent.splice(0,row.recent.length-24);
  return{count:stat.count,successRate:round3(stat.successes/stat.count),tick:now};
}

function contextStats(row,context){
  const prefix=`${id(context)}:`;const out=[];
  for(const [key,value] of Object.entries(row.behaviors))if(key.startsWith(prefix))out.push({behavior:key.slice(prefix.length),...value});
  return out;
}

export function expectationProfile(state,{opponentId,context='general',defenderIntelligence=65,scoutingKnowledge=0}={}){
  const root=ensureOpponentAdaptation(state);if(!root)return{expected:null,confidence:0,distribution:{}};
  const row=opponentRow(root,opponentId),stats=contextStats(row,context),total=stats.reduce((s,x)=>s+x.count,0);
  if(!total)return{expected:null,confidence:0,distribution:{}};
  const distribution=Object.fromEntries(stats.map(x=>[x.behavior,round3(x.count/total)]));
  const ranked=[...stats].sort((a,b)=>b.count-a.count||b.lastTick-a.lastTick),top=ranked[0],share=top.count/total;
  const iq=clamp(Number(defenderIntelligence)||0,0,100)/100,scout=clamp(Number(scoutingKnowledge)||0,0,100)/100;
  const evidence=1-Math.exp(-total/4.5),confidence=clamp(share*evidence*(.45+.4*iq+.15*scout),0,.96);
  return{expected:top.behavior,confidence:round3(confidence),distribution,total};
}

export function defenderAdaptation(state,args={}){
  const profile=expectationProfile(state,args),confidence=profile.confidence;
  if(!profile.expected)return{...profile,anticipationMs:0,commitment:0};
  const intelligence=clamp(Number(args.defenderIntelligence)||0,0,100)/100;
  return{...profile,anticipationMs:Math.round(confidence*(70+180*intelligence)),commitment:round3(clamp(confidence*(.55+.35*intelligence),0,.9))};
}

export function deceptionWindow(state,{opponentId,context='general',actualBehavior,defenderIntelligence=65,scoutingKnowledge=0}={}){
  const adaptation=defenderAdaptation(state,{opponentId,context,defenderIntelligence,scoutingKnowledge});
  if(!adaptation.expected||adaptation.expected===id(actualBehavior))return{surprise:0,expected:adaptation.expected,actual:id(actualBehavior),reactionDelayMs:0};
  const actualShare=adaptation.distribution[id(actualBehavior)]||0;
  const novelty=1-actualShare;
  const surprise=clamp(adaptation.confidence*novelty,0,.9);
  return{surprise:round3(surprise),expected:adaptation.expected,actual:id(actualBehavior),reactionDelayMs:Math.round(70+surprise*260)};
}

export function decayOpponentAdaptation(state,{currentTick,halfLifeTicks=900}={}){
  const root=ensureOpponentAdaptation(state);if(!root)return null;
  const now=Math.max(root.matchTick,Number(currentTick)||root.matchTick);root.matchTick=now;
  const half=Math.max(60,Number(halfLifeTicks)||900);
  for(const row of Object.values(root.opponents))for(const stat of Object.values(row.behaviors)){
    const age=Math.max(0,now-Number(stat.lastTick||0));if(age<half)continue;
    const factor=Math.pow(.5,age/half);stat.count=round3(stat.count*factor);stat.successes=round3(stat.successes*factor);
  }
  return root;
}
