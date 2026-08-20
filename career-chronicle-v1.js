const milestoneKey=(type)=>`career:${type}`;

export const CAREER_MILESTONE_TYPES={
  debut:'debut',
  firstStart:'first-start',
  firstGoal:'first-goal',
  firstAssist:'first-assist',
  firstStarPerformance:'first-star-performance',
  appearances10:'appearances-10',
  goals10:'goals-10',
};

export function ensureCareerChronicle(state){
  state.chronicle??={version:1,milestones:[],seen:[]};
  state.chronicle.version=1;
  state.chronicle.milestones??=[];
  state.chronicle.seen??=[];
  return state.chronicle;
}

function addMilestone(state,type,entry,totals){
  const chronicle=ensureCareerChronicle(state),key=milestoneKey(type);
  if(chronicle.seen.includes(key))return false;
  chronicle.seen.push(key);
  chronicle.milestones.push({
    id:key,
    type,
    season:entry.season??state.season??1,
    week:entry.week??null,
    clubId:entry.clubId??state.clubId??null,
    opponent:entry.opponent??null,
    score:Array.isArray(entry.score)?[...entry.score]:null,
    squadStatus:entry.squadStatus??null,
    rating:entry.rating??null,
    totals:{...totals},
  });
  return true;
}

export function syncCareerChronicle(state){
  const chronicle=ensureCareerChronicle(state),history=Array.isArray(state.history)?state.history:[];
  let apps=0,goals=0,assists=0;
  for(const entry of history){
    if(entry?.appeared)apps++;
    goals+=Number(entry?.goals)||0;
    assists+=Number(entry?.assists)||0;
    const totals={apps,goals,assists};

    if(entry?.appeared)addMilestone(state,CAREER_MILESTONE_TYPES.debut,entry,totals);
    if(entry?.appeared&&entry?.squadStatus==='starter')addMilestone(state,CAREER_MILESTONE_TYPES.firstStart,entry,totals);
    if((Number(entry?.goals)||0)>0)addMilestone(state,CAREER_MILESTONE_TYPES.firstGoal,entry,totals);
    if((Number(entry?.assists)||0)>0)addMilestone(state,CAREER_MILESTONE_TYPES.firstAssist,entry,totals);
    if(entry?.appeared&&(Number(entry?.rating)||0)>=8.5)addMilestone(state,CAREER_MILESTONE_TYPES.firstStarPerformance,entry,totals);
    if(apps>=10)addMilestone(state,CAREER_MILESTONE_TYPES.appearances10,entry,totals);
    if(goals>=10)addMilestone(state,CAREER_MILESTONE_TYPES.goals10,entry,totals);
  }
  return chronicle;
}

export function careerMilestone(state,type){
  return syncCareerChronicle(state).milestones.find(m=>m.type===type)||null;
}

export function recentCareerMilestones(state,limit=5){
  const n=Math.max(0,Math.floor(Number(limit)||0));
  return syncCareerChronicle(state).milestones.slice(-n).reverse();
}
