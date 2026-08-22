import test from 'node:test';
import assert from 'node:assert/strict';
import {createIdentityState} from '../player-identity-progression-v1.js';
import {__identityUiV1} from '../identity-ui-v1.js';

function career(){return{createdAt:99,player:{name:'OUROS',birthDate:'2009-03-01',position:'ST',build:'finisher',trainingMemory:{},trainingSummary:{sessions:0},trainingLog:[]}};}

test('identity screen has progression branches and no legacy equip system',()=>{
  const c=career(),html=__identityUiV1.render(c,createIdentityState(c));
  assert.match(html,/IDENTIDAD FUTBOLÍSTICA/);
  assert.match(html,/Ramas de juego/);
  assert.match(html,/Cómo estás jugando/);
  assert.match(html,/Definición/);
  assert.match(html,/Ruptura/);
  assert.doesNotMatch(html,/máximo 3/i);
  assert.doesNotMatch(html,/EQUIPADA/i);
  assert.doesNotMatch(html,/Manos seguras/i);
  assert.doesNotMatch(html,/type="range"/i);
});

test('a striker identity exposes role-specific decisions instead of three generic sliders',()=>{
  const c=career(),html=__identityUiV1.render(c,createIdentityState(c));
  assert.match(html,/Ruptura al espacio/);
  assert.match(html,/Ataque del área/);
  assert.match(html,/Resolver de primera/);
  assert.match(html,/Apoyo al pie/);
});
