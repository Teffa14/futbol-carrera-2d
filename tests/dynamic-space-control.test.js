import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateArrivalTime,arrivalRace,controlAtPoint,interceptionWindow} from '../dynamic-space-control-v1.js';

function player(overrides={}){return{x:0,y:0,vx:0,vy:0,facingX:1,facingY:0,team:0,fatigue:0,data:{pace:70,stamina:70,physical:70,dribbling:65,ballControl:65,vision:65,composure:65,defense:55,fitness:100},...overrides};}

test('faster player reaches the same open point sooner',()=>{
  const slow=player({data:{...player().data,pace:48}}),fast=player({data:{...player().data,pace:90}}),target={x:180,y:0};
  assert.ok(estimateArrivalTime(fast,target)<estimateArrivalTime(slow,target));
});

test('orientation changes arrival time even at equal distance',()=>{
  const target={x:120,y:0},forward=player({facingX:1,facingY:0}),backward=player({facingX:-1,facingY:0});
  assert.ok(estimateArrivalTime(forward,target)+.15<estimateArrivalTime(backward,target));
});

test('fatigue reduces effective control of distant space',()=>{
  const target={x:190,y:0},fresh=player({fatigue:0}),tired=player({fatigue:62});
  assert.ok(estimateArrivalTime(fresh,target)<estimateArrivalTime(tired,target));
});

test('existing momentum toward the target improves arrival',()=>{
  const target={x:150,y:0},moving=player({vx:3.2,vy:0}),standing=player();
  assert.ok(estimateArrivalTime(moving,target)<estimateArrivalTime(standing,target));
});

test('arrival race and point control use time rather than nearest distance alone',()=>{
  const target={x:100,y:0},nearSlow=player({x:40,team:0,facingX:-1,data:{...player().data,pace:42}}),farFast=player({x:25,team:1,facingX:1,vx:3.5,data:{...player().data,pace:94}});
  const race=arrivalRace(nearSlow,farFast,target),control=controlAtPoint([nearSlow,farFast],target,{team:0});
  assert.equal(race.winner,farFast);
  assert.equal(control.controllerTeam,1);
  assert.ok(control.advantage<0);
});

test('interception window compares defender arrival against ball arrival budget',()=>{
  const defender=player({x:60,y:30,team:1,facingX:1,facingY:0,data:{...player().data,pace:82,defense:82}}),target={x:100,y:0};
  const early=interceptionWindow([defender],target,{arrivalTime:1.5}),late=interceptionWindow([defender],target,{arrivalTime:.15});
  assert.equal(early.canIntercept,true);
  assert.equal(late.canIntercept,false);
  assert.ok(early.margin>late.margin);
});
