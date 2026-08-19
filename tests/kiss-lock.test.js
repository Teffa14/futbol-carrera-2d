import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePlayerContacts,steerAroundOpponent} from '../contacts.js';

function p(id,team,x,y=640){return{id,team,x,y,vx:0,vy:0,r:10,facingX:1,facingY:0,data:{physical:70,dribbling:70,ballControl:70}};}

test('post-duel escape still executes when the desired target is already inside the old 18px early-return radius',()=>{
  const a=p('a',0,500,350),b=p('b',1,518,350),ball={x:509,y:350};
  a.contactEscapeTicks=8;a.contactEscapeX=0;a.contactEscapeY=-1;
  const target=steerAroundOpponent(a,{x:505,y:350},[a,b],ball);
  assert.ok(target.y<a.y-20,'escape memory must override a near-ball target instead of being discarded');
});

test('persistent rival contact at a touchline is forcibly broken in well under one simulated minute',()=>{
  const a=p('a',0,480),b=p('b',1,498),players=[a,b];
  let broken=false;
  for(let frame=0;frame<16;frame++){
    // Recreate the pressure that used to make both agents continuously kiss the same collision line.
    const mid=(a.x+b.x)/2;
    a.x=mid-9;b.x=mid+9;a.y=640;b.y=640;a.vx=.35;b.vx=-.35;a.vy=0;b.vy=0;
    const contacts=resolvePlayerContacts(players);
    if(contacts.some(c=>c.lockBroken)){broken=true;break;}
  }
  assert.equal(broken,true,'same rival pair must be classified as a lock and actively separated');
  assert.ok((a.contactLockBreaks||0)>0&&(b.contactLockBreaks||0)>0);
  assert.ok(Math.abs(a.contactEscapeX)>.9&&Math.abs(b.contactEscapeX)>.9,'bottom-touchline escape must run parallel to the line');
  assert.ok(Math.abs(a.contactEscapeY)<.1&&Math.abs(b.contactEscapeY)<.1,'touchline breaker must not choose the impossible outside lane');
  assert.ok(a.contactEscapeX*b.contactEscapeX<0,'rivals must commit to opposite escape directions');
});

test('a three-player sandwich cannot keep every participant committed to the same stationary cluster',()=>{
  const left=p('left',0,480),middle=p('middle',1,498),right=p('right',0,516),players=[left,middle,right];
  let anyBreak=false;
  for(let frame=0;frame<20;frame++){
    const centre=498;
    left.x=centre-18;middle.x=centre;right.x=centre+18;
    left.y=middle.y=right.y=640;
    left.vx=.3;middle.vx=0;right.vx=-.3;
    const contacts=resolvePlayerContacts(players);
    if(contacts.some(c=>c.lockBroken)){anyBreak=true;break;}
  }
  assert.equal(anyBreak,true,'at least one rival pair in the sandwich must be broken automatically');
  const escapeCount=players.filter(x=>(x.contactEscapeTicks||0)>0).length;
  assert.ok(escapeCount>=2,'lock breakup must create persistent escape steering for multiple participants');
});
