import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testsDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(testsDir,'..');
const dist=path.join(root,'dist');
const html=()=>fs.readFileSync(path.join(dist,'index.html'),'utf8');

test('production artifact keeps the stable loader marker and a separate content fingerprint',()=>{
  assert.ok(fs.existsSync(path.join(dist,'index.html')),'dist/index.html must exist');
  assert.deepEqual(fs.readdirSync(dist).sort(),['index.html']);
  const source=html();
  assert.match(source,/<meta name="career-build" content="self-contained">/);
  assert.match(source,/<meta name="career-build-id" content="[a-f0-9]{12}">/);
});

test('production page embeds styles and executable game code',()=>{
  const source=html();
  assert.match(source,/<style>[\s\S]+<\/style>/);
  assert.match(source,/<script>[\s\S]+<\/script>/);
  assert.match(source,/CAREER ELEVEN|Career Eleven/);
  assert.doesNotMatch(source,/type=["']module["']/i);
});

test('production page has no runtime GitHub loader, repository identity, or missing core asset dependency',()=>{
  const source=html();
  assert.doesNotMatch(source,/raw\.githubusercontent\.com/i);
  assert.doesNotMatch(source,/Teffa14\/futbol-carrera-2d/i);
  assert.doesNotMatch(source,/github\.com\/Teffa14/i);
  assert.doesNotMatch(source,/api\.github\.com\/repos\/Teffa14/i);
  assert.doesNotMatch(source,/createObjectURL\s*\(\s*new Blob/);
  assert.doesNotMatch(source,/(?:src|href)=["']\.\/(?:app|styles|character-creation)\./i);
  assert.doesNotMatch(source,/from\s+['"]\.\//);
});

test('Vercel never serves a stale game shell that requires Ctrl+F5',()=>{
  const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
  const headers=config.headers?.find(rule=>rule.source==='/(.*)')?.headers||[];
  const values=Object.fromEntries(headers.map(h=>[String(h.key).toLowerCase(),String(h.value).toLowerCase()]));
  assert.match(values['cache-control']||'',/no-store/);
  assert.match(values['cache-control']||'',/max-age=0/);
  assert.equal(values['cdn-cache-control'],'no-store');
  assert.equal(values['vercel-cdn-cache-control'],'no-store');
});

test('main validation workflow publishes static Build Output API payload without Vercel build inference',()=>{
  const workflow=fs.readFileSync(path.join(root,'.github','workflows','smoke.yml'),'utf8');
  assert.match(workflow,/\.vercel\/output\/static/);
  assert.match(workflow,/version:\s*3/);
  assert.match(workflow,/deploy --prebuilt --prod/);
  assert.match(workflow,/github\.event_name == 'push'/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(workflow,/vercel@latest build/);
  assert.doesNotMatch(workflow,/vercel@latest pull/);
});

test('legacy production workflow remains disabled so only validated main can publish',()=>{
  const legacy=fs.readFileSync(path.join(root,'.github','workflows','deploy-vercel-production.yml'),'utf8');
  assert.match(legacy,/Legacy Vercel deploy disabled/);
  assert.match(legacy,/workflow_dispatch/);
  assert.doesNotMatch(legacy,/push:\s*\n\s*branches:\s*\[main\]/);
  assert.doesNotMatch(legacy,/deploy --prebuilt --prod/);
});
