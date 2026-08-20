const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hashString(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function pick(list,seed){return list[hashString(seed)%list.length];}

function ensureMemory(player,key,amount,quality=70){player.trainingMemory??={};const old=player.trainingMemory[key]||{familiarity:0,reps:0,quality:0,lastWeek:0};player.trainingMemory[key]={familiarity:+clamp((old.familiarity||0)+amount,0,100).toFixed(1),reps:(old.reps||0)+Math.max(1,Math.round(amount)),quality:+Math.max(old.quality||0,quality).toFixed(1),lastWeek:0};}
export function ensureCampaignState(state){
  state.campaign??={coachTrust:50,lockerRoom:50,media:50,relationships:{},seenEvents:[],currentEvent:null,resolved:[]};
  state.campaign.relationships??={};state.campaign.seenEvents??=[];state.campaign.resolved??=[];return state.campaign;
}

const EVENTS={
  strikerMeeting:{id:'striker-meeting',title:'Reunión con el DT',body:'El entrenador te muestra video. Quiere decidir cómo vas a interpretar el puesto cuando el equipo progresa.',positions:['ST','LW','RW','CAM'],choices:[
    {id:'depth',label:'Atacar la espalda',text:'Quedarte alto, fijar y romper cuando el pasador levanta la cabeza.',effects:{coachTrust:3,memories:{'timed-run':5,'through-ball':3,'box-run':2},instructions:{risk:4}}},
    {id:'link',label:'Venir a asociarme',text:'Bajar sólo cuando el apoyo crea un tercer hombre y después atacar de nuevo.',effects:{coachTrust:2,lockerRoom:2,memories:{'third-man':5,'wall-pass':5,'scan-runner':3}}},
  ]},
  teammateSession:{id:'teammate-session',title:'Un compañero te busca después de la práctica',body:'Quiere quedarse diez minutos más ensayando una secuencia concreta con vos.',choices:[
    {id:'wall',label:'Pared + ruptura',text:'Repetir pase, devolución y ataque del espacio.',effects:{lockerRoom:4,fitness:-3,memories:{'wall-pass':6,'timed-run':4,'combination':3}}},
    {id:'wide',label:'Desborde + centro',text:'Ensayar cuándo soltar al corredor y cómo atacar el área.',effects:{lockerRoom:3,fitness:-3,memories:{overlap:5,cross:5,cutback:4,'far-post-run':3}}},
    {id:'rest',label:'Me voy a recuperar',text:'Priorizás piernas para el próximo partido.',effects:{fitness:6,coachTrust:-1}},
  ]},
  benchReaction:{id:'bench-reaction',title:'Te toca esperar',body:'El DT te deja afuera del XI. La prensa pregunta cómo reaccionás.',choices:[
    {id:'work',label:'“Tengo que ganármelo”',text:'Bajás el ruido y te enfocás en entrenar mejor.',effects:{coachTrust:4,media:2,fans:40}},
    {id:'pressure',label:'“Quiero jugar ya”',text:'Metés presión pública. Puede servir o puede costarte.',effects:{coachTrust:-6,media:5,fans:180,reputation:1}},
  ]},
  tacticalChange:{id:'tactical-change',title:'Nueva idea para el próximo partido',body:'El cuerpo técnico prueba una variante. Te pide una respuesta concreta antes de cerrar la charla.',choices:[
    {id:'direct',label:'Buscar profundidad rápido',text:'Más rupturas y pases verticales cuando aparece la ventana.',effects:{coachTrust:2,memories:{'through-ball':4,'timed-run':4},instructions:{risk:5}}},
    {id:'patient',label:'Atraer antes de acelerar',text:'Circular, fijar rivales y recién romper cuando se abre el espacio.',effects:{coachTrust:3,memories:{combination:5,'third-man':4,'scan-before-receive':4},instructions:{risk:-2}}},
  ]},
  mediaMoment:{id:'media-moment',title:'Micrófono después del partido',body:'Te preguntan por tu rol y por qué el equipo no siempre encuentra espacios.',choices:[
    {id:'team',label:'Hablar del equipo',text:'Defendés la idea colectiva y hablás de sincronizar movimientos.',effects:{lockerRoom:3,media:2,fans:50}},
    {id:'self',label:'Pedir más pelota',text:'Decís que podés marcar diferencias si te encuentran más.',effects:{lockerRoom:-2,media:4,fans:140,coachTrust:-1}},
  ]},
};

function eventPool(state){const pos=state.player?.position,last=state.lastMatch;const list=[];if(EVENTS.strikerMeeting.positions.includes(pos))list.push(EVENTS.strikerMeeting);list.push(EVENTS.teammateSession,EVENTS.tacticalChange,EVENTS.mediaMoment);if(last&&last.squadStatus&&last.squadStatus!=='starter')list.unshift(EVENTS.benchReaction);return list;}
export function getWeeklyInteraction(state){
  const c=ensureCampaignState(state),key=`s${state.season}-w${state.week}`;
  if(c.currentEvent?.weekKey===key&&!c.currentEvent.resolved)return c.currentEvent;
  const template=pick(eventPool(state),`${key}|${state.player?.name}|${state.clubId}`),event={...template,weekKey:key,resolved:false};c.currentEvent=event;if(!c.seenEvents.includes(`${key}:${event.id}`))c.seenEvents.push(`${key}:${event.id}`);return event;
}

export function resolveInteraction(state,choiceId){
  const c=ensureCampaignState(state),event=c.currentEvent;if(!event||event.resolved)return{ok:false,message:'No hay decisión pendiente'};const choice=event.choices.find(x=>x.id===choiceId);if(!choice)return{ok:false,message:'Opción inválida'};const e=choice.effects||{},p=state.player;
  c.coachTrust=clamp((c.coachTrust||50)+(e.coachTrust||0),0,100);c.lockerRoom=clamp((c.lockerRoom||50)+(e.lockerRoom||0),0,100);c.media=clamp((c.media||50)+(e.media||0),0,100);state.progress.fans=Math.max(0,(state.progress.fans||0)+(e.fans||0));state.progress.reputation=Math.max(0,(state.progress.reputation||0)+(e.reputation||0));p.fitness=clamp((p.fitness??100)+(e.fitness||0),30,100);
  for(const [key,val] of Object.entries(e.memories||{}))ensureMemory(p,key,val,72);for(const [key,val] of Object.entries(e.instructions||{})){p.instructions??={risk:55,shoot:55,dribble:60};p.instructions[key]=clamp((p.instructions[key]??50)+val,0,100);}
  event.resolved=true;event.choiceId=choice.id;c.resolved.push({season:state.season,week:state.week,eventId:event.id,choiceId:choice.id});c.currentEvent=null;
  const roster=state.world?.[state.clubId]?.roster,idx=roster?.findIndex(x=>x.isUser);if(idx>=0)roster[idx]=p;return{ok:true,message:choice.label,choice};
}
