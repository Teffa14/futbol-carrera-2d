import test from 'node:test';
import assert from 'node:assert/strict';
import {CLEAN_MATCH_UI_CSS} from '../clean-match-ui-v4.js';

test('match controls live in their own layout row instead of floating over the pitch',()=>{
  assert.match(CLEAN_MATCH_UI_CSS,/grid-template-rows:minmax\(0,1fr\) 42px/);
  assert.match(CLEAN_MATCH_UI_CSS,/\.match-controls\{position:static!important/);
  assert.doesNotMatch(CLEAN_MATCH_UI_CSS,/\.match-controls\{position:absolute/);
});
