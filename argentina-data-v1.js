import {POSITIONS,BUILDS,SKILLS} from './data.js';

const upsert=(list,item)=>{const i=list.findIndex(x=>x.id===item.id);if(i>=0)Object.assign(list[i],item);else list.push(item);};

upsert(POSITIONS,{id:'GK',name:'Arquero'});

const OUTFIELD={
  finisher:{name:'Definidor',desc:'Ataca el área, se perfila rápido y prioriza el remate.',positions:'outfield',runtime:{shooting:8,composure:6,shotBias:.18}},
  creator:{name:'Armador',desc:'Levanta la cabeza, filtra pases y acelera la jugada con pelota.',positions:'outfield',runtime:{passing:7,vision:9,ballControl:3,passBias:.18}},
  technician:{name:'Gambeteador',desc:'Conducción corta, cambio de ritmo, giro y uno contra uno.',positions:'outfield',runtime:{dribbling:9,ballControl:9,pace:2,turning:10,dribbleBias:.20}},
  engine:{name:'Todoterreno',desc:'Sostiene intensidad, repite esfuerzos y llega a las dos áreas.',positions:'outfield',runtime:{stamina:11,physical:4,pace:3,fatigueDrain:.72}},
  'ball-winner':{name:'Recuperador',desc:'Anticipa, mete el cuerpo y gana segundas pelotas.',positions:'outfield',runtime:{defense:10,physical:8,stamina:5,duel:10}},
  speedster:{name:'Picante',desc:'Arranque, cambio de ritmo y ruptura con metros por delante.',positions:'outfield',runtime:{pace:10,dribbling:5,acceleration:11,sprint:7,dribbleBias:.12}},
  target:{name:'Nueve de área',desc:'Fija centrales, protege, descarga y define dentro del área.',positions:'outfield',runtime:{physical:10,shooting:6,ballControl:5,composure:4,shield:12,shotBias:.10}},
};
for(const b of BUILDS){if(OUTFIELD[b.id])Object.assign(b,OUTFIELD[b.id]);}

upsert(BUILDS,{id:'shot-stopper',name:'Atajador',desc:'Reflejos, achique, manos firmes y respuesta en el rebote.',positions:['GK'],mods:{defense:10,composure:7,physical:4,ballControl:2,passing:-4,pace:-2},tendencies:{shoot:.1,dribble:.35,pass:.75},runtime:{defense:12,composure:9,physical:4,gkReflex:14,gkHandling:12}});
upsert(BUILDS,{id:'sweeper-keeper',name:'Arquero líbero',desc:'Juega adelantado, corta pelotas profundas y achica fuera del área chica.',positions:['GK'],mods:{pace:8,ballControl:6,passing:5,vision:5,defense:5,physical:-1},tendencies:{shoot:.1,dribble:.7,pass:1.1},runtime:{pace:9,ballControl:7,vision:6,gkSweep:15,acceleration:8}});
upsert(BUILDS,{id:'keeper-playmaker',name:'Arquero de juego',desc:'Primer pase, control y distribución para iniciar ataques desde el fondo.',positions:['GK'],mods:{passing:10,vision:8,ballControl:7,composure:5,defense:3,pace:-2},tendencies:{shoot:.1,dribble:.55,pass:1.4},runtime:{passing:11,vision:10,ballControl:8,composure:5,gkDistribution:15}});

upsert(SKILLS,{id:'safe-hands',name:'Manos seguras',desc:'Amortigua remates y deja menos rebotes peligrosos.',effects:{gkHandling:12}});
upsert(SKILLS,{id:'keeper-reflex',name:'Reflejo corto',desc:'Reacciona antes en remates cercanos y desvíos.',effects:{gkReflex:12}});
upsert(SKILLS,{id:'sweeper-reader',name:'Lectura de líbero',desc:'Mejora la salida a pelotas profundas detrás de la defensa.',effects:{gkSweep:12}});
upsert(SKILLS,{id:'keeper-pass',name:'Salida limpia',desc:'Mejora control y distribución con los pies.',effects:{pass:8,gkDistribution:12}});

export function buildsForPosition(position){return BUILDS.filter(b=>position==='GK'?Array.isArray(b.positions)&&b.positions.includes('GK'):b.positions!=='outfield'?!(Array.isArray(b.positions)&&b.positions.includes('GK')):true);}
export function isGoalkeeperBuild(id){return['shot-stopper','sweeper-keeper','keeper-playmaker'].includes(id);}
