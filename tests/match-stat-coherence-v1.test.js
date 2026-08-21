import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchEngine} from '../engine.js';
import '../match-stat-coherence-v1.js';

function lineup(prefix){return Array.from({length:11},(_,i)=>({name:`${prefix}${i}`,instanceId:`${prefix}-${i}`,engineRole:i===0?'GK':i===10?'ST':'CM',pace:70,shooting:70,passing:70,dribbling:90,defense:60,physical:65,ballControl:90,vision:70,stamina:70,composure:80,fitness:100,skills:[]}));}

test('a completed dribble cannot exist with zero physical touches',()=>{
  const e=new MatchEngine(lineup('h'),lineup('a'),{userId:'h-10',seed:'dribble-touch'}),p=e.playerById('h-10'),d=e.playerById('a-9');
  e.restart=null;e.rng=()=>0;e.ball.x=p.x;e.ball.y=p.y;e.ball.lastPlayerId=null;e.ball.lastTouchTick=-99;d.x=p.x+20;d.y=p.y;
  assert.equal(e.attemptSkillMove(p,d),true);assert.equal(p.perf.dribblesCompleted,1);assert.ok(p.perf.touches>=1);
});

test('a non-own-goal crossing the line cannot leave team shots at zero',()=>{
  const e=new MatchEngine(lineup('h'),lineup('a'),{userId:'h-10',seed:'goal-shot'}),p=e.playerById('h-10');
  e.restart=null;e.ball.x=1060;e.ball.y=350;e.ball.lastTeam=0;e.ball.lastPlayerId=p.id;e.ball.shotById=null;
  e.checkGoal();assert.equal(e.score[0],1);assert.ok(e.stats.shots[0]>=1);assert.ok(e.stats.shotsOnTarget[0]>=1);assert.ok(p.perf.shots>=1);
});
