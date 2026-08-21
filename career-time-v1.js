const MS_DAY=24*60*60*1000;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function parseISO(value){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));
  if(!m)throw new Error(`Invalid ISO date: ${value}`);
  const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])));
  if(d.getUTCFullYear()!==Number(m[1])||d.getUTCMonth()!==Number(m[2])-1||d.getUTCDate()!==Number(m[3]))throw new Error(`Invalid ISO date: ${value}`);
  return d;
}
function iso(d){return d.toISOString().slice(0,10);}
function hashSeed(seed){let h=2166136261;for(const ch of String(seed)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function monthDay(d){return (d.getUTCMonth()+1)*100+d.getUTCDate();}

export function addDaysISO(date,days){const d=parseISO(date);d.setUTCDate(d.getUTCDate()+Math.round(Number(days)||0));return iso(d);}
export function daysBetweenISO(from,to){return Math.round((parseISO(to)-parseISO(from))/MS_DAY);}

export function ageOnDate(birthDate,currentDate){
  const birth=parseISO(birthDate),now=parseISO(currentDate);
  let age=now.getUTCFullYear()-birth.getUTCFullYear();
  if(monthDay(now)<monthDay(birth))age--;
  return Math.max(0,age);
}

export function birthDateForAge(age,onDate,{seed='player'}={}){
  const now=parseISO(onDate),a=clamp(Math.round(Number(age)||18),0,60),h=hashSeed(seed);
  const month=1+(h%12),day=1+((h>>>8)%28),birthday=month*100+day;
  const year=now.getUTCFullYear()-a-(monthDay(now)<birthday?1:0);
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

export function careerSeasonStartDate(countryId='AR',season=1){
  const year=2026+Math.max(0,Math.round(Number(season)||1)-1);
  const calendarYear=new Set(['AR','BR']);
  return `${year}-${calendarYear.has(countryId)?'02-01':'08-01'}`;
}

function playerKey(player,index=0){return player?.instanceId||player?.id||player?.name||`player-${index}`;}
function ensurePlayerBirthDate(player,currentDate,index=0){
  if(!player)return;
  if(!player.birthDate)player.birthDate=birthDateForAge(player.age??18,currentDate,{seed:playerKey(player,index)});
  player.age=ageOnDate(player.birthDate,currentDate);
}

export function synchronizeCareerAges(state){
  const currentDate=state?.clock?.currentDate;
  if(!currentDate)return state;
  let i=0;
  for(const club of Object.values(state.world||{}))for(const player of club.roster||[])ensurePlayerBirthDate(player,currentDate,i++);
  ensurePlayerBirthDate(state.player,currentDate,i);
  if(state.player?.developmentProfile)state.player.developmentProfile.age=state.player.age;
  return state;
}

export function initializeCareerTime(state,{startDate=null}={}){
  if(!state)throw new Error('Career state required');
  const currentDate=startDate||careerSeasonStartDate(state.countryId,state.season||1);
  state.clock={currentDate,startedAt:currentDate,elapsedDays:0,lastAdvanceDays:0};
  synchronizeCareerAges(state);
  return state.clock;
}

export function advanceCareerDays(state,days=7){
  if(!state?.clock)initializeCareerTime(state);
  const amount=Math.max(0,Math.round(Number(days)||0));
  state.clock.currentDate=addDaysISO(state.clock.currentDate,amount);
  state.clock.elapsedDays=(state.clock.elapsedDays||0)+amount;
  state.clock.lastAdvanceDays=amount;
  synchronizeCareerAges(state);
  return state.clock;
}

export function rollCareerToSeasonStart(state,season=state?.season||1){
  if(!state?.clock)initializeCareerTime(state);
  const target=careerSeasonStartDate(state.countryId,season),gap=daysBetweenISO(state.clock.currentDate,target);
  if(gap>0)advanceCareerDays(state,gap);else synchronizeCareerAges(state);
  return state.clock;
}
