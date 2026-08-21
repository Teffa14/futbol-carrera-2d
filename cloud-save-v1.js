import {createClient} from '@supabase/supabase-js';
import {CAREER_VERSION,STORE_KEY} from './career.js';

export const CLOUD_SAVE_VERSION=1;
export const CAREER_SUPABASE_REGION='sa-east-1';
export const CAREER_SUPABASE_URL='https://wrwupigmaoljpfazjrfl.supabase.co';
export const CAREER_SUPABASE_PUBLISHABLE_KEY='sb_publishable_QtZch8557hndsodzFHg1GQ_yyoD7qud';

const META_KEY=`${STORE_KEY}:cloud:v${CLOUD_SAVE_VERSION}`;
const AUTH_STORAGE_KEY='career-eleven-auth-v1';
const nativeSetItem=Storage.prototype.setItem;
const nativeRemoveItem=Storage.prototype.removeItem;
let suppressLocalHook=false;
let uploadTimer=null;
let session=null;
let initialized=false;
let lastError=null;
let lastSyncAt=null;

const supabase=createClient(CAREER_SUPABASE_URL,CAREER_SUPABASE_PUBLISHABLE_KEY,{
  auth:{
    persistSession:true,
    autoRefreshToken:true,
    detectSessionInUrl:true,
    storageKey:AUTH_STORAGE_KEY
  }
});

function readMeta(){
  try{return JSON.parse(localStorage.getItem(META_KEY)||'{}')||{};}catch{return{};}
}
function writeMeta(patch){
  const next={...readMeta(),...patch};
  nativeSetItem.call(localStorage,META_KEY,JSON.stringify(next));
  return next;
}
function localCareer(){
  try{
    const raw=localStorage.getItem(STORE_KEY);
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    return parsed?.version===CAREER_VERSION?parsed:null;
  }catch{return null;}
}
function emitStatus(){
  const detail=cloudSaveStatus();
  globalThis.dispatchEvent?.(new CustomEvent('career-cloud-status',{detail}));
}
function setError(error){
  lastError=error?String(error.message||error):null;
  emitStatus();
}

export function cloudSaveStatus(){
  return {
    version:CLOUD_SAVE_VERSION,
    region:CAREER_SUPABASE_REGION,
    initialized,
    authenticated:Boolean(session?.user?.id),
    anonymous:Boolean(session?.user?.is_anonymous),
    userId:session?.user?.id||null,
    lastSyncAt,
    error:lastError
  };
}

async function requireSession(){
  if(session?.user?.id)return session;
  const current=await supabase.auth.getSession();
  if(current.error)throw current.error;
  if(current.data.session){session=current.data.session;return session;}
  const created=await supabase.auth.signInAnonymously({options:{data:{product:'career-eleven'}}});
  if(created.error)throw created.error;
  session=created.data.session;
  return session;
}

async function remoteCareer(){
  if(!session?.user?.id)return null;
  const {data,error}=await supabase
    .from('career_saves')
    .select('career_version,save_data,updated_at')
    .eq('user_id',session.user.id)
    .maybeSingle();
  if(error)throw error;
  if(!data||data.career_version!==CAREER_VERSION)return null;
  return data;
}

export async function pushCareerToCloud(){
  const career=localCareer();
  if(!career)return false;
  await requireSession();
  const {error}=await supabase.from('career_saves').upsert({
    user_id:session.user.id,
    career_version:CAREER_VERSION,
    save_data:career,
    updated_at:new Date().toISOString()
  },{onConflict:'user_id'});
  if(error)throw error;
  lastSyncAt=Date.now();
  writeMeta({localSavedAt:lastSyncAt,remoteSavedAt:lastSyncAt});
  setError(null);
  return true;
}

async function deleteCloudCareer(){
  await requireSession();
  const {error}=await supabase.from('career_saves').delete().eq('user_id',session.user.id);
  if(error)throw error;
  lastSyncAt=Date.now();
  writeMeta({localSavedAt:lastSyncAt,remoteSavedAt:lastSyncAt});
  setError(null);
}

function queueUpload(){
  clearTimeout(uploadTimer);
  uploadTimer=setTimeout(()=>{
    pushCareerToCloud().catch(setError);
  },900);
}

function installLocalSaveMirror(){
  if(Storage.prototype.__careerCloudSaveV1)return;
  Object.defineProperty(Storage.prototype,'__careerCloudSaveV1',{value:true,configurable:false});
  Storage.prototype.setItem=function(key,value){
    nativeSetItem.call(this,key,value);
    if(this!==localStorage||key!==STORE_KEY||suppressLocalHook)return;
    writeMeta({localSavedAt:Date.now()});
    queueUpload();
  };
  Storage.prototype.removeItem=function(key){
    nativeRemoveItem.call(this,key);
    if(this!==localStorage||key!==STORE_KEY||suppressLocalHook)return;
    writeMeta({localSavedAt:Date.now()});
    clearTimeout(uploadTimer);
    deleteCloudCareer().catch(setError);
  };
}

async function reconcileCloudAndLocal(){
  const remote=await remoteCareer();
  const local=localCareer();
  if(!remote){
    if(local)await pushCareerToCloud();
    return;
  }
  const remoteAt=Date.parse(remote.updated_at)||0;
  const localAt=Number(readMeta().localSavedAt)||0;
  if(!local||remoteAt>localAt+1500){
    suppressLocalHook=true;
    try{
      nativeSetItem.call(localStorage,STORE_KEY,JSON.stringify(remote.save_data));
      writeMeta({localSavedAt:remoteAt,remoteSavedAt:remoteAt});
    }finally{suppressLocalHook=false;}
    lastSyncAt=remoteAt;
    setError(null);
    if(typeof location!=='undefined')location.reload();
    return;
  }
  if(localAt>remoteAt+1500)await pushCareerToCloud();
}

export async function initializeCloudSave(){
  if(initialized)return cloudSaveStatus();
  try{
    await requireSession();
    initialized=true;
    await reconcileCloudAndLocal();
    setError(null);
  }catch(error){
    initialized=true;
    setError(error);
  }
  emitStatus();
  return cloudSaveStatus();
}

installLocalSaveMirror();
void initializeCloudSave();

globalThis.CareerCloudSave={
  status:cloudSaveStatus,
  syncNow:()=>pushCareerToCloud(),
  initialize:()=>initializeCloudSave()
};
