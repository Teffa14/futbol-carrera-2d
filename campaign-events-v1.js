import {adjustRelationship,ensureChemistryState,relationshipValue,syncCareerChemistryState,teamHierarchySnapshot} from './team-chemistry-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hashString(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function pick(list,seed){return list[hashString(seed)%list.length];}
function weekKey(state){return`s${state.season}-w${state.week}`;}
function absoluteWeek(season,week){return Number(season||1)*100+Number(week||1);}
function playerId(p){return String(p?.instanceId||p?.id||p?.name||'player');}
function roleFamily(pos){if(pos==='GK')return'GK';if(['CB','LB','RB','LWB','RWB'].includes(pos))return'DEF';if(['CDM','CM','CAM','LM','RM'].includes(pos))return'MID';return'FWD';}
function escName(p){return p?.name||'un compañero';}

function ensureMemory(player,key,amount,quality=70){player.trainingMemory??={};const old=player.trainingMemory[key]||{familiarity:0,reps:0,quality:0,lastWeek:0};player.trainingMemory[key]={familiarity:+clamp((old.familiarity||0)+amount,0,100).toFixed(1),reps:(old.reps||0)+Math.max(1,Math.round(amount)),quality:+Math.max(old.quality||0,quality).toFixed(1),lastWeek:0};}
export function ensureCampaignState(state){
  state.campaign??={coachTrust:50,lockerRoom:50,media:50,relationships:{},seenEvents:[],currentEvent:null,resolved:[]};
  const c=state.campaign;c.relationships??={};c.seenEvents??=[];c.resolved??=[];c.weekDecisions??={};c.eventHistory??=[];c.currentEvent??=null;
  for(const old of c.resolved){if(old?.season&&old?.week){const key=`s${old.season}-w${old.week}`;c.weekDecisions[key]??={resolved:true,eventId:old.eventId,choiceId:old.choiceId,choiceLabel:old.choiceLabel||old.choiceId};}}
  ensureChemistryState(state);return c;
}

function roster(state){return(state.world?.[state.clubId]?.roster||[]).filter(p=>!p.isUser);}
function hierarchyMate(state){const snap=teamHierarchySnapshot(state,8);const top=snap.find(p=>!p.isUser);return roster(state).find(p=>playerId(p)===top?.id)||roster(state)[0]||null;}
function sameUnitMate(state){const fam=roleFamily(state.player?.position),list=roster(state).filter(p=>roleFamily(p.position)===fam).sort((a,b)=>relationshipValue(state,playerId(b))-relationshipValue(state,playerId(a))||b.rating-a.rating);return list[0]||hierarchyMate(state);}
function lowChemMate(state){return[...roster(state)].sort((a,b)=>relationshipValue(state,playerId(a))-relationshipValue(state,playerId(b))||b.rating-a.rating)[0]||null;}
function positionalRival(state){return[...roster(state)].filter(p=>p.position===state.player?.position).sort((a,b)=>b.rating-a.rating)[0]||sameUnitMate(state);}
function veteran(state){return[...roster(state)].filter(p=>Number(p.age||0)>=28).sort((a,b)=>b.rating-a.rating)[0]||hierarchyMate(state);}
function youngster(state){return[...roster(state)].filter(p=>Number(p.age||99)<=22).sort((a,b)=>b.potential-a.potential||b.rating-a.rating)[0]||sameUnitMate(state);}

function staticEvent(id,title,body,choices,cooldown=4,weight=1){return{id,title,body,choices,cooldown,weight};}
function withMate(base,mate){return mate?{...base,teammateId:playerId(mate),teammateName:mate.name}:base;}

function eventPool(state){
  const p=state.player,last=state.lastMatch,perf=last?.userPerformance||null,status=last?.squadStatus,star=hierarchyMate(state),unit=sameUnitMate(state),low=lowChemMate(state),rival=positionalRival(state),vet=veteran(state),kid=youngster(state),events=[];
  events.push(staticEvent('role-video','Revisión de rol con el DT','El cuerpo técnico te muestra tres secuencias de tu último partido. Quiere una respuesta concreta sobre cómo interpretar tu rol.',[
    {id:'discipline',label:'Priorizar la estructura',text:'Primero cumplir la zona y el timing pedido; improvisar sólo cuando la jugada lo habilita.',effects:{coachTrust:3,lockerRoom:1,memories:{'scan-before-receive':4,'timed-run':3},instructions:{risk:-2}}},
    {id:'freedom',label:'Pedir más libertad',text:'Aceptás el rol, pero pedís margen para romperlo cuando veas una ventaja real.',effects:{coachTrust:-1,media:1,memories:{'scan-before-receive':3},instructions:{risk:4}}},
  ],4,1.2));
  events.push(withMate(staticEvent('extra-combination',`${escName(unit)} quiere quedarse después de entrenar`,`Te propone repetir una secuencia específica hasta que ambos reconozcan el mismo momento de pase y ruptura.`,[
    {id:'stay',label:'Quedarme y repetirla',text:'Ganás sincronización con él, pero llegás más cargado al resto de la semana.',effects:{relationship:5,lockerRoom:2,fitness:-4,memories:{'wall-pass':5,'third-man':4,'timed-run':3}}},
    {id:'short',label:'Hacer sólo cinco repeticiones',text:'Mejorás algo la coordinación sin gastar tanto físico.',effects:{relationship:2,fitness:-1,memories:{'wall-pass':2}}},
    {id:'leave',label:'Priorizar recuperación',text:'Cuidás piernas, pero perdés una oportunidad de construir sociedad.',effects:{relationship:-1,fitness:5}},
  ],3,1.25),unit));
  events.push(withMate(staticEvent('star-service',`${escName(star)} te pide una charla`,`Es uno de los futbolistas de mayor jerarquía del plantel. Te dice que algunas jugadas se rompen porque el equipo no reconoce cuándo acelerar hacia él.`,[
    {id:'adapt',label:'Aprender sus señales',text:'Ajustás tus apoyos para conectarte mejor con el referente sin forzar cada pelota.',effects:{relationship:4,lockerRoom:2,memories:{'scan-runner':4,'combination':3}}},
    {id:'balanced',label:'Decirle que no todo pasa por él',text:'Defendés una circulación más repartida. Puede ayudar al equipo, pero enfría la relación personal.',effects:{relationship:-3,coachTrust:1,lockerRoom:1}},
    {id:'feed',label:'Prometer buscarlo más',text:'La sociedad mejora, pero asumís una tendencia más vertical y previsible.',effects:{relationship:5,instructions:{risk:3},lockerRoom:-1}},
  ],6,1.05),star));
  events.push(withMate(staticEvent('repair-link',`La conexión con ${escName(low)} no está funcionando`,`En video aparecen dos movimientos donde uno esperaba una cosa y el otro hizo otra. No es un problema de técnica: es sincronización.`,[
    {id:'talk',label:'Hablar y definir señales',text:'Aclaran cuándo venir, cuándo romper y qué gesto significa que el pase sale.',effects:{relationship:6,coachTrust:1,memories:{'combination':4,'scan-runner':3}}},
    {id:'football',label:'Resolverlo jugando',text:'No hacen una charla formal. Priorizan más repeticiones juntos.',effects:{relationship:3,fitness:-2,memories:{'wall-pass':3}}},
    {id:'ignore',label:'No darle importancia',text:'Confiás en que se acomode solo. La falta de coordinación puede durar.',effects:{relationship:-3}},
  ],5,1.1),low));
  events.push(withMate(staticEvent('position-competition',`${escName(rival)} compite por tu zona`,`El entrenamiento deja claro que ambos pelean por minutos o responsabilidades parecidas. El vestuario observa cómo manejás esa competencia.`,[
    {id:'compete',label:'Competir sin esconder nada',text:'Entrenás fuerte y mantenés una relación profesional.',effects:{relationship:1,coachTrust:2,fitness:-2}},
    {id:'help',label:'Compartir información',text:'Le explicás una lectura táctica que te funciona. Mejoran como unidad aunque la competencia siga.',effects:{relationship:4,lockerRoom:3,coachTrust:1}},
    {id:'distance',label:'Marcar distancia',text:'Protegés tu espacio personal, pero el vínculo se enfría.',effects:{relationship:-4,lockerRoom:-1}},
  ],7,.85),rival));
  events.push(withMate(staticEvent('veteran-advice',`${escName(vet)} te frena al salir`,`El veterano te señala un detalle de ritmo: a veces acelerás una jugada antes de que el bloque esté listo.`,[
    {id:'listen',label:'Escucharlo y revisar video',text:'Ganás lectura colectiva y mejor relación con un referente del vestuario.',effects:{relationship:4,lockerRoom:2,memories:{'scan-before-receive':4,'combination':3}}},
    {id:'own',label:'Mantener mi interpretación',text:'Creés que ese riesgo forma parte de tu juego.',effects:{relationship:-1,instructions:{risk:3}}},
  ],6,.8),vet));
  events.push(withMate(staticEvent('help-youngster',`${escName(kid)} te pide ayuda`,`Un compañero joven quiere entender una secuencia que vos ya trabajaste más. Ayudarlo consume tiempo de tu propia preparación.`,[
    {id:'teach',label:'Quedarme a explicarla',text:'El vínculo y el vestuario mejoran. Tu sesión personal pierde algo de recuperación.',effects:{relationship:5,lockerRoom:3,fitness:-2,memories:{'third-man':2}}},
    {id:'quick',label:'Darle una explicación corta',text:'Ayudás sin cambiar demasiado tu planificación.',effects:{relationship:2,lockerRoom:1}},
    {id:'no',label:'Seguir con mi trabajo',text:'No hay conflicto abierto, pero perdés una oportunidad de construir vínculo.',effects:{relationship:-1}},
  ],7,.75),kid));
  events.push(staticEvent('recovery-choice','El preparador físico te da dos caminos',`Llegás a la sesión con ${Math.round(p?.fitness??100)}% de condición. El cuerpo técnico te deja elegir cómo administrar la carga.`,[
    {id:'recover',label:'Recuperación completa',text:'Llegás más fresco al partido, pero resignás una parte del trabajo extra.',effects:{fitness:8,coachTrust:-1}},
    {id:'normal',label:'Carga normal',text:'Mantenés el plan sin buscar un beneficio inmediato.',effects:{fitness:1,coachTrust:1}},
    {id:'extra',label:'Carga alta',text:'Sumás repeticiones tácticas, con riesgo de llegar más cansado.',effects:{fitness:-6,coachTrust:2,memories:{'timed-run':3,'scan-before-receive':3}}},
  ],3,Number(p?.fitness??100)<78?1.8:.65));
  events.push(staticEvent('media-role','Pregunta incómoda en zona mixta','Un periodista pregunta si el equipo debería darte más protagonismo con pelota.',[
    {id:'team',label:'“La jugada decide quién recibe”',text:'Quitás presión pública y defendés la estructura colectiva.',effects:{media:1,lockerRoom:3,fans:25}},
    {id:'self',label:'“Puedo asumir más”',text:'Te exponés y aumentás tu perfil. Algunos compañeros lo toman como reclamo.',effects:{media:4,lockerRoom:-3,fans:120,reputation:1}},
    {id:'coach',label:'“Eso lo define el DT”',text:'Respaldás la autoridad del entrenador, aunque la respuesta sea menos atractiva para prensa.',effects:{coachTrust:3,media:-1}},
  ],4,1));
  events.push(staticEvent('locker-credit','El vestuario discute una jugada clave','Hay tensión sobre quién tomó la decisión correcta en una secuencia que terminó mal. Podés intervenir o dejarla pasar.',[
    {id:'own',label:'Asumir mi parte',text:'Bajás la tensión y ganás credibilidad interna.',effects:{lockerRoom:4,media:-1}},
    {id:'collective',label:'Hablar de la secuencia, no de culpables',text:'Intentás convertir el error en una lectura compartida.',effects:{lockerRoom:3,coachTrust:2,memories:{'combination':2}}},
    {id:'silent',label:'No meterme',text:'No asumís costo inmediato, pero tampoco ayudás a resolver el problema.',effects:{lockerRoom:-1}},
  ],5,.9));
  events.push(staticEvent('tactical-change','Nueva idea para el próximo partido','El cuerpo técnico prueba una variante y te pide elegir qué lectura vas a priorizar.',[
    {id:'direct',label:'Atacar la primera ventana',text:'Ruptura y pase vertical cuando el rival todavía está reorganizándose.',effects:{coachTrust:2,memories:{'through-ball':4,'timed-run':4},instructions:{risk:4}}},
    {id:'patient',label:'Atraer antes de acelerar',text:'Esperar que el rival salte para abrir el espacio siguiente.',effects:{coachTrust:3,memories:{'combination':4,'third-man':4,'scan-before-receive':3},instructions:{risk:-2}}},
  ],5,1.05));
  if(['ST','LW','RW','CAM'].includes(p?.position))events.push(staticEvent('attacker-detail','El DT corrige tu altura','En ataque posicional estás alternando entre venir demasiado pronto y quedar fuera de la jugada. Te pide elegir una referencia.',[
    {id:'depth',label:'Fijar y atacar espalda',text:'Quedarte alto hasta que el pasador tenga tiempo real para encontrarte.',effects:{coachTrust:2,memories:{'timed-run':5,'through-ball':3,'box-run':2}}},
    {id:'link',label:'Bajar para tercer hombre',text:'Venir sólo cuando el apoyo habilite una combinación y volver a romper.',effects:{coachTrust:2,lockerRoom:1,memories:{'third-man':5,'wall-pass':4}}},
  ],5,1.2));
  if(['CB','LB','RB','CDM','GK'].includes(p?.position))events.push(staticEvent('defensive-detail','Reunión de la última línea','El cuerpo técnico quiere definir cómo vas a reaccionar cuando un compañero salta a presionar y queda espacio a su espalda.',[
    {id:'cover',label:'Priorizar cobertura',text:'Cerrás primero la línea peligrosa y recién después atacás la pelota.',effects:{coachTrust:3,memories:{'counterpress':2,'scan-before-receive':3}}},
    {id:'step',label:'Saltar agresivo',text:'Buscás cortar antes, aceptando más riesgo a tu espalda.',effects:{coachTrust:1,instructions:{risk:3}}},
  ],5,1.15));
  if(status&&status!=='starter')events.push(staticEvent('bench-reaction','Te toca esperar','El DT no te puso de inicio. La prensa quiere saber si estás conforme con tu lugar.',[
    {id:'work',label:'“Tengo que ganármelo”',text:'Bajás el ruido y devolvés la discusión al entrenamiento.',effects:{coachTrust:4,media:1,fans:35}},
    {id:'pressure',label:'“Quiero jugar ya”',text:'Aumentás presión pública. Puede darte visibilidad, pero afecta la relación interna.',effects:{coachTrust:-5,media:4,lockerRoom:-2,fans:150,reputation:1}},
  ],3,1.8));
  if(perf&&Number(perf.rating||0)>=7.4)events.push(staticEvent('good-match-credit','Después de un buen partido llegan elogios','Tu actuación genera titulares. Te preguntan cuánto de lo que pasó fue mérito individual.',[
    {id:'share',label:'Repartir el mérito',text:'Nombrás a los compañeros que te dieron soluciones y mejorás el clima interno.',effects:{lockerRoom:4,media:1,fans:60}},
    {id:'own',label:'Reivindicar mi nivel',text:'Capitalizás el momento para crecer en perfil público.',effects:{media:4,lockerRoom:-2,fans:180,reputation:1}},
  ],5,1.7));
  if(perf&&Number(perf.rating||6)<5.9)events.push(staticEvent('poor-match-response','El partido dejó preguntas','Tu rendimiento estuvo por debajo de lo esperado. El DT quiere saber cómo vas a responder durante la semana.',[
    {id:'review',label:'Pedir video y corregir',text:'Convertís el mal partido en trabajo específico.',effects:{coachTrust:3,fitness:-1,memories:{'scan-before-receive':3}}},
    {id:'reset',label:'Cerrar el partido y recuperar',text:'Priorizás limpiar la cabeza y llegar fresco.',effects:{fitness:6,coachTrust:-1}},
    {id:'excuse',label:'Señalar que faltaron apoyos',text:'Desplazás parte de la responsabilidad hacia el equipo.',effects:{media:2,lockerRoom:-4,coachTrust:-2}},
  ],4,1.8));
  return events.filter(e=>e&&e.choices?.length);
}

function eligibleEvents(state,pool){
  const c=ensureCampaignState(state),now=absoluteWeek(state.season,state.week),history=c.eventHistory||[],lastIds=history.slice(-2).map(x=>x.eventId),eligible=pool.filter(e=>{
    const last=[...history].reverse().find(x=>x.eventId===e.id);if(last&&now-absoluteWeek(last.season,last.week)<Number(e.cooldown||3))return false;if(lastIds.includes(e.id))return false;return true;
  });return eligible.length?eligible:pool.filter(e=>!lastIds.includes(e.id)).length?pool.filter(e=>!lastIds.includes(e.id)):pool;
}
function weightedPick(events,seed){const expanded=[];for(const e of events){const n=clamp(Math.round((e.weight||1)*4),1,10);for(let i=0;i<n;i++)expanded.push(e);}return pick(expanded,seed);}

export function getWeeklyInteraction(state){
  if(!state||state.seasonComplete)return null;const c=ensureCampaignState(state),key=weekKey(state);if(c.weekDecisions[key]?.resolved)return null;
  if(c.currentEvent?.weekKey===key&&!c.currentEvent.resolved)return c.currentEvent;
  if(c.currentEvent?.weekKey!==key)c.currentEvent=null;
  syncCareerChemistryState(state);const pool=eligibleEvents(state,eventPool(state)),template=weightedPick(pool,`${key}|${state.player?.name}|${state.clubId}|${c.eventHistory.length}`),event={...template,choices:template.choices.map(x=>({...x,effects:{...(x.effects||{})}})),weekKey:key,resolved:false};c.currentEvent=event;if(!c.seenEvents.includes(`${key}:${event.id}`))c.seenEvents.push(`${key}:${event.id}`);return event;
}

export function weeklyDecisionGate(state){
  if(!state||state.seasonComplete)return{ok:true,required:false,key:state?weekKey(state):null,event:null};const c=ensureCampaignState(state),key=weekKey(state),done=c.weekDecisions[key];if(done?.resolved)return{ok:true,required:true,resolved:true,key,decision:done,event:null};const event=getWeeklyInteraction(state);return{ok:false,required:true,resolved:false,key,event,message:'Resolvé el momento de carrera de esta semana antes de jugar el partido.'};
}
export function resolvedDecisionForWeek(state){const c=ensureCampaignState(state);return c.weekDecisions?.[weekKey(state)]||null;}

export function resolveInteraction(state,choiceId){
  const c=ensureCampaignState(state),event=c.currentEvent,key=weekKey(state);if(c.weekDecisions[key]?.resolved)return{ok:false,message:'La decisión de esta semana ya fue tomada'};if(!event||event.weekKey!==key||event.resolved)return{ok:false,message:'No hay decisión pendiente'};const choice=event.choices.find(x=>x.id===choiceId);if(!choice)return{ok:false,message:'Opción inválida'};const e=choice.effects||{},p=state.player;
  c.coachTrust=clamp((c.coachTrust||50)+(e.coachTrust||0),0,100);c.lockerRoom=clamp((c.lockerRoom||50)+(e.lockerRoom||0),0,100);c.media=clamp((c.media||50)+(e.media||0),0,100);state.progress.fans=Math.max(0,(state.progress.fans||0)+(e.fans||0));state.progress.reputation=Math.max(0,(state.progress.reputation||0)+(e.reputation||0));p.fitness=clamp((p.fitness??100)+(e.fitness||0),30,100);
  for(const [memory,val] of Object.entries(e.memories||{}))ensureMemory(p,memory,val,72);for(const [instruction,val] of Object.entries(e.instructions||{})){p.instructions??={risk:55,shoot:55,dribble:60};p.instructions[instruction]=clamp((p.instructions[instruction]??50)+val,0,100);}
  if(event.teammateId&&Number(e.relationship||0)!==0)adjustRelationship(state,event.teammateId,Number(e.relationship),'career-choice');for(const [mateId,val] of Object.entries(e.relationships||{}))adjustRelationship(state,mateId,val,'career-choice');
  event.resolved=true;event.choiceId=choice.id;c.weekDecisions[key]={resolved:true,eventId:event.id,choiceId:choice.id,choiceLabel:choice.label,title:event.title,teammateId:event.teammateId||null};c.resolved.push({season:state.season,week:state.week,eventId:event.id,choiceId:choice.id,choiceLabel:choice.label});c.eventHistory.push({season:state.season,week:state.week,eventId:event.id,choiceId:choice.id});c.eventHistory=c.eventHistory.slice(-80);c.currentEvent=null;
  syncCareerChemistryState(state);const roster=state.world?.[state.clubId]?.roster,idx=roster?.findIndex(x=>x.isUser);if(idx>=0)roster[idx]=p;return{ok:true,message:choice.label,choice,decision:c.weekDecisions[key]};
}

export const __campaignTest={eventPool,eligibleEvents,weekKey,absoluteWeek};
