const STYLE_ID='career-cloud-save-style-v1';
const BUTTON_ID='career-cloud-save-button-v1';
const MODAL_ID='career-cloud-save-modal-v1';

function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function cloud(){return globalThis.CareerCloudSave||null;}
function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    .cloud-save-overlay{position:fixed;inset:0;z-index:100000;background:rgba(2,8,5,.82);display:grid;place-items:center;padding:18px;backdrop-filter:blur(8px)}
    .cloud-save-panel{width:min(620px,100%);max-height:88vh;overflow:auto;background:#0d1812;border:1px solid rgba(216,255,76,.24);border-radius:22px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.45);color:#f4f7f1}
    .cloud-save-panel h2{margin:4px 0 8px;font-size:clamp(24px,5vw,34px)}
    .cloud-save-panel p{color:#aab8b0;line-height:1.5}
    .cloud-save-panel .cloud-kicker{font-size:11px;letter-spacing:.15em;color:#d8ff4c;font-weight:800}
    .cloud-save-panel label{display:block;margin-top:16px;font-size:12px;font-weight:800;color:#d8e0da}
    .cloud-save-panel textarea,.cloud-save-panel input{box-sizing:border-box;width:100%;margin-top:7px;border:1px solid #2b3d32;border-radius:12px;background:#07110c;color:#f4f7f1;padding:12px;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
    .cloud-save-panel textarea{min-height:82px;resize:vertical}
    .cloud-save-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
    .cloud-save-actions button{border:0;border-radius:12px;padding:11px 14px;font:inherit;font-weight:800;cursor:pointer;background:#d8ff4c;color:#07110c}
    .cloud-save-actions button.secondary{background:#1a2a20;color:#eaf1ec;border:1px solid #304536}
    .cloud-save-actions button:disabled{opacity:.5;cursor:wait}
    .cloud-save-warning{margin-top:14px;padding:12px;border-radius:12px;background:#151d16;border:1px solid #394333;color:#dbe5dc;font-size:12px;line-height:1.45}
    .cloud-save-status{min-height:20px;margin-top:12px;color:#d8ff4c;font-size:12px;font-weight:700}
    .cloud-save-close{float:right;background:transparent!important;color:#bac7be!important;border:0!important;padding:4px 8px!important;font-size:22px!important}
  `;
  document.head.appendChild(style);
}

async function copyText(text){
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
  const area=document.createElement('textarea');
  area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
}
function formatSync(time){return time?new Date(time).toLocaleString('es-AR'):'Todavía no sincronizada';}
function setStatus(modal,text,error=false){
  const node=modal.querySelector('.cloud-save-status');
  if(!node)return;
  node.textContent=text;
  node.style.color=error?'#ff9b9b':'#d8ff4c';
}

function openModal(){
  const api=cloud();
  if(!api)return;
  document.getElementById(MODAL_ID)?.remove();
  ensureStyle();
  const status=api.status();
  const code=api.recoveryCode();
  const overlay=document.createElement('div');
  overlay.id=MODAL_ID;
  overlay.className='cloud-save-overlay';
  overlay.innerHTML=`<section class="cloud-save-panel" role="dialog" aria-modal="true" aria-label="Guardado en la nube">
    <button class="cloud-save-close" data-cloud-close aria-label="Cerrar">×</button>
    <div class="cloud-kicker">CAREER ELEVEN · CLOUD SAVE</div>
    <h2>Tu carrera, también en la nube.</h2>
    <p>El juego sigue guardando primero en este dispositivo. Supabase mantiene una copia recuperable sin pedirte una cuenta.</p>
    <label>Tu código de recuperación</label>
    <textarea readonly data-cloud-code>${esc(code)}</textarea>
    <div class="cloud-save-actions">
      <button data-cloud-copy>Copiar código</button>
      <button class="secondary" data-cloud-sync>Sincronizar ahora</button>
    </div>
    <div class="cloud-save-warning"><b>Guardá este código fuera del juego.</b> Cualquiera que tenga el código puede abrir esa carrera. Career Eleven no guarda la clave en texto plano en la base.</div>
    <label>Recuperar una carrera en este dispositivo</label>
    <input data-cloud-restore-code placeholder="Pegá un código CE1…" autocomplete="off" spellcheck="false" />
    <div class="cloud-save-actions"><button class="secondary" data-cloud-restore>Recuperar carrera</button></div>
    <div class="cloud-save-status">${status.error?`Nube no disponible: ${esc(status.error)}`:`Última sincronización: ${esc(formatSync(status.lastSyncAt))}`}</div>
  </section>`;
  document.body.appendChild(overlay);
  const close=()=>overlay.remove();
  overlay.querySelector('[data-cloud-close]').onclick=close;
  overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
  overlay.querySelector('[data-cloud-copy]').onclick=async event=>{
    try{await copyText(code);setStatus(overlay,'Código copiado. Guardalo en un lugar seguro.');event.currentTarget.textContent='Copiado';}
    catch(error){setStatus(overlay,String(error?.message||error),true);}
  };
  overlay.querySelector('[data-cloud-sync]').onclick=async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{
      const ok=await api.syncNow();
      setStatus(overlay,ok?`Sincronizada: ${formatSync(Date.now())}`:'Creá una carrera antes de sincronizar.');
    }catch(error){setStatus(overlay,String(error?.message||error),true);}
    finally{button.disabled=false;}
  };
  overlay.querySelector('[data-cloud-restore]').onclick=async event=>{
    const button=event.currentTarget;
    const value=overlay.querySelector('[data-cloud-restore-code]').value;
    if(!value.trim()){setStatus(overlay,'Pegá primero el código de recuperación.',true);return;}
    button.disabled=true;
    try{
      await api.restore(value);
      setStatus(overlay,'Carrera recuperada. Recargando…');
      setTimeout(()=>location.reload(),250);
    }catch(error){setStatus(overlay,String(error?.message||error),true);button.disabled=false;}
  };
}

function ensureButton(){
  const nav=document.querySelector('.nav');
  if(!nav||document.getElementById(BUTTON_ID)||!cloud())return;
  const button=document.createElement('button');
  button.id=BUTTON_ID;
  button.className='nav-btn';
  button.type='button';
  button.innerHTML='<span>☁</span>Nube';
  button.onclick=openModal;
  const reset=nav.querySelector('.reset');
  nav.insertBefore(button,reset||null);
}

ensureStyle();
ensureButton();
const observer=new MutationObserver(()=>queueMicrotask(ensureButton));
observer.observe(document.body,{childList:true,subtree:true});
globalThis.addEventListener?.('career-cloud-status',ensureButton);
