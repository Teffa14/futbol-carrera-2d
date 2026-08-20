import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchEngine} from '../engine.js';
import '../kick-direction.js';
import '../ball-priority.js';
import '../anti-cluster.js';
import '../positional-ai.js';
import '../boundary-intelligence.js';
import '../role-depth.js';
import '../match-presentation.js';
import {FIELD} from '../football-rules-v2.js';
import '../locomotion-v2.js';
import '../agent-brain-v2.js';
import '../passing-intelligence-v2.js';

const roles=['GK','RB','CB','CB','LB','CDM','CM','CAM','RW','ST','LW'];
function lineup(prefix,shift=0){return roles.map((role,i)=>({instanceId:`${prefix}-${i}`,id:`${prefix}-${i}`,name:`${prefix} ${role} ${i}`,position:role,engineRole:role,rating:72,pace:58+((i*9+shift)%35),shooting:52+((i*8+shift)%37),passing:59+((i*11+shift)%34),dribbling:56+((i*13+shift)%37),defense:53+((i*7+shift)%39),physical:57+((i*5+shift)%35),ballControl:58+((i*10+shift)%35),vision:57+((i*12+shift)%37),stamina:61+((i*6+shift)%33),composure:58+((i*7+shift)%35),fitness:100,skills:[],instructions:{risk:50,shoot:55,dribble:52}}));}
function spread(players,key){const values=players.map(p=>p[key]);return Math.max(...values)-Math.min(...values);}
function edgeCount(players){return players.filter(p=>p.x<FIELD.left+30||p.x>FIELD.right-30||p.y<FIELD.top+30||p.y>FIELD.bottom-30).length;}

test('a long match preserves space, independent velocity and two-team participation',()=>{
  const e=new MatchEngine(lineup('home',2),lineup('away',17),{seed:'emergent-football-regression'});
  let samples=0,healthyWidth=0,maxSpeedRange=0,maxWallStreak=[0,0],wallStreak=[0,0],cadenceDiversity=0;
  for(let i=0;i<7000&&!e.finished;i++){
    e.step(.016);
    if(i<80||i%30)continue;
    samples++;
    for(const team of [0,1]){
      const ps=e.players.filter(p=>p.team===team),width=spread(ps,'y');
      if(width>185)healthyWidth++;
      const wall=edgeCount(ps);wallStreak[team]=wall>=6?wallStreak[team]+1:0;maxWallStreak[team]=Math.max(maxWallStreak[team],wallStreak[team]);
    }
    const speeds=e.players.filter(p=>p.role!=='GK').map(p=>Math.hypot(p.vx,p.vy));
    maxSpeedRange=Math.max(maxSpeedRange,Math.max(...speeds)-Math.min(...speeds));
    const cadences=new Set(e.players.filter(p=>p.role!=='GK').map(p=>p.brainUntil||0));cadenceDiversity=Math.max(cadenceDiversity,cadences.size);
  }
  assert.equal(e.finished,true);
  assert.ok(e.stats.passes[0]>=3&&e.stats.passes[1]>=3,`both teams must pass: ${e.stats.passes[0]}-${e.stats.passes[1]}`);
  assert.ok(e.stats.shots[0]+e.stats.shots[1]>=1,`match produced no shots`);
  assert.ok(healthyWidth>=samples*1.25,`teams collapsed too often: healthy width ${healthyWidth}/${samples*2}`);
  assert.ok(maxSpeedRange>.55,`players still move at nearly one speed: range ${maxSpeedRange}`);
  assert.ok(maxWallStreak[0]<8&&maxWallStreak[1]<8,`six-player wall column persisted: ${maxWallStreak}`);
  assert.ok(cadenceDiversity>=4,`agents still share a synchronized decision clock: ${cadenceDiversity}`);
});
