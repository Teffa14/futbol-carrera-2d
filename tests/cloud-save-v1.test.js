import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testsDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(testsDir,'..');
const cloud=fs.readFileSync(path.join(root,'cloud-save-v1.js'),'utf8');
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

test('local career storage remains the first durable save and cloud upload is secondary',()=>{
  assert.match(cloud,/STORE_KEY/);
  assert.match(cloud,/nativeSetItem\.call\(this,key,value\)/);
  assert.match(cloud,/queueUpload\(\)/);
  assert.match(cloud,/catch\(setError\)/);
});

test('cloud save installs before app so every career write can be mirrored',()=>{
  const cloudAt=index.indexOf("import './cloud-save-v1.js';");
  const appAt=index.indexOf("import './app.js';");
  assert.ok(cloudAt>=0,'cloud save module must be imported');
  assert.ok(appAt>=0,'app module must be imported');
  assert.ok(cloudAt<appAt,'cloud save module must run before app.js');
});

test('career_saves enforces row level security by authenticated user id',()=>{
  assert.match(migration,/enable row level security/i);
  assert.match(migration,/auth\.uid\(\)/);
  assert.match(migration,/for select[\s\S]*to authenticated/i);
  assert.match(migration,/for insert[\s\S]*to authenticated/i);
  assert.match(migration,/for update[\s\S]*to authenticated/i);
  assert.match(migration,/for delete[\s\S]*to authenticated/i);
});

test('Supabase browser client version is pinned',()=>{
  assert.equal(pkg.dependencies?.['@supabase/supabase-js'],'2.112.3');
});
