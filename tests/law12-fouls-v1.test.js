import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchEngine} from '../engine.js';
import {adjudicateContactFoul,awardDirectFreeKick,processContactFouls} from '../law12-fouls-v1.js';

function player(id,team,x,y,vx=0,vy=0){return{id,team,x,y,vx,vy,r:10,role:'CM',data:{name:id}};}

const ball={x:500,y:350,r:6,vx:0,vy:0};

test('late contact on the ball-advantaged player is adjudicated as a direct free kick',()=>{
  const victim=player('victim',0,500,350,.15,0);
  const offender=player('offender',1,518,350,-2.4,0);
  const foul=adjudicateContactFoul({contact:{a:victim,b:offender,leverageA:0,leverageB:0},ball,lastPossessionTeam:0});
  assert.equal(foul?.kind,'direct-free-kick');
  assert.equal(foul?.team,0);
  assert.equal(foul?.offenderId,'offender');
});

test('shoulder contact with comparable ball access stays legal',()=>{
  const a=player('a',0,494,350,1.1,0);
  const b=player('b',1,506,350,-1.0,0);
  const foul=adjudicateContactFoul({contact:{a,b,leverageA:.12,leverageB:0},ball,lastPossessionTeam:0});
  assert.equal(foul,null);
});

test('awardDirectFreeKick creates a physical restart without ball ownership',()=>{
  const engine={
    tick:40,
    players:[player('home',0,450,350),player('away',1,520,350)],
    ball:{...ball,lastTeam:1,lastPlayerId:'away',passerId:'away',intendedReceiverId:'x',shotById:'away',assistCandidateId:'away'},
    stats:{},lastPossessionTeam:1,events:[],
    playerById(id){return this.players.find(p=>p.id===id)||null;},
    pushEvent(text,team,type){this.events.push({text,team,type});},
  };
  assert.equal(awardDirectFreeKick(engine,{team:0,offenderId:'away',victimId:'home',x:500,y:350}),true);
  assert.equal(engine.restart.kind,'free-kick');
  assert.equal(engine.restart.reason,'foul');
  assert.equal(engine.ball.vx,0);
  assert.equal(engine.ball.vy,0);
  assert.equal('ownerId' in engine.ball,false);
  assert.equal(engine.stats.foulsCommitted[1],1);
  assert.equal(engine.stats.foulsWon[0],1);
});

test('contact foul processor converts physical contact evidence into one restart',()=>{
  const engine={
    tick:80,restart:null,lastPossessionTeam:0,
    players:[player('victim',0,500,350,.1,0),player('offender',1,518,350,-2.6,0)],
    ball:{...ball,lastTeam:0,lastPlayerId:'victim',passerId:null,intendedReceiverId:null,shotById:null,assistCandidateId:null},
    stats:{},events:[],
    playerById(id){return this.players.find(p=>p.id===id)||null;},
    pushEvent(text,team,type){this.events.push({text,team,type});},
  };
  const foul=processContactFouls(engine,[{a:engine.players[0],b:engine.players[1],leverageA:0,leverageB:0}]);
  assert.equal(foul?.reason,'late-contact');
  assert.equal(engine.restart?.active,true);
  assert.equal(engine.events.at(-1)?.type,'foul');
});

test('Law 12 module patches MatchEngine collision resolution exactly once',()=>{
  assert.equal(MatchEngine.prototype.__law12ContactFoulsV1,true);
});
