import test from 'node:test';
import assert from 'node:assert/strict';
import {ageOnDate,birthDateForAge,careerSeasonStartDate,initializeCareerTime,advanceCareerDays,rollCareerToSeasonStart} from '../career-time-v1.js';

test('age changes on the birthday instead of at an arbitrary season boundary',()=>{
  assert.equal(ageOnDate('2009-06-15','2026-06-14'),16);
  assert.equal(ageOnDate('2009-06-15','2026-06-15'),17);
  assert.equal(ageOnDate('2009-06-15','2027-01-01'),17);
});

test('birthDateForAge creates a deterministic birthday matching the requested age on the reference date',()=>{
  const a=birthDateForAge(17,'2026-02-01',{seed:'prospect'}),b=birthDateForAge(17,'2026-02-01',{seed:'prospect'});
  assert.equal(a,b);
  assert.equal(ageOnDate(a,'2026-02-01'),17);
});

test('domestic calendars expose reusable season windows',()=>{
  assert.equal(careerSeasonStartDate('AR',1),'2026-02-01');
  assert.equal(careerSeasonStartDate('AR',2),'2027-02-01');
  assert.equal(careerSeasonStartDate('EN',1),'2026-08-01');
});

test('initializing the clock anchors every roster age to a birth date',()=>{
  const user={id:'user',instanceId:'user',name:'User',age:17,birthDate:'2009-12-20',developmentProfile:{age:17,birthDate:'2009-12-20'}};
  const teammate={id:'mate',instanceId:'mate',name:'Mate',age:24};
  const state={countryId:'AR',season:1,player:user,world:{club:{roster:[user,teammate]}}};
  initializeCareerTime(state,{startDate:'2026-02-01'});
  assert.equal(state.clock.currentDate,'2026-02-01');
  assert.equal(ageOnDate(user.birthDate,state.clock.currentDate),17);
  assert.equal(ageOnDate(teammate.birthDate,state.clock.currentDate),24);
  assert.equal(user.developmentProfile.birthDate,user.birthDate);
});

test('weekly time progression crosses birthdays naturally for the full roster',()=>{
  const user={id:'user',instanceId:'user',name:'User',age:17,birthDate:'2009-02-05',developmentProfile:{age:17,birthDate:'2009-02-05'}};
  const mate={id:'mate',instanceId:'mate',name:'Mate',age:20,birthDate:'2006-02-04'};
  const state={countryId:'AR',season:1,player:user,world:{club:{roster:[user,mate]}},clock:{currentDate:'2026-02-01',startedAt:'2026-02-01',elapsedDays:0,lastAdvanceDays:0}};
  advanceCareerDays(state,7);
  assert.equal(state.clock.currentDate,'2026-02-08');
  assert.equal(user.age,17);
  assert.equal(mate.age,20);
  assert.equal(state.clock.elapsedDays,7);
  advanceCareerDays(state,365);
  assert.equal(user.age,18);
  assert.equal(mate.age,21);
});

test('season roll never rewinds an already advanced football calendar',()=>{
  const user={id:'user',instanceId:'user',age:18,birthDate:'2008-04-10'};
  const state={countryId:'AR',season:2,player:user,world:{club:{roster:[user]}},clock:{currentDate:'2027-03-15',startedAt:'2026-02-01',elapsedDays:407,lastAdvanceDays:7}};
  rollCareerToSeasonStart(state,2);
  assert.equal(state.clock.currentDate,'2027-03-15');
  assert.equal(user.age,18);
});

test('season rollover applies one age-curve step to veterans across the football world',()=>{
  const user={id:'user',instanceId:'user',position:'ST',age:34,birthDate:'1992-01-10',rating:80,pace:80,shooting:80,passing:80,dribbling:80,defense:50,physical:80,ballControl:80,vision:80,stamina:80,composure:80,developmentProfile:{age:34,birthDate:'1992-01-10',stage:'veteran'}};
  const mate={id:'mate',instanceId:'mate',position:'CM',age:35,birthDate:'1991-01-10',rating:79,pace:78,shooting:72,passing:82,dribbling:78,defense:72,physical:76,ballControl:80,vision:82,stamina:80,composure:81};
  const state={countryId:'AR',season:2,player:user,world:{club:{roster:[user,mate]}},clock:{currentDate:'2026-12-20',startedAt:'2026-02-01',elapsedDays:322,lastAdvanceDays:7}};
  const userBefore=[user.pace,user.physical,user.stamina],mateBefore=[mate.pace,mate.physical,mate.stamina];
  rollCareerToSeasonStart(state,2);
  assert.equal(state.clock.currentDate,'2027-02-01');
  assert.equal(user.age,35);
  assert.equal(mate.age,36);
  assert.ok([user.pace,user.physical,user.stamina].some((v,i)=>v<userBefore[i]));
  assert.ok([mate.pace,mate.physical,mate.stamina].some((v,i)=>v<mateBefore[i]));
  const snapshot={pace:user.pace,physical:user.physical,stamina:user.stamina};
  rollCareerToSeasonStart(state,2);
  assert.deepEqual({pace:user.pace,physical:user.physical,stamina:user.stamina},snapshot);
});
