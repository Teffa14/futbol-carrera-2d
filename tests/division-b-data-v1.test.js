import test from 'node:test';
import assert from 'node:assert/strict';
import {DIVISION_B_COUNTRY,SECOND_DIVISION_CLUBS} from '../division-b-data-v1.js';

test('second division contains the 36 AFA 2026 clubs with unique ids',()=>{
  assert.equal(DIVISION_B_COUNTRY.tier,2);
  assert.equal(SECOND_DIVISION_CLUBS.length,36);
  assert.equal(new Set(SECOND_DIVISION_CLUBS.map(club=>club.id)).size,36);
  assert.equal(SECOND_DIVISION_CLUBS.filter(club=>club.zone==='A').length,18);
  assert.equal(SECOND_DIVISION_CLUBS.filter(club=>club.zone==='B').length,18);
  assert.ok(SECOND_DIVISION_CLUBS.every(club=>club.country==='ARB'&&club.tier===2));
});

test('recognisable second-division clubs are present',()=>{
  const names=new Set(SECOND_DIVISION_CLUBS.map(club=>club.name));
  for(const name of ['Ferro Carril Oeste','Nueva Chicago','Quilmes','Chacarita Juniors','Colón','San Martín de Tucumán'])assert.ok(names.has(name),name);
});
