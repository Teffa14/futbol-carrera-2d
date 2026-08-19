import test from 'node:test';
import assert from 'node:assert/strict';
import {createDevelopmentProfile,developmentStage,ageDevelopmentWeight,developmentHeadroom} from '../career-development.js';

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
