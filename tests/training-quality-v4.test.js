import test from 'node:test';
import assert from 'node:assert/strict';
import {DRILLS} from '../training-memory-v1.js';
import {TrainingEngine} from '../training-engine-v1.js';
import '../training-physics-fix-v2.js';
import '../training-quality-v4.js';

const player={name:'Alex',pace:82,shooting:80,passing:82,dribbling:84,defense:66,physical:74,ballControl:84,vision:83,stamina:82,composure:82};
function run(id,reps=6){const drill=DRILLS.find(d=>d.id===id);assert.ok(drill,`missing drill ${id}`);const result={drillId:id,quality:86,grade:'A',reps,successes:0,seed:`quality-v4-${id}`},e=new TrainingEngine(drill,result,player),phases=new Set();for(let i=0;i<12000&&!e.finished;i++){e.step(.016);if(e.trainingQualityV4?.phase)phases.add(e.trainingQualityV4.phase);}assert.equal(e.finished,true,`${id} did not finish`);const final=e.sessionResult();assert.equal(final.reps,reps);assert.equal(final.repResults.length,reps,`${id} did not score every repetition`);assert.ok(final.successes>=0&&final.successes<=reps);assert.ok(phases.size>=2,`${id} never changed training phase`);assert.ok(e.trainingQualityV4.objective.length>10,`${id} has no meaningful visible objective`);return{e,final,phases,m:e.trainingMetricsV4};}

test('cone drill is gate-based close-control work rather than a timer animation',()=>{const {m}=run('cone-dribble',4);assert.ok(m.gatesCleared>=8,`only ${m.gatesCleared} gates were physically cleared`);});

test('1v1 drill exposes both sides and requires beating a defender before finishing',()=>{const {m}=run('one-v-one',6);assert.ok(m.branches.has('inside'));assert.ok(m.branches.has('outside'));assert.ok(m.duelsBeaten>=2,`only ${m.duelsBeaten} defenders beaten`);assert.ok(m.shots>=1,'1v1 never reached a finish');});

test('2v2 drill contains physical combination play and a return run',()=>{const {m}=run('two-v-two',5);assert.ok(m.passesAttempted>=4,`only ${m.passesAttempted} passes attempted`);assert.ok(m.passesCompleted>=1,'no physical pass was completed');assert.ok(m.wallBeats>=1,'no wall/return sequence produced an advantage');});

test('3v3 drill circulates through multiple receivers before progression',()=>{const {m}=run('three-v-three',5);assert.ok(m.passesAttempted>=6,`only ${m.passesAttempted} passes attempted`);assert.ok(m.receivers.size>=2,`only ${m.receivers.size} receiver involved`);assert.ok(m.passesCompleted>=2,`only ${m.passesCompleted} completed passes`);});

test('through-ball drill waits for timed runs and produces real passes into space',()=>{const {m}=run('through-ball',5);assert.ok(m.timedRuns>=5,`only ${m.timedRuns} timed runs`);assert.ok(m.passesAttempted>=3,'through-ball drill barely passes');assert.ok(m.throughReceptions>=1,'no runner ever reached a through ball beyond the line');});

test('crossing drill reads geometry and uses more than one delivery solution',()=>{const {m}=run('crossing',6);assert.ok(m.deliveries>=3,`only ${m.deliveries} deliveries`);assert.ok(m.deliveryChoices?.size>=2,`delivery choices: ${[...(m.deliveryChoices||[])]}`);assert.ok(m.branches.has('cutback'),'cutback never selected');assert.ok([...m.branches].some(x=>x.includes('cross')),'cross never selected');});

test('finishing drill serves different ball types and forces trajectory reading before shots',()=>{const {m}=run('finishing',6);assert.equal(m.serviceTypes.size,3,`service types: ${[...m.serviceTypes]}`);assert.ok(m.passesAttempted>=3,'services were not physically kicked');assert.ok(m.shots>=1,'player never generated a finish');});

test('free-kick drill changes target around wall/keeper geometry and physically shoots',()=>{const {m}=run('free-kick',6);assert.ok(m.targetZones.size>=2,`target zones: ${[...m.targetZones]}`);assert.ok(m.shots>=4,`only ${m.shots} free kicks were struck`);assert.ok(m.branches.has('upper-corner')&&m.branches.has('lower-corner'),'free kicks did not read both target sides');});

test('session grade is calculated after execution instead of trusting preview successes',()=>{const drill=DRILLS.find(d=>d.id==='cone-dribble'),e=new TrainingEngine(drill,{drillId:drill.id,quality:90,grade:'S',reps:3,successes:3,seed:'actual-result'},player);for(let i=0;i<8000&&!e.finished;i++)e.step(.016);const result=e.sessionResult();assert.equal(result.actual,true);assert.equal(result.successes,result.repResults.filter(r=>r.success).length);assert.equal(result.grade,result.quality>=91?'S':result.quality>=82?'A':result.quality>=72?'B':result.quality>=62?'C':result.quality>=52?'D':'E');});
