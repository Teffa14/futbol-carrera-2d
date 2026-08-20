import test from 'node:test';
import assert from 'node:assert/strict';
import {lateralCarryProfile} from '../lateral-carry-v2.js';

const p={team:0,x:300,y:300,data:{pace:75,dribbling:82,ballControl:84}};
test('horizontal carries get more contact tolerance and softer touches',()=>{
  const lateral=lateralCarryProfile(p,{x:305,y:390}),forward=lateralCarryProfile(p,{x:390,y:305});
  assert.ok(lateral.lateral>.7);assert.ok(forward.lateral<.2);assert.ok(lateral.contactTolerance>forward.contactTolerance);assert.ok(lateral.touchPower<forward.touchPower);
});
