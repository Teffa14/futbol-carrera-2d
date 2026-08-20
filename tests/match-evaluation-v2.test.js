import test from 'node:test';
import assert from 'node:assert/strict';

const {MatchEngine}=await import('../engine.js');
await import('../football-rules-v2.js');
const {passFootballValue,__evaluationV2}=await import('../match-evaluation-v2.js');
const {movingPassTarget,scoreActionCandidates}=await import('../decision-value-v1.js');

const mk=(name,id,role='CM',extra={})=>({name,instanceId:id,engineRole:role,position:role,pace:75,shooting:70,passing:75,dribbling:72,defense:68,physical:70,ballControl:74,vision:76,stamina:78,composure:75,...extra});
function engine(role='CM'){const e=new MatchEngine([mk('User','user-player',role),mk('Mate','mate','ST')],[mk('Def','def','CB'),mk('Opp','opp','CM')],{userId:'user-player',seed:`eval-${role}`});e.restart=null;return e;}

test('progressive football value is higher than a harmless backward pass',()=>{const e=engine('CM'),p=e.playerById('user-player');const forward=passFootballValue(p,{x:400,y:350},{x:620,y:350}),back=passFootballValue(p,{x:400,y:350},{x:320,y:350});assert.ok(forward>back,`${forward} should exceed ${back}`);assert.ok(forward>0);});

test('role rating weights the same action differently without heavy positioning penalties',()=>{const st=engine('ST'),cb=engine('CB'),ps=st.playerById('user-player'),pc=cb.playerById('user-player');__evaluationV2.add(st,ps,'shooting',1,'test');__evaluationV2.add(cb,pc,'shooting',1,'test');assert.ok(st.userPerformance().rating>cb.userPerformance().rating);assert.equal(st.userPerformance().ratingBreakdown.shooting,7);});

test('continuous contact with the same defender remains one dribble episode even after old time cooldowns',()=>{const e=engine('RW'),p=e.playerById('user-player'),d=e.playerById('def');p.x=400;p.y=350;d.x=425;d.y=350;const before=p.perf.dribblesAttempted;e.attemptSkillMove(p,d);for(let i=0;i<120;i++){e.tick++;e.attemptSkillMove(p,d);}assert.equal(p.perf.dribblesAttempted,before+1,'one body-contact sequence must remain one football action');});

test('real separation closes a dribble episode so a later duel can count as a new action',()=>{const e=engine('RW'),p=e.playerById('user-player'),d=e.playerById('def');p.x=400;p.y=350;d.x=425;d.y=350;const before=p.perf.dribblesAttempted;e.attemptSkillMove(p,d);d.x=500;__evaluationV2.pruneDribbleEpisodes(e);d.x=425;e.tick+=40;e.attemptSkillMove(p,d);assert.equal(p.perf.dribblesAttempted,before+2);});

test('event stream collapses repeated micro-action narration but preserves major events',()=>{const e=engine();for(let i=0;i<8;i++)e.pushEvent('Regate: cambio de dirección',0,'user');assert.equal(e.events.filter(x=>x.text.includes('Regate')).length,1);e.pushEvent('GOL — User',0,'goal');e.pushEvent('GOL — User',0,'goal');assert.equal(e.events.filter(x=>x.text.includes('GOL')).length,2,'major events are never collapsed');});

test('moving receiver pass is aimed into future space before the kick',()=>{const e=engine('CM'),p=e.playerById('user-player'),m=e.playerById('mate');p.x=360;p.y=350;m.x=520;m.y=320;m.vx=1.8;m.vy=.55;e.ball.x=375;e.ball.y=350;const aim=movingPassTarget(e,p,m,'progressive');assert.ok(aim.x>m.x+10);assert.ok(aim.y>m.y);e.armKick(p,{x:m.x,y:m.y},5,'pass',{receiverId:m.id,passKind:'progressive'});assert.ok(p.kickIntent.aimX>m.x+10);});

test('decision utility compares pass dribble and shot instead of farming one action type',()=>{const e=engine('ST'),p=e.playerById('user-player'),m=e.playerById('mate'),d=e.playerById('def'),o=e.playerById('opp');p.x=875;p.y=350;p.data.shooting=90;p.data.composure=88;m.x=650;m.y=470;d.x=760;d.y=240;o.x=700;o.y=520;e.ball.x=p.x+15;e.ball.y=p.y;const choices=scoreActionCandidates(e,p);assert.ok(choices.some(x=>x.type==='pass'));assert.ok(choices.some(x=>x.type==='dribble'));assert.ok(choices.some(x=>x.type==='shot'));assert.equal(choices[0].type,'shot','a striker in a strong central finishing window should prefer the highest-value shot');});
