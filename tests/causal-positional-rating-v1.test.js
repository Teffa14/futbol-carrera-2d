import test from 'node:test';
import assert from 'node:assert/strict';

const {MatchEngine}=await import('../engine.js');
await import('../football-rules-v2.js');
await import('../match-evaluation-v2.js');
const {defensiveLaneValue,supportOutletValue,turnoverSeverity}=await import('../causal-positional-rating-v1.js');
const {__evaluationV2}=await import('../match-evaluation-v2.js');

const mk=(name,id,role='CM',extra={})=>({name,instanceId:id,engineRole:role,position:role,pace:74,shooting:62,passing:75,dribbling:68,defense:74,physical:72,ballControl:72,vision:76,stamina:78,composure:74,...extra});
function makeEngine(){
  const e=new MatchEngine(
    [mk('Actor','actor','CM'),mk('Forward','forward','ST'),mk('Left','left','LW'),mk('CB Support','cb-support','CB')],
    [mk('User CB','user-player','CB'),mk('Other CB','other-cb','CB'),mk('Opp Mid','opp-mid','CM'),mk('Opp ST','opp-st','ST')],
    {userId:'user-player',seed:'causal-positional-rating'}
  );
  e.restart=null;
  return e;
}

function placePassingScene(e){
  const actor=e.playerById('actor'),forward=e.playerById('forward'),left=e.playerById('left'),cb=e.playerById('user-player'),other=e.playerById('other-cb'),oppMid=e.playerById('opp-mid'),oppSt=e.playerById('opp-st'),support=e.playerById('cb-support');
  actor.x=430;actor.y=350;forward.x=690;forward.y=350;left.x=560;left.y=120;support.x=315;support.y=455;
  cb.x=555;cb.y=350;other.x=730;other.y=470;oppMid.x=760;oppMid.y=220;oppSt.x=850;oppSt.y=350;
  e.ball.x=actor.x;e.ball.y=actor.y;e.ball.lastTeam=0;e.ball.lastPlayerId=actor.id;
  return{actor,forward,left,cb,support};
}

test('a centre back receives causal defensive value for denying a dangerous passing lane',()=>{
  const e=makeEngine(),{actor,cb}=placePassingScene(e);
  const blocked=defensiveLaneValue(e,cb,actor);
  cb.y=545;
  const outside=defensiveLaneValue(e,cb,actor);
  assert.ok(blocked.value>.45,`expected meaningful lane denial, got ${blocked.value}`);
  assert.ok(blocked.value>outside.value+.20,`${blocked.value} should materially exceed ${outside.value}`);
});

test('a defender can add value by becoming a safe recycling outlet during build-up',()=>{
  const e=makeEngine(),{actor,support}=placePassingScene(e);
  const useful=supportOutletValue(e,support,actor);
  support.x=610;support.y=350;
  const redundant=supportOutletValue(e,support,actor);
  assert.ok(useful.value>.55,`expected useful build-up support, got ${useful.value}`);
  assert.ok(useful.value>redundant.value,`${useful.value} should exceed ${redundant.value}`);
});

test('turnovers are context weighted instead of carrying one flat penalty',()=>{
  const e=makeEngine(),p=e.playerById('user-player');
  const dangerous=turnoverSeverity(p,{x:110,y:350},{pressure:.2,escapeOptions:2});
  const attackingWide=turnoverSeverity(p,{x:880,y:95},{pressure:1,escapeOptions:0});
  assert.ok(dangerous>attackingWide+.04,`${dangerous} should materially exceed ${attackingWide}`);
});

test('intercepting a real pass credits the defender without requiring a tackle event',()=>{
  const e=makeEngine(),{actor,cb}=placePassingScene(e);
  e.ball.evaluationPass={passerId:actor.id,receiverId:'forward',start:{x:430,y:350},aim:{x:690,y:350},value:.18,kind:'progressive',tick:e.tick};
  const before=__evaluationV2.ledger(e,cb).defending;
  e.registerPhysicalTouch(cb,'touch');
  const after=__evaluationV2.ledger(e,cb).defending;
  assert.ok(after>before+.02,`${after} should exceed ${before}`);
});

test('a dispossession is recorded as a possession error and a recovery even without a completed duel event',()=>{
  const e=makeEngine(),{actor,cb}=placePassingScene(e);
  actor.x=520;actor.y=350;cb.x=545;cb.y=350;e.ball.x=532;e.ball.y=350;e.ball.lastTeam=actor.team;e.ball.lastPlayerId=actor.id;e.ball.evaluationPass=null;
  const errorBefore=__evaluationV2.ledger(e,actor).error,defBefore=__evaluationV2.ledger(e,cb).defending;
  e.registerPhysicalTouch(cb,'touch');
  assert.ok(__evaluationV2.ledger(e,actor).error<errorBefore,'loser should receive a real possession-loss cost');
  assert.ok(__evaluationV2.ledger(e,cb).defending>defBefore,'winner should receive recovery value');
});

test('positional scoring observes the free ball but never creates ownership state',()=>{
  const e=makeEngine(),{actor,cb}=placePassingScene(e),before={x:e.ball.x,y:e.ball.y,vx:e.ball.vx,vy:e.ball.vy};
  defensiveLaneValue(e,cb,actor);supportOutletValue(e,e.playerById('cb-support'),actor);
  assert.deepEqual({x:e.ball.x,y:e.ball.y,vx:e.ball.vx,vy:e.ball.vy},before);
  assert.equal('ownerId' in e.ball,false);
});
