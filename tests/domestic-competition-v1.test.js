import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRoundRobinSchedule,calculateStandings,competitionProgress,createDomesticCompetition,createNextSeasonCompetitions,finalizeDomesticCompetition,recordCompetitionResult,resolvePromotionRelegation} from '../domestic-competition-v1.js';

const clubs=prefix=>[1,2,3,4].map(n=>`${prefix}-${n}`);

function completeCompetition(competition,scoreForFixture){
  let state=competition;
  for(const fixture of state.fixtures){
    const [homeGoals,awayGoals]=scoreForFixture(fixture);
    state=recordCompetitionResult(state,{fixtureId:fixture.id,homeGoals,awayGoals});
  }
  return finalizeDomesticCompetition(state);
}

test('round robin gives every club one home and away match against every opponent',()=>{
  const schedule=buildRoundRobinSchedule(clubs('a'));
  assert.equal(schedule.length,12);
  const pairCounts=new Map();
  for(const fixture of schedule){
    const key=[fixture.homeId,fixture.awayId].sort().join('|');
    pairCounts.set(key,(pairCounts.get(key)||0)+1);
  }
  assert.equal(pairCounts.size,6);
  assert.ok([...pairCounts.values()].every(count=>count===2));
});

test('odd club counts produce a valid schedule without bye fixtures',()=>{
  const schedule=buildRoundRobinSchedule(['a','b','c'],{doubleRoundRobin:false});
  assert.equal(schedule.length,3);
  assert.ok(schedule.every(f=>f.homeId!=='__BYE__'&&f.awayId!=='__BYE__'));
});

test('standings derive from recorded results with football tie breakers',()=>{
  let league=createDomesticCompetition({id:'l1',name:'Liga',country:'AR',season:2026,tier:1,clubIds:['a','b','c'],doubleRoundRobin:false});
  const scoreByPair=new Map([
    [['a','b'].sort().join('|'),[2,0]],
    [['a','c'].sort().join('|'),[1,0]],
    [['b','c'].sort().join('|'),[3,0]],
  ]);
  for(const fixture of league.fixtures){
    const key=[fixture.homeId,fixture.awayId].sort().join('|'),score=scoreByPair.get(key),sorted=[fixture.homeId,fixture.awayId].sort();
    let homeGoals,awayGoals;
    if(sorted[0]===fixture.homeId){[homeGoals,awayGoals]=score;}else{[awayGoals,homeGoals]=score;}
    league=recordCompetitionResult(league,{fixtureId:fixture.id,homeGoals,awayGoals});
  }
  const table=calculateStandings(league);
  assert.equal(table[0].clubId,'a');
  assert.equal(table[0].points,6);
  assert.equal(table[2].clubId,'c');
});

test('a competition cannot finalize before every scheduled match is played',()=>{
  const league=createDomesticCompetition({id:'l1',name:'Liga',country:'AR',season:2026,tier:1,clubIds:clubs('a')});
  assert.deepEqual(competitionProgress(league),{played:0,total:12,remaining:12,complete:false});
  assert.throws(()=>finalizeDomesticCompetition(league),/unplayed fixtures/);
});

test('completed season stores immutable historical table and champion',()=>{
  const league=createDomesticCompetition({id:'l1',name:'Liga',country:'AR',season:2026,tier:1,clubIds:clubs('a')});
  const completed=completeCompetition(league,fixture=>fixture.homeId==='a-1'?[2,0]:fixture.awayId==='a-1'?[0,2]:[0,0]);
  assert.equal(completed.completed,true);
  assert.equal(completed.championId,'a-1');
  assert.equal(completed.history.season,'2026');
  assert.equal(completed.history.table[0].clubId,'a-1');
  assert.throws(()=>recordCompetitionResult(completed,{fixtureId:completed.fixtures[0].id,homeGoals:0,awayGoals:0}),/after competition completion/);
});

test('promotion and relegation exchange sporting places between adjacent tiers',()=>{
  const upper=completeCompetition(createDomesticCompetition({id:'first',name:'Primera',country:'AR',season:2026,tier:1,clubIds:clubs('u')}),fixture=>fixture.homeId==='u-4'?[0,2]:fixture.awayId==='u-4'?[2,0]:[1,1]);
  const lower=completeCompetition(createDomesticCompetition({id:'second',name:'Segunda',country:'AR',season:2026,tier:2,clubIds:clubs('l')}),fixture=>fixture.homeId==='l-1'?[3,0]:fixture.awayId==='l-1'?[0,3]:[0,0]);
  const movement=resolvePromotionRelegation({upper,lower,promotionSlots:1,relegationSlots:1});
  assert.deepEqual(movement.promoted,['l-1']);
  assert.deepEqual(movement.relegated,['u-4']);
  assert.ok(movement.nextUpperClubIds.includes('l-1'));
  assert.ok(!movement.nextUpperClubIds.includes('u-4'));
  assert.ok(movement.nextLowerClubIds.includes('u-4'));
});

test('next season preserves competition definitions while applying movement and resetting results',()=>{
  const upper=completeCompetition(createDomesticCompetition({id:'first',name:'Primera',country:'AR',season:2026,tier:1,clubIds:clubs('u')}),fixture=>fixture.homeId==='u-4'?[0,1]:fixture.awayId==='u-4'?[1,0]:[0,0]);
  const lower=completeCompetition(createDomesticCompetition({id:'second',name:'Segunda',country:'AR',season:2026,tier:2,clubIds:clubs('l')}),fixture=>fixture.homeId==='l-1'?[2,0]:fixture.awayId==='l-1'?[0,2]:[0,0]);
  const movement=resolvePromotionRelegation({upper,lower});
  const next=createNextSeasonCompetitions({upper,lower,movement,nextSeason:'2027'});
  assert.equal(next.upper.season,'2027');
  assert.equal(next.lower.season,'2027');
  assert.equal(Object.keys(next.upper.results).length,0);
  assert.equal(next.upper.completed,false);
  assert.equal(next.upper.clubIds.length,upper.clubIds.length);
  assert.ok(next.upper.clubIds.includes('l-1'));
});

test('movement rejects non-adjacent tiers and mismatched slot counts',()=>{
  const make=(id,tier)=>completeCompetition(createDomesticCompetition({id,name:id,country:'AR',season:2026,tier,clubIds:clubs(id)}),()=>[0,0]);
  const first=make('first',1),third=make('third',3),second=make('second',2);
  assert.throws(()=>resolvePromotionRelegation({upper:first,lower:third}),/adjacent tiers/);
  assert.throws(()=>resolvePromotionRelegation({upper:first,lower:second,promotionSlots:2,relegationSlots:1}),/must match/);
});
