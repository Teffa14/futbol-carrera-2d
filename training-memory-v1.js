const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hashString(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function rngFor(seed){let a=hashString(seed);return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

export const DRILLS=[
  {id:'cone-dribble',name:'Slalom de conos',kind:'cones',desc:'Microtoques, cambios de dirección y aceleración con pelota.',memories:['carry','close-control','change-direction'],attrs:{dribbling:.37,ballControl:.34,pace:.18,stamina:.11},duration:18},
  {id:'one-v-one',name:'1 contra 1',kind:'1v1',desc:'Encara un defensor, protege, cambia de lado, acelera y busca salida.',memories:['1v1','shield-turn','burst-after-touch'],attrs:{dribbling:.32,ballControl:.25,physical:.15,composure:.18,stamina:.10},duration:20},
  {id:'two-v-two',name:'2 contra 2',kind:'2v2',desc:'Pared, tercer hombre, apoyo, aceleración y finalización bajo presión.',memories:['wall-pass','third-man','press-resistance'],attrs:{passing:.29,vision:.25,ballControl:.20,composure:.16,stamina:.10},duration:22},
  {id:'three-v-three',name:'3 contra 3',kind:'3v3',desc:'Juego reducido: circulación, desmarque, presión, transición y finalización.',memories:['combination','third-man','counterpress','scan-before-receive'],attrs:{passing:.24,vision:.23,stamina:.20,ballControl:.16,defense:.10,composure:.07},duration:24},
  {id:'through-ball',name:'Pase en profundidad',kind:'through',desc:'Esperá la ruptura y atacá el espacio detrás de la línea.',memories:['through-ball','timed-run','scan-runner'],attrs:{passing:.42,vision:.38,composure:.20},duration:18},
  {id:'crossing',name:'Desborde y centro',kind:'cross',desc:'Llegada a fondo, pase tenso o centro medido, cutback y ocupación del área.',memories:['overlap','cross','cutback','far-post-run'],attrs:{passing:.30,vision:.22,ballControl:.18,pace:.12,composure:.08,stamina:.10},duration:20},
  {id:'finishing',name:'Definición',kind:'finish',desc:'Control, remate de primera, segundo palo y finalización de centro.',memories:['box-run','first-time-shot','cutback-finish','shot-selection'],attrs:{shooting:.46,composure:.28,ballControl:.18,pace:.05,stamina:.03},duration:18},
  {id:'free-kick',name:'Tiro libre',kind:'free-kick',desc:'Perfil, potencia, colocación y repetición de gesto.',memories:['free-kick','shot-placement','set-piece-routine'],attrs:{shooting:.52,composure:.30,ballControl:.18},duration:16},
];

export function drillById(id){return DRILLS.find(d=>d.id===id)||null;}
function resolveDrill(drillOrId,override=null){if(override?.id)return override;if(drillOrId&&typeof drillOrId==='object'&&drillOrId.id)return drillOrId;return drillById(drillOrId);}
export function ensureTrainingMemory(state){
  if(!state?.player)return state;
  state.player.trainingMemory??={};
  state.player.developmentWork??={};
  state.player.trainingLog??=[];
  state.player.trainingSummary??={sessions:0,avgGrade:0,bestGrade:'—'};
  state.campaign??={coachTrust:50,lockerRoom:50,media:50,relationships:{},seenEvents:[],currentEvent:null};
  return state;
}
export function memoryLevel(player,key){return clamp(Number(player?.trainingMemory?.[key]?.familiarity)||0,0,100);}
export function memoryConfidence(player,key){const m=player?.trainingMemory?.[key];if(!m)return 0;return clamp((m.familiarity||0)*.65+(m.quality||0)*.35,0,100);}
export function topMemories(player,limit=6){return Object.entries(player?.trainingMemory||{}).map(([id,m])=>({id,...m})).sort((a,b)=>(b.familiarity||0)-(a.familiarity||0)).slice(0,limit);}

function weightedAbility(player,attrs){let total=0,w=0;for(const [key,weight] of Object.entries(attrs)){total+=(Number(player[key])||50)*weight;w+=weight;}return total/(w||1);}
function gradeFor(q){return q>=91?'S':q>=82?'A':q>=72?'B':q>=62?'C':q>=52?'D':'E';}
const GRADE_VALUE={S:6,A:5,B:4,C:3,D:2,E:1};

export function previewTrainingResult(state,drillId,attempt=0,drillOverride=null){
  ensureTrainingMemory(state);const drill=resolveDrill(drillId,drillOverride);if(!drill)throw new Error('Ejercicio inválido');
  const p=state.player,r=rngFor(`${state.season}|${state.week}|${p.name}|${drill.id}|${attempt}|${state.player.trainingLog.length}`),ability=weightedAbility(p,drill.attrs),familiarity=drill.memories.reduce((s,k)=>s+memoryLevel(p,k),0)/drill.memories.length;
  const form=Number(p.form||0)*1.6,fitness=(Number(p.fitness??100)-75)*.10,variation=(r()+r()+r()-1.5)*10;
  const quality=clamp(Math.round(ability*.68+familiarity*.19+form+fitness+variation),35,98),reps=6+Math.floor(r()*6),successes=clamp(Math.round(reps*(.34+quality/155)+(r()-.5)*1.6),0,reps),grade=gradeFor(quality);
  return{drillId:drill.id,quality,grade,reps,successes,ability:Math.round(ability),memoryBefore:Math.round(familiarity),seed:`${state.season}-${state.week}-${drill.id}-${attempt}`};
}

export function developmentWorkThreshold(value){const v=clamp(Number(value)||50,30,99);if(v<50)return 58+(v-30)*.8;if(v<65)return 76+(v-50)*2;if(v<75)return 108+(v-65)*4.2;if(v<85)return 152+(v-75)*7.5;return 232+(v-85)*12.5;}
export function developmentLearningEfficiency(value){const v=clamp(Number(value)||50,30,99);if(v<50)return 1.55;if(v<60)return 1.32;if(v<70)return 1.12;if(v<75)return .94;if(v<85)return .68;return .45;}
function workThreshold(value){return developmentWorkThreshold(value);}
function nextAttributeProgress(player,drill){
  return Object.entries(drill.attrs).map(([attr,weight])=>{
    const threshold=workThreshold(player[attr]),work=Number(player.developmentWork?.[attr]||0),percent=clamp(Math.round(work/threshold*100),0,99);
    return{attr,weight,work:+work.toFixed(1),threshold:+threshold.toFixed(1),percent};
  }).sort((a,b)=>b.weight-a.weight||b.percent-a.percent);
}
export function trainingDevelopmentProgress(player,drillOrId){const drill=resolveDrill(drillOrId);return drill?nextAttributeProgress(player,drill):[];}

export function applyTrainingResult(state,result,calculateOverall=null,drillOverride=null){
  ensureTrainingMemory(state);const drill=resolveDrill(result?.drillId,drillOverride);if(!drill)return{ok:false,message:'Ejercicio inválido'};
  if((state.progress?.trainingPoints??0)<=0)return{ok:false,message:'No quedan sesiones esta semana'};
  const p=state.player,oldSessions=p.trainingSummary.sessions||0,oldAvg=p.trainingSummary.avgGrade||0,gradeValue=GRADE_VALUE[result.grade]||1,reps=Math.max(1,Number(result.reps)||1),successRate=clamp((Number(result.successes)||0)/reps,0,1);
  const memoryGain=clamp(Math.round(2+result.quality/14+successRate*3),3,12);
  for(const key of drill.memories){const old=p.trainingMemory[key]||{familiarity:0,reps:0,quality:0,lastWeek:0};const nextFam=clamp(old.familiarity+memoryGain*(1-old.familiarity/135),0,100);p.trainingMemory[key]={familiarity:+nextFam.toFixed(1),reps:(old.reps||0)+reps,quality:+(((old.quality||result.quality)*.7)+result.quality*.3).toFixed(1),lastWeek:state.week};}
  const gained=[];for(const [attr,weight] of Object.entries(drill.attrs)){const performanceMultiplier=.84+successRate*.34+(result.grade==='S'?.10:result.grade==='A'?.05:0),learningEfficiency=developmentLearningEfficiency(p[attr]),xp=result.quality*reps*weight*.095*performanceMultiplier*learningEfficiency;let work=(p.developmentWork[attr]||0)+xp,threshold=workThreshold(p[attr]);while(work>=threshold&&p[attr]<99&&p[attr]<(p.dynamicPotential??p.potential??96)+5){work-=threshold;p[attr]=clamp(p[attr]+1,30,99);gained.push(attr);threshold=workThreshold(p[attr]);}p.developmentWork[attr]=+work.toFixed(1);}
  p.trainingSummary={sessions:oldSessions+1,avgGrade:+((oldAvg*oldSessions+gradeValue)/(oldSessions+1)).toFixed(2),bestGrade:!p.trainingSummary.bestGrade||p.trainingSummary.bestGrade==='—'||gradeValue>(GRADE_VALUE[p.trainingSummary.bestGrade]||0)?result.grade:p.trainingSummary.bestGrade};
  p.trainingLog.unshift({season:state.season,week:state.week,drillId:drill.id,grade:result.grade,quality:result.quality,reps,successes:result.successes,memoryGain,development:nextAttributeProgress(p,drill).slice(0,3)});p.trainingLog=p.trainingLog.slice(0,30);
  state.progress.trainingPoints--;state.progress.xp=(state.progress.xp||0)+Math.round(12+result.quality*.28);state.campaign.coachTrust=clamp((state.campaign.coachTrust||50)+(result.grade==='S'?3:result.grade==='A'?2:result.grade==='B'?1:result.grade==='E'?-1:0),0,100);p.fitness=clamp((p.fitness??100)-(5+reps*.35),35,100);
  if(typeof calculateOverall==='function')p.rating=calculateOverall(p);
  const roster=state.world?.[state.clubId]?.roster,idx=roster?.findIndex(x=>x.isUser);if(idx>=0)roster[idx]=p;
  const progress=nextAttributeProgress(p,drill),lead=progress.slice(0,2).map(x=>`${x.attr} ${x.percent}%`).join(' · ');
  return{ok:true,gained,memoryGain,developmentProgress:progress,message:gained.length?`Sesión ${result.grade}. Mejoraste ${[...new Set(gained)].join(', ')}. Próximo progreso: ${lead}.`:`Sesión ${result.grade}. La adaptación subió y el trabajo de stats sigue acumulando: ${lead}.`};
}
