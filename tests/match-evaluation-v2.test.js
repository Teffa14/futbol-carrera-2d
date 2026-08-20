import test from 'node:test';
import assert from 'node:assert/strict';

const {MatchEngine}=await import('../engine.js');
await import('../football-rules-v2.js');
const {passFootballValue,__evaluationV2}=await import('../match-evaluation-v2.js');
await import('../decision-value-v1.js');

const mk=(name,id,role='CM',extra={})=>({name,instanceId:id,engineRole:role,position:role,pace:75,shooting:70,passing:75,dribbling:72,defense:68,physical:70,ballControl:74,vision:76,stamina:78,composure:75,...extra});
function engine(role='CM'){const e=new MatchEngine([mk('User','user-player',role),mk('Mate','mate','ST')],[mk('Def','def','CB'),mk('Opp','opp','CM')],{userId:'user-player',seed:`eval-${role}`});e.restart=null;return e;}

test('progressive football value is higher than a harmless backward pass',()=>{const e=engine('CM'),p=e.playerById('user-player');const forward=passFootballValue(p,{x:400,y:350},{x:620,y:350}),back=passFootballValue(p,{x:400,y:350},{x:320,y:350});assert.ok(forward>back,`${forward} should exceed ${back}`);assert.ok(forward>0);});

test('role rating weights the same action differently without heavy positioning penalties',()=>{const st=engine('ST'),cb=engine('CB'),ps=st.playerById('user-player'),pc=cb.playerById('user-player');__evaluationV2.add(st,ps,'shooting',1,'test');__evaluationV2.add(cb,pc,'shooting',1,'test');assert.ok(st.userPerformance().rating>cb.userPerformance().rating);assert.equal(st.userPerformance().ratingBreakdown.shooting,7);});

test('repeated dribble collisions against the same defender form one meaningful episode',()=>{const e=engine('RW'),p=e.playerById('user-player'),d=e.playerById('def');p.x=400;p.y=350;d.x=425;d.y=350;const before=p.perf.dribblesAttempted;for(let i=0;i<8;i++)e.attemptSkillMove(p,d);assert.equal(p.perf.dribblesAttempted,before+1,'same collision sequence must not create eight dribble attempts');});

test('event stream collapses repeated micro-action narration but preserves major events',()=>{const e=engine();for(let i=0;i<8;i++)e.pushEvent('Regate: cambio de dirección',0,'user');assert.equal(e.events.filter(x=>x.text.includes('Regate')).length,1);e.pushEvent('GOL — User',0,'goal');e.pushEvent('GOL — User',0,'goal');assert.equal(e.events.filter(x=>x.text.includes('GOL')).length,2,'major events are never collapsed');});

test('moving receiver pass is aimed into future space before the kick',()=>{const e=engine('CM'),p=e.playerById('user-player'),m=e.playerById('mate');p.x=360;p.y=350;m.x=520;m.y=320;m.vx=1.8;m.vy=.55;e.ball.x=375;e.ball.y=350;e.armKick(p,{x:m.x,y:m.y},5,'pass',{receiverId:m.id,passKind:'progressive'});assert.ok(p.kickIntent.aimX>m.x+10,`aim ${p.kickIntent.aimX} should lead receiver ${m.x}`);assert.ok(p.kickIntent.aimY>m.y,'aim should also account for lateral movement');});
