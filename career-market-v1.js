const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const num=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

function contractSignal(contractStatus={}){
  const status=String(contractStatus.status||'active');
  if(status==='free-agent')return 14;
  if(contractStatus.expiring||contractStatus.canNegotiate)return 7;
  return -4;
}

function ageSignal(age){
  const years=num(age,24);
  if(years<=20)return 5;
  if(years<=27)return 3;
  if(years<=31)return 1;
  if(years<=34)return -2;
  return -5;
}

function levelFit(playerRating,clubReputation){
  const expected=Math.max(45,num(clubReputation,78)-12);
  const gap=num(playerRating,60)-expected;
  if(gap>=8)return 17;
  if(gap>=3)return 13;
  if(gap>=-3)return 8;
  if(gap>=-8)return 1;
  if(gap>=-13)return -10;
  return -22;
}

function roleFromScore(score,playerRating,clubReputation){
  const expected=Math.max(45,num(clubReputation,78)-12);
  const gap=num(playerRating,60)-expected;
  if(score>=82&&gap>=5)return'key-player';
  if(score>=70&&gap>=0)return'important';
  if(score>=60)return'rotation';
  return'prospect';
}

function wageForOffer({score,playerRating,clubPrestige,currentWeeklyWage=0}){
  const marketBase=Math.max(350,Math.round((num(playerRating,60)-45)**2*7.5+num(clubPrestige,75)*18));
  const interestPremium=1+Math.max(0,num(score)-60)/140;
  return Math.max(Math.round(num(currentWeeklyWage)*1.05),Math.round(marketBase*interestPremium/50)*50);
}

export function assessClubInterest({
  player,
  club,
  career={},
  contractStatus={},
  squadNeed=50,
}={}){
  if(!player||!club)return null;
  const rating=clamp(num(player.rating,60),40,99);
  const reputation=clamp(num(career.reputation,10),0,100);
  const performance=clamp(num(career.performance,50),0,100);
  const need=clamp(num(squadNeed,50),0,100);
  const prestige=clamp(num(club.prestige,club.reputation||75),50,100);
  const clubReputation=clamp(num(club.reputation,76+(prestige-70)*.22),50,100);
  const levelGap=Math.round(rating-Math.max(45,clubReputation-12));

  const components={
    levelFit:levelFit(rating,clubReputation),
    reputation:Math.round((reputation-40)*.18),
    performance:Math.round((performance-50)*.16),
    squadNeed:Math.round((need-50)*.20),
    contract:contractSignal(contractStatus),
    age:ageSignal(player.age),
  };
  const score=clamp(Math.round(54+Object.values(components).reduce((sum,value)=>sum+value,0)),0,100);
  const threshold=contractStatus.status==='free-agent'?46:contractStatus.expiring||contractStatus.canNegotiate?50:58;
  const sportingEligible=levelGap>=-14;
  const interested=sportingEligible&&score>=threshold;
  return{
    clubId:String(club.id||''),
    score,
    threshold,
    interested,
    sportingEligible,
    components,
    projectedRole:roleFromScore(score,rating,clubReputation),
    levelGap,
  };
}

export function generateCareerOffers({
  player,
  clubs=[],
  career={},
  contractStatus={},
  currentClubId=null,
  squadNeeds={},
  currentWeeklyWage=0,
  maxOffers=5,
  allowCurrentClub=false,
}={}){
  if(!player)return[];
  const evaluated=[];
  for(const club of clubs){
    if(!club?.id)continue;
    if(!allowCurrentClub&&currentClubId&&String(club.id)===String(currentClubId))continue;
    const assessment=assessClubInterest({
      player,
      club,
      career,
      contractStatus,
      squadNeed:squadNeeds[club.id]??50,
    });
    if(!assessment?.interested)continue;
    const term=player.age>=33?1:assessment.projectedRole==='prospect'?3:2;
    evaluated.push({
      clubId:String(club.id),
      clubName:String(club.name||club.id),
      interestScore:assessment.score,
      projectedRole:assessment.projectedRole,
      weeklyWage:wageForOffer({
        score:assessment.score,
        playerRating:player.rating,
        clubPrestige:club.prestige,
        currentWeeklyWage,
      }),
      seasons:term,
      assessment,
    });
  }
  return evaluated
    .sort((a,b)=>b.interestScore-a.interestScore||b.weeklyWage-a.weeklyWage||a.clubId.localeCompare(b.clubId))
    .slice(0,clamp(Math.floor(num(maxOffers,5)),0,20));
}
