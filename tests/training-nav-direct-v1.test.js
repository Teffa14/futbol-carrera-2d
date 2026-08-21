import test from 'node:test';
import assert from 'node:assert/strict';
import {openTrainingDirect} from '../training-nav-direct-v1.js';

function fakeState(){return{player:{name:'Test',position:'ST',pace:50,shooting:46,passing:48,dribbling:49,defense:35,physical:50,ballControl:47,vision:45,stamina:52,composure:44,trainingMemory:{},developmentWork:{},trainingLog:[],trainingSummary:{sessions:0,avgGrade:0,bestGrade:'—'}},progress:{trainingPoints:2}};}

test('sidebar training route mounts v2 without invoking legacy trainingView',()=>{const buttons=[{dataset:{view:'home'},classList:{toggle(){}}},{dataset:{view:'training'},classList:{toggle(){}}}],main={innerHTML:''},body={classList:{remove(){}}},doc={querySelector(sel){if(sel==='.main')return main;return null;},querySelectorAll(sel){return sel==='.nav-btn[data-view]'?buttons:[];},body};const ok=openTrainingDirect(doc,fakeState());assert.equal(ok,true);assert.match(main.innerHTML,/id="training-v2-home"/);assert.doesNotMatch(main.innerHTML,/data-train=/);});
