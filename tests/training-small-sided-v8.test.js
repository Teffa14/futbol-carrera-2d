import test from 'node:test';
import assert from 'node:assert/strict';

await import('../football-rules-v2.js');
await import('../locomotion-v2.js');
await import('../carry-intelligence-v1.js');
await import('../agent-brain-v2.js');
await import('../passing-intelligence-v2.js');
await import('../striker-intelligence-v3.js');
await import('../trajectory-intelligence-v1.js');
await import('../match-evaluation-v2.js');
await import('../decision-value-v1.js');
const {TrainingMatchEngine}=await import('../training-match-engine-v1.js');
await import('../training-intelligence-v7.js');
const {__trainingSmallSidedV8}=await import('../training-small-sided-v8.js');

const user={name:'Training User',instanceId:'training-user',position:'CM',engineRole:'CM',pace:78,shooting:68,passing:80,dribbling:76,defense:65,physical:68,ballControl:79,vision:82,stamina:80,composure:78};
function run(kind,frames=1300){const e=new TrainingMatchEngine({id:`${kind}-live`,name:kind,kind},{seed:`small-${kind}`,reps:2,quality:78,grade:'B',successes:0},user);let maxActions=0,maxTargets=0,maxPress=0,maxCover=0;for(let i=0;i<frames&&!e.finished;i++){e.step(1/60);const m=__trainingSmallSidedV8.meta(e);maxActions=Math.max(maxActions,m.matchActions);maxTargets=Math.max(maxTargets,m.matchAiTargets);maxPress=Math.max(maxPress,m.pressFrames);maxCover=Math.max(maxCover,m.coverFrames);for(const p of e.players){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));}assert.ok(Number.isFinite(e.ball.x)&&Number.isFinite(e.ball.y));}return{e,maxActions,maxTargets,maxPress,maxCover};}

test('2v2 uses live match action selection with pressing and covering rather than a fixed wall script',()=>{const r=run('2v2');assert.ok(r.maxTargets>80,`match AI targets ${r.maxTargets}`);assert.ok(r.maxActions>0,'a real MatchEngine ball action should be selected');assert.ok(r.maxPress>20,'one defender should actively press');assert.ok(r.maxCover>20,'the other defender should cover instead of following the same point');assert.equal(Object.hasOwn(r.e.ball,'ownerId'),false);});

test('3v3 circulates through live physical passes and multiple support decisions',()=>{const r=run('3v3',1500);assert.ok(r.maxTargets>120);assert.ok(r.maxActions>1,`only ${r.maxActions} live actions were selected`);assert.ok(r.e.stats.passes[0]+r.e.stats.passes[1]>1,'small-sided game should attempt physical passes');assert.ok(r.maxPress>20&&r.maxCover>20,'defenders must split press and cover jobs');assert.equal(Object.hasOwn(r.e.ball,'ownerId'),false);});
