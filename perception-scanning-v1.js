const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function unit(x,y){const l=Math.hypot(x,y)||1;return{x:x/l,y:y/l};}
function playerVision(p){return clamp(Number(p?.data?.vision??60),30,99);}
function playerComposure(p){return clamp(Number(p?.data?.composure??60),30,99);}

export function perceptionProfile(p){
  const vision=playerVision(p),composure=playerComposure(p);
  return{
    vision,
    halfConeRadians:(55+vision*.35)*Math.PI/180,
    range:240+vision*2.2,
    closeAwareness:42+vision*.20,
    scanIntervalTicks:Math.max(4,Math.round(15-vision*.085-composure*.025)),
    memoryTicks:Math.round(38+vision*.78+composure*.20),
  };
}

function facing(p){
  const f=unit(Number(p?.facingX??(p?.team===0?1:-1)),Number(p?.facingY??0));
  return f;
}

export function targetVisibility(p,target){
  if(!p||!target||p.id===target.id)return{visible:false,distance:Infinity,angle:Math.PI};
  const profile=perceptionProfile(p),d=dist(p,target);
  if(d>profile.range)return{visible:false,distance:d,angle:Math.PI};
  if(d<=profile.closeAwareness)return{visible:true,distance:d,angle:0,peripheral:true};
  const dir=unit(target.x-p.x,target.y-p.y),face=facing(p),dot=clamp(face.x*dir.x+face.y*dir.y,-1,1),angle=Math.acos(dot);
  return{visible:angle<=profile.halfConeRadians,distance:d,angle,peripheral:false};
}

function ensureState(p){
  p.perceptionState??={lastScanTick:-999,memory:{}};
  p.perceptionState.memory??={};
  return p.perceptionState;
}

function snapshot(target,tick,visible=true){
  return{
    id:target.id,team:target.team,role:target.role,
    x:target.x,y:target.y,vx:target.vx||0,vy:target.vy||0,
    lastSeenTick:tick,visible,confidence:1,
  };
}

export function updatePerception(engine,p,{force=false}={}){
  if(!engine||!p)return[];
  const state=ensureState(p),profile=perceptionProfile(p),tick=Number(engine.tick)||0;
  const due=force||tick-state.lastScanTick>=profile.scanIntervalTicks;
  if(due){
    state.lastScanTick=tick;
    for(const target of engine.players||[]){
      if(target.id===p.id)continue;
      if(targetVisibility(p,target).visible)state.memory[target.id]=snapshot(target,tick,true);
    }
  }
  const result=[];
  for(const [id,mem] of Object.entries(state.memory)){
    const age=Math.max(0,tick-mem.lastSeenTick),live=(engine.players||[]).find(q=>String(q.id)===String(id));
    if(age>profile.memoryTicks||!live){delete state.memory[id];continue;}
    const visibility=targetVisibility(p,live),confidence=clamp(1-age/profile.memoryTicks,0,1);
    if(visibility.visible){Object.assign(mem,snapshot(live,tick,true));result.push({...mem,confidence:1});continue;}
    mem.visible=false;mem.confidence=confidence;
    result.push({...mem,confidence});
  }
  return result;
}

export function perceivedPlayers(engine,p,options={}){
  const snapshots=updatePerception(engine,p,options);
  return snapshots.map(s=>({
    ...s,
    player:(engine.players||[]).find(q=>q.id===s.id)||null,
  })).filter(s=>s.player);
}

export function perceivedTeammates(engine,p,options={}){
  return perceivedPlayers(engine,p,options).filter(s=>s.team===p.team);
}

export function perceivedOpponents(engine,p,options={}){
  return perceivedPlayers(engine,p,options).filter(s=>s.team!==p.team);
}

export function perceivedOpponentStates(engine,p,options={}){
  return perceivedOpponents(engine,p,options).map(observation=>{
    const live=observation.player;
    return{
      ...live,
      x:observation.x,
      y:observation.y,
      vx:observation.vx,
      vy:observation.vy,
      perceptionConfidence:observation.confidence,
      perceptionVisible:observation.visible,
      perceptionLastSeenTick:observation.lastSeenTick,
    };
  });
}

export function perceptionConfidence(engine,p,targetId){
  const item=perceivedPlayers(engine,p).find(s=>s.id===targetId);
  return item?.confidence??0;
}
