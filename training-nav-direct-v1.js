import {loadCareer} from './career.js';
import {trainingHomeMarkup} from './training-ui-v2.js';

export const TRAINING_NAV_DIRECT_VERSION=1;

export function openTrainingDirect(doc=globalThis.document,stateOverride=null){
  if(!doc?.querySelector||!doc?.querySelectorAll)return false;
  const main=doc.querySelector('.main');
  const state=stateOverride||loadCareer();
  if(!main||!state?.player)return false;
  for(const button of doc.querySelectorAll('.nav-btn[data-view]'))button.classList?.toggle?.('on',button.dataset?.view==='training');
  doc.body?.classList?.remove?.('match-live-active','matchday-v3-live','matchday-v3-preview','prematch-v2','training-live-v5');
  main.innerHTML=trainingHomeMarkup(state);
  return true;
}

function intercept(event){
  const trigger=event.target?.closest?.('[data-view="training"]');
  if(!trigger)return;
  event.preventDefault?.();
  event.stopImmediatePropagation?.();
  openTrainingDirect(document);
}

if(typeof document!=='undefined')document.addEventListener('click',intercept,true);
export const __trainingNavDirectV1={openTrainingDirect,intercept};
