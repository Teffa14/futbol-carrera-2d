import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testsDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(testsDir,'..');
const dist=path.join(root,'dist');
const html=()=>fs.readFileSync(path.join(dist,'index.html'),'utf8');

test('production artifact is one self-contained HTML file',()=>{
  assert.ok(fs.existsSync(path.join(dist,'index.html')),'dist/index.html must exist');
  assert.deepEqual(fs.readdirSync(dist).sort(),['index.html']);
  assert.match(html(),/<meta name="career-build" content="self-contained">/);
});

test('production page embeds styles and executable game code',()=>{
  const source=html();
  assert.match(source,/<style>[\s\S]+<\/style>/);
  assert.match(source,/<script>[\s\S]+<\/script>/);
  assert.match(source,/CAREER ELEVEN|Career Eleven/);
  assert.doesNotMatch(source,/type=["']module["']/i);
});

test('production page has no runtime GitHub module loader or missing core asset dependency',()=>{
  const source=html();
  assert.doesNotMatch(source,/raw\.githubusercontent\.com/);
  assert.doesNotMatch(source,/createObjectURL\s*\(\s*new Blob/);
  assert.doesNotMatch(source,/(?:src|href)=["']\.\/(?:app|styles|character-creation)\./i);
  assert.doesNotMatch(source,/from\s+['"]\.\//);
});
