import test from 'node:test';
import assert from 'node:assert/strict';
import '../argentina-data-v1.js';
import {goalkeeperProfile,goalkeeperTarget,projectedGoalCross} from '../goalkeeper-intelligence-v2.js';

const keeper=(build='shot-stopper')=>({id:'gk',team:0,role:'GK',x:80,y:350,r:7.25,vx:0,vy:0,fatigue:0,data:{build,pace:58,defense:78,physical:72,ballControl:66,vision:68,passing:64,composure:76,stamina:68,skills:[]}});
function engine(gk=keeper()){return{ball:{x:410,y:340,vx:-5.2,vy:.08},players:[gk,{id:'rival',team:1,role:'ST',x:430,y:340,r:7.25,vx:0,vy:0,fatigue:0,data:{pace:72,stamina:70,ballControl:68,vision:62,composure:65,defense:30,physical:68}}]};}

test('shot stopper build materially improves goalkeeper profile',()=>{
  const strong=goalkeeperProfile(keeper('shot-stopper')),neutral=goalkeeperProfile({...keeper(),data:{...keeper().data,build:null}});
  assert.ok(strong.reflex>neutral.reflex);assert.ok(strong.handling>neutral.handling);
});

test('goalkeeper predicts an on-target shot crossing',()=>{
  const gk=keeper(),e=engine(gk),cross=projectedGoalCross(e,gk);assert.ok(cross?.onTarget);const target=goalkeeperTarget(e,gk);assert.equal(target.reason,'shot-line');assert.ok(target.y>=295&&target.y<=405);
});
