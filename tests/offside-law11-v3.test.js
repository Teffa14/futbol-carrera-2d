import test from 'node:test';
import assert from 'node:assert/strict';
import {law11Snapshot} from '../offside-law11-v3.js';
import {exactOffsideLine,legalStrikerEdge,strikerSpatialTarget} from '../striker-position-v4.js';

function engine(){return{tick:100,restart:null,ball:{x:620,y:350},players:[
  {id:'a1',team:0,role:'ST',x:826,y:330,r:7.25,data:{pace:76,vision:64}},
  {id:'a2',team:0,role:'RW',x:812,y:430,r:7.25,data:{}},
  {id:'a3',team:0,role:'CM',x:760,y:350,r:7.25,data:{}},
  {id:'d1',team:1,role:'CB',x:835,y:300,r:7.25,data:{}},
  {id:'d2',team:1,role:'CB',x:800,y:400,r:7.25,data:{}},
  {id:'gk',team:1,role:'GK',x:1020,y:350,r:7.25,data:{}}
]};}

test('Law 11 snapshots every attacker already beyond the line',()=>{
  const e=engine();assert.deepEqual(law11Snapshot(e,0).sort(),['a1','a2']);
  assert.equal(exactOffsideLine(e,0),800);
});

test('ball position can move the offside line ahead of defenders',()=>{
  const e=engine();e.ball.x=850;assert.deepEqual(law11Snapshot(e,0),[]);assert.equal(exactOffsideLine(e,0),850);
});

test('striker target stays close to the legal edge instead of a double margin',()=>{
  const e=engine(),p=e.players[0],legal=legalStrikerEdge(e,p),base={x:730,y:350};
  const target=strikerSpatialTarget(e,p,base,0);assert.ok(target.x<=legal+.001);assert.ok(legal-target.x<45,`target ${target.x}, legal ${legal}`);
});
