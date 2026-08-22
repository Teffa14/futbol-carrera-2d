import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const {TRAINING_SPEED,stepTrainingX4,rebuildTrainingResult,trainingPhase}=await import('../training-session-v6.js');
const {MatchEngine}=await import('../engine.js');
await import('../match-evaluation-v2.js');
await import('../stamina-load-v1.js');
const {__playerPerformanceScoreV1}=await import('../player-performance-score-v1.js');

const mk=(name,id,role='CM',stamina=70)=>({name,instanceId:id,engineRole:role,position:role,pace:78,shooting:70,passing:74,dribbling:72,defense:70,physical:70,ballControl:74,vision:75,stamina,composure:74});
function makeEngine(stamina=70,role='CM'){
  const home=[mk('User','user-player',role,stamina),mk('Mate','mate','ST',72)];
  const away=[mk('Def','def','CB',75),mk('Opp','opp','CM',75)];
  const e=new MatchEngine(home,away,{userId:'user-player',seed:`athletic-${stamina}-${role}`});e.restart=null;return e;
}

test('all live training can advance at x4 with stable substeps',()=>{
  const calls=[],fake={finished:false,step(dt){calls.push(dt);}};
  const steps=stepTrainingX4(fake,.025);
  assert.equal(TRAINING_SPEED,4);
  assert.ok(steps>=4);
  assert.ok(Math.max(...calls)<=.0250001);
  assert.ok(Math.abs(calls.reduce((a,b)=>a+b,0)-.1)<1e-9);
});

test('training grade uses execution, indicators and repetition consistency',()=>{
  const strong=rebuildTrainingResult({quality:84,reps:8,successes:7},[{value:90},{value:82},{value:88}]);
  const weak=rebuildTrainingResult({quality:84,reps:8,successes:3},[{value:42},{value:55},{value:48}]);
  assert.ok(strong.quality>weak.quality);
  assert.ok(strong.markerAverage>weak.markerAverage);
  assert.equal(strong.trainingSpeed,4);
  assert.equal(trainingPhase(.1),'Lectura');
  assert.equal(trainingPhase(.9),'Ejecución');
});

test('high stamina preserves repeat effort better under identical running load',()=>{
  const high=makeEngine(92),low=makeEngine(48),ph=high.playerById('user-player'),pl=low.playerById('user-player');
  for(let i=0;i<520;i++){
    const th={x:i%2?900:220,y:i%4<2?180:520},tl={...th};
    high.movePlayer(ph,th,.016,true);low.movePlayer(pl,tl,.016,true);
  }
  assert.ok(pl.fatigue>ph.fatigue+2,`low ${pl.fatigue} should exceed high ${ph.fatigue}`);
  assert.ok((ph.staminaState?.movementFactor??0)>(pl.staminaState?.movementFactor??0));
  assert.equal('ownerId' in high.ball,false);
});

test('balanced scoring rewards causal role work and exposes ratings for every player',()=>{
  const e=makeEngine(80,'CB'),p=e.playerById('user-player');
  for(let i=0;i<6;i++)__playerPerformanceScoreV1.evaluateRoleWork(e);
  const before=__playerPerformanceScoreV1.balancedPlayerRating(e,p).rating;
  const evalApi=(await import('../match-evaluation-v2.js')).__evaluationV2;
  evalApi.add(e,p,'defending',.9,'Cierra una jugada');
  p.perf.passesAttempted=12;p.perf.passesCompleted=11;p.perf.bodyDuels=6;p.perf.bodyDuelsWon=5;p.perf.touches=30;
  const after=__playerPerformanceScoreV1.balancedPlayerRating(e,p).rating,report=e.report();
  assert.ok(after>before);
  assert.equal(report.playerRatings.length,e.players.length);
  assert.ok(report.playerRatings.every(x=>Number.isFinite(x.rating)));
});

test('mobile layout uses a bottom touch navigation and single-column dense cards',()=>{
  const css=fs.readFileSync(new URL('../mobile-responsive-v2.css',import.meta.url),'utf8');
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(css,/position:fixed/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/@media\(max-width:520px\)/);
  assert.match(css,/\.grid\.training[^}]*grid-template-columns:1fr/);
  assert.match(html,/mobile-responsive-v2\.css/);
  assert.match(html,/training-overhaul-v1\.js/);
  assert.match(html,/stamina-load-v1\.js/);
});
