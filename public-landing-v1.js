const LANDING_SESSION_KEY='career-eleven:public-landing-entered';

const support={
  alias:'career.eleven',
  cvu:'0000003100057101140012',
};

function shouldShowLanding(){
  const url=new URL(window.location.href);
  if(url.searchParams.get('landing')==='1'||url.hash==='#landing')return true;
  if(url.searchParams.get('play')==='1'||url.hash==='#play')return false;
  return sessionStorage.getItem(LANDING_SESSION_KEY)!=='1';
}

function copyText(value,button){
  const done=()=>{
    const previous=button.textContent;
    button.textContent='COPIADO';
    button.classList.add('copied');
    window.setTimeout(()=>{button.textContent=previous;button.classList.remove('copied');},1400);
  };
  if(navigator.clipboard?.writeText){navigator.clipboard.writeText(value).then(done).catch(()=>fallbackCopy(value,done));return;}
  fallbackCopy(value,done);
}

function fallbackCopy(value,done){
  const area=document.createElement('textarea');
  area.value=value;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';
  document.body.appendChild(area);area.select();
  try{document.execCommand('copy');done();}catch{}
  area.remove();
}

function landingMarkup(){
  return `<div class="public-landing" id="publicLanding" role="dialog" aria-label="Career Eleven">
    <div class="public-landing-noise"></div>
    <header class="public-landing-nav">
      <a class="public-landing-brand" href="#landingTop" aria-label="Career Eleven inicio"><span>CE</span><b>CAREER ELEVEN</b><small>2D FOOTBALL CAREER</small></a>
      <nav>
        <a href="#ce-now">EL JUEGO</a>
        <a href="#ce-roadmap">ROADMAP</a>
        <a href="#ce-creators">CREADORES</a>
        <a href="#ce-support">APOYAR</a>
        <button class="public-play compact" data-public-play>JUGAR BETA</button>
      </nav>
    </header>

    <main id="landingTop">
      <section class="public-hero">
        <div class="public-hero-copy">
          <div class="public-kicker"><span></span> BETA PÚBLICA · HECHO DESDE ARGENTINA</div>
          <h1>UNA CARRERA.<br><em>MILES DE HISTORIAS.</em></h1>
          <p class="public-lead">Creá un futbolista. Ganate un lugar. Entrená. Fallá. Mejorá. Cambiá tu destino. Career Eleven quiere convertir una carrera 2D en algo que dé ganas de jugar, mirar, discutir y contar.</p>
          <div class="public-actions">
            <button class="public-play" data-public-play>JUGAR CAREER ELEVEN <span>→</span></button>
            <a class="public-secondary" href="#ce-roadmap">VER HACIA DÓNDE VA</a>
          </div>
          <div class="public-proof">
            <div><b>22</b><span>jugadores en cancha</span></div>
            <div><b>1</b><span>carrera que es sólo tuya</span></div>
            <div><b>∞</b><span>historias emergentes</span></div>
          </div>
        </div>

        <div class="public-pitch-card" aria-label="Representación de un partido 11 contra 11">
          <div class="public-scorebug"><span>CAREER</span><b>2D</b><span>ELEVEN</span></div>
          <div class="public-pitch">
            <i class="half"></i><i class="circle"></i><i class="box box-left"></i><i class="box box-right"></i>
            <div class="public-team team-a">${['9','11','10','7','8','5','3','6','2','4','1'].map((n,i)=>`<span style="--i:${i}">${n}</span>`).join('')}</div>
            <div class="public-team team-b">${['9','11','10','7','8','5','3','6','2','4','1'].map((n,i)=>`<span style="--i:${i}">${n}</span>`).join('')}</div>
            <b class="public-ball"></b>
          </div>
          <div class="public-matchline"><span>FÍSICA LIBRE DE PELOTA</span><span>IA POR POSICIÓN</span><span>AUTOPLAY 11v11</span></div>
        </div>
      </section>

      <section class="public-section public-now" id="ce-now">
        <div class="public-section-head"><span>01 · HOY</span><h2>NO ARRANCÁS SIENDO CRACK.<br>TE LO TENÉS QUE GANAR.</h2><p>La beta ya gira alrededor de una idea simple: vos sos un futbolista, no el manager del universo.</p></div>
        <div class="public-feature-grid">
          <article><b>CREÁ TU PERFIL</b><p>Posición, atributos correlacionados, identidad y un juvenil que todavía tiene todo por demostrar.</p></article>
          <article><b>ENTRENÁ DE VERDAD</b><p>Ejercicios por rol construidos sobre la misma física del partido. Lo que practicás alimenta tu desarrollo.</p></article>
          <article><b>PELEÁ POR MINUTOS</b><p>El entrenador decide. Podés ser titular, suplente o quedar afuera. El puesto no viene regalado.</p></article>
          <article><b>VIVÍ EL PARTIDO</b><p>Autoplay 2D, pelota libre, toques físicos, pases, duelos, desmarques, cansancio y decisiones visibles.</p></article>
          <article><b>CRECÉ CON EL TIEMPO</b><p>Edad, temporadas, atributos, potencial y etapas de carrera forman una trayectoria que cambia.</p></article>
          <article><b>CONSTRUÍ UNA HISTORIA</b><p>Una carrera puede terminar siendo ascenso, banco, gloria, regreso, Europa, selección o algo que nadie planeó.</p></article>
        </div>
      </section>

      <section class="public-section public-roadmap" id="ce-roadmap">
        <div class="public-section-head"><span>02 · ROADMAP</span><h2>ESTO NO TERMINA EN UN MODO CARRERA.</h2><p>El objetivo es construir un ecosistema de fútbol 2D donde la carrera individual termine conectándose con fútbol colectivo real.</p></div>
        <div class="public-roadmap-track">
          <article class="live"><strong>AHORA</strong><h3>Career Mode vivo</h3><p>Entrenamiento por posición, progresión, edad, contratos, entrenador, vestuario, mundo persistente e IA cada vez más personal.</p><small>JUGABLE + EN EXPANSIÓN</small></article>
          <article class="building"><strong>PRÓXIMO</strong><h3>Identidad futbolística</h3><p>Más decisiones por rol, mastery, hábitos, especializaciones y builds que cambien cómo piensa y ejecuta cada jugador.</p><small>EN CONSTRUCCIÓN</small></article>
          <article class="building"><strong>TACTICAL LAB</strong><h3>Diseño de jugadas</h3><p>Playbooks condicionales, patrones de pase, tercer hombre, presión, salida, rupturas, automatismos y respuestas cuando el rival rompe el plan.</p><small>PLANIFICADO</small></article>
          <article class="future"><strong>11 vs 11</strong><h3>Ligas PvP humanas</h3><p>Veintidós personas. Un futbolista por persona. Horarios programados, equipos, temporadas, tablas, promociones y partidos que importan.</p><small>VISIÓN COMPETITIVA</small></article>
          <article class="future"><strong>COMPETITIVO</strong><h3>Infraestructura seria</h3><p>Servidor autoritativo, reconexión, anti-cheat, logs, repeticiones, integridad competitiva y herramientas para torneos.</p><small>VISIÓN A LARGO PLAZO</small></article>
          <article class="future"><strong>ESPECTÁCULO</strong><h3>Hecho para mirar</h3><p>Historias, rivalidades, carreras, ligas y partidos pensados también para streams, videos, narradores y comunidades.</p><small>YOUTUBE · STREAM · COMUNIDAD</small></article>
        </div>
      </section>

      <section class="public-section public-creators" id="ce-creators">
        <div class="public-creator-copy">
          <span>03 · PARA YOUTUBERS Y STREAMERS</span>
          <h2>LA SERIE SE ESCRIBE SOLA.<br>VOS CONTÁS LO QUE PASÓ.</h2>
          <p>¿Te cortaron a los 18 y volviste desde el ascenso? ¿Rechazaste Europa para jugar una Libertadores? ¿Un técnico te bancó hasta llevarte con él? La gracia es que la historia salga del sistema y no de un guion.</p>
          <div class="public-creator-tags"><b>CARRERAS LARGAS</b><b>RIVALIDADES</b><b>CLIPS</b><b>DECISIONES</b><b>DRAMA FUTBOLERO</b><b>PVP FUTURO</b></div>
        </div>
        <aside class="public-creator-note"><small>MENSAJE OFICIAL</small><blockquote>Si Career Eleven te sirve para una serie, te da videos y la comunidad se prende, bancá el proyecto también.<br><b>No sean ratas coludas.</b></blockquote><span>Con cariño. Pero en serio.</span></aside>
      </section>

      <section class="public-section public-support" id="ce-support">
        <div class="public-support-copy"><span>04 · APOYAR</span><h2>AYUDÁ A QUE ESTO SIGA CRECIENDO.</h2><p>Career Eleven es un proyecto independiente. Si querés financiar desarrollo, infraestructura y tiempo de trabajo, podés aportar voluntariamente.</p><small>Los aportes no compran ventajas dentro del juego ni garantizan una función específica.</small></div>
        <div class="public-support-card">
          <div class="public-support-row"><span>ALIAS</span><strong>${support.alias}</strong><button data-copy="${support.alias}">COPIAR</button></div>
          <div class="public-support-row"><span>CVU</span><strong>${support.cvu}</strong><button data-copy="${support.cvu}">COPIAR</button></div>
        </div>
      </section>

      <section class="public-final-cta">
        <small>CAREER ELEVEN · PUBLIC BETA</small>
        <h2>ENTRÁ AHORA.<br>DESPUÉS DECÍ QUE VOS ESTUVISTE AL PRINCIPIO.</h2>
        <button class="public-play" data-public-play>CREAR MI FUTBOLISTA <span>→</span></button>
      </section>
    </main>

    <footer class="public-footer"><b>CAREER ELEVEN</b><span>Proyecto independiente en desarrollo.</span><button data-public-play>ENTRAR AL JUEGO</button></footer>
  </div>`;
}

function closeLanding(){
  sessionStorage.setItem(LANDING_SESSION_KEY,'1');
  document.documentElement.classList.remove('public-landing-open');
  document.querySelector('#publicLanding')?.remove();
  if(location.hash==='#landing'||location.hash==='#play')history.replaceState(null,'',`${location.pathname}${location.search}`);
  window.scrollTo({top:0,behavior:'instant'});
}

export function mountPublicLanding(){
  if(!shouldShowLanding()||document.querySelector('#publicLanding'))return false;
  document.body.insertAdjacentHTML('beforeend',landingMarkup());
  document.documentElement.classList.add('public-landing-open');
  document.querySelectorAll('[data-public-play]').forEach(button=>button.addEventListener('click',closeLanding));
  document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',()=>copyText(button.dataset.copy||'',button)));
  return true;
}

mountPublicLanding();

export const PUBLIC_LANDING_V1={support,LANDING_SESSION_KEY};
