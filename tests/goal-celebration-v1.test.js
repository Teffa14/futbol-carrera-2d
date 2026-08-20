import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchEngine} from '../engine.js';
import {goalCelebrationSnapshot,__goalCelebrationTest} from '../goal-celebration-v1.js';

const ROLES=['GK','LB','CB','CB','RB','CDM','CM','CAM','LW','RW','ST'];
function lineup(prefix){return ROLES.map((position,i)=>({instanceId:`${prefix}-${i}`,name:`${prefix} ${i}`,position,engineRole:position,rating:65+i,pace:70,shooting:68,passing:70,dribbling:68,defense:62,physical:68,ballControl:70,vision:70,stamina:75,composure:72,fitness:100,skills:[]}));}

function goalReadyEngine(){
  const engine=new MatchEngine(lineup('Local'),lineup('Visita'),{homeName:'Nueva Chicago',awayName:'Colegiales',seed:'goal-celebration-test'});
  engine.restart=null;
  const scorer=engine.players.find(p=>p.team===0&&p.role==='ST');
  const assist=engine.players.find(p=>p.team===0&&p.role==='CAM');
  scorer.x=990;scorer.y=350;
  engine.ball.x=1060;engine.ball.y=350;engine.ball.vx=6;engine.ball.vy=0;
  engine.ball.shotById=scorer.id;engine.ball.lastPlayerId=scorer.id;engine.ball.assistCandidateId=assist.id;engine.ball.lastTeam=0;
  return{engine,scorer,assist};
}

test('a goal opens a celebration phase instead of restarting immediately',()=>{
  const {engine,scorer,assist}=goalReadyEngine(),beforeX=scorer.x,minute=engine.minute;
  engine.checkGoal();
  assert.deepEqual(engine.score,[1,0]);
  assert.equal(engine.restart,null);
  assert.equal(scorer.x,beforeX);
  const celebration=goalCelebrationSnapshot(engine);
  assert.equal(celebration.active,true);
  assert.equal(celebration.scorerId,scorer.id);
  assert.equal(celebration.assistName,assist.data.name);
  assert.equal(celebration.score[0],1);
  assert.equal(celebration.minute,1);
  assert.equal(engine.minute,minute);
});

test('the ball cannot score repeatedly while the celebration is active',()=>{
  const {engine}=goalReadyEngine();
  engine.checkGoal();
  engine.checkGoal();
  engine.checkGoal();
  assert.deepEqual(engine.score,[1,0]);
});

test('kickoff is created only after the celebration has completed',()=>{
  const {engine}=goalReadyEngine();
  engine.checkGoal();
  const minute=engine.minute;
  let guard=0;
  while(engine.goalCelebration&&guard++<200)engine.step(.025);
  assert.ok(guard<200);
  assert.equal(engine.goalCelebration,null);
  assert.equal(engine.minute,minute);
  assert.equal(engine.restart?.active,true);
  assert.equal(engine.restart?.kind,'kickoff');
  assert.equal(engine.restart?.team,1);
});

test('celebration duration is long enough to read the goal',()=>{
  assert.ok(__goalCelebrationTest.CELEBRATION_SECONDS>=2.5);
});
