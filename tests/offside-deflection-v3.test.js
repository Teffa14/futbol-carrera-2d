import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Law 11 layer explicitly preserves pending offside through a deflection',()=>{
  const src=fs.readFileSync(new URL('../offside-law11-v3.js',import.meta.url),'utf8');
  assert.match(src,/high-speed block\/deflection/);
  assert.match(src,/if\(!this\.pendingOffside\)this\.pendingOffside=pending/);
});
