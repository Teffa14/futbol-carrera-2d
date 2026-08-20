import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('career and scouting matches default to x1',()=>{
  const career=fs.readFileSync(new URL('../career.js',import.meta.url),'utf8'),pre=fs.readFileSync(new URL('../precareer-entry-ui-v2.js',import.meta.url),'utf8');
  assert.match(career,/settings:\{camera:'player',speed:1\}/);
  assert.match(pre,/trialSpeed=1/);
  assert.match(pre,/data-pc-speed=\\?"1\\?"/);
});

test('Argentina UI includes collapsible nav and viewport-aware match pitch',()=>{
  const ui=fs.readFileSync(new URL('../argentina-ui-v1.js',import.meta.url),'utf8');
  assert.match(ui,/nav-collapsed/);assert.match(ui,/max-height:calc\(100vh/);assert.match(ui,/Fútbol Argentino/);
});
