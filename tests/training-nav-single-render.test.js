import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const ui=await readFile(new URL('../training-ui-v2.js',import.meta.url),'utf8');
const app=await readFile(new URL('../app.js',import.meta.url),'utf8');

test('training sidebar navigation is owned by one direct renderer',()=>{
  assert.match(ui,/document\.addEventListener\('click',interceptTrainingNavigation,true\)/);
  assert.match(ui,/stopImmediatePropagation\?\.\(\)/);
  assert.match(ui,/renderTrainingHomeNow\(document\)/);
  assert.doesNotMatch(ui,/new MutationObserver\(decorateTrainingHome\)/);
});

test('training navigation interception targets only the training view',()=>{
  assert.match(ui,/closest\?\.\('\[data-view="training"\]'\)/);
  assert.match(ui,/dataset\.view==='training'/);
});

test('legacy app training view remains bypassable by capture navigation',()=>{
  assert.match(app,/function trainingView\(/);
  assert.match(app,/\$\$\('\[data-view\]'\)\.forEach/);
  assert.match(ui,/event\.preventDefault\?\.\(\)/);
  assert.match(ui,/event\.stopImmediatePropagation\?\.\(\)/);
});
