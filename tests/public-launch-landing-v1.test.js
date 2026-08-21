import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [landing,index,css]=await Promise.all([
  readFile(new URL('../public-landing-v1.js',import.meta.url),'utf8'),
  readFile(new URL('../index.html',import.meta.url),'utf8'),
  readFile(new URL('../public-landing.css',import.meta.url),'utf8'),
]);

test('public entry mounts the launch landing without replacing the playable app',()=>{
  assert.match(index,/import '\.\/app\.js';/);
  assert.match(index,/import '\.\/public-landing-v1\.js';/);
  assert.match(index,/public-landing\.css/);
  assert.match(landing,/data-public-play/);
  assert.match(landing,/sessionStorage/);
  assert.match(landing,/searchParams\.get\('play'\)/);
});

test('landing clearly separates current beta from future roadmap ambitions',()=>{
  for(const text of ['BETA PÚBLICA','ROADMAP','Diseño de jugadas','Playbooks','Ligas PvP humanas','Veintidós personas','Servidor autoritativo','YOUTUBERS Y STREAMERS']){
    assert.ok(landing.includes(text),`falta ${text}`);
  }
  assert.match(landing,/JUGABLE \+ EN EXPANSIÓN/);
  assert.match(landing,/VISIÓN COMPETITIVA/);
  assert.match(landing,/VISIÓN A LARGO PLAZO/);
});

test('funding panel exposes only the approved alias and CVU',()=>{
  assert.ok(landing.includes("alias:'career.eleven'"));
  assert.ok(landing.includes("cvu:'0000003100057101140012'"));
  for(const forbidden of ['tefa.14b','@gmail','+543','Celular','E-mail'])assert.equal(landing.includes(forbidden),false,`dato personal no permitido: ${forbidden}`);
});

test('creator section keeps the requested project voice',()=>{
  assert.match(landing,/No sean ratas coludas\./);
  assert.match(landing,/bancá el proyecto también/);
});

test('landing has dedicated responsive presentation rather than inheriting dashboard cards',()=>{
  assert.match(css,/\.public-hero\{/);
  assert.match(css,/\.public-pitch\{/);
  assert.match(css,/\.public-roadmap-track\{/);
  assert.match(css,/@media\(max-width:650px\)/);
});
