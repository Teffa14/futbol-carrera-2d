const EXACT_COPY=new Map([
  ['2D · 11v11 AUTOPLAY','CARRERA DE FUTBOLISTA'],
  ['MODO CARRERA · 11 CONTRA 11','NUEVA CARRERA'],
  ['MODO CARRERA · FÚTBOL ARGENTINO','NUEVA CARRERA'],
  ['Tu jugador.','ELEGÍ TU PUESTO.'],
  ['Tu carrera.','DESPUÉS GANÁTELO.'],
  ['Build','Estilo'],
  ['Build inicial','Estilo inicial'],
  ['PvP Async','Desafíos'],
  ['Fuentes','Créditos'],
  ['Autoplay 2D con 22 jugadores. Conducción por toques, movimiento por espacios y atributos que cambian lo que pasa en cancha.','Elegí posición y perfil. Después vas a tener que demostrarlo en la prueba de ingreso.'],
  ['Definí el perfil inicial. Cada inversión mueve varias capacidades relacionadas y los rangos altos cuestan más.','Repartí tus puntos entre las áreas que mejor representan tu forma de jugar. Los rangos altos cuestan más.'],
  ['La identidad y el talento inicial quedan definidos antes del club. Cambiar de institución no cambia las capacidades del mismo juvenil.','Este perfil te acompaña cuando cambies de club.'],
  ['PREVIEW DEL JUVENIL','TU JUVENIL'],
  ['Perfil listo. Los 15 puntos están distribuidos en un perfil juvenil válido.','Listo para la prueba.'],
  ['Qué significa cada stat dentro del partido','Qué cambia cada atributo en cancha'],
  ['ARQUETIPO Y HABILIDADES','IDENTIDAD FUTBOLÍSTICA'],
  ['Tendencias de tu IA','Con pelota'],
  ['Tu jugador sigue siendo autoplay, pero estas preferencias cambian sus decisiones con pelota.','Elegí qué querés priorizar cuando recibís la pelota.'],
  ['DESARROLLO SEMANAL','SEMANA DE ENTRENAMIENTO'],
  ['Partido 11v11','Partido'],
  ['Jugar 11v11','Jugar partido'],
  ['JUGAR PARTIDO 11v11','JUGAR PARTIDO'],
  ['Seguimiento individual','Tu partido'],
  ['PVP ASYNC · GHOST','DESAFÍO'],
  ['LIGA GHOST','DESAFÍOS'],
  ['PvP asíncrono','Desafíos'],
  ['Versión local: perfiles ghost entran realmente al XI rival. La capa de cuentas/backend viene después.','Enfrentá planteles armados alrededor de otros futbolistas.'],
  ['Próximo ghost','Próximo rival'],
  ['Jugar ghost 11v11','Jugar desafío'],
  ['Ghost XI','Equipo rival'],
  ['Ahora te miran en contexto real.','Ahora vienen los partidos.'],
  ['11 contra 11 autoplay. Los visores pesan más lo que hacés acá que los ejercicios aislados: decisiones, pérdidas, pases, duelos, goles, robos y puntaje.','Los visores te evalúan dentro de un equipo: decisiones, pérdidas, pases, duelos, goles, recuperaciones y rendimiento general.'],
  ['Los visores están mirando. Este partido pesa 60% dentro de la evidencia combinada.','Los visores miran cada intervención y también lo que hacés sin pelota.'],
  ['El partido suma evidencia para tus ofertas.','Este partido cuenta para las ofertas que vas a recibir.'],
  ['Todavía no hubo mejora permanente de atributos.','Todavía no mejoraste atributos durante la prueba.'],
  ['ENTRENAMIENTO SIMULADO','ENTRENAMIENTO'],
  ['Entrená acciones, no botones','Trabajo de cancha'],
  ['Cada sesión se ve en cancha. La nota depende de tus atributos, estado físico y familiaridad previa. Practicar crea memoria futbolística. Los atributos sólo suben cuando acumulás suficiente trabajo de desarrollo.','Elegí una situación de tu puesto y repetila. La nota refleja cómo la resolvés y el trabajo se acumula durante la temporada.'],
  ['MEMORIA DEL JUGADOR','TRABAJO ACUMULADO'],
  ['Lo que tu jugador aprendió a reconocer','Lo que venís repitiendo'],
  ['Progresión real:','Foco de trabajo:'],
  ['IA que estás formando','Cómo estás jugando'],
  ['Esto reemplaza los viejos sliders. Los números salen de tu build, ramas, foco y experiencia.','Tus tendencias actuales según lo que venís practicando y usando en cancha.'],
  ['Matchday bloqueado','Antes del partido'],
  ['Decisión semanal resuelta','Esta semana'],
  ['CALIDAD','EJECUCIÓN'],
  ['ÉXITOS','BUENAS'],
  ['Los planteles completos usan datos abiertos cuando existen. Los ratings generados se identifican como valores de juego.','Datos y licencias usados para planteles y referencias.'],
]);

const COPY_RULES=[
  [/^(\d+) sesiones disponibles\. Lo que subís acá cambia directamente el motor 11v11\.$/i,'$1 sesiones disponibles.'],
  [/^La cámara sigue a .+?\. El aro verde y la flecha marcan tu jugador\. El rating cambia con cada pase, regate, remate, robo, pérdida, gol o asistencia\.$/i,'Tu rendimiento se actualiza con lo que hacés en cancha: pases, duelos, remates, recuperaciones, pérdidas, goles y asistencias.'],
  [/^Prioridad\s+\d+\s+·\s+disciplina\s+.+$/i,'Objetivo del DT'],
  [/^Familiaridad\s+(\d+)\s+·\s+(\d+)\s+reps$/i,'Práctica $1 · $2 repeticiones'],
  [/^Entrenamiento\s+([EDCBAS—])\s+·\s+[a-z0-9-]+$/i,'Entrenamiento · Nota $1'],
  [/^([A-Z]{2,4})\s+·\s+Estado físico\s+(\d+)\s+·\s+Confianza DT\s+(\d+)\. El partido arranca siempre en x1\.$/i,'$1 · Estado físico $2 · Confianza DT $3.'],
  [/^Ganaste\s+(\d+)\s+punto\(s\) de atributo durante la prueba\. Máximo total de esta etapa: 4\.$/i,'Mejoraste $1 punto(s) de atributo durante la prueba.'],
  [/^Visor\s+(\d+)\/100\s+·\s+confianza\s+\d+%\s+·\s+técnico\s+(\d+)\s+·\s+táctico\s+(\d+)\.$/i,'Visor $1/100 · Técnica $2 · Táctica $3.'],
  [/^Los partidos pesan más que los ejercicios\. Tu OVR final de juvenil es\s+(\d+)\. Elegí dónde empezás a jugar profesionalmente en la B\.$/i,'Tu OVR juvenil es $1. Elegí dónde empezás a jugar profesionalmente en la B.'],
  [/^Build\s+(.+)$/i,'Estilo $1'],
  [/^Build base:\s*(.+)$/i,'Estilo base: $1'],
];

function replacementFor(raw){
  const trimmed=raw.trim();
  if(!trimmed)return null;
  if(EXACT_COPY.has(trimmed))return EXACT_COPY.get(trimmed);
  for(const [pattern,replacement] of COPY_RULES){if(pattern.test(trimmed))return trimmed.replace(pattern,replacement);}
  return null;
}

function cleanTextNode(node){
  const raw=node.nodeValue||'',replacement=replacementFor(raw);
  if(replacement===null)return false;
  const leading=raw.match(/^\s*/)?.[0]||'',trailing=raw.match(/\s*$/)?.[0]||'';
  node.nodeValue=`${leading}${replacement}${trailing}`;
  return true;
}

function cleanAttributes(root){
  if(!(root instanceof Element))return;
  for(const attr of ['title','aria-label']){
    const raw=root.getAttribute(attr);if(!raw)continue;const replacement=replacementFor(raw);if(replacement!==null)root.setAttribute(attr,replacement);
  }
  root.querySelectorAll?.('[title],[aria-label]').forEach(el=>{for(const attr of ['title','aria-label']){const raw=el.getAttribute(attr);if(!raw)continue;const replacement=replacementFor(raw);if(replacement!==null)el.setAttribute(attr,replacement);}});
}

function removeDeveloperBadges(root=document){
  const scope=root?.querySelectorAll?root:document;
  scope.querySelectorAll?.('.training-engine-pill').forEach(el=>{
    if(/MOTOR|MISMA FÍSICA|FÍSICA DEL PARTIDO|11V11/i.test(el.textContent||''))el.remove();
  });
}

export function sanitizePlayerFacingCopy(root=document.body){
  if(!root)return 0;
  let changed=0;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){const tag=node.parentElement?.tagName;if(['SCRIPT','STYLE','TEXTAREA','CODE','PRE'].includes(tag))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT;}});
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes)if(cleanTextNode(node))changed++;
  if(root instanceof Element)cleanAttributes(root);
  removeDeveloperBadges(root);
  return changed;
}

function onMutations(mutations){
  for(const mutation of mutations){
    if(mutation.type==='characterData'){cleanTextNode(mutation.target);continue;}
    for(const node of mutation.addedNodes){if(node.nodeType===Node.TEXT_NODE)cleanTextNode(node);else if(node.nodeType===Node.ELEMENT_NODE)sanitizePlayerFacingCopy(node);}
  }
  removeDeveloperBadges(document);
}

if(typeof document!=='undefined'){
  sanitizePlayerFacingCopy(document.body);
  new MutationObserver(onMutations).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
}

export const __playerFacingCopyV1={EXACT_COPY,COPY_RULES,replacementFor,removeDeveloperBadges};
