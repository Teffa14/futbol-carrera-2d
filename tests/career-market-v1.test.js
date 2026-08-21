import test from 'node:test';
import assert from 'node:assert/strict';
import {assessClubInterest,generateCareerOffers} from '../career-market-v1.js';

const club=(id,reputation,prestige=reputation)=>({id,name:id,reputation,prestige});

test('strong sporting fit creates real club interest',()=>{
  const result=assessClubInterest({
    player:{rating:72,age:23},
    club:club('step-up',78,82),
    career:{reputation:70,performance:75},
    contractStatus:{status:'active',expiring:false,canNegotiate:false},
    squadNeed:70,
  });
  assert.equal(result.interested,true);
  assert.ok(result.score>=result.threshold);
  assert.ok(['important','rotation','key-player'].includes(result.projectedRole));
});

test('elite clubs reject players far below their sporting level',()=>{
  const result=assessClubInterest({
    player:{rating:55,age:19},
    club:club('elite',93,95),
    career:{reputation:10,performance:40},
    contractStatus:{status:'active'},
    squadNeed:50,
  });
  assert.equal(result.interested,false);
  assert.ok(result.components.levelFit<0);
});

test('free agency materially improves access without guaranteeing an offer',()=>{
  const base={
    player:{rating:61,age:24},
    club:club('mid-table',80,80),
    career:{reputation:30,performance:55},
    squadNeed:55,
  };
  const active=assessClubInterest({...base,contractStatus:{status:'active'}});
  const free=assessClubInterest({...base,contractStatus:{status:'free-agent',canNegotiate:true}});
  assert.equal(active.interested,false);
  assert.equal(free.interested,true);
  assert.ok(free.score>active.score);
  assert.ok(free.threshold<active.threshold);
});

test('position need changes interest but cannot erase a severe level mismatch',()=>{
  const wanted=assessClubInterest({
    player:{rating:58,age:21},
    club:club('champion',92,94),
    career:{reputation:25,performance:60},
    contractStatus:{status:'free-agent'},
    squadNeed:100,
  });
  const notNeeded=assessClubInterest({
    player:{rating:58,age:21},
    club:club('champion',92,94),
    career:{reputation:25,performance:60},
    contractStatus:{status:'free-agent'},
    squadNeed:0,
  });
  assert.ok(wanted.score>notNeeded.score);
  assert.equal(wanted.interested,false);
});

test('offer generation excludes current club and returns strongest candidates first',()=>{
  const offers=generateCareerOffers({
    player:{rating:74,age:25},
    clubs:[club('current',78,78),club('a',79,82),club('b',76,78),club('elite',94,95)],
    career:{reputation:72,performance:78},
    contractStatus:{status:'free-agent',canNegotiate:true},
    currentClubId:'current',
    squadNeeds:{a:75,b:55,elite:20},
    currentWeeklyWage:1400,
    maxOffers:3,
  });
  assert.ok(offers.length>=1);
  assert.equal(offers.some(offer=>offer.clubId==='current'),false);
  for(let i=1;i<offers.length;i++)assert.ok(offers[i-1].interestScore>=offers[i].interestScore);
  assert.ok(offers.every(offer=>offer.weeklyWage>=1470));
});

test('offer generation is deterministic for identical career state',()=>{
  const input={
    player:{rating:69,age:29},
    clubs:[club('x',77,79),club('y',80,82),club('z',75,76)],
    career:{reputation:60,performance:68},
    contractStatus:{status:'active',expiring:true,canNegotiate:true},
    squadNeeds:{x:65,y:60,z:45},
    currentWeeklyWage:900,
  };
  assert.deepEqual(generateCareerOffers(input),generateCareerOffers(input));
});
