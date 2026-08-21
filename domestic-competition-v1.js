const DEFAULT_POINTS=Object.freeze({win:3,draw:1,loss:0});

const clone=value=>JSON.parse(JSON.stringify(value));
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

function normalizeClubIds(clubIds){
  assert(Array.isArray(clubIds)&&clubIds.length>=2,'A competition needs at least two clubs');
  const ids=clubIds.map(id=>String(id));
  assert(new Set(ids).size===ids.length,'Club ids must be unique inside a competition');
  return ids;
}

function fixtureId(round,index,homeId,awayId){return `r${round+1}-m${index+1}-${homeId}-${awayId}`;}

export function buildRoundRobinSchedule(clubIds,{doubleRoundRobin=true}={}){
  const ids=normalizeClubIds(clubIds),bye='__BYE__',rotation=ids.length%2?[...ids,bye]:[...ids],roundSize=rotation.length-1,half=rotation.length/2,fixtures=[];
  for(let round=0;round<roundSize;round++){
    for(let i=0;i<half;i++){
      const left=rotation[i],right=rotation[rotation.length-1-i];
      if(left===bye||right===bye)continue;
      const flip=(round+i)%2===1,homeId=flip?right:left,awayId=flip?left:right;
      fixtures.push({id:fixtureId(round,i,homeId,awayId),round:round+1,homeId,awayId});
    }
    rotation.splice(1,0,rotation.pop());
  }
  if(doubleRoundRobin){
    const offset=roundSize;
    for(const first of [...fixtures]){
      const round=first.round+offset;
      fixtures.push({id:`r${round}-return-${first.awayId}-${first.homeId}`,round,homeId:first.awayId,awayId:first.homeId});
    }
  }
  return fixtures;
}

function emptyRow(clubId){return{clubId,played:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,goalDifference:0,points:0};}

function compareRows(a,b){
  return b.points-a.points||b.goalDifference-a.goalDifference||b.goalsFor-a.goalsFor||b.wins-a.wins||a.clubId.localeCompare(b.clubId);
}

export function calculateStandings(competition){
  const rows=new Map(competition.clubIds.map(id=>[id,emptyRow(id)])),points=competition.points||DEFAULT_POINTS;
  for(const result of Object.values(competition.results||{})){
    const fixture=competition.fixtures.find(item=>item.id===result.fixtureId);
    if(!fixture)continue;
    const home=rows.get(fixture.homeId),away=rows.get(fixture.awayId),hg=result.homeGoals,ag=result.awayGoals;
    for(const row of [home,away])row.played++;
    home.goalsFor+=hg;home.goalsAgainst+=ag;away.goalsFor+=ag;away.goalsAgainst+=hg;
    if(hg>ag){home.wins++;away.losses++;home.points+=points.win;away.points+=points.loss;}
    else if(hg<ag){away.wins++;home.losses++;away.points+=points.win;home.points+=points.loss;}
    else{home.draws++;away.draws++;home.points+=points.draw;away.points+=points.draw;}
  }
  for(const row of rows.values())row.goalDifference=row.goalsFor-row.goalsAgainst;
  return [...rows.values()].sort(compareRows).map((row,index)=>({...row,position:index+1}));
}

export function createDomesticCompetition({id,name,country,season,tier,clubIds,doubleRoundRobin=true,points=DEFAULT_POINTS}){
  const normalized=normalizeClubIds(clubIds);
  assert(id&&name&&country,'Competition id, name and country are required');
  assert(Number.isInteger(tier)&&tier>=1,'Competition tier must be a positive integer');
  return{id:String(id),name:String(name),country:String(country),season:String(season),tier,clubIds:normalized,fixtures:buildRoundRobinSchedule(normalized,{doubleRoundRobin}),results:{},points:{...DEFAULT_POINTS,...points},completed:false,championId:null,history:null};
}

export function recordCompetitionResult(competition,{fixtureId:targetId,homeGoals,awayGoals}){
  assert(!competition.completed,'Cannot record results after competition completion');
  const fixture=competition.fixtures.find(item=>item.id===targetId);
  assert(fixture,`Unknown fixture: ${targetId}`);
  assert(!competition.results[targetId],`Fixture already has a result: ${targetId}`);
  assert(Number.isInteger(homeGoals)&&homeGoals>=0&&Number.isInteger(awayGoals)&&awayGoals>=0,'Goals must be non-negative integers');
  const next=clone(competition);
  next.results[targetId]={fixtureId:targetId,homeGoals,awayGoals};
  return next;
}

export function competitionProgress(competition){
  const played=Object.keys(competition.results||{}).length,total=competition.fixtures.length;
  return{played,total,remaining:total-played,complete:played===total};
}

export function finalizeDomesticCompetition(competition){
  const progress=competitionProgress(competition);
  assert(progress.complete,'Cannot finalize a competition with unplayed fixtures');
  const table=calculateStandings(competition),next=clone(competition);
  next.completed=true;next.championId=table[0]?.clubId||null;
  next.history={season:next.season,competitionId:next.id,tier:next.tier,championId:next.championId,table};
  return next;
}

function normalizedSlots(value,label){assert(Number.isInteger(value)&&value>=0,`${label} must be a non-negative integer`);return value;}

export function resolvePromotionRelegation({upper,lower,promotionSlots=1,relegationSlots=1}){
  assert(upper?.completed&&lower?.completed,'Both competitions must be completed before promotion/relegation');
  assert(upper.country===lower.country,'Promotion/relegation requires competitions from the same country');
  assert(upper.tier+1===lower.tier,'Competitions must be adjacent tiers');
  const promotions=normalizedSlots(promotionSlots,'promotionSlots'),relegations=normalizedSlots(relegationSlots,'relegationSlots');
  assert(promotions===relegations,'Promotion and relegation slots must match to preserve tier sizes');
  assert(promotions<upper.clubIds.length&&promotions<lower.clubIds.length,'Movement slots must leave clubs in both tiers');
  const upperTable=calculateStandings(upper),lowerTable=calculateStandings(lower);
  const promoted=lowerTable.slice(0,promotions).map(row=>row.clubId),relegated=upperTable.slice(-relegations).map(row=>row.clubId);
  const nextUpper=[...upper.clubIds.filter(id=>!relegated.includes(id)),...promoted];
  const nextLower=[...lower.clubIds.filter(id=>!promoted.includes(id)),...relegated];
  return{promoted,relegated,nextUpperClubIds:nextUpper,nextLowerClubIds:nextLower,history:{country:upper.country,fromSeason:upper.season,toSeason:String(Number(upper.season)+1),promoted:[...promoted],relegated:[...relegated]}};
}

export function createNextSeasonCompetitions({upper,lower,movement,nextSeason=String(Number(upper.season)+1)}){
  assert(movement?.nextUpperClubIds&&movement?.nextLowerClubIds,'Promotion/relegation movement is required');
  return{
    upper:createDomesticCompetition({...upper,season:nextSeason,clubIds:movement.nextUpperClubIds}),
    lower:createDomesticCompetition({...lower,season:nextSeason,clubIds:movement.nextLowerClubIds}),
  };
}
