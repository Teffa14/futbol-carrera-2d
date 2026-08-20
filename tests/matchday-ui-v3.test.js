import test from 'node:test';
import assert from 'node:assert/strict';
import {MATCHDAY_UI_CSS} from '../matchday-ui-v3.js';

test('live match UI gives the pitch most of the viewport',()=>{
  assert.match(MATCHDAY_UI_CSS,/height:calc\(100dvh - 108px\)/);
  assert.match(MATCHDAY_UI_CSS,/grid-template-columns:minmax\(0,1fr\) 292px/);
  assert.match(MATCHDAY_UI_CSS,/\.match-controls\{position:absolute/);
});

test('player and team stats are laid out as real HUD components',()=>{
  assert.match(MATCHDAY_UI_CSS,/\.player-live\{display:grid/);
  assert.match(MATCHDAY_UI_CSS,/\.team-live>div\{display:grid/);
  assert.match(MATCHDAY_UI_CSS,/grid-template-columns:42px minmax\(0,1fr\) 42px/);
});

test('final match layer replaces the old condensed Windows-like font stack',()=>{
  assert.doesNotMatch(MATCHDAY_UI_CSS,/Arial Narrow/);
  assert.doesNotMatch(MATCHDAY_UI_CSS,/Bahnschrift Condensed/);
  assert.match(MATCHDAY_UI_CSS,/Segoe UI Variable/);
  assert.match(MATCHDAY_UI_CSS,/Aptos/);
});

test('match header and navigation are compact',()=>{
  assert.match(MATCHDAY_UI_CSS,/\.top\{height:48px/);
  assert.match(MATCHDAY_UI_CSS,/grid-template-columns:52px minmax\(0,1fr\)/);
  assert.match(MATCHDAY_UI_CSS,/body\.matchday-v3-live \.hero\{[^}]*height:48px/);
});
