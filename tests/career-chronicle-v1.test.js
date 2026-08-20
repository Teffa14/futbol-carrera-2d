import test from 'node:test';
import assert from 'node:assert/strict';
import {CAREER_MILESTONE_TYPES,ensureCareerChronicle,syncCareerChronicle,careerMilestone,recentCareerMilestones} from '../career-chronicle-v1.js';

function stateWith(history=[]){return{season:2,clubId:'club-a',history};}

test('chronicle records first career moments once from real match history',()=>{
  const state=stateWith([
    {season:1,week:1,appeared:false,squadStatus:'bench',score:[1,1]},
    {season:1,week:2,appeared:true,squadStatus:'bench',rating:6.8,goals:0,assists:0,score:[0,0]},
    {season:1,week:3,appeared:true,squadStatus:'starter',rating:8.7,goals:1,assists:1,score:[2,1]},
  ]);
  const c=syncCareerChronicle(state);
  assert.equal(c.milestones.filter(m=>m.type===CAREER_MILESTONE_TYPES.debut).length,1);
  assert.equal(careerMilestone(state,CAREER_MILESTONE_TYPES.debut).week,2);
  assert.equal(careerMilestone(state,CAREER_MILESTONE_TYPES.firstStart).week,3);
  assert.equal(careerMilestone(state,CAREER_MILESTONE_TYPES.firstGoal).week,3);
  assert.equal(careerMilestone(state,CAREER_MILESTONE_TYPES.firstAssist).week,3);
  assert.equal(careerMilestone(state,CAREER_MILESTONE_TYPES.firstStarPerformance).week,3);
});

test('sync is idempotent and does not duplicate milestones',()=>{
  const state=stateWith([{season:1,week:1,appeared:true,squadStatus:'starter',rating:9,goals:2,assists:1,score:[3,0]}]);
  syncCareerChronicle(state);const before=state.chronicle.milestones.length;
  syncCareerChronicle(state);
  assert.equal(state.chronicle.milestones.length,before);
  assert.equal(new Set(state.chronicle.seen).size,state.chronicle.seen.length);
});

test('threshold milestones capture the match where the threshold is crossed',()=>{
  const history=[];
  for(let week=1;week<=10;week++)history.push({season:1,week,appeared:true,squadStatus:week<3?'bench':'starter',rating:7,goals:1,assists:0,score:[1,0]});
  const state=stateWith(history);syncCareerChronicle(state);
  const apps10=careerMilestone(state,CAREER_MILESTONE_TYPES.appearances10),goals10=careerMilestone(state,CAREER_MILESTONE_TYPES.goals10);
  assert.equal(apps10.week,10);assert.equal(apps10.totals.apps,10);
  assert.equal(goals10.week,10);assert.equal(goals10.totals.goals,10);
});

test('milestones keep match context needed by future narrative presentation',()=>{
  const state=stateWith([{season:3,week:7,clubId:'rosario-central',opponent:'newells',appeared:true,squadStatus:'starter',rating:8.9,goals:1,assists:0,score:[2,1]}]);
  const firstGoal=careerMilestone(state,CAREER_MILESTONE_TYPES.firstGoal);
  assert.equal(firstGoal.clubId,'rosario-central');assert.equal(firstGoal.opponent,'newells');assert.deepEqual(firstGoal.score,[2,1]);assert.equal(firstGoal.rating,8.9);
});

test('recent milestones return newest events first without changing history',()=>{
  const history=[
    {season:1,week:1,appeared:true,squadStatus:'bench',rating:6.5,goals:0,assists:0,score:[0,0]},
    {season:1,week:2,appeared:true,squadStatus:'starter',rating:7.1,goals:0,assists:0,score:[1,0]},
    {season:1,week:3,appeared:true,squadStatus:'starter',rating:8.6,goals:1,assists:0,score:[2,0]},
  ];
  const state=stateWith(history),snapshot=JSON.stringify(history),recent=recentCareerMilestones(state,2);
  assert.equal(recent.length,2);assert.ok(recent[0].week>=recent[1].week);assert.equal(JSON.stringify(history),snapshot);
});

test('empty careers initialize a stable chronicle without fake milestones',()=>{
  const state=stateWith([]),c=ensureCareerChronicle(state);
  assert.deepEqual(c.milestones,[]);assert.deepEqual(syncCareerChronicle(state).milestones,[]);
});
