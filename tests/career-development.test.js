import test from 'node:test';
import assert from 'node:assert/strict';
import {createDevelopmentProfile,developmentStage,ageDevelopmentWeight,developmentHeadroom,applySeasonalAgeDecline} from '../career-development.js';

test('youth career profiles start meaningfully below 70 and are deterministic',()=>{
  const a=createDevelopmentProfile({seed:'rw-test',age:17,entryLevel:'reserve',background:'local_academy'});
  const b=createDevelopmentProfile({seed:'rw-test',age:17,entryLevel:'reserve',background:'local_academy'});
  assert.deepEqual(a,b);
  assert.ok(a.startingOverall>=45&&a.startingOverall<=68);
  assert.ok(a.startingOverall<70);
  assert.ok(a.potential>a.startingOverall);
  assert.ok(a.potential<=94);
  assert.match(a.birthDate,/^2009-\d{2}-\d{2}$/);
  assert.equal(a.stage,'academy');
});

test('entry context and background change the starting career instead of using one fixed 70 profile',()=>{
  const academy=createDevelopmentProfile({seed:'same',age:17,entryLevel:'academy',background:'late_bloomer'});
  const smallFirst=createDevelopmentProfile({seed:'same',age:17,entryLevel:'first_small',background:'elite_academy'});
  assert.ok(smallFirst.startingOverall>academy.startingOverall);
  assert.ok(academy.potential-academy.startingOverall>=12);
});

test('development stages cover academy through decline',()=>{
  assert.equal(developmentStage(16),'academy');
  assert.equal(developmentStage(19),'rookie');
  assert.equal(developmentStage(22),'development');
  assert.equal(developmentStage(27),'prime');
  assert.equal(developmentStage(32),'veteran');
  assert.equal(developmentStage(37),'decline');
});

test('age curves distinguish early physical development from later football intelligence',()=>{
  assert.ok(ageDevelopmentWeight('pace',18)>ageDevelopmentWeight('vision',18));
  assert.ok(ageDevelopmentWeight('vision',27)>ageDevelopmentWeight('pace',27));
  assert.ok(ageDevelopmentWeight('pace',35)<0);
  assert.ok(ageDevelopmentWeight('composure',31)>0);
});

test('development headroom is bounded by dynamic potential',()=>{
  const p=createDevelopmentProfile({seed:'headroom',age:18,entryLevel:'second'});
  assert.equal(developmentHeadroom(p,p.dynamicPotential),0);
  assert.equal(developmentHeadroom(p,p.dynamicPotential-7),7);
});

test('seasonal decline is bounded, deterministic and preserves later-maturing intelligence first',()=>{
  const make=()=>({instanceId:'veteran-9',position:'ST',age:35,rating:80,pace:80,shooting:80,passing:80,dribbling:80,defense:55,physical:80,ballControl:80,vision:80,stamina:80,composure:80,developmentProfile:{age:35,stage:'decline'}});
  const a=make(),b=make();
  const lossesA=applySeasonalAgeDecline(a,{season:7}),lossesB=applySeasonalAgeDecline(b,{season:7});
  assert.deepEqual(lossesA,lossesB);
  assert.equal(lossesA.length,2);
  assert.ok(lossesA.every(x=>x.from-x.to===1));
  assert.equal(a.vision,80);
  assert.equal(a.composure,80);
  assert.ok(a.rating<=80);
  assert.deepEqual(applySeasonalAgeDecline(a,{season:7}),[]);
});

test('prime-age players do not decline just because a new season starts',()=>{
  const player={instanceId:'prime-8',position:'CM',age:28,rating:78,pace:75,shooting:70,passing:82,dribbling:78,defense:70,physical:72,ballControl:80,vision:83,stamina:82,composure:80};
  const before={...player};
  assert.deepEqual(applySeasonalAgeDecline(player,{season:4}),[]);
  for(const key of ['pace','shooting','passing','dribbling','defense','physical','ballControl','vision','stamina','composure','rating'])assert.equal(player[key],before[key]);
});
