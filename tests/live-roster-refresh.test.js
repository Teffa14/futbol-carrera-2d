import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,normalize,matchClub} from '../scripts/refresh-live-rosters.mjs';

test('CSV parser keeps quoted commas and escaped quotes',()=>{
  const rows=parseCsv('name,club,note\n"Doe, John","Club A","said ""yes"""\n');
  assert.equal(rows.length,1);
  assert.equal(rows[0].name,'Doe, John');
  assert.equal(rows[0].note,'said "yes"');
});

test('normalization removes accents and common club boilerplate',()=>{
  assert.equal(normalize('C.A. River Plate'),'river plate');
  assert.equal(normalize('Atlético de Rafaela'),'atletico de rafaela');
});

test('club matching resolves common external aliases without confusing first and second tier',()=>{
  assert.equal(matchClub('CA River Plate')?.id,'river');
  assert.equal(matchClub('Ferro')?.id,'b-ferro');
  assert.equal(matchClub('San Martín Tucumán')?.id,'b-san-martin-tuc');
  assert.equal(matchClub('CA Boca Juniors')?.id,'boca');
});
