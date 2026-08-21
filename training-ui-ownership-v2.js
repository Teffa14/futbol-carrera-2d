export const TRAINING_UI_OWNER_VERSION=2;

export function claimTrainingUiOwnership(doc=globalThis.document){
  if(!doc?.body||typeof doc.querySelector!=='function'||typeof doc.createElement!=='function')return null;
  const existing=doc.querySelector('#training-sim-shell');
  if(existing)return existing;
  const sentinel=doc.createElement('div');
  sentinel.id='training-sim-shell';
  sentinel.hidden=true;
  sentinel.setAttribute?.('data-training-owner','v2');
  sentinel.setAttribute?.('aria-hidden','true');
  doc.body.appendChild(sentinel);
  return sentinel;
}

if(typeof document!=='undefined')claimTrainingUiOwnership(document);
