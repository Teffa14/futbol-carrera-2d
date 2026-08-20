import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {COUNTRIES} from '../data.js';
import {createCareer,makeRoundRobin,nextFixture,lineup11,matchdaySelection,completeCareerMatch,trainAttribute,unlockSkill,asyncLineup,recordAsyncResult} from '../career.js';
import {MatchEngine} from '../engine.js';

test('all leagues create 11-player lineups and valid double round robin',()=>{
  for(const country of COUNTRIES){
    const club=country.clubs[0];
    const s=createCareer({playerName:'Test Player',nationality:country.id,position:'CM',build:'creator',countryId:country.id,clubId:club.id});
    assert.equal(Object.keys(s.world).length,country.clubs.length);
    for(const c of country.clubs)assert.equal(lineup11(s,c.id).length,11,`${country.id}/${c.id}`);
    const rounds=makeRoundRobin(country.id,1);
    assert.equal(rounds.length,(country.clubs.length-1)*2);
    for(const round of rounds){const seen=new Set();for(const f of round.fixtures){assert.equal(seen.has(f.home),false);assert.equal(seen.has(f.away),false);seen.add(f.home);seen.add(f.away);}}
  }
});

test('created career has no personal default name',()=>{
  const s=createCareer({playerName:'',nationality:'AR',position:'CAM',build:'technician',countryId:'AR',clubId:'river'});
  assert.equal(s.player.name,'Jugador');
  const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert.equal(app.includes('placeholder="Stefano"'),false);
});

test('coach-owned selection can leave a youth player outside the XI and promote him on merit',()=>{
  const s=createCareer({playerName:'Prospect',nationality:'AR',position:'CM',build:'creator',countryId:'AR',clubId:'river'});
  const roster=s.world[s.clubId].roster;
  for(const p of roster){p.rating=p.isUser?30:90;p.fitness=100;p.form=0;}
  let selection=matchdaySelection(s);
  assert.equal(selection.starters.length,11);
  assert.ok(selection.bench.length<=7);
  assert.equal(selection.status,'reserve');
  assert.equal(selection.starters.some(p=>p.isUser),false);
  assert.equal(lineup11(s,s.clubId).some(p=>p.isUser),false);

  for(const p of roster){if(!p.isUser)p.rating=50;}
  s.player.rating=99;
  selection=matchdaySelection(s);
  assert.equal(selection.status,'starter');
  assert.equal(lineup11(s,s.clubId).some(p=>p.isUser),true);
});

test('forceUser remains an explicit competitive-mode override',()=>{
  const s=createCareer({playerName:'Prospect',nationality:'PT',position:'CM',build:'engine',countryId:'PT',clubId:'porto'});
  for(const p of s.world[s.clubId].roster){p.rating=p.isUser?30:90;p.fitness=100;p.form=0;}
  assert.equal(lineup11(s,s.clubId).some(p=>p.isUser),false);
  assert.equal(lineup11(s,s.clubId,{forceUser:true}).some(p=>p.isUser),true);
});

test('a match without an appearance does not award appearance stats or performance XP',()=>{
  const s=createCareer({playerName:'Prospect',nationality:'ES',position:'CM',build:'creator',countryId:'ES',clubId:'barcelona'});
  for(const p of s.world[s.clubId].roster){p.rating=p.isUser?30:90;p.fitness=100;p.form=0;}
  const fixture=nextFixture(s),beforeXp=s.progress.xp,beforeApps=s.seasonStats.apps;
  const result=completeCareerMatch(s,fixture.id,{score:[1,0],userPerformance:null});
  assert.equal(result.ok,true);
  assert.equal(s.seasonStats.apps,beforeApps);
  assert.equal(s.progress.xp,beforeXp);
  assert.equal(s.history.at(-1).appeared,false);
  assert.equal(s.history.at(-1).squadStatus,'reserve');
  assert.equal(s.lastMatch.userPerformance,null);
});

test('new careers use the canonical youth development profile',()=>{
  const input={playerName:'Youth Test',nationality:'AR',position:'RW',build:'technician',countryId:'AR',clubId:'river'};
  const a=createCareer(input),b=createCareer(input);
  assert.equal(a.player.age,17);
  assert.match(a.player.birthDate,/^2009-\d{2}-\d{2}$/);
  assert.ok(a.player.rating<70,`expected youth OVR below 70, got ${a.player.rating}`);
  assert.equal(a.player.rating,a.player.developmentProfile.startingOverall);
  assert.equal(a.player.developmentProfile.entryLevel,'reserve');
  assert.equal(a.player.developmentProfile.background,'local_academy');
  assert.equal(a.player.dynamicPotential,a.player.developmentProfile.dynamicPotential);
  assert.ok(a.player.dynamicPotential>a.player.rating);
  assert.ok(a.player.dynamicPotential<=94);
  assert.deepEqual(
    {rating:a.player.rating,birthDate:a.player.birthDate,potential:a.player.dynamicPotential,pace:a.player.pace,dribbling:a.player.dribbling},
    {rating:b.player.rating,birthDate:b.player.birthDate,potential:b.player.dynamicPotential,pace:b.player.pace,dribbling:b.player.dribbling},
  );
});

test('career development inputs can represent different entry contexts without changing the API shape',()=>{
  const common={playerName:'Prospect',nationality:'ES',position:'CM',build:'creator',countryId:'ES',clubId:'barcelona'};
  const reserve=createCareer({...common,age:17,entryLevel:'reserve',background:'local_academy'});
  const second=createCareer({...common,age:18,entryLevel:'second',background:'elite_academy'});
  assert.equal(reserve.player.developmentProfile.entryLevel,'reserve');
  assert.equal(second.player.developmentProfile.entryLevel,'second');
  assert.equal(second.player.age,18);
  assert.ok(second.player.rating>=reserve.player.rating);
  assert.notEqual(second.player.dynamicPotential,96);
});

test('training changes an attribute that is used by the player model',()=>{
  const s=createCareer({playerName:'Test',nationality:'ES',position:'RW',build:'speedster',countryId:'ES',clubId:'barcelona'});
  const before=s.player.dribbling,points=s.progress.trainingPoints;
  const r=trainAttribute(s,'dribbling');
  assert.equal(r.ok,true);assert.ok(s.player.dribbling>before);assert.equal(s.progress.trainingPoints,points-1);
});

test('skill system unlocks and equips a perk',()=>{
  const s=createCareer({playerName:'Test',nationality:'EN',position:'ST',build:'finisher',countryId:'EN',clubId:'arsenal'});
  const r=unlockSkill(s,'power-shot');
  assert.equal(r.ok,true);assert.equal(s.player.unlockedSkills.includes('power-shot'),true);
});

test('async opponent contributes a ghost player to an 11v11 lineup without inheriting youth scaling',()=>{
  const s=createCareer({playerName:'Test',nationality:'PT',position:'CM',build:'engine',countryId:'PT',clubId:'porto'});
  const opp=s.asyncLeague.opponents[0],xi=asyncLineup(s,opp.id);
  assert.equal(xi.length,11);assert.equal(xi.some(p=>p.instanceId===opp.player.instanceId),true);
  assert.equal(opp.player.developmentProfile,null);
  assert.ok(opp.player.rating>=60);
  const result=recordAsyncResult(s,opp.id,[2,1],{rating:8});
  assert.equal(result.ok,true);assert.ok(s.asyncLeague.rating>1000);
});

test('11v11 match exits kickoff, keeps the ball free and completes deterministically',()=>{
  const build=()=>{const s=createCareer({playerName:'Test',nationality:'AR',position:'CAM',build:'technician',countryId:'AR',clubId:'river'});const f=nextFixture(s),home=lineup11(s,f.home),away=lineup11(s,f.away);return new MatchEngine(home,away,{homeName:f.home,awayName:f.away,homeTactics:s.world[f.home].tactics,awayTactics:s.world[f.away].tactics,userId:s.player.instanceId,seed:'fixed-11v11'});};
  const run=()=>{const e=build();let hadPhysicalTouch=false,hadFreeFlight=false;for(let i=0;i<7000&&!e.finished;i++){e.step(.05);assert.equal('ownerId' in e.ball,false);if(e.ball.lastPlayerId)hadPhysicalTouch=true;if(Math.hypot(e.ball.vx,e.ball.vy)>1&&e.tick-e.ball.lastTouchTick>2)hadFreeFlight=true;}assert.equal(e.finished,true);assert.equal(e.players.length,22);assert.equal(e.restart?.active,false);assert.equal(hadPhysicalTouch,true);assert.equal(hadFreeFlight,true);const touches=e.players.reduce((n,p)=>n+p.perf.touches,0);assert.ok(touches>0);assert.ok(e.stats.passes[0]+e.stats.passes[1]>0);return JSON.stringify({score:e.score,stats:e.stats,user:e.userPerformance()});};
  assert.equal(run(),run());
});
