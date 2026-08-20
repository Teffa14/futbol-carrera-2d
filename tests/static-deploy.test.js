import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testsDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(testsDir,'..');
const dist=path.join(root,'dist');

const read=name=>fs.readFileSync(path.join(dist,name),'utf8');

test('production artifact contains local application assets',()=>{
  for(const name of ['index.html','app.js','styles.css','character-creation.css','data.js','engine.js','career.js']){
    assert.ok(fs.existsSync(path.join(dist,name)),`${name} must be present in dist/`);
  }
});

test('production entrypoint loads local modules instead of a GitHub runtime loader',()=>{
  const index=read('index.html');
  assert.match(index,/import\s+['"]\.\/app\.js['"]/);
  assert.doesNotMatch(index,/raw\.githubusercontent\.com/);
  assert.doesNotMatch(index,/createObjectURL\s*\(\s*new Blob/);
});

test('production artifact preserves relative module graph',()=>{
  const app=read('app.js');
  assert.match(app,/from\s+['"]\.\/engine\.js['"]/);
  assert.match(app,/from\s+['"]\.\/career\.js['"]/);
  assert.ok(fs.existsSync(path.join(dist,'engine.js')));
  assert.ok(fs.existsSync(path.join(dist,'career.js')));
});
