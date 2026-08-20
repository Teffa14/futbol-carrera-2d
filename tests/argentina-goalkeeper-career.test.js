import test from 'node:test';
import assert from 'node:assert/strict';
import '../argentina-data-v1.js';
import {POSITIONS} from '../data.js';
import {createUserPlayer,calculateOverall} from '../career.js';
import {buildsForPosition} from '../argentina-data-v1.js';
import {runtimeModsFor} from '../build-effects-v2.js';

test('goalkeeper is a selectable career position with dedicated builds',()=>{
  assert.ok(POSITIONS.some(p=>p.id==='GK'&&p.name==='Arquero'));
  assert.deepEqual(buildsForPosition('GK').map(b=>b.id).sort(),['keeper-playmaker','shot-stopper','sweeper-keeper']);
  assert.ok(!buildsForPosition('ST').some(b=>b.id==='shot-stopper'));
});

test('goalkeeper overall reacts to goalkeeper-relevant stats',()=>{
  const keeper=createUserPlayer({name:'Arquero prueba',nationality:'AR',position:'GK',build:'shot-stopper',development:false});
  const before=calculateOverall(keeper);keeper.defense+=8;keeper.composure+=4;const after=calculateOverall(keeper);
  assert.ok(after>before,`${before} -> ${after}`);
  assert.equal(keeper.skills[0],'keeper-reflex');
});

test('outfield builds have material runtime identity',()=>{
  const technician={data:{build:'technician'}},finisher={data:{build:'finisher'}},engine={data:{build:'engine'}};
  assert.ok(runtimeModsFor(technician).turning>=8);
  assert.ok(runtimeModsFor(finisher).shooting>=6);
  assert.ok(runtimeModsFor(engine).fatigueDrain<1);
});
