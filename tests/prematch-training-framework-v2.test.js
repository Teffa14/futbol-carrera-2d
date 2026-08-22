import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ROLE_DRILLS,trainingCatalogFor,trainingFamily,recommendedTrainingDrills,trainingMarkerSnapshot} from '../training-framework-v2.js';
import {TrainingMatchEngine,TRAINING_RUNTIME_VERSIONS} from '../training-runtime-latest.js';
import {__prematchUiV2} from '../prematch-ui-v2.js';

const {pitchLayout,roleText,topResponsibilities}=__prematchUiV2;
const player=(position='ST')=>({name:'OUROS',position,engineRole:position,pace:55,shooting:54,passing:52,dribbling:56,defense:48,physical:55,ballControl:53,vision:51,stamina:57,composure:50,fitness:100,trainingMemory:{},developmentWork:{}});

test('training v2 is role-specific instead of one generic drill grid',()=>{
  const families=['ST','W','CAM','MID','DEF','GK'];
  for(const family of families){const position={ST:'ST',W:'RW',CAM:'CAM',MID:'CM',DEF:'CB',GK:'GK'}[family],rows=trainingCatalogFor(player(position));assert.ok(rows.length>=5,`${family} should have a real training pack`);assert.ok(rows.every(d=>d.family===family));assert.ok(rows.every(d=>d.frameworkVersion===2));assert.ok(rows.every(d=>d.markers.length===5));}
  assert.equal(trainingFamily('RB'),'DEF');assert.equal(trainingFamily('LW'),'W');
  assert.ok(!trainingCatalogFor(player('ST')).some(d=>d.id.startsWith('gk-')),'striker must never see goalkeeper work');
  assert.ok(!trainingCatalogFor(player('GK')).some(d=>d.id.startsWith('st-')),'keeper must never see striker work');
});

test('every new drill declares real stats, memories and marker-specific evaluation',()=>{
  for(const d of ROLE_DRILLS){const weight=Object.values(d.attrs).reduce((a,b)=>a+b,0);assert.ok(weight>.95&&weight<1.05,`${d.id} attribute weights should sum to ~1, got ${weight}`);assert.ok(d.memories.length>=3,`${d.id} needs football memory evidence`);assert.equal(new Set(d.markers.map(m=>m.id)).size,5,`${d.id} markers must be distinct`);}
});

test('weak-player recommendations follow weighted stat needs',()=>{
  const p=player('ST');p.shooting=38;p.composure=40;p.ballControl=42;p.pace=70;const ids=recommendedTrainingDrills(p,3);assert.ok(ids.some(id=>id.includes('finish')||id==='st-free-kick'),`expected finishing work, got ${ids.join(', ')}`);
});

test('defender and goalkeeper have runnable physical scenarios',()=>{
  for(const [position,id] of [['CB','def-1v1'],['GK','gk-shots'],['GK','gk-distribution']]){const d=ROLE_DRILLS.find(x=>x.id===id),e=new TrainingMatchEngine(d,{quality:58,grade:'D',reps:1,successes:0,seed:`test-${id}`},player(position));for(let i=0;i<80;i++)e.step(.016);assert.equal(e.drill.id,id);assert.ok(e.trainingQualityV6.objective.length>10);assert.ok(Number.isFinite(e.ball.x)&&Number.isFinite(e.ball.y));const markers=trainingMarkerSnapshot(e,d);assert.equal(markers.length,5);assert.ok(markers.every(m=>m.value>=0&&m.value<=100));}
});

test('canonical runtime publishes role framework plus one authoritative scenario engine',()=>{assert.equal(TRAINING_RUNTIME_VERSIONS.framework,2);assert.ok(TRAINING_RUNTIME_VERSIONS.matchEngine>=2);assert.equal(TRAINING_RUNTIME_VERSIONS.authoritativeScenarios,TRAINING_RUNTIME_VERSIONS.matchEngine);assert.equal(TRAINING_RUNTIME_VERSIONS.liveUi,5);assert.equal('roleScenarios' in TRAINING_RUNTIME_VERSIONS,false);assert.equal('competitive' in TRAINING_RUNTIME_VERSIONS,false);});

test('prematch helpers create a football briefing instead of card list',()=>{
  const html=pitchLayout([{name:'Arquero',engineRole:'GK',rating:60},{name:'Central Uno',engineRole:'CB',rating:62},{name:'OUROS',engineRole:'ST',rating:63,isUser:true}]);assert.match(html,/pm-player user/);assert.match(html,/OUROS/);assert.equal(roleText('occupy-high-value-finishing-lane'),'Ocupá la zona de mayor valor para definir.');const rows=topResponsibilities({responsibilities:{a:[{id:'x',priority:70,action:'a'}],b:[{id:'y',priority:90,action:'b'}]}});assert.equal(rows[0].id,'y');
});

test('production wiring removes live training v4 and keeps markers/commentary beside pitch',async()=>{
  const [index,live,home,pre]=await Promise.all([readFile(new URL('../index.html',import.meta.url),'utf8'),readFile(new URL('../training-live-ui-v5.js',import.meta.url),'utf8'),readFile(new URL('../training-ui-v2.js',import.meta.url),'utf8'),readFile(new URL('../prematch-ui-v2.js',import.meta.url),'utf8')]);
  assert.match(index,/training-live-ui-v5\.js/);assert.doesNotMatch(index,/import '\.\/training-live-ui-v4\.js'/);assert.match(live,/tr5-markers/);assert.match(live,/trainingV5Log/);assert.match(live,/grid-template-columns:minmax\(0,1fr\) 350px/);assert.match(home,/Semana de trabajo/);assert.match(home,/RECOMENDADO/);assert.match(pre,/PLAN DEL PARTIDO/);assert.match(pre,/SOCIEDADES/);assert.match(pre,/AMENAZAS DEL RIVAL/);
});