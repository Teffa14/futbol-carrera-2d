import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testsDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(testsDir,'..');
const cloud=fs.readFileSync(path.join(root,'cloud-save-v1.js'),'utf8');
const cloudUi=fs.readFileSync(path.join(root,'cloud-save-ui-v1.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/202608210001_create_career_saves.sql'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

test('cloud save points at the South America production project with only a publishable key',()=>{
  assert.match(cloud,/CAREER_SUPABASE_REGION='sa-east-1'/);
  assert.match(cloud,/https:\/\/wrwupigmaoljpfazjrfl\.supabase\.co/);
  assert.match(cloud,/sb_publishable_/);
  assert.doesNotMatch(cloud,/service[_-]?role/i);
  assert.doesNotMatch(cloud,/sb_secret_/i);
});

test('cloud save uses a high-entropy recovery credential instead of personal identity',()=>{
  assert.match(cloud,/crypto\.getRandomValues\(new Uint8Array\(32\)\)/);
  assert.match(cloud,/crypto\.randomUUID\(\)/);
  assert.match(cloud,/`CE1\.\$\{c\.saveId\}\.\$\{c\.secret\}`/);
  assert.doesNotMatch(cloud,/signInAnonymously/);
  assert.doesNotMatch(cloud,/signInWithOtp/);
  assert.doesNotMatch(cloudUi,/type=["']email["']/i);
  assert.doesNotMatch(cloudUi,/type=["']tel["']/i);
});

test('cloud save observes the existing local save without replacing Storage methods',()=>{
  assert.match(cloud,/localStorage\.getItem\(STORE_KEY\)/);
  assert.match(cloud,/setInterval\(observeLocalSave,POLL_MS\)/);
  assert.match(cloud,/queueUpload\(\)/);
  assert.doesNotMatch(cloud,/Storage\.prototype\.setItem\s*=/);
  assert.doesNotMatch(cloud,/Storage\.prototype\.removeItem\s*=/);
});

test('recovery secret is hashed server-side and RLS checks that secret on every table operation',()=>{
  assert.match(migration,/secret_hash bytea not null/i);
  assert.match(migration,/digest\(convert_to\(p_secret,'UTF8'\),'sha256'\)/i);
  assert.match(migration,/enable row level security/i);
  assert.match(migration,/current_setting\('app\.career_secret', true\)/i);
  assert.match(migration,/career_saves_select_recovery_key/i);
  assert.match(migration,/career_saves_insert_recovery_key/i);
  assert.match(migration,/career_saves_update_recovery_key/i);
  assert.match(migration,/career_saves_delete_recovery_key/i);
  assert.doesNotMatch(migration,/user_id/i);
  assert.doesNotMatch(migration,/auth\.uid\(\)/i);
});

test('browser RPCs run with caller privileges instead of SECURITY DEFINER elevation',()=>{
  assert.match(migration,/security invoker/ig);
  assert.doesNotMatch(migration,/security definer/i);
  assert.match(migration,/set_config\('app\.career_secret',p_secret,true\)/i);
  assert.match(migration,/grant select, insert, update, delete on table public\.career_saves to anon/i);
  assert.match(migration,/revoke all on table public\.career_saves from authenticated/i);
  assert.match(migration,/grant execute on function public\.career_save_write[\s\S]*to anon/i);
  assert.match(migration,/grant execute on function public\.career_save_read[\s\S]*to anon/i);
  assert.match(migration,/grant execute on function public\.career_save_delete[\s\S]*to anon/i);
  assert.match(migration,/revoke all on function public\.career_save_write[\s\S]*from authenticated/i);
  assert.match(migration,/pg_column_size\(p_save_data\) > 5242880/i);
});

test('cloud runtime loads before app and recovery UI loads after app',()=>{
  const cloudAt=index.indexOf("import './cloud-save-v1.js';");
  const appAt=index.indexOf("import './app.js';");
  const uiAt=index.indexOf("import './cloud-save-ui-v1.js';");
  assert.ok(cloudAt>=0&&appAt>=0&&uiAt>=0);
  assert.ok(cloudAt<appAt,'cloud runtime should start before app');
  assert.ok(appAt<uiAt,'cloud UI should attach after app');
});

test('cloud UI exposes copy, save, and cross-device recovery actions',()=>{
  assert.match(cloudUi,/Copiar código/);
  assert.match(cloudUi,/Guardar copia ahora/);
  assert.match(cloudUi,/Recuperar carrera/);
  assert.match(cloudUi,/Guardá este código fuera del juego/);
  assert.match(cloud,/restoreWithRecoveryCode/);
});

test('Supabase browser client version is pinned',()=>{
  assert.equal(pkg.dependencies?.['@supabase/supabase-js'],'2.112.3');
});
