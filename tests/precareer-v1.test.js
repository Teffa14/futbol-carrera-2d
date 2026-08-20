import test from 'node:test';
import assert from 'node:assert/strict';
import {buildScoutingProfile,completePreCareerAssessment,createPreCareerState,preCareerReadiness,recordPreCareerDrill,recordTrialMatch} from '../precareer-v1.js';

function player(){return{instanceId:'user-player',name:'Prospecto',position:'RW',age:17,rating:57,country:'Argentina',pace:62,shooting:55,passing:58,dribbling:63,defense:38,physical:51};}
const drill=(id,score)=>({drillId:id,scores:{technical:score,tactical:score-5,physical:score+2,mentality:score-3}});
const trial=(id,score)=>({matchId:id,scores:{technical:score,tactical:score+4,physical:score-2,mentality:score+1},minutes:70});

test('pre-career starts unsigned and does not mutate player attributes',()=>{
  const p=player(),before=structuredClone(p),state=createPreCareerState({player:p,seed:'fixed'});
  assert.equal(state.stage,'assessment');assert.equal(state.signed,false);assert.deepEqual(p,before);
  assert.equal(state.player.overall,57);assert.equal('pace' in state.player,false);
});

test('three distinct drills unlock trial matches and repeated drill replaces evidence',()=>{
  let state=createPreCareerState({player:player()});
  state=recordPreCareerDrill(state,drill('control',60));
  state=recordPreCareerDrill(state,drill('passing',65));
  state=recordPreCareerDrill(state,drill('control',72));
  assert.equal(state.drills.length,2);assert.equal(preCareerReadiness(state).drillsComplete,false);
  state=recordPreCareerDrill(state,drill('finishing',68));
  assert.equal(preCareerReadiness(state).drillsComplete,true);assert.equal(state.stage,'trial-matches');
});

test('trial matches cannot be recorded before required drills',()=>{
  const state=createPreCareerState({player:player()});
  assert.throws(()=>recordTrialMatch(state,trial('trial-1',66)),/Required drills/);
});

test('trial evidence weighs more than drills in scouting profile',()=>{
  let state=createPreCareerState({player:player()});
  for(const id of ['control','passing','finishing'])state=recordPreCareerDrill(state,drill(id,40));
  state=recordTrialMatch(state,trial('trial-1',80));
  const profile=buildScoutingProfile(state);
  assert.ok(profile.technical>60,'trial match should pull technical score above midpoint');
  assert.ok(profile.tactical>profile.physical);
});

test('two trial matches complete assessment and unlock offers stage',()=>{
  let state=createPreCareerState({player:player()});
  for(const id of ['control','passing','finishing'])state=recordPreCareerDrill(state,drill(id,64));
  state=recordTrialMatch(state,trial('trial-1',67));
  assert.equal(preCareerReadiness(state).readyForOffers,false);
  state=recordTrialMatch(state,trial('trial-2',71));
  assert.equal(preCareerReadiness(state).readyForOffers,true);assert.equal(state.stage,'awaiting-offers');
  state=completePreCareerAssessment(state);
  assert.equal(state.status,'scouted');assert.equal(state.scouting.confidence,100);
});

test('assessment records observations without granting player progression',()=>{
  const p=player();let state=createPreCareerState({player:p});
  for(const id of ['control','passing','finishing'])state=recordPreCareerDrill(state,drill(id,95));
  state=recordTrialMatch(state,trial('trial-1',95));state=recordTrialMatch(state,trial('trial-2',95));
  assert.equal(p.rating,57);assert.equal(p.dribbling,63);assert.equal(state.player.overall,57);
  assert.ok(state.scouting.profile.overall>80);
});
