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
      <a class="public-landing-brand" href="#landingTop" aria-label="Career Eleven inicio"><span>CE</span><b>CAREER ELEVEN</b><small>CARRERA DE FUTBOLISTA</small></a>
      <nav>
        <a href="#ce-now">EL JUEGO</a>
        <a href="#ce-roadmap">PRÓXIMOS CAMBIOS</a>
        <a href="#ce-creators">CREADORES</a>
        <a href="#ce-support">APOYAR</a>
        <button class="public-play compact" data-public-play>JUGAR</button>
      </nav>
    </header>

    <main id="landingTop">
      <section class="public-hero">
        <div class="public-hero-copy">
          <div class="public-kicker"><span></span> BETA PÚBLICA · HECHO EN ARGENTINA</div>
          <h1>NO TE REGALAN EL PUESTO.<br><em>GANÁTELO.</em></h1>
          <p class="public-lead">Llegás como juvenil a un plantel que ya existe. El DT arma el equipo. Tus compañeros compiten por los mismos minutos. Entrenás durante la semana y cada fecha puede acercarte al once o devolverte al banco.</p>
          <div class="public-actions">
            <button class="public-play" data-public-play>IR A LA PRUEBA <span>→</span></button>
            <a class="public-secondary" href="#ce-now">VER QUÉ HAY HOY</a>
          </div>
          <div class="public-proof">
            <div><b>11</b><span>titulares</span></div>
            <div><b>1</b><span>puesto que tenés que defender</span></div>
            <div><b>90′</b><span>para demostrarlo</span></div>
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
          <div class="public-matchline"><span>TU PUESTO</span><span>TU EQUIPO</span><span>TU PARTIDO</span></div>
        </div>
      </section>

      <section class="public-section public-now" id="ce-now">
        <div class="public-section-head"><span>01 · EN LA BETA</span><h2>LLEGÁS A UN CLUB.<br>AHORA TENÉS QUE JUGAR.</h2><p>El plantel no se acomoda a vos. Hay un DT, una jerarquía y un calendario. Tu lugar cambia según lo que hacés.</p></div>
        <div class="public-feature-grid">
          <article><b>PRUEBA DE INGRESO</b><p>Tres ejercicios y dos partidos antes de recibir ofertas. Los visores miran cómo resolvés cada situación.</p></article>
          <article><b>ENTRENAMIENTO</b><p>Elegí trabajos de tu puesto. La sesión muestra qué resolvés bien y qué necesitás repetir antes del próximo partido.</p></article>
          <article><b>EL ONCE LO ARMA EL DT</b><p>Podés ser titular, entrar desde el banco o mirar desde afuera. El puesto se sostiene con rendimiento.</p></article>
          <article><b>TENÉS UN TRABAJO EN CANCHA</b><p>Un nueve fija centrales. Un cinco cierra el medio. Un lateral decide cuándo pasar. El DT espera cosas distintas de cada puesto.</p></article>
          <article><b>VESTUARIO</b><p>Las sociedades se construyen jugando. La jerarquía y la confianza cambian tu lugar dentro del plantel.</p></article>
          <article><b>TEMPORADA</b><p>Tabla, racha, cansancio, contratos y decisiones se acumulan. El partido siguiente no empieza de cero.</p></article>
        </div>
      </section>

      <section class="public-section public-roadmap" id="ce-roadmap">
        <div class="public-section-head"><span>02 · LO QUE FALTA</span><h2>HAY MUCHO FÚTBOL TODAVÍA POR METER.</h2><p>El foco es hacer más profunda la carrera y dar más peso a lo que pasa entre un partido y el siguiente.</p></div>
        <div class="public-roadmap-track">
          <article class="live"><strong>AHORA</strong><h3>Carrera individual</h3><p>Prueba, club, entrenamiento, rol, partidos, tabla, vestuario y desarrollo del jugador.</p><small>BETA ACTIVA</small></article>
          <article class="building"><strong>SIGUIENTE</strong><h3>Más decisiones de cancha</h3><p>Más lecturas por puesto, movimientos, asociaciones, duelos y soluciones distintas para un mismo futbolista.</p><small>EN DESARROLLO</small></article>
          <article class="building"><strong>TÁCTICA</strong><h3>Preparar jugadas</h3><p>Trabajar movimientos y relaciones durante la semana para intentar repetirlos cuando el partido los permita.</p><small>PLANIFICADO</small></article>
          <article class="future"><strong>11 vs 11</strong><h3>Un jugador por persona</h3><p>Partidos organizados donde cada persona lleva su futbolista y comparte equipo con otros diez.</p><small>A FUTURO</small></article>
          <article class="future"><strong>COMPETENCIA</strong><h3>Ligas organizadas</h3><p>Calendario, tablas, ascensos, descensos, estadísticas y temporadas que puedan sostenerse en el tiempo.</p><small>A FUTURO</small></article>
          <article class="future"><strong>COMUNIDAD</strong><h3>Seguir una carrera fecha a fecha</h3><p>Rendimientos, rivalidades, decisiones, transferencias y partidos que den motivos para volver a mirar.</p><small>A FUTURO</small></article>
        </div>
      </section>

      <section class="public-section public-creators" id="ce-creators">
        <div class="public-creator-copy">
          <span>03 · PARA CREAR CONTENIDO</span>
          <h2>SI TE PASÓ ALGO QUE NO PODÉS CREER,<br>MOSTRALO.</h2>
          <p>Que te sienten después de tres partidos malos. Que un pibe te saque el puesto. Que vuelvas al club donde arrancaste. Que llegues a una final siendo suplente. Si la carrera produce algo bueno, el contenido sale de lo que pasó en cancha.</p>
          <div class="public-creator-tags"><b>BANCO</b><b>TITULARIDAD</b><b>TRANSFERENCIAS</b><b>RIVALIDADES</b><b>FINALES</b><b>SELECCIÓN</b></div>
        </div>
        <aside class="public-creator-note"><small>MENSAJE OFICIAL</small><blockquote>Si te da una serie, te da clips y te da horas de juego, podés bancar el desarrollo también.<br><b>No sean ratas coludas.</b></blockquote><span>Con cariño. Pero en serio.</span></aside>
      </section>

      <section class="public-section public-support" id="ce-support">
        <div class="public-support-copy"><span>04 · APOYAR</span><h2>SI LO ESTÁS JUGANDO, PODÉS BANCARLO.</h2><p>Career Eleven es independiente. Los aportes son voluntarios y ayudan a cubrir desarrollo y costos del proyecto.</p><small>Los aportes no compran ventajas dentro del juego ni garantizan una función específica.</small></div>
        <div class="public-support-card">
          <div class="public-support-row"><span>ALIAS</span><strong>${support.alias}</strong><button data-copy="${support.alias}">COPIAR</button></div>
          <div class="public-support-row"><span>CVU</span><strong>${support.cvu}</strong><button data-copy="${support.cvu}">COPIAR</button></div>
        </div>
      </section>

      <section class="public-final-cta">
        <small>PRIMER PASO · PRUEBA DE INGRESO</small>
        <h2>TRES EJERCICIOS.<br>DOS PARTIDOS.<br>DESPUÉS LLEGAN LAS OFERTAS.</h2>
        <button class="public-play" data-public-play>EMPEZAR LA PRUEBA <span>→</span></button>
      </section>
    </main>

    <footer class="public-footer"><b>CAREER ELEVEN</b><span>Beta independiente en desarrollo.</span><button data-public-play>JUGAR</button></footer>
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
