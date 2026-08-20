import test from 'node:test';
import assert from 'node:assert/strict';
import {staminaRemaining,receptionTouchVelocity} from '../physical-technique-v1.js';

function speed(v){return Math.hypot(v.vx,v.vy);}

test('stamina marker reflects fitness minus live fatigue',()=>{
  assert.equal(staminaRemaining({data:{fitness:92},fatigue:17}),75);
  assert.equal(staminaRemaining({data:{fitness:60},fatigue:80}),0);
});

test('high ball control cushions a hard incoming pass more than low control',()=>{
  const common={ballVx:-6.2,ballVy:.4,playerVx:0,playerVy:0,normalX:1,normalY:0,composure:70,dribbling:68,fatigue:8,intended:true};
  const elite=receptionTouchVelocity({...common,ballControl:90}),poor=receptionTouchVelocity({...common,ballControl:45});
  assert.ok(elite.quality>poor.quality);
  assert.ok(speed(elite)<speed(poor));
  assert.ok(elite.release<poor.release);
});

test('intended receivers take a shorter first touch than accidental contacts',()=>{
  const common={ballVx:-5,ballVy:1.1,playerVx:.2,playerVy:0,normalX:1,normalY:0,ballControl:74,composure:72,dribbling:70,fatigue:12};
  const intended=receptionTouchVelocity({...common,intended:true}),loose=receptionTouchVelocity({...common,intended:false});
  assert.ok(intended.quality>loose.quality);
  assert.ok(speed(intended)<speed(loose));
});
