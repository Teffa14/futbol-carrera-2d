import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchEngine} from '../engine.js';
import {DRILLS} from '../training-memory-v1.js';
import {TrainingMatchEngine} from '../training-match-engine-v1.js';
import '../training-intelligence-v7.js';

const player={name:'Alex',position:'ST',pace:84,shooting:82,passing:78,dribbling:84,defense:58,physical:76,ballControl:83,vision:80,stamina:82,composure:81};
const drill=id=>DRILLS.find(d=>d.id===id);
const make=(id,reps=3)=>new TrainingMatchEngine(drill(id),{drillId:id,quality:82,grade:'A',reps,successes:0,seed:`v7-${id}`},player);

function run(id,reps=2){const e=make(id,reps);for(let i=0;i<18000&&!e.finished;i++){e.step(.016);assert.ok(Number.isFinite(e.ball.x)&&Number.isFinite(e.ball.y),`${id}: non-finite ball`);for(const p of e.players)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y),`${id}: non-finite player`);}assert.equal(e.finished,true,`${id}: did not finish`);return e;}

test('adaptive training still uses the exact MatchEngine physics implementation',()=>{const e=make('cone-dribble',1);assert.ok(e instanceof MatchEngine);assert.equal(e.updateFreeBall,MatchEngine.prototype.updateFreeBall);assert.equal(e.resolvePlayerCollisions,MatchEngine.prototype.resolvePlayerCollisions);assert.equal(e.resolveBallPlayerCollisions,MatchEngine.prototype.resolveBallPlayerCollisions);assert.equal(e.executeKick,MatchEngine.prototype.executeKick);assert.equal(e.movePlayer,MatchEngine.prototype.movePlayer);assert.equal(e.owner(),null);});

test('decision drills expose multiple repetition variants instead of one scripted route',()=>{for(const id of ['one-v-one','two-v-two','through-ball','crossing','finishing','free-kick']){const e=make(id,7),variants=new Set();for(let r=0;r<7;r++){e.resetRep(r,r===0);variants.add(e.trainingIntelligenceV7.variant);}assert.ok(variants.size>=2,`${id}: only ${[...variants]}`);}});

test('2v2 refuses a forced wall when the support lane is blocked',()=>{const e=make('two-v-two',1),q=e.trainingQualityV6,[d1,d2]=e.defenders,mate=e.mates[0];d1.x=e.ball.x+70;d1.y=e.ball.y;d2.x=(e.ball.x+mate.x)/2;d2.y=(e.ball.y+mate.y)/2;q.plan=null;e.scenario(.016);assert.ok(['carry','carry-release',null].includes(q.plan));assert.notEqual(q.plan,'wall');});

test('3v3 enters counterpress immediately after an opposition touch',()=>{const e=make('three-v-three',1),q=e.trainingQualityV6,s=e.trainingIntelligenceV7;q.possessionId=e.defenders[0].id;e.scenario(.016);assert.equal(q.phase,'Contrapresión');assert.equal(s.counterpresses,1);assert.match(s.coachCue,/Pérdida/);});

test('session result reports decision quality, variety and coaching feedback',()=>{const e=run('crossing',3),out=e.sessionResult();assert.equal(out.actual,true);assert.ok(Number.isFinite(out.decisionScore));assert.ok(Array.isArray(out.decisionVariety));assert.ok(Array.isArray(out.feedback)&&out.feedback.length>=2);assert.ok(out.feedback.every(Boolean));});

test('all eight adaptive drills complete on shared match physics',()=>{for(const d of DRILLS){const e=run(d.id,2),out=e.sessionResult();assert.equal(out.repResults.length,2,`${d.id}: missing rep results`);assert.ok(e.trainingMetricsV6.physicalTouches>0,`${d.id}: no physical touches`);assert.ok(out.quality>=35&&out.quality<=99,`${d.id}: invalid quality`);}});
