import test from 'node:test';
import assert from 'node:assert/strict';
import {tacticalProfile,tacticalProfileId,tacticalSpaceBias,tacticalProfileFromDecisionProfile} from '../tactical-profile-v1.js';

const field={left:0,right:1050,top:0,bottom:680,centerY:340};
const anchor={x:520,y:150};

function player(profile){
  return{id:'rw-1',team:0,role:'RW',x:anchor.x,y:anchor.y,data:{tacticalProfile:profile,passing:72,dribbling:72,vision:72}};
}

test('same-stat wingers can carry distinct tactical identities',()=>{
  const isolation=player('isolation-winger');
  const combinative=player('combinative-winger');
  assert.equal(tacticalProfileId(isolation),'isolation-winger');
  assert.equal(tacticalProfileId(combinative),'combinative-winger');
  assert.ok(tacticalProfile(isolation).width>tacticalProfile(combinative).width);
  assert.ok(tacticalProfile(combinative).combination>tacticalProfile(isolation).combination);
});

test('isolation winger values touchline space while combinative winger values the half-space',()=>{
  const wideTarget={x:580,y:25};
  const halfSpaceTarget={x:580,y:185};
  const isolation=player('isolation-winger');
  const combinative=player('combinative-winger');
  const isolationWide=tacticalSpaceBias({player:isolation,target:wideTarget,anchor,field,hasPossession:true});
  const isolationHalf=tacticalSpaceBias({player:isolation,target:halfSpaceTarget,anchor,field,hasPossession:true});
  const combinativeWide=tacticalSpaceBias({player:combinative,target:wideTarget,anchor,field,hasPossession:true});
  const combinativeHalf=tacticalSpaceBias({player:combinative,target:halfSpaceTarget,anchor,field,hasPossession:true});
  assert.ok(isolationWide>isolationHalf,`expected isolation width bias ${isolationWide} > ${isolationHalf}`);
  assert.ok(combinativeHalf>combinativeWide,`expected combinative half-space bias ${combinativeHalf} > ${combinativeWide}`);
});

test('learned decision profiles become bounded spatial tendencies',()=>{
  const runner=tacticalProfileFromDecisionProfile({runBehind:92,showFeet:28,oneTouch:32,width:45,dribbleIntent:60,passRisk:68,shootIntent:84},'ST');
  const connector=tacticalProfileFromDecisionProfile({runBehind:34,showFeet:88,oneTouch:86,width:62,dribbleIntent:42,passRisk:72,shootIntent:35},'RW');
  assert.ok(runner.depth>.7);
  assert.ok(runner.directness>0);
  assert.ok(connector.support>.7);
  assert.ok(connector.combination>.7);
  assert.ok(connector.halfSpace>0);
  for(const value of [...Object.values(runner),...Object.values(connector)])assert.ok(value>=-1&&value<=1);
});

test('learned identity changes off-ball preference without changing raw stats',()=>{
  const learned=tacticalProfileFromDecisionProfile({runBehind:35,showFeet:90,oneTouch:88,width:70,dribbleIntent:40,passRisk:66,shootIntent:30},'RW');
  const p=player(learned);
  const halfSpace=tacticalSpaceBias({player:p,target:{x:580,y:185},anchor,field,hasPossession:true});
  const neutral=tacticalSpaceBias({player:player(null),target:{x:580,y:185},anchor,field,hasPossession:true});
  assert.ok(halfSpace>neutral);
  assert.equal(p.data.passing,72);
  assert.equal(p.data.dribbling,72);
  assert.equal(p.data.vision,72);
});

test('custom profiles are bounded and remain mechanical tendencies',()=>{
  const custom=player({width:4,halfSpace:-4,depth:.5,support:.2,combination:.7,dribble:.8,directness:.1,roam:.3});
  const profile=tacticalProfile(custom);
  assert.equal(profile.width,1);
  assert.equal(profile.halfSpace,-1);
  const value=tacticalSpaceBias({player:custom,target:{x:620,y:40},anchor,field,hasPossession:true});
  assert.ok(value<=1&&value>=-1);
  assert.equal('speedMultiplier' in profile,false);
  assert.equal('overallBoost' in profile,false);
});

test('profile model does not encode ball ownership or target steering',()=>{
  const source=JSON.stringify(tacticalProfile(player('direct-striker')))+JSON.stringify(tacticalProfileFromDecisionProfile({runBehind:90},'ST'));
  assert.doesNotMatch(source,/ownerId|capture|homing|receiverId|targetPlayer/i);
});
