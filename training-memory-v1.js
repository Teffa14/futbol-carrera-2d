const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hashString(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function rngFor(seed){let a=hashString(seed);return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

export const DRILLS=[
  {id:'cone-dribble',name:'Slalom de conos',kind:'cones',desc:'Microtoques, cambios de dirección y aceleración con pelota.',memories:['carry','close-control','change-direction'],attrs:{dribbling:.42,ballControl:.38,pace:.20},duration:18},
  {id:'one-v-one',name:'1 contra 1',kind:'1v1',desc:'Encara un defensor, protege, cambia de lado y busca salida.',memories:['1v1','shield-turn','burst-after-touch'],attrs:{dribbling:.35,ballControl:.27,physical:.18,composure:.20},duration:20},
  {id:'two-v-two',name:'2 contra 2',kind:'2v2',desc:'Pared, tercer hombre, apoyo y decisión bajo presión.',memories:['wall-pass','third-man','press-resistance'],attrs:{passing:.32,vision:.28,ballControl:.22,composure:.18},duration:22},
  {id:'three-v-three',name:'3 contra 3',kind:'3v3',desc:'Juego reducido: circulación, desmarque, presión y transición.',memories:['combination','third-man','counterpress','scan-before-receive'],attrs:{passing:.25,vision:.25,stamina:.20,ballControl:.15,defense:.15},duration:24},
  {id:'through-ball',name:'Pase en profundidad',kind:'through',desc:'Esperá la ruptura y atacá el espacio detrás de la línea.',memories:['through-ball','timed-run','scan-runner'],attrs:{passing:.42,vision:.38,composure:.20},duration:18},
  {id:'crossing',name:'Desborde y centro',kind:'cross',desc:'Llegada a fondo, centro, cutback y ocupación del área.',memories:['overlap','cross','cutback','far-post-run'],attrs:{passing:.34,vision:.24,ballControl:.20,pace:.12,composure:.10},duration:20},
  {id:'finishing',name:'Definición',kind:'finish',desc:'Primer toque, remate rápido, segundo palo y finalización de centro.',memories:['box-run','first-time-shot','cutback-finish','shot-selection'],attrs:{shooting:.48,composure:.30,ballControl:.14,pace:.08},duration:18},
  {id:'free-kick',name:'Tiro libre',kind:'free-kick',desc:'Perfil, potencia, colocación y repetición de gesto.',memories:['free-kick','shot-placement','set-piece-routine'],attrs:{shooting:.52,composure:.30,ballControl:.18},duration:16},
];

export function drillById(id){return DRILLS.find(d=>d.id===id)||null;}
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

export function previewTrainingResult(state,drillId,attempt=0){
  ensureTrainingMemory(state);const drill=drillById(drillId);if(!drill)throw new Error('Ejercicio inválido');
  const p=state.player,r=rngFor(`${state.season}|${state.week}|${p.name}|${drillId}|${attempt}|${state.player.trainingLog.length}`),ability=weightedAbility(p,drill.attrs),familiarity=drill.memories.reduce((s,k)=>s+memoryLevel(p,k),0)/drill.memories.length;
  const form=Number(p.form||0)*1.6,fitness=(Number(p.fitness??100)-75)*.10,variation=(r()+r()+r()-1.5)*10;
  const quality=clamp(Math.round(ability*.68+familiarity*.19+form+fitness+variation),35,98),reps=6+Math.floor(r()*6),successes=clamp(Math.round(reps*(.34+quality/155)+(r()-.5)*1.6),0,reps),grade=gradeFor(quality);
  return{drillId,quality,grade,reps,successes,ability:Math.round(ability),memoryBefore:Math.round(familiarity),seed:`${state.season}-${state.week}-${drillId}-${attempt}`};
}

function workThreshold(value){return 92+Math.max(0,Number(value)-45)*2.25;}
export function applyTrainingResult(state,result,calculateOverall=null){
  ensureTrainingMemory(state);const drill=drillById(result?.drillId);if(!drill)return{ok:false,message:'Ejercicio inválido'};
  if((state.progress?.trainingPoints??0)<=0)return{ok:false,message:'No quedan sesiones esta semana'};
  const p=state.player,oldSessions=p.trainingSummary.sessions||0,oldAvg=p.trainingSummary.avgGrade||0,gradeValue=GRADE_VALUE[result.grade]||1;
  const memoryGain=clamp(Math.round(2+result.quality/14+result.successes/result.reps*3),3,12);
  for(const key of drill.memories){const old=p.trainingMemory[key]||{familiarity:0,reps:0,quality:0,lastWeek:0};const nextFam=clamp(old.familiarity+memoryGain*(1-old.familiarity/135),0,100);p.trainingMemory[key]={familiarity:+nextFam.toFixed(1),reps:(old.reps||0)+result.reps,quality:+(((old.quality||result.quality)*.7)+result.quality*.3).toFixed(1),lastWeek:state.week};}
  const gained=[];for(const [attr,weight] of Object.entries(drill.attrs)){const xp=result.quality*result.reps*weight*.085;let work=(p.developmentWork[attr]||0)+xp,threshold=workThreshold(p[attr]);while(work>=threshold&&p[attr]<99&&p[attr]<(p.dynamicPotential??p.potential??96)+5){work-=threshold;p[attr]=clamp(p[attr]+1,30,99);gained.push(attr);threshold=workThreshold(p[attr]);}p.developmentWork[attr]=+work.toFixed(1);}
  p.trainingSummary={sessions:oldSessions+1,avgGrade:+((oldAvg*oldSessions+gradeValue)/(oldSessions+1)).toFixed(2),bestGrade:!p.trainingSummary.bestGrade||p.trainingSummary.bestGrade==='—'||gradeValue>(GRADE_VALUE[p.trainingSummary.bestGrade]||0)?result.grade:p.trainingSummary.bestGrade};
  p.trainingLog.unshift({season:state.season,week:state.week,drillId:drill.id,grade:result.grade,quality:result.quality,reps:result.reps,successes:result.successes,memoryGain});p.trainingLog=p.trainingLog.slice(0,30);
  state.progress.trainingPoints--;state.progress.xp=(state.progress.xp||0)+Math.round(12+result.quality*.28);state.campaign.coachTrust=clamp((state.campaign.coachTrust||50)+(result.grade==='S'?3:result.grade==='A'?2:result.grade==='B'?1:result.grade==='E'?-1:0),0,100);p.fitness=clamp((p.fitness??100)-(5+result.reps*.35),35,100);
  if(typeof calculateOverall==='function')p.rating=calculateOverall(p);
  const roster=state.world?.[state.clubId]?.roster,idx=roster?.findIndex(x=>x.isUser);if(idx>=0)roster[idx]=p;
  return{ok:true,gained,memoryGain,message:gained.length?`Sesión ${result.grade}. Mejoraste ${[...new Set(gained)].join(', ')}.`:`Sesión ${result.grade}. Sumaste memoria y trabajo de desarrollo.`};
}
