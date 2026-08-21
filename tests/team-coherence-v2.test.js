import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchEngine} from '../engine.js';
import {__teamCoherenceV2} from '../team-coherence-v2.js';

function lineup(prefix){return Array.from({length:11},(_,i)=>({name:`${prefix}${i}`,instanceId:`${prefix}-${i}`,engineRole:i===0?'GK':i===10?'ST':i>7?'LW':'CM',pace:72,shooting:65,passing:68,dribbling:68,defense:60,physical:65,ballControl:70,vision:70,stamina:72,composure:70,fitness:100,skills:[]}));}

test('only the strongest call remains primary and a deep call sustains acceleration',()=>{
  const e=new MatchEngine(lineup('h'),lineup('a'),{seed:'calls'});e.restart=null;e.inferPossessionTeam=()=>0;
  const a=e.playerById('h-10'),b=e.playerById('h-9');
  a.callForPass={score:.82,kind:'ahead',label:'¡AL ESPACIO!',targetX:a.x+120,targetY:a.y,untilTick:e.tick+30};
  b.callForPass={score:.61,kind:'ahead',label:'¡AL ESPACIO!',targetX:b.x+90,targetY:b.y,untilTick:e.tick+30};
  __teamCoherenceV2.prioritizeCalls(e);
  assert.equal(a.callForPass.primary,true);assert.equal(b.callForPass.primary,false);assert.ok(a.burstTimer>=.62);assert.ok(a.offBallCommit.untilTick>=e.tick+58);
});

test('the same prepared pattern cannot immediately restart again',()=>{
  const e=new MatchEngine(lineup('h'),lineup('a'),{seed:'patterns'});e.restart=null;e.minute=20;e.teamSequences=[{type:'overlap-cross',started:100,team:0},null];e._patternHistory=[{type:'overlap-cross',minute:15},null];e._patternSeen=[null,null];e._sequenceCooldown=[0,0];
  __teamCoherenceV2.dampPatternRepetition(e);
  assert.equal(e.teamSequences[0],null);assert.ok(e._sequenceCooldown[0]>=360);
});
