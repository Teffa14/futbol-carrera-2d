import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files=['training-live-ui-v3.js'];

test('blob-loaded production modules do not keep unresolved side-effect relative imports',()=>{
  for(const file of files){
    const src=fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
    assert.doesNotMatch(src,/import\s+['"]\.\//,`${file} contains a side-effect relative import that a blob: URL cannot resolve`);
  }
});
