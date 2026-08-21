import {DRILLS} from './training-memory-v1.js';
import {__identityProgressionV1} from './player-identity-progression-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const A=(attrs)=>attrs;
const M=(...markers)=>markers.map(([id,label])=>({id,label}));
const drill=(id,family,name,kind,desc,attrs,memories,markers,extra={})=>({
  id,family,name,kind,desc,attrs,memories,markers,frameworkVersion:2,duration:extra.duration||20,
  category:extra.category||'Técnica',identityWeights:extra.identityWeights||{},objective:extra.objective||desc,variant:extra.variant||null,
});

export function trainingFamily(position){
  if(position==='GK')return'GK';
  if(position==='ST')return'ST';
  if(['LW','RW','LM','RM'].includes(position))return'W';
  if(position==='CAM')return'CAM';
  if(['CB','LB','RB','LWB','RWB'].includes(position))return'DEF';
  return'MID';
}

const COMMON={
  decision:['decision','Decisión'],execution:['execution','Ejecución'],control:['control','Control'],timing:['timing','Timing'],
  space:['space','Espacio'],finish:['finish','Remate'],pass:['pass','Pase'],pressure:['pressure','Presión'],duel:['duel','Duelo'],
  scan:['scan','Lectura'],trajectory:['trajectory','Trayectoria'],save:['save','Atajada'],rebound:['rebound','Rebote'],coverage:['coverage','Cobertura'],
  distribution:['distribution','Salida'],height:['height','Altura'],curve:['curve','Efecto'],body:['body','Perfil'],continuity:['continuity','Continuidad'],
};

export const ROLE_DRILLS=[
  // STRIKER
  drill('st-profile-finish','ST','Definición perfilada','finish','Recibí, orientá el primer contacto y dejate el arco abierto antes de rematar.',A({shooting:.34,ballControl:.27,composure:.24,dribbling:.08,pace:.07}),['box-run','shot-selection','close-control','first-time-shot'],M(COMMON.body,COMMON.control,COMMON.finish,COMMON.decision,COMMON.execution),{category:'Definición',variant:'profile',identityWeights:{finishing:.64,movement:.16,duel:.12,combination:.08}}),
  drill('st-one-touch','ST','Definición de primera','finish','Atacá la trayectoria del pase y resolvé sin regalar un toque cuando la ventana ya está abierta.',A({shooting:.39,composure:.25,ballControl:.19,pace:.10,vision:.07}),['first-time-shot','box-run','far-post-run','shot-selection'],M(COMMON.timing,COMMON.trajectory,COMMON.body,COMMON.finish,COMMON.decision),{category:'Definición',variant:'one-touch',identityWeights:{finishing:.66,movement:.24,combination:.10}}),
  drill('st-run-behind','ST','Ruptura a la espalda','through','Fijá la última línea, temporizá y atacá el intervalo sólo cuando aparece la ventana.',A({pace:.27,vision:.23,composure:.20,stamina:.16,ballControl:.14}),['timed-run','scan-runner','box-run','burst-after-touch'],M(COMMON.scan,COMMON.timing,COMMON.space,COMMON.trajectory,COMMON.control),{category:'Movimiento',identityWeights:{movement:.72,finishing:.12,combination:.10,duel:.06}}),
  drill('st-wall-run','ST','Descarga y ruptura','2v2','Recibí apoyo, descargá simple y volvé a acelerar para aparecer del otro lado de la presión.',A({passing:.24,ballControl:.22,vision:.19,pace:.15,composure:.12,stamina:.08}),['wall-pass','third-man','timed-run','scan-before-receive'],M(COMMON.control,COMMON.pass,COMMON.continuity,COMMON.space,COMMON.timing),{category:'Asociación',identityWeights:{combination:.58,movement:.30,duel:.12}}),
  drill('st-box-duel','ST','Duelo de área','1v1','Protegé, girá o atacá un lado sin perder la pelota y terminá la ventaja.',A({physical:.24,ballControl:.23,dribbling:.20,composure:.18,shooting:.15}),['1v1','shield-turn','close-control','shot-selection'],M(COMMON.duel,COMMON.control,COMMON.body,COMMON.decision,COMMON.finish),{category:'Duelo',identityWeights:{duel:.58,finishing:.28,movement:.14}}),
  drill('st-press','ST','Presión del 9','3v3','Orientá la salida, acelerá en el disparador correcto y convertí la recuperación en ataque.',A({stamina:.26,pace:.20,vision:.18,defense:.16,composure:.12,physical:.08}),['counterpress','scan-before-receive','timed-run','combination'],M(COMMON.scan,COMMON.pressure,COMMON.timing,COMMON.space,COMMON.continuity),{category:'Sin pelota',identityWeights:{movement:.34,duel:.30,combination:.22,finishing:.14}}),
  drill('st-free-kick','ST','Tiro libre ofensivo','free-kick','Leé barrera y arquero. Elegí altura, salida y efecto antes del golpe.',A({shooting:.42,composure:.25,ballControl:.15,vision:.10,passing:.08}),['free-kick','shot-placement','set-piece-routine'],M(COMMON.scan,COMMON.body,COMMON.height,COMMON.curve,COMMON.finish),{category:'Pelota parada',identityWeights:{finishing:.72,combination:.18,movement:.10}}),

  // WINGERS
  drill('w-isolation','W','Aislamiento 1 contra 1','1v1','Recibí abierto, fijá al lateral y elegí salir por fuera o atacar el intervalo.',A({dribbling:.31,pace:.24,ballControl:.21,composure:.14,physical:.10}),['1v1','change-direction','burst-after-touch','close-control'],M(COMMON.scan,COMMON.duel,COMMON.control,COMMON.space,COMMON.execution),{category:'Desequilibrio',identityWeights:{duel:.68,movement:.20,width:.12}}),
  drill('w-wide-carry','W','Conducción de banda','cones','Encadená cambios de dirección sin perder velocidad útil ni separar demasiado la pelota.',A({dribbling:.31,ballControl:.29,pace:.22,stamina:.10,composure:.08}),['carry','close-control','change-direction','burst-after-touch'],M(COMMON.control,COMMON.body,COMMON.execution,COMMON.continuity,COMMON.timing),{category:'Desequilibrio',identityWeights:{duel:.60,width:.24,movement:.16}}),
  drill('w-cross-choice','W','Desborde y elección de centro','cross','Llegá con ventaja y elegí centro, segundo palo o pase atrás según el área.',A({passing:.27,vision:.24,ballControl:.17,pace:.14,composure:.10,stamina:.08}),['overlap','cross','cutback','far-post-run'],M(COMMON.scan,COMMON.space,COMMON.pass,COMMON.trajectory,COMMON.decision),{category:'Último tercio',identityWeights:{width:.62,combination:.18,movement:.14,duel:.06}}),
  drill('w-inside-finish','W','Diagonal y remate','finish','Atacá desde banda hacia dentro y resolvé con el cuerpo perfilado.',A({shooting:.30,dribbling:.22,ballControl:.18,pace:.14,composure:.12,vision:.04}),['box-run','shot-selection','change-direction','first-time-shot'],M(COMMON.space,COMMON.body,COMMON.control,COMMON.finish,COMMON.decision),{category:'Último tercio',identityWeights:{movement:.38,duel:.28,width:.18,combination:.16}}),
  drill('w-overlap-combine','W','Pared y desborde','2v2','Usá al compañero para liberar banda o medio espacio y seguí la acción.',A({passing:.24,vision:.22,pace:.18,ballControl:.18,composure:.10,stamina:.08}),['wall-pass','third-man','overlap','timed-run'],M(COMMON.pass,COMMON.continuity,COMMON.space,COMMON.timing,COMMON.control),{category:'Asociación',identityWeights:{combination:.48,width:.30,movement:.22}}),
  drill('w-counterpress','W','Pérdida y contrapresión','3v3','Tras perderla, cerrá la salida más peligrosa antes de volver a abrirte.',A({stamina:.25,pace:.19,defense:.17,vision:.16,composure:.13,physical:.10}),['counterpress','scan-before-receive','combination'],M(COMMON.pressure,COMMON.scan,COMMON.space,COMMON.timing,COMMON.continuity),{category:'Sin pelota',identityWeights:{movement:.34,combination:.30,duel:.22,width:.14}}),

  // ATTACKING MIDFIELDER
  drill('cam-scan-receive','CAM','Recibir entre líneas','2v2','Escaneá antes de recibir, orientá el primer contacto y atacá la ventaja creada.',A({vision:.28,ballControl:.25,composure:.19,passing:.17,dribbling:.11}),['scan-before-receive','close-control','third-man','press-resistance'],M(COMMON.scan,COMMON.body,COMMON.control,COMMON.space,COMMON.decision),{category:'Recepción',identityWeights:{reception:.54,creation:.24,combination:.22}}),
  drill('cam-through','CAM','Pase filtrado','through','Detectá el desmarque y soltá la pelota en el momento que rompe la línea.',A({vision:.34,passing:.32,composure:.18,ballControl:.10,stamina:.06}),['through-ball','scan-runner','timed-run'],M(COMMON.scan,COMMON.timing,COMMON.pass,COMMON.space,COMMON.trajectory),{category:'Creación',identityWeights:{creation:.68,combination:.18,arrival:.14}}),
  drill('cam-third-man','CAM','Tercer hombre','3v3','Mové la presión y encontrá al jugador que aparece después de la primera descarga.',A({vision:.27,passing:.25,ballControl:.18,composure:.15,stamina:.10,dribbling:.05}),['third-man','combination','scan-before-receive','wall-pass'],M(COMMON.scan,COMMON.pass,COMMON.space,COMMON.continuity,COMMON.decision),{category:'Creación',identityWeights:{creation:.42,combination:.40,reception:.18}}),
  drill('cam-edge-finish','CAM','Llegada desde segunda línea','finish','Llegá por detrás del delantero y resolvé desde una zona limpia.',A({shooting:.29,vision:.20,composure:.20,pace:.12,ballControl:.12,stamina:.07}),['box-run','timed-run','shot-selection','first-time-shot'],M(COMMON.timing,COMMON.space,COMMON.body,COMMON.finish,COMMON.decision),{category:'Llegada',identityWeights:{arrival:.58,creation:.20,reception:.12,combination:.10}}),
  drill('cam-pressure-escape','CAM','Giro bajo presión','1v1','Usá perfil, control y engaño para salir de la marca sin regalar la siguiente acción.',A({ballControl:.28,dribbling:.24,composure:.22,vision:.14,physical:.12}),['press-resistance','shield-turn','close-control','scan-before-receive'],M(COMMON.scan,COMMON.control,COMMON.body,COMMON.duel,COMMON.continuity),{category:'Recepción',identityWeights:{reception:.62,combination:.22,creation:.16}}),
  drill('cam-free-kick','CAM','Tiro libre creativo','free-kick','Leé barrera y arquero y ejecutá la solución de mayor valor, no siempre el mismo rincón.',A({shooting:.34,vision:.20,composure:.22,ballControl:.12,passing:.12}),['free-kick','shot-placement','set-piece-routine'],M(COMMON.scan,COMMON.decision,COMMON.height,COMMON.curve,COMMON.execution),{category:'Pelota parada',identityWeights:{creation:.34,arrival:.30,reception:.18,combination:.18}}),

  // CENTRAL MIDFIELD
  drill('mid-tempo','MID','Ritmo y circulación','3v3','Elegí cuándo asegurar, cuándo acelerar y qué línea conviene romper.',A({passing:.27,vision:.27,composure:.17,ballControl:.14,stamina:.10,defense:.05}),['combination','scan-before-receive','third-man','through-ball'],M(COMMON.scan,COMMON.decision,COMMON.pass,COMMON.space,COMMON.continuity),{category:'Organización',identityWeights:{creation:.42,support:.34,reception:.16,arrival:.08}}),
  drill('mid-linebreak','MID','Romper línea con pase','through','Reconocé al receptor entre líneas y pesá el pase para que pueda continuar.',A({passing:.34,vision:.32,composure:.18,ballControl:.10,stamina:.06}),['through-ball','scan-runner','third-man'],M(COMMON.scan,COMMON.pass,COMMON.trajectory,COMMON.space,COMMON.decision),{category:'Organización',identityWeights:{creation:.66,support:.20,reception:.14}}),
  drill('mid-support','MID','Ángulos de apoyo','2v2','Ofrecé una línea útil, recibí perfilado y volvé a aparecer después de pasar.',A({vision:.25,passing:.23,ballControl:.20,composure:.15,stamina:.11,pace:.06}),['wall-pass','combination','scan-before-receive','third-man'],M(COMMON.space,COMMON.scan,COMMON.control,COMMON.pass,COMMON.continuity),{category:'Apoyo',identityWeights:{support:.56,reception:.25,creation:.19}}),
  drill('mid-pressure-escape','MID','Salir de presión','1v1','Protegé la pelota, girá hacia el lado libre y conservá una siguiente acción útil.',A({ballControl:.28,composure:.22,dribbling:.18,physical:.14,vision:.12,pace:.06}),['press-resistance','shield-turn','close-control'],M(COMMON.scan,COMMON.control,COMMON.duel,COMMON.body,COMMON.continuity),{category:'Recepción',identityWeights:{reception:.58,support:.22,creation:.12,arrival:.08}}),
  drill('mid-counterpress','MID','Contrapresión y segunda pelota','3v3','Reaccioná a la pérdida, cerrá pase interior y atacá la segunda jugada.',A({stamina:.25,defense:.20,vision:.19,pace:.12,physical:.12,composure:.12}),['counterpress','scan-before-receive','timed-run'],M(COMMON.pressure,COMMON.scan,COMMON.coverage,COMMON.timing,COMMON.continuity),{category:'Sin pelota',identityWeights:{support:.36,arrival:.28,reception:.18,creation:.18}}),

  // DEFENDERS
  drill('def-1v1','DEF','Defender 1 contra 1','def-1v1','Controlá distancia y perfil. No regales el centro ni saltes antes de tiempo.',A({defense:.31,pace:.19,physical:.19,composure:.14,vision:.10,stamina:.07}),['defensive-1v1','scan-before-receive','counterpress'],M(COMMON.scan,COMMON.body,COMMON.duel,COMMON.timing,COMMON.execution),{category:'Defensa',identityWeights:{defending:.64,coverage:.20,duel:.16}}),
  drill('def-cover','DEF','Cobertura y profundidad','def-cover','Leé al poseedor y al corredor. Protegé la espalda del compañero antes de saltar.',A({defense:.29,vision:.23,pace:.17,composure:.15,stamina:.10,physical:.06}),['cover-depth','scan-runner','counterpress'],M(COMMON.scan,COMMON.coverage,COMMON.space,COMMON.timing,COMMON.decision),{category:'Defensa',identityWeights:{coverage:.62,defending:.26,build:.12}}),
  drill('def-build','DEF','Salida bajo presión','def-build','Recibí del arquero o central, perfilate y encontrá el primer pase que supera presión.',A({passing:.27,vision:.25,ballControl:.22,composure:.17,defense:.05,physical:.04}),['scan-before-receive','third-man','press-resistance','through-ball'],M(COMMON.scan,COMMON.body,COMMON.control,COMMON.pass,COMMON.decision),{category:'Salida',identityWeights:{build:.64,coverage:.16,duel:.10,defending:.10}}),
  drill('def-recovery','DEF','Carrera de recuperación','def-cover','Defendé hacia tu arco sin perseguir la pelota: recuperá línea y cerrá el pase más peligroso.',A({pace:.24,defense:.24,stamina:.18,vision:.15,composure:.11,physical:.08}),['cover-depth','timed-run','counterpress'],M(COMMON.timing,COMMON.coverage,COMMON.space,COMMON.pressure,COMMON.execution),{category:'Defensa',variant:'recovery',identityWeights:{coverage:.54,defending:.30,duel:.16}}),
  drill('def-duel','DEF','Duelo y segunda pelota','def-1v1','Ganale la posición al atacante y preparate para la pelota que queda viva.',A({physical:.27,defense:.27,composure:.16,pace:.12,vision:.10,stamina:.08}),['shield-turn','second-ball','defensive-1v1'],M(COMMON.body,COMMON.duel,COMMON.timing,COMMON.coverage,COMMON.continuity),{category:'Duelo',variant:'second-ball',identityWeights:{duel:.52,defending:.30,coverage:.18}}),

  // GOALKEEPERS
  drill('gk-shots','GK','Atajada y set','gk-shot','Ajustá el set según pelota y rematador. Llegá con el cuerpo estable al contacto.',A({defense:.34,composure:.24,pace:.13,vision:.12,physical:.10,ballControl:.07}),['keeper-set','shot-placement','reaction-save'],M(COMMON.scan,COMMON.body,COMMON.save,COMMON.execution,COMMON.rebound),{category:'Atajada',identityWeights:{saving:.72,composure:.18,sweeping:.10}}),
  drill('gk-rebounds','GK','Control del rebote','gk-shot','Atajá sin devolver la pelota al centro. Priorizá costado o segunda intervención.',A({defense:.30,composure:.25,ballControl:.14,vision:.12,physical:.11,pace:.08}),['reaction-save','keeper-rebound','second-ball'],M(COMMON.save,COMMON.rebound,COMMON.body,COMMON.decision,COMMON.continuity),{category:'Atajada',variant:'rebound',identityWeights:{saving:.56,composure:.34,sweeping:.10}}),
  drill('gk-cross','GK','Centro y dominio del área','gk-cross','Leé trayectoria, tráfico y punto de caída. Salí sólo cuando llegás con ventaja.',A({vision:.24,defense:.23,composure:.20,pace:.12,physical:.12,ballControl:.09}),['cross-read','keeper-set','scan-runner'],M(COMMON.scan,COMMON.trajectory,COMMON.timing,COMMON.save,COMMON.decision),{category:'Área',identityWeights:{composure:.40,saving:.32,sweeping:.28}}),
  drill('gk-sweep','GK','Arquero líbero','gk-sweep','Leé el pase profundo y decidí si atacar la pelota o proteger el arco.',A({pace:.22,vision:.25,composure:.20,defense:.15,ballControl:.10,passing:.08}),['sweeper-read','timed-run','scan-runner'],M(COMMON.scan,COMMON.timing,COMMON.space,COMMON.control,COMMON.decision),{category:'Área',identityWeights:{sweeping:.68,composure:.18,distribution:.14}}),
  drill('gk-distribution','GK','Primera salida','gk-distribution','Después de controlar, encontrá una salida que supere la primera presión sin rifarla.',A({passing:.29,vision:.28,ballControl:.18,composure:.17,pace:.04,stamina:.04}),['keeper-distribution','scan-before-receive','through-ball','third-man'],M(COMMON.scan,COMMON.control,COMMON.distribution,COMMON.space,COMMON.decision),{category:'Salida',identityWeights:{distribution:.70,composure:.18,sweeping:.12}}),
];

// The legacy list remains the shared persistence API, but its contents are now the v2 catalogue.
if(!DRILLS.some(d=>d?.frameworkVersion===2))DRILLS.splice(0,DRILLS.length,...ROLE_DRILLS);

// Identity progression consumes the same evidence instead of requiring a parallel perk system.
const identityWeights=__identityProgressionV1?.DRILL_BRANCH_WEIGHTS;
if(identityWeights){for(const d of ROLE_DRILLS)identityWeights[d.id]={...d.identityWeights};}

export function trainingCatalogFor(player){const family=trainingFamily(player?.position);return ROLE_DRILLS.filter(d=>d.family===family);}
export function trainingDrillById(id){return ROLE_DRILLS.find(d=>d.id===id)||null;}
export function primaryTrainingStats(drill,limit=4){return Object.entries(drill?.attrs||{}).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([id,weight])=>({id,weight}));}
export function recommendedTrainingDrills(player,limit=3){
  return trainingCatalogFor(player).map(d=>{const weighted=Object.entries(d.attrs).reduce((s,[k,w])=>s+(100-(Number(player?.[k])||50))*w,0);return{drill:d,need:weighted};}).sort((a,b)=>b.need-a.need).slice(0,limit).map(x=>x.drill.id);
}

function ability(player,drill){let t=0,w=0;for(const [k,x] of Object.entries(drill?.attrs||{})){t+=(Number(player?.[k])||50)*x;w+=x;}return t/(w||1);}
function progressRatio(engine){return clamp((engine?.repProgress?.()??0),0,1);}
function resultRate(engine){const q=engine?.trainingQualityV6,reps=Math.max(1,engine?.result?.reps||1),done=q?.repResults?.length||0,success=(q?.repResults||[]).filter(r=>r.success).length+(q?.repSuccess?1:0);return done||q?.repSuccess?success/Math.max(1,done+(q?.repSuccess?1:0)):0;}
function liveBase(engine,drill){const p=engine?.player?.data||engine?.playerData||{},q=engine?.trainingQualityV6||{},m=engine?.trainingMetricsV6||{},base=ability(p,drill),rate=resultRate(engine),prog=progressRatio(engine);return{p,q,m,base,rate,prog};}
function scoreMetric(id,engine,drill){
  const {p,q,m,base,rate,prog}=liveBase(engine,drill),stat=(k)=>Number(p?.[k])||50,phase=String(q.phase||'').toLowerCase();
  const touch=Math.min(1,(m.physicalTouches||0)/Math.max(2,(engine?.rep||0)+2)),passes=Math.min(1,(m.passesCompleted||0)/Math.max(1,m.passesAttempted||1)),goals=Math.min(1,(m.goals||0)/Math.max(1,(engine?.rep||0)+1));
  const map={
    decision:base*.62+stat('vision')*.20+stat('composure')*.18+rate*16,
    execution:base*.72+rate*24+touch*6,
    control:stat('ballControl')*.62+stat('dribbling')*.22+touch*16,
    timing:stat('vision')*.34+stat('pace')*.24+stat('composure')*.20+rate*22,
    space:stat('vision')*.52+stat('composure')*.18+rate*20+(phase.includes('espacio')?8:0),
    finish:stat('shooting')*.64+stat('composure')*.20+goals*16,
    pass:stat('passing')*.58+stat('vision')*.22+passes*20,
    pressure:stat('stamina')*.30+stat('pace')*.24+stat('defense')*.26+rate*20,
    duel:stat('physical')*.28+stat('dribbling')*.26+stat('ballControl')*.24+rate*22,
    scan:stat('vision')*.66+stat('composure')*.18+prog*16,
    trajectory:stat('vision')*.36+stat('ballControl')*.22+stat('composure')*.18+rate*24,
    save:stat('defense')*.60+stat('composure')*.20+rate*20,
    rebound:stat('defense')*.30+stat('ballControl')*.28+stat('composure')*.24+rate*18,
    coverage:stat('defense')*.42+stat('vision')*.30+stat('pace')*.12+rate*16,
    distribution:stat('passing')*.48+stat('vision')*.30+passes*22,
    height:stat('shooting')*.34+stat('ballControl')*.24+stat('composure')*.22+rate*20,
    curve:stat('shooting')*.38+stat('ballControl')*.26+stat('composure')*.18+rate*18,
    body:stat('ballControl')*.34+stat('composure')*.32+stat('vision')*.18+rate*16,
    continuity:stat('stamina')*.20+stat('vision')*.25+stat('passing')*.20+rate*25+passes*10,
  };
  return clamp(Math.round(map[id]??base*.75+rate*25),0,100);
}
export function trainingMarkerSnapshot(engine,drill){return (drill?.markers||[]).map(def=>({...def,value:scoreMetric(def.id,engine,drill)}));}
export function trainingDifficulty(player,drill){const x=ability(player,drill);return x<50?'Fundamentos':x<65?'Desarrollo':x<78?'Competitivo':'Perfeccionamiento';}

export const __trainingFrameworkV2={COMMON,scoreMetric,ability};
