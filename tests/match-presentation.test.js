import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchEngine} from '../engine.js';
import {MATCH_BALL_RADIUS,assignMatchSquadNumbers} from '../match-presentation.js';

const roles=['GK','RB','CB','CB','LB','CDM','CM','CAM','RW','ST','LW'];
function lineup(prefix){return roles.map((role,i)=>({instanceId:`${prefix}-${i}`,id:`${prefix}-${i}`,name:`${prefix} ${i}`,position:role,engineRole:role,rating:68,pace:68,shooting:62,passing:66,dribbling:65,defense:62,physical:66,ballControl:66,vision:65,stamina:70,composure:65,fitness:100,skills:[]}));}
function engine(){return new MatchEngine(lineup('home'),lineup('away'),{seed:'presentation-test'});}

test('match presentation makes the physical ball slightly smaller without ownership state',()=>{
  const e=engine();
  assert.equal(MATCH_BALL_RADIUS,5);
  assert.equal(e.ball.r,5);
  assert.equal('ownerId' in e.ball,false);
});

test('each XI receives unique deterministic shirt numbers',()=>{
  const a=engine(),b=engine();
  for(const team of [0,1]){
    const aa=a.players.filter(p=>p.team===team),bb=b.players.filter(p=>p.team===team);
    const numbers=aa.map(p=>p.data.squadNumber);
    assert.equal(new Set(numbers).size,11);
    assert.equal(numbers.every(n=>Number.isInteger(n)&&n>=1&&n<=99),true);
    assert.deepEqual(aa.map(p=>[p.id,p.data.squadNumber]),bb.map(p=>[p.id,p.data.squadNumber]));
  }
});

test('existing valid shirt numbers are preserved when unique',()=>{
  const players=[
    {id:'keeper',role:'GK',data:{instanceId:'keeper',squadNumber:30}},
    {id:'striker',role:'ST',data:{instanceId:'striker',squadNumber:77}},
    {id:'mid',role:'CM',data:{instanceId:'mid'}}
  ];
  assignMatchSquadNumbers(players);
  assert.equal(players[0].data.squadNumber,30);
  assert.equal(players[1].data.squadNumber,77);
  assert.notEqual(players[2].data.squadNumber,30);
  assert.notEqual(players[2].data.squadNumber,77);
});

test('shirt number is rendered inside the player circle',()=>{
  const e=engine(),p=e.players.find(x=>x.team===0&&x.role==='ST');
  const text=[];
  const ctx={beginPath(){},arc(){},stroke(){},fill(){},moveTo(){},lineTo(){},closePath(){},save(){},restore(){},strokeText(v,x,y){text.push(['stroke',v,x,y]);},fillText(v,x,y){text.push(['fill',v,x,y]);}};
  e.drawPlayer(ctx,p);
  const number=String(p.data.squadNumber);
  assert.equal(text.some(([kind,value,x,y])=>kind==='fill'&&value===number&&x===p.x&&y===p.y+.5),true);
});
