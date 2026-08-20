const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hypot=(x,y)=>Math.hypot(Number(x)||0,Number(y)||0);
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;

function dataOf(player){return player?.data||player||{};}
function norm(x,y){const m=hypot(x,y);return m>1e-9?{x:x/m,y:y/m}:{x:1,y:0};}
function angleBetween(ax,ay,bx,by){const a=norm(ax,ay),b=norm(bx,by);return Math.acos(clamp(dot(a.x,a.y,b.x,b.y),-1,1));}

export function arrivalMotionProfile(player){
  const d=dataOf(player),motion=player?.motion||{};
  const pace=clamp(Number(d.pace??70),20,99),stamina=clamp(Number(d.stamina??d.physical??68),20,99),control=clamp(Number(d.ballControl??65),20,99),dribbling=clamp(Number(d.dribbling??65),20,99),vision=clamp(Number(d.vision??d.passing??65),20,99),composure=clamp(Number(d.composure??65),20,99),defense=clamp(Number(d.defense??50),20,99);
  return{
    acceleration:clamp(Number(motion.acceleration??(pace*.68+dribbling*.16+control*.12+stamina*.04)),28,99),
    sprintSpeed:clamp(Number(motion.sprintSpeed??(pace*.86+stamina*.07+(Number(d.physical??65))*.07)),28,99),
    agility:clamp(Number(motion.agility??(dribbling*.48+control*.34+pace*.18)),28,99),
    reaction:clamp(Number(motion.reaction??(vision*.30+composure*.26+control*.22+defense*.12+pace*.10)),28,99),
  };
}

export function estimateArrivalTime(player,target,{reactionScale=1}={}){
  if(!player||!target)return Infinity;
  const dx=(Number(target.x)||0)-(Number(player.x)||0),dy=(Number(target.y)||0)-(Number(player.y)||0),distance=hypot(dx,dy);
  if(distance<1)return 0;
  const direction=norm(dx,dy),m=arrivalMotionProfile(player),fatigue=clamp(Number(player.fatigue??0),0,100),fitness=clamp(Number(dataOf(player).fitness??100),35,100),availableFitness=clamp(fitness-fatigue,35,100)/100;
  const fatigueFactor=.72+.28*availableFitness;
  const maxFrameSpeed=(2.55+m.sprintSpeed/100*1.95)*fatigueFactor;
  const accelFrame=.035*(.68+m.acceleration/115)*fatigueFactor;
  const currentAlong=Math.max(0,dot(Number(player.vx)||0,Number(player.vy)||0,direction.x,direction.y));
  const turnAngle=angleBetween(Number(player.facingX??direction.x),Number(player.facingY??direction.y),direction.x,direction.y);
  const turnRate=5.2+((m.agility*2)/100)*2.8;
  const turnDelay=turnAngle/turnRate;
  const reactionDelay=(.08+(100-m.reaction)*.0036)*Math.max(0,reactionScale);
  const maxPerSecond=Math.max(.1,maxFrameSpeed*60),accelPerSecond=Math.max(.1,accelFrame*3600),v0=Math.min(currentAlong*60,maxPerSecond);
  const accelTime=Math.max(0,(maxPerSecond-v0)/accelPerSecond),accelDistance=v0*accelTime+.5*accelPerSecond*accelTime*accelTime;
  let travelTime;
  if(accelDistance>=distance){travelTime=(-v0+Math.sqrt(v0*v0+2*accelPerSecond*distance))/accelPerSecond;}
  else{travelTime=accelTime+(distance-accelDistance)/maxPerSecond;}
  return Math.max(0,reactionDelay+turnDelay+travelTime);
}

export function arrivalRace(first,second,target,options={}){
  const firstTime=estimateArrivalTime(first,target,options),secondTime=estimateArrivalTime(second,target,options),margin=secondTime-firstTime;
  return{firstTime,secondTime,margin,winner:Math.abs(margin)<.05?null:(margin>0?first:second)};
}

export function controlAtPoint(players,target,{team=null,contestWindow=.22}={}){
  const arrivals=(players||[]).filter(Boolean).map(player=>({player,time:estimateArrivalTime(player,target)})).sort((a,b)=>a.time-b.time);
  const first=arrivals[0]||null;if(!first)return{controllerTeam:null,advantage:0,contested:false,arrivals:[]};
  const ownTeam=team??first.player.team,own=arrivals.find(a=>a.player.team===ownTeam)||null,opponent=arrivals.find(a=>a.player.team!==ownTeam)||null;
  if(!own)return{controllerTeam:opponent?.player.team??null,advantage:-Infinity,contested:false,arrivals};
  if(!opponent)return{controllerTeam:own.player.team,advantage:Infinity,contested:false,arrivals};
  const advantage=opponent.time-own.time,contested=Math.abs(advantage)<=contestWindow;
  return{controllerTeam:contested?null:(advantage>0?own.player.team:opponent.player.team),advantage,contested,arrivals};
}

export function interceptionWindow(defenders,target,{arrivalTime,buffer=.08}={}){
  const available=Number(arrivalTime);if(!Number.isFinite(available))return{canIntercept:false,best:null,margin:-Infinity};
  let best=null;for(const defender of defenders||[]){const time=estimateArrivalTime(defender,target);if(!best||time<best.time)best={player:defender,time};}
  if(!best)return{canIntercept:false,best:null,margin:-Infinity};
  const margin=available-best.time-buffer;return{canIntercept:margin>=0,best,margin};
}
