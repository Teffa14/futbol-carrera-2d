import {SECOND_DIVISION_CLUBS} from './division-b-data-v1.js';

const STORE_KEY='career-eleven-2d:v4';
const VALID_IDS=new Set(SECOND_DIVISION_CLUBS.map(c=>c.id));

function fixtureKey(home,away){return `${home}|${away}`;}
export function makeSecondDivisionSchedule(season=1){
  const arr=SECOND_DIVISION_CLUBS.map(c=>c.id);if(arr.length%2)arr.push(null);const n=arr.length,first=[];let rot=[...arr];
  for(let r=0;r<n-1;r++){const fixtures=[];for(let i=0;i<n/2;i++){const a=rot[i],b=rot[n-1-i];if(a&&b){const swap=(r+i+season)%2===1;fixtures.push({id:`s${season}-r${r+1}-${i}`,home:swap?b:a,away:swap?a:b,played:false,score:null});}}first.push({week:r+1,fixtures});rot=[rot[0],rot[n-1],...rot.slice(1,n-1)];}
  return [...first,...first.map((round,i)=>({week:first.length+i+1,fixtures:round.fixtures.map((f,j)=>({id:`s${season}-r${first.length+i+1}-${j}`,home:f.away,away:f.home,played:false,score:null}))}))];
}

function tableRows(){return SECOND_DIVISION_CLUBS.map(c=>({clubId:c.id,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}));}
function applyTable(table,f){const h=table.find(r=>r.clubId===f.home),a=table.find(r=>r.clubId===f.away);if(!h||!a||!f.played||!Array.isArray(f.score))return;const [hg,ag]=f.score;h.p++;a.p++;h.gf+=hg;h.ga+=ag;a.gf+=ag;a.ga+=hg;if(hg>ag){h.w++;a.l++;h.pts+=3;}else if(ag>hg){a.w++;h.l++;a.pts+=3;}else{h.d++;a.d++;h.pts++;a.pts++;}}

export function hasForeignLeagueFixture(state){return (state?.schedule||[]).some(round=>(round.fixtures||[]).some(f=>!VALID_IDS.has(f.home)||!VALID_IDS.has(f.away)));}

export function repairSecondDivisionCareer(state){
  if(!state||!VALID_IDS.has(state.clubId))return{changed:false,state};
  const countryMismatch=state.countryId!=='ARB',foreign=hasForeignLeagueFixture(state);if(!countryMismatch&&!foreign)return{changed:false,state};
  const played=new Map();for(const round of state.schedule||[])for(const f of round.fixtures||[])if(f.played&&VALID_IDS.has(f.home)&&VALID_IDS.has(f.away)&&Array.isArray(f.score))played.set(fixtureKey(f.home,f.away),{score:[...f.score]});
  const schedule=makeSecondDivisionSchedule(Number(state.season)||1);for(const round of schedule)for(const f of round.fixtures){const old=played.get(fixtureKey(f.home,f.away));if(old){f.played=true;f.score=[...old.score];}}
  const table=tableRows();for(const round of schedule)for(const f of round.fixtures)applyTable(table,f);
  const userPlayed=schedule.reduce((n,round)=>n+(round.fixtures.some(f=>f.played&&(f.home===state.clubId||f.away===state.clubId))?1:0),0);
  state.countryId='ARB';state.schedule=schedule;state.table=table;state.week=Math.max(1,userPlayed+1);state.seasonComplete=false;state.competitionIntegrity={version:1,repairedAt:Date.now(),reason:foreign?'foreign-tier-fixture':'country-id'};
  return{changed:true,state};
}

function repairStoredCareer(){if(typeof localStorage==='undefined')return;try{const raw=localStorage.getItem(STORE_KEY);if(!raw)return;const state=JSON.parse(raw),out=repairSecondDivisionCareer(state);if(out.changed)localStorage.setItem(STORE_KEY,JSON.stringify(out.state));}catch{}}
repairStoredCareer();

export const __competitionIntegrityV1={makeSecondDivisionSchedule,hasForeignLeagueFixture,repairSecondDivisionCareer};
