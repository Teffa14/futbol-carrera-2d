import {createClient} from '@supabase/supabase-js';
import {CAREER_VERSION,STORE_KEY} from './career.js';

export const CLOUD_SAVE_VERSION=1;
export const CAREER_SUPABASE_REGION='sa-east-1';
export const CAREER_SUPABASE_URL='https://wrwupigmaoljpfazjrfl.supabase.co';
export const CAREER_SUPABASE_PUBLISHABLE_KEY='sb_publishable_QtZch8557hndsodzFHg1GQ_yyoD7qud';

const META_KEY=`${STORE_KEY}:cloud:v${CLOUD_SAVE_VERSION}`;
const CREDENTIAL_KEY=`${STORE_KEY}:recovery:v${CLOUD_SAVE_VERSION}`;
const POLL_MS=1200;
const UPLOAD_DEBOUNCE_MS=700;
let uploadTimer=null;
let initialized=false;
let lastError=null;
let lastSyncAt=null;
let lastObservedRaw=null;
let operationChain=Promise.resolve();

const supabase=createClient(CAREER_SUPABASE_URL,CAREER_SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});

function readJson(key,fallback=null){
  try{return JSON.parse(localStorage.getItem(key)??'null')??fallback;}catch{return fallback;}
}
function readMeta(){return readJson(META_KEY,{})||{};}
function writeMeta(patch){
  const next={...readMeta(),...patch};
  localStorage.setItem(META_KEY,JSON.stringify(next));
  return next;
}
function localCareer(){
  const parsed=readJson(STORE_KEY,null);
  return parsed?.version===CAREER_VERSION?parsed:null;
}
function base64Url(bytes){
  let binary='';
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function newCredential(){
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  return {saveId:crypto.randomUUID(),secret:base64Url(bytes)};
}
function validCredential(value){
  return Boolean(value&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.saveId)&&/^[A-Za-z0-9_-]{40,128}$/.test(value.secret));
}
function credential(){
  const existing=readJson(CREDENTIAL_KEY,null);
  if(validCredential(existing))return existing;
  const created=newCredential();
  localStorage.setItem(CREDENTIAL_KEY,JSON.stringify(created));
  return created;
}
function setCredential(value){
  if(!validCredential(value))throw new Error('Código de recuperación inválido.');
  localStorage.setItem(CREDENTIAL_KEY,JSON.stringify(value));
}
function emitStatus(){
  globalThis.dispatchEvent?.(new CustomEvent('career-cloud-status',{detail:cloudSaveStatus()}));
}
function setError(error){lastError=error?String(error.message||error):null;emitStatus();}
function enqueue(task){
  operationChain=operationChain.then(task,task).catch(error=>{setError(error);return false;});
  return operationChain;
}

export function recoveryCode(){
  const c=credential();
  return `CE1.${c.saveId}.${c.secret}`;
}
export function parseRecoveryCode(code){
  const parts=String(code||'').trim().split('.');
  const value=parts.length===3&&parts[0].toUpperCase()==='CE1'?{saveId:parts[1],secret:parts[2]}:null;
  if(!validCredential(value))throw new Error('Código de recuperación inválido.');
  return value;
}
export function cloudSaveStatus(){
  return {version:CLOUD_SAVE_VERSION,region:CAREER_SUPABASE_REGION,initialized,lastSyncAt,error:lastError,hasCareer:Boolean(localCareer()),recoveryCode:recoveryCode()};
}

async function readRemote(c=credential()){
  const {data,error}=await supabase.rpc('career_save_read',{p_save_id:c.saveId,p_secret:c.secret});
  if(error)throw error;
  const row=Array.isArray(data)?data[0]:data;
  if(!row||row.career_version!==CAREER_VERSION)return null;
  return row;
}
async function writeRemote(){
  const career=localCareer();
  if(!career)return false;
  const c=credential();
  const {data,error}=await supabase.rpc('career_save_write',{
    p_save_id:c.saveId,
    p_secret:c.secret,
    p_career_version:CAREER_VERSION,
    p_save_data:career
  });
  if(error)throw error;
  const synced=Date.parse(data)||Date.now();
  lastSyncAt=synced;
  writeMeta({remoteSavedAt:synced,clearedAt:null});
  setError(null);
  return true;
}
async function deleteRemote(){
  const c=credential();
  const {error}=await supabase.rpc('career_save_delete',{p_save_id:c.saveId,p_secret:c.secret});
  if(error)throw error;
  lastSyncAt=Date.now();
  writeMeta({remoteSavedAt:lastSyncAt});
  setError(null);
  return true;
}

export function syncNow(){
  clearTimeout(uploadTimer);
  return enqueue(()=>writeRemote());
}
function queueUpload(){
  clearTimeout(uploadTimer);
  uploadTimer=setTimeout(()=>enqueue(()=>writeRemote()),UPLOAD_DEBOUNCE_MS);
}

async function reconcile(){
  const remote=await readRemote();
  const local=localCareer();
  const meta=readMeta();
  const remoteAt=remote?Date.parse(remote.updated_at)||0:0;
  const localAt=Number(meta.localSavedAt)||0;
  const clearedAt=Number(meta.clearedAt)||0;

  if(clearedAt&&clearedAt>=remoteAt&& !local){
    if(remote)await deleteRemote();
    return;
  }
  if(!remote){
    if(local){
      const stamp=localAt||Date.now();
      writeMeta({localSavedAt:stamp,clearedAt:null});
      await writeRemote();
    }
    return;
  }
  if(!local||remoteAt>localAt+1500){
    localStorage.setItem(STORE_KEY,JSON.stringify(remote.save_data));
    lastObservedRaw=localStorage.getItem(STORE_KEY);
    writeMeta({localSavedAt:remoteAt,remoteSavedAt:remoteAt,clearedAt:null});
    lastSyncAt=remoteAt;
    setError(null);
    if(typeof location!=='undefined')location.reload();
    return;
  }
  if(localAt>remoteAt+1500)await writeRemote();
}

function observeLocalSave(){
  const raw=localStorage.getItem(STORE_KEY);
  if(raw===lastObservedRaw)return;
  lastObservedRaw=raw;
  const now=Date.now();
  clearTimeout(uploadTimer);
  if(raw===null){
    writeMeta({localSavedAt:now,clearedAt:now});
    enqueue(()=>deleteRemote());
    return;
  }
  const parsed=localCareer();
  if(!parsed)return;
  writeMeta({localSavedAt:now,clearedAt:null});
  queueUpload();
}

export async function restoreWithRecoveryCode(code){
  const candidate=parseRecoveryCode(code);
  const remote=await readRemote(candidate);
  if(!remote)throw new Error('No encontramos una carrera para ese código.');
  setCredential(candidate);
  localStorage.setItem(STORE_KEY,JSON.stringify(remote.save_data));
  lastObservedRaw=localStorage.getItem(STORE_KEY);
  const remoteAt=Date.parse(remote.updated_at)||Date.now();
  writeMeta({localSavedAt:remoteAt,remoteSavedAt:remoteAt,clearedAt:null});
  lastSyncAt=remoteAt;
  setError(null);
  return remote.save_data;
}

export async function initializeCloudSave(){
  if(initialized)return cloudSaveStatus();
  credential();
  lastObservedRaw=localStorage.getItem(STORE_KEY);
  try{await reconcile();setError(null);}catch(error){setError(error);}
  initialized=true;
  emitStatus();
  return cloudSaveStatus();
}

setInterval(observeLocalSave,POLL_MS);
void initializeCloudSave();

globalThis.CareerCloudSave={
  status:cloudSaveStatus,
  recoveryCode,
  syncNow,
  restore:restoreWithRecoveryCode,
  initialize:initializeCloudSave
};
