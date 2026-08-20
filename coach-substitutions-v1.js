const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function roleFamily(role){
  if(role==='GK')return'GK';
  if(['LB','RB','CB','LWB','RWB'].includes(role))return'DEF';
  if(['CDM','CM','CAM','LM','RM'].includes(role))return'MID';
  return'FWD';
}

function roleCompatibility(player,role){
  const own=player.engineRole||player.position;
  if(own===role)return 18;
  if(roleFamily(own)===roleFamily(role))return 8;
  if(['LW','RW','ST'].includes(own)&&['LW','RW','ST'].includes(role))return 6;
  if(['CM','CAM','CDM'].includes(own)&&['CM','CAM','CDM'].includes(role))return 6;
  return-18;
}

function liveFatigue(player,fatigueById){
  const id=player.instanceId||player.id;
  const live=Number(fatigueById?.[id]);
  if(Number.isFinite(live))return clamp(live,0,100);
  return clamp(100-(player.fitness??100),0,100);
}

function benchUtility(player,starter,role,context){
  const ratingGap=(player.rating??50)-(starter.rating??50);
  const freshness=((player.fitness??100)-(starter.fitness??100))*.11;
  const compatibility=roleCompatibility(player,role);
  const trailingBoost=context.scoreDiff<0&&roleFamily(role)==='FWD'?7:0;
  const protectLeadBoost=context.scoreDiff>0&&roleFamily(role)==='DEF'?5:0;
  const form=((player.form??0)-(starter.form??0))*1.5;
  return ratingGap+freshness+compatibility+trailingBoost+protectLeadBoost+form;
}

function replacementPressure(starter,context){
  const fatigue=liveFatigue(starter,context.fatigueById);
  const minutePressure=clamp((context.minute-50)*.42,0,18);
  const fatiguePressure=clamp((fatigue-35)*.42,0,24);
  const scorePressure=context.scoreDiff<0?clamp(-context.scoreDiff*4,0,10):0;
  const fitnessPressure=clamp((72-(starter.fitness??100))*.18,0,10);
  return minutePressure+fatiguePressure+scorePressure+fitnessPressure;
}

export function planCoachSubstitutions({starters=[],bench=[],minute=60,scoreDiff=0,fatigueById={},maxSubs=5,alreadyUsed=[]}={}){
  if(minute<50||minute>=90||!starters.length||!bench.length||maxSubs<=0)return[];
  const used=new Set(alreadyUsed);
  const availableBench=bench.filter(p=>!used.has(p.instanceId||p.id));
  const candidates=[];

  for(const starter of starters){
    const starterId=starter.instanceId||starter.id;
    if(used.has(starterId)||starter.engineRole==='GK')continue;
    const role=starter.engineRole||starter.position;
    const pressure=replacementPressure(starter,{minute,scoreDiff,fatigueById});
    for(const incoming of availableBench){
      if(incoming.engineRole==='GK'||incoming.position==='GK')continue;
      const compatibility=roleCompatibility(incoming,role);
      if(compatibility<0)continue;
      const utility=benchUtility(incoming,starter,role,{scoreDiff});
      const score=pressure+utility;
      candidates.push({starter,incoming,role,score,pressure,utility});
    }
  }

  candidates.sort((a,b)=>b.score-a.score||b.utility-a.utility||String(a.incoming.instanceId||a.incoming.id).localeCompare(String(b.incoming.instanceId||b.incoming.id)));
  const changes=[],outUsed=new Set(),inUsed=new Set();
  const threshold=minute>=75?10:minute>=65?16:22;
  for(const c of candidates){
    const outId=c.starter.instanceId||c.starter.id,inId=c.incoming.instanceId||c.incoming.id;
    if(outUsed.has(outId)||inUsed.has(inId)||c.score<threshold)continue;
    changes.push({
      outId,
      inId,
      role:c.role,
      minute:Math.round(minute),
      score:Number(c.score.toFixed(2)),
      reason:c.pressure>=20?'fatigue_or_match_state':'freshness_and_role_fit',
    });
    outUsed.add(outId);inUsed.add(inId);
    if(changes.length>=maxSubs)break;
  }
  return changes;
}

export function userBenchOpportunity(selection,context={}){
  if(!selection||selection.status!=='bench'||!selection.user)return null;
  const changes=planCoachSubstitutions({starters:selection.starters,bench:selection.bench,...context});
  const userId=selection.user.instanceId||selection.user.id;
  return changes.find(change=>change.inId===userId)||null;
}
