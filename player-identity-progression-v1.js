const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const IDENTITY_STORE_KEY='career-eleven-identity:v1';
export const CAREER_STORE_KEY='career-eleven-2d:v4';
const LEVEL_XP=[0,90,230,420,660,950];
const GRADE_MULT={E:.72,D:.82,C:.92,B:1,A:1.12,S:1.26};

const TRAITS={
  finish_profile:{name:'Perfil de remate',desc:'Se acomoda antes y prioriza una postura limpia para definir.'},
  quick_finish:{name:'Finalización rápida',desc:'Reduce la tendencia a dar un toque extra cuando la ventana de remate ya existe.'},
  attack_back:{name:'Ataca la espalda',desc:'Reconoce antes el espacio detrás de la última línea.'},
  diagonal_run:{name:'Diagonal agresiva',desc:'Prefiere rupturas diagonales que separan a los centrales.'},
  layoff:{name:'Descarga natural',desc:'Bajo presión reconoce antes una devolución simple.'},
  wall_follow:{name:'Pared y sigue',desc:'Después de soltarla mantiene la carrera para volver a recibir.'},
  shield_turn:{name:'Protege y gira',desc:'Tolera mejor el contacto antes de abandonar un duelo.'},
  second_ball:{name:'Segunda pelota',desc:'Ataca antes rebotes y pelotas divididas cerca del área.'},
  width_hold:{name:'Fija amplitud',desc:'Sostiene la banda cuando abrir el bloque mejora la jugada.'},
  inside_attack:{name:'Ataque interior',desc:'Reconoce el momento para abandonar la banda y atacar el intervalo.'},
  first_touch_lane:{name:'Primer toque útil',desc:'Orienta el control hacia la siguiente línea disponible.'},
  scan_pass:{name:'Escaneo previo',desc:'Busca información antes de recibir para acelerar la siguiente decisión.'},
  tempo_control:{name:'Control del ritmo',desc:'Alterna seguridad y progresión según presión y estructura.'},
  arrive_box:{name:'Llegada desde atrás',desc:'Ataca el área cuando otro jugador fija la última línea.'},
  intercept_lane:{name:'Lectura de línea',desc:'Prioriza cerrar la línea probable antes de perseguir al poseedor.'},
  step_out:{name:'Salto defensivo',desc:'Sale de la línea cuando puede llegar antes sin romper la cobertura.'},
  cover_depth:{name:'Cobertura profunda',desc:'Protege espalda y segundo balón cuando un compañero salta.'},
  build_pass:{name:'Salida limpia',desc:'Busca el primer pase que supera presión sin regalar la pelota.'},
  gk_set:{name:'Set de atajada',desc:'Ajusta mejor la posición corporal antes del remate.'},
  gk_rebound:{name:'Control del rebote',desc:'Prioriza desviar hacia zonas menos peligrosas.'},
  gk_sweep:{name:'Lectura de líbero',desc:'Sale antes cuando la pelota profunda es realmente atacable.'},
  gk_distribution:{name:'Inicio con los pies',desc:'Busca una salida útil después de recuperar la pelota.'},
};

const CATALOGS={
  ST:[
    {id:'finishing',name:'Definición',desc:'Perfil, selección de remate y resolución dentro del área.',memories:['box-run','first-time-shot','cutback-finish','shot-selection','shot-placement'],traits:[[2,'finish_profile'],[4,'quick_finish']]},
    {id:'movement',name:'Ruptura',desc:'Timing, diagonales, espalda de centrales y ataque de trayectoria.',memories:['timed-run','box-run','far-post-run','burst-after-touch'],traits:[[2,'attack_back'],[4,'diagonal_run']]},
    {id:'combination',name:'Asociación',desc:'Descarga, pared, tercer hombre y volver a ofrecerse.',memories:['wall-pass','third-man','combination','scan-before-receive'],traits:[[2,'layoff'],[4,'wall_follow']]},
    {id:'duel',name:'Duelo de área',desc:'Protección, giro, rebote y continuidad bajo contacto.',memories:['1v1','shield-turn','close-control','press-resistance'],traits:[[2,'shield_turn'],[4,'second_ball']]},
  ],
  W:[
    {id:'duel',name:'Desequilibrio',desc:'Uno contra uno, cambio de ritmo y conducción en ventaja.',memories:['1v1','change-direction','burst-after-touch','close-control'],traits:[[2,'first_touch_lane'],[4,'shield_turn']]},
    {id:'movement',name:'Ruptura',desc:'Ataque a la espalda, diagonal y llegada al segundo palo.',memories:['timed-run','far-post-run','box-run'],traits:[[2,'attack_back'],[4,'inside_attack']]},
    {id:'combination',name:'Asociación',desc:'Paredes, tercer hombre y apoyo en medio espacio.',memories:['wall-pass','third-man','combination'],traits:[[2,'layoff'],[4,'wall_follow']]},
    {id:'width',name:'Amplitud y centro',desc:'Fijar banda, desborde, centro y pase atrás.',memories:['overlap','cross','cutback','far-post-run'],traits:[[2,'width_hold'],[4,'scan_pass']]},
  ],
  CAM:[
    {id:'creation',name:'Creación',desc:'Pase filtrado, visión y ventaja entre líneas.',memories:['through-ball','scan-runner','third-man'],traits:[[2,'scan_pass'],[4,'tempo_control']]},
    {id:'reception',name:'Recepción',desc:'Perfil, primer toque y giro antes de la presión.',memories:['scan-before-receive','close-control','press-resistance'],traits:[[2,'first_touch_lane'],[4,'shield_turn']]},
    {id:'combination',name:'Asociación',desc:'Pared, apoyo y continuidad del ataque.',memories:['wall-pass','third-man','combination'],traits:[[2,'layoff'],[4,'wall_follow']]},
    {id:'arrival',name:'Llegada',desc:'Aparecer en zona de remate desde segunda línea.',memories:['box-run','shot-selection','timed-run'],traits:[[2,'arrive_box'],[4,'finish_profile']]},
  ],
  MID:[
    {id:'creation',name:'Pase y visión',desc:'Progresión, cambio de orientación y pase entre líneas.',memories:['through-ball','scan-runner','third-man'],traits:[[2,'scan_pass'],[4,'tempo_control']]},
    {id:'support',name:'Apoyo',desc:'Ángulos de pase, ofrecer línea y pasar para seguir.',memories:['wall-pass','combination','scan-before-receive'],traits:[[2,'layoff'],[4,'wall_follow']]},
    {id:'reception',name:'Control bajo presión',desc:'Primer toque, protección y salida del rival.',memories:['close-control','press-resistance','shield-turn'],traits:[[2,'first_touch_lane'],[4,'shield_turn']]},
    {id:'arrival',name:'Llegada',desc:'Ocupar segunda jugada y aparecer por detrás del ataque.',memories:['box-run','counterpress','timed-run'],traits:[[2,'arrive_box'],[4,'second_ball']]},
  ],
  DEF:[
    {id:'defending',name:'Anticipación',desc:'Intercepción, lectura de pase y salto defensivo.',memories:['counterpress','scan-before-receive'],traits:[[2,'intercept_lane'],[4,'step_out']]},
    {id:'coverage',name:'Cobertura',desc:'Profundidad, segunda pelota y equilibrio de la línea.',memories:['counterpress','timed-run'],traits:[[2,'cover_depth'],[4,'second_ball']]},
    {id:'build',name:'Salida',desc:'Control, pase seguro y progresión desde el fondo.',memories:['scan-before-receive','third-man','through-ball'],traits:[[2,'build_pass'],[4,'scan_pass']]},
    {id:'duel',name:'Duelo',desc:'Cuerpo, protección de zona y recuperación.',memories:['1v1','shield-turn','press-resistance'],traits:[[2,'shield_turn'],[4,'step_out']]},
  ],
  GK:[
    {id:'saving',name:'Atajada',desc:'Posición de set, reacción y dirección del rechazo.',memories:['shot-placement','first-time-shot'],traits:[[2,'gk_set'],[4,'gk_rebound']]},
    {id:'sweeping',name:'Arquero líbero',desc:'Lectura de profundidad y salida fuera del área chica.',memories:['timed-run','scan-runner'],traits:[[2,'gk_sweep'],[4,'cover_depth']]},
    {id:'distribution',name:'Salida con los pies',desc:'Control, pase y elección de la primera progresión.',memories:['scan-before-receive','through-ball','third-man'],traits:[[2,'gk_distribution'],[4,'build_pass']]},
    {id:'composure',name:'Manejo del área',desc:'Decidir bajo presión, rebotes y segundas pelotas.',memories:['press-resistance','close-control'],traits:[[2,'gk_rebound'],[4,'tempo_control']]},
  ],
};

const BUILD_BIAS={
  finisher:{finishing:16,movement:9,shootIntent:14,boxAttack:12,oneTouch:8},
  creator:{creation:16,combination:10,passRisk:12,showFeet:10},
  technician:{duel:15,reception:12,dribbleIntent:15,showFeet:4},
  engine:{support:10,arrival:12,press:14,runBehind:5},
  'ball-winner':{defending:16,coverage:10,press:15},
  speedster:{movement:17,duel:8,runBehind:17,dribbleIntent:6},
  target:{finishing:10,duel:15,combination:7,boxAttack:13,showFeet:9},
  'shot-stopper':{saving:18,composure:8},
  'sweeper-keeper':{sweeping:18,distribution:7},
  'keeper-playmaker':{distribution:18,composure:7},
};

const DRILL_BRANCH_WEIGHTS={
  'cone-dribble':{duel:.65,reception:.35},
  'one-v-one':{duel:.72,reception:.28},
  'two-v-two':{combination:.58,support:.25,reception:.17},
  'three-v-three':{combination:.35,support:.25,creation:.18,arrival:.12,defending:.10},
  'through-ball':{creation:.48,movement:.37,combination:.15},
  crossing:{width:.52,movement:.25,combination:.13,arrival:.10},
  finishing:{finishing:.60,movement:.22,arrival:.18,saving:.35},
  'free-kick':{finishing:.62,creation:.18,composure:.20,saving:.20},
};

function familyForPosition(position){if(position==='GK')return'GK';if(position==='ST')return'ST';if(['LW','RW','LM','RM'].includes(position))return'W';if(position==='CAM')return'CAM';if(['CB','LB','RB','LWB','RWB'].includes(position))return'DEF';return'MID';}
export function identityFamily(position){return familyForPosition(position);}
export function branchCatalogFor(position){return CATALOGS[familyForPosition(position)].map(x=>({...x,traits:x.traits.map(t=>[...t])}));}
export function traitDefinition(id){return TRAITS[id]||null;}
function fingerprint(career){const p=career?.player||{};return[career?.createdAt||'career',p.name||'Jugador',p.birthDate||p.age||'',p.position||'CM'].join('|');}
function branchLevel(xp){let level=0;for(let i=1;i<LEVEL_XP.length;i++)if(xp>=LEVEL_XP[i])level=i;return level;}
export function branchProgress(branch){const xp=Math.max(0,Number(branch?.xp)||0),level=branchLevel(xp),next=LEVEL_XP[Math.min(level+1,LEVEL_XP.length-1)],base=LEVEL_XP[level],atMax=level>=LEVEL_XP.length-1,percent=atMax?100:clamp(Math.round((xp-base)/(next-base)*100),0,100);return{level,xp:+xp.toFixed(1),next,percent,atMax};}
function addXp(identity,id,amount,source=''){const b=identity.branches[id];if(!b||!Number.isFinite(amount)||amount<=0)return 0;b.xp=+(Number(b.xp||0)+amount).toFixed(1);b.lastSource=source||b.lastSource||'';return amount;}
function bootstrapBranchXp(career,def){const memory=career?.player?.trainingMemory||{},vals=def.memories.map(k=>Number(memory[k]?.familiarity)||0).filter(v=>v>0),memoryAvg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0,bias=Number(BUILD_BIAS[career?.player?.build]?.[def.id]||0);return clamp(memoryAvg*.62+bias*1.8,0,120);}
function recalc(identity){identity.traits=[];for(const def of branchCatalogFor(identity.position)){const level=branchProgress(identity.branches[def.id]).level;for(const [need,trait] of def.traits)if(level>=need&&!identity.traits.includes(trait))identity.traits.push(trait);}identity.profile=deriveAIProfile(identity);identity.updatedAt=Date.now();return identity;}
export function createIdentityState(career){const branches={};for(const def of branchCatalogFor(career?.player?.position||'CM'))branches[def.id]={xp:+bootstrapBranchXp(career,def).toFixed(1),lastSource:'Base y entrenamiento previo'};const id={version:1,fingerprint:fingerprint(career),playerName:career?.player?.name||'Jugador',position:career?.player?.position||'CM',buildId:career?.player?.build||'creator',focus:null,branches,traits:[],profile:{},processed:{trainingSessions:Number(career?.player?.trainingSummary?.sessions)||0,matchKeys:[]},log:[],updatedAt:Date.now()};for(const h of (career?.history||[]).slice(-24)){const key=[h.fixtureId||'',h.date||'',h.season||'',h.week||''].join('|');if(key)id.processed.matchKeys.push(key);}return recalc(id);}
export function ensureIdentityState(career,existing=null){if(!career?.player)return existing||null;if(!existing||existing.fingerprint!==fingerprint(career)||existing.position!==career.player.position){return createIdentityState(career);}for(const def of branchCatalogFor(existing.position))existing.branches[def.id]??={xp:0,lastSource:''};existing.processed??={trainingSessions:0,matchKeys:[]};existing.processed.matchKeys??=[];existing.log??=[];existing.buildId=career.player.build||existing.buildId;return recalc(existing);}
function log(identity,text,delta){identity.log.unshift({at:Date.now(),text,delta});identity.log=identity.log.slice(0,12);}
export function applyTrainingEvidence(identity,entry){if(!identity||!entry)return identity;const weights=DRILL_BRANCH_WEIGHTS[entry.drillId]||{},quality=clamp(Number(entry.quality)||45,35,98),reps=Math.max(1,Number(entry.reps)||6),success=clamp(Number(entry.successes||0)/reps,0,1),mult=GRADE_MULT[entry.grade]||.8,base=(24+quality*.20+success*9)*mult;let total=0;for(const [id,w] of Object.entries(weights)){if(!identity.branches[id])continue;const focusBoost=identity.focus===id?1.18:1,totalXp=base*w*focusBoost;total+=addXp(identity,id,totalXp,`Entrenamiento: ${entry.drillId}`);}if(total>0)log(identity,`Entrenamiento ${entry.grade||'—'} · ${entry.drillId}`,Math.round(total));return recalc(identity);}
function matchWeights(identity,perf){const b=perf?.ratingBreakdown||{},f=familyForPosition(identity.position),positive=k=>Math.max(0,Number(b[k]||6)-6),raw={shots:Number(perf?.shots)||0,onTarget:Number(perf?.shotsOnTarget)||0,goals:Number(perf?.goals)||0,assists:Number(perf?.assists)||0,passes:Number(perf?.passesCompleted)||0,dribbles:Number(perf?.dribblesCompleted)||0,tackles:Number(perf?.tackles)||0,interceptions:Number(perf?.interceptions)||0};
  if(f==='ST')return{finishing:7+raw.shots*2.5+raw.onTarget*4+raw.goals*12+positive('shooting')*10,movement:6+positive('offBall')*12+positive('tactical')*5,combination:4+raw.passes*.45+raw.assists*8+positive('passing')*8,duel:4+raw.dribbles*2+positive('dribbling')*8};
  if(f==='W')return{duel:5+raw.dribbles*2.2+positive('dribbling')*9,movement:5+positive('offBall')*10+positive('tactical')*4,combination:4+raw.passes*.45+raw.assists*7+positive('passing')*7,width:5+positive('tactical')*9+positive('offBall')*4};
  if(f==='CAM')return{creation:6+raw.passes*.55+raw.assists*9+positive('passing')*10,reception:4+positive('dribbling')*7+positive('tactical')*5,combination:5+raw.passes*.45+positive('passing')*6,arrival:4+raw.shots*2+raw.goals*10+positive('offBall')*7};
  if(f==='MID')return{creation:5+raw.passes*.5+positive('passing')*9,support:5+positive('offBall')*6+positive('tactical')*8,reception:4+positive('dribbling')*6+positive('tactical')*4,arrival:4+raw.shots+raw.tackles+positive('offBall')*5};
  if(f==='DEF')return{defending:6+raw.tackles*2+raw.interceptions*2.5+positive('defending')*10,coverage:5+positive('tactical')*9+positive('offBall')*5,build:4+raw.passes*.5+positive('passing')*8,duel:5+raw.tackles+positive('defending')*5};
  return{saving:6+Number(perf?.saves||0)*3+positive('defending')*10,sweeping:4+positive('offBall')*7+positive('tactical')*6,distribution:4+raw.passes*.6+positive('passing')*9,composure:5+positive('tactical')*7};}
export function applyMatchEvidence(identity,perf){if(!identity||!perf)return identity;const weights=matchWeights(identity,perf);let total=0;for(const [id,xp] of Object.entries(weights)){if(!identity.branches[id])continue;const focusBoost=identity.focus===id?1.08:1,totalXp=Math.max(0,xp)*focusBoost;total+=addXp(identity,id,totalXp,'Partido');}log(identity,`Partido · nota ${Number(perf.rating||6).toFixed(1)}`,Math.round(total));return recalc(identity);}
function mastery(identity,id){const b=identity?.branches?.[id];if(!b)return 0;const p=branchProgress(b);return clamp(p.level*20+p.percent*.2,0,100);}
function bias(identity,key){return Number(BUILD_BIAS[identity?.buildId]?.[key]||0);}
export function deriveAIProfile(identity){if(!identity)return{};const f=familyForPosition(identity.position),m=id=>mastery(identity,id),focus=id=>identity.focus===id?6:0;let p={};
  if(f==='ST')p={runBehind:clamp(38+m('movement')*.48+bias(identity,'runBehind')+focus('movement'),10,96),showFeet:clamp(30+m('combination')*.48+bias(identity,'showFeet')+focus('combination'),10,92),boxAttack:clamp(44+m('finishing')*.34+m('movement')*.20+bias(identity,'boxAttack')+focus('finishing'),15,97),oneTouch:clamp(25+m('finishing')*.45+m('combination')*.16+bias(identity,'oneTouch'),8,94),dribbleIntent:clamp(24+m('duel')*.55+bias(identity,'dribbleIntent')+focus('duel'),8,90),shootIntent:clamp(48+m('finishing')*.43+bias(identity,'shootIntent'),20,97),passRisk:clamp(30+m('combination')*.42+bias(identity,'passRisk'),12,84),press:clamp(32+m('duel')*.22+bias(identity,'press'),15,82),width:30};
  else if(f==='W')p={runBehind:clamp(42+m('movement')*.43+bias(identity,'runBehind')+focus('movement'),15,95),showFeet:clamp(34+m('combination')*.35+focus('combination'),15,86),boxAttack:clamp(30+m('movement')*.32,10,82),oneTouch:clamp(28+m('combination')*.32,10,82),dribbleIntent:clamp(45+m('duel')*.46+bias(identity,'dribbleIntent')+focus('duel'),20,97),shootIntent:clamp(35+m('movement')*.18,15,80),passRisk:clamp(34+m('combination')*.35,12,82),press:clamp(35+m('duel')*.18,15,78),width:clamp(46+m('width')*.42+focus('width'),20,96)};
  else if(f==='CAM'||f==='MID')p={runBehind:clamp(25+m('arrival')*.35,8,75),showFeet:clamp(48+m(f==='CAM'?'combination':'support')*.38,20,94),boxAttack:clamp(22+m('arrival')*.42,8,78),oneTouch:clamp(36+m(f==='CAM'?'reception':'reception')*.28,15,82),dribbleIntent:clamp(28+m('reception')*.34+bias(identity,'dribbleIntent'),10,82),shootIntent:clamp(25+m('arrival')*.28+bias(identity,'shootIntent'),10,78),passRisk:clamp(43+m('creation')*.42+bias(identity,'passRisk')+focus('creation'),20,96),press:clamp(38+m(f==='MID'?'support':'combination')*.15+bias(identity,'press'),18,78),width:35};
  else if(f==='DEF')p={runBehind:18,showFeet:clamp(44+m('build')*.30,20,82),boxAttack:8,oneTouch:clamp(30+m('build')*.22,12,70),dribbleIntent:clamp(15+m('duel')*.18,5,52),shootIntent:8,passRisk:clamp(30+m('build')*.34,12,78),press:clamp(38+m('defending')*.35+bias(identity,'press')+focus('defending'),18,92),width:clamp(34+m('coverage')*.22,20,72)};
  else p={runBehind:0,showFeet:45,boxAttack:0,oneTouch:25,dribbleIntent:12,shootIntent:0,passRisk:clamp(28+m('distribution')*.38,10,82),press:0,width:0,gkSweep:clamp(30+m('sweeping')*.55+bias(identity,'gkSweep')+focus('sweeping'),15,96),gkDistribution:clamp(35+m('distribution')*.50+bias(identity,'gkDistribution')+focus('distribution'),18,96),gkSet:clamp(42+m('saving')*.48+focus('saving'),20,97)};
  return Object.fromEntries(Object.entries(p).map(([k,v])=>[k,Math.round(v)]));}
export function identityMechanicalMods(identity){const f=familyForPosition(identity?.position),m=id=>mastery(identity,id),traits=new Set(identity?.traits||[]);if(f==='ST')return{shooting:Math.floor(m('finishing')/32)+(traits.has('quick_finish')?1:0),composure:Math.floor(m('finishing')/38),passing:Math.floor(m('combination')/45),ballControl:Math.floor(m('duel')/42)};if(f==='W')return{dribbling:Math.floor(m('duel')/34),ballControl:Math.floor(m('duel')/44),passing:Math.floor(m('combination')/45)};if(f==='CAM'||f==='MID')return{passing:Math.floor(m('creation')/34),vision:Math.floor(m('creation')/30),ballControl:Math.floor(m('reception')/44)};if(f==='DEF')return{defense:Math.floor(m('defending')/34),passing:Math.floor(m('build')/45),physical:Math.floor(m('duel')/46)};return{defense:Math.floor(m('saving')/32),passing:Math.floor(m('distribution')/42),composure:Math.floor(m('composure')/44)};}
export function identitySummary(identity){return branchCatalogFor(identity.position).map(def=>({def,branch:identity.branches[def.id],progress:branchProgress(identity.branches[def.id])}));}

let nativeSet=null;
function readJson(storage,key){try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}}
export function readActiveIdentity(){if(typeof localStorage==='undefined')return null;return readJson(localStorage,IDENTITY_STORE_KEY);}
export function writeActiveIdentity(identity){if(typeof localStorage==='undefined'||!identity)return;const setter=nativeSet||Storage.prototype.setItem;setter.call(localStorage,IDENTITY_STORE_KEY,JSON.stringify(recalc(identity)));if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('career-eleven-identity-updated'));}
function matchKey(state){const h=state?.history?.at?.(-1),last=state?.lastMatch;return[last?.fixtureId||h?.fixtureId||'',last?.date||h?.date||'',h?.season||state?.season||'',h?.week||state?.week||''].join('|');}
export function syncIdentityFromCareer(state,existing=null){if(!state?.player)return existing;let identity=ensureIdentityState(state,existing);const sessions=Number(state.player.trainingSummary?.sessions)||0,done=Number(identity.processed.trainingSessions)||0;if(sessions>done){const delta=Math.min(sessions-done,state.player.trainingLog?.length||0),entries=(state.player.trainingLog||[]).slice(0,delta).reverse();for(const entry of entries)applyTrainingEvidence(identity,entry);identity.processed.trainingSessions=sessions;}
  const key=matchKey(state);if(key&&state.lastMatch?.userPerformance&&!identity.processed.matchKeys.includes(key)){applyMatchEvidence(identity,state.lastMatch.userPerformance);identity.processed.matchKeys.push(key);identity.processed.matchKeys=identity.processed.matchKeys.slice(-40);}return recalc(identity);}
function installStorageBridge(){if(typeof window==='undefined'||typeof Storage==='undefined'||typeof localStorage==='undefined')return;if(Storage.prototype.__careerIdentityV1)return;nativeSet=Storage.prototype.setItem;const original=nativeSet;Storage.prototype.setItem=function identityAwareSetItem(key,value){if(key===CAREER_STORE_KEY){try{const career=JSON.parse(value),current=readJson(this,IDENTITY_STORE_KEY),identity=syncIdentityFromCareer(career,current);if(identity)original.call(this,IDENTITY_STORE_KEY,JSON.stringify(identity));}catch{}}return original.call(this,key,value);};Storage.prototype.__careerIdentityV1=true;try{const career=readJson(localStorage,CAREER_STORE_KEY);if(career){const identity=syncIdentityFromCareer(career,readJson(localStorage,IDENTITY_STORE_KEY));if(identity)original.call(localStorage,IDENTITY_STORE_KEY,JSON.stringify(identity));}}catch{}}
installStorageBridge();

export const __identityProgressionV1={LEVEL_XP,DRILL_BRANCH_WEIGHTS,BUILD_BIAS,mastery,recalc,fingerprint};
