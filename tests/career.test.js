import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, makeRoundRobin, nextUserFixture, completeUserLeagueMatch, draftPlayer, runTraining, sortedTable, marketPlayers } from '../career.js';
import { countryById } from '../career.js';

test('round robin schedules every club once per round and home/away twice per pair',()=>{
  const rounds=makeRoundRobin('AR',1);
  const clubs=countryById('AR').clubs.map(c=>c.id);
  assert.equal(rounds.length,(clubs.length-1)*2);
  const pairCount=new Map();
  for(const round of rounds){
    const seen=new Set();
    for(const f of round.fixtures){
      assert.equal(seen.has(f.home),false);assert.equal(seen.has(f.away),false);seen.add(f.home);seen.add(f.away);
      const pair=[f.home,f.away].sort().join('|');pairCount.set(pair,(pairCount.get(pair)||0)+1);
    }
  }
  for(const count of pairCount.values())assert.equal(count,2);
});

test('career creates persistent world squads and valid five-player XI',()=>{
  const s=createCareer({manager:'Test',nationality:'AR',style:'tactician',countryId:'AR',clubId:'river'});
  assert.equal(Object.keys(s.clubs).length,6);
  assert.ok(s.squad.length>=14);
  assert.equal(s.startingXI.length,5);
  assert.equal(s.table.length,6);
  assert.ok(nextUserFixture(s));
});

test('completing user match advances whole round exactly once',()=>{
  const s=createCareer({manager:'Test',nationality:'EN',style:'developer',countryId:'EN',clubId:'arsenal'});
  const f=nextUserFixture(s);
  const round=s.schedule.find(r=>r.week===f.week);
  completeUserLeagueMatch(s,f.id,[2,1],{scorers:['Bukayo Saka','Bukayo Saka']});
  assert.equal(round.fixtures.every(x=>x.played),true);
  assert.equal(s.week,2);
  assert.equal(s.table.reduce((sum,r)=>sum+r.p,0),round.fixtures.length*2);
  assert.equal(sortedTable(s).length,6);
});

test('draft consumes a pick and adds the prospect to the squad',()=>{
  const s=createCareer({manager:'Test',nationality:'PT',style:'recruiter',countryId:'PT',clubId:'porto'});
  const before=s.squad.length,prospect=s.draft.pool[0],picks=s.draft.picksLeft;
  const res=draftPlayer(s,prospect.instanceId);
  assert.equal(res.ok,true);assert.equal(s.squad.length,before+1);assert.equal(s.draft.picksLeft,picks-1);
});

test('training can run once per week',()=>{
  const s=createCareer({manager:'Test',nationality:'ES',style:'developer',countryId:'ES',clubId:'barcelona'});
  const a=runTraining(s),b=runTraining(s);
  assert.equal(a.ok,true);assert.equal(b.ok,false);
});

test('market exposes players from other clubs but not user club',()=>{
  const s=createCareer({manager:'Test',nationality:'IT',style:'recruiter',countryId:'IT',clubId:'inter'});
  const market=marketPlayers(s);
  assert.ok(market.length>20);
  assert.equal(market.some(p=>p.sellerId==='inter'),false);
});
