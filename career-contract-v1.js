const DAY_MS=24*60*60*1000;

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function isoDate(value){
  const text=String(value||'').slice(0,10);
  const date=new Date(`${text}T00:00:00Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||Number.isNaN(date.getTime()))throw new Error(`Invalid contract date: ${value}`);
  return text;
}

function addYears(dateText,years){
  const date=new Date(`${isoDate(dateText)}T00:00:00Z`);
  const month=date.getUTCMonth(),day=date.getUTCDate();
  date.setUTCFullYear(date.getUTCFullYear()+years);
  if(date.getUTCMonth()!==month){
    date.setUTCDate(0);
  }else if(date.getUTCDate()!==day){
    date.setUTCDate(day);
  }
  return date.toISOString().slice(0,10);
}

function dayDiff(from,to){
  return Math.floor((new Date(`${isoDate(to)}T00:00:00Z`)-new Date(`${isoDate(from)}T00:00:00Z`))/DAY_MS);
}

export function createPlayerContract({
  clubId,
  startDate,
  endDate=null,
  seasons=2,
  weeklyWage=0,
  squadRole='prospect',
  shirtNumber=null,
}={}){
  if(!clubId)throw new Error('clubId is required');
  const start=isoDate(startDate);
  const term=clamp(Math.round(Number(seasons)||1),1,6);
  const end=endDate?isoDate(endDate):addYears(start,term);
  if(dayDiff(start,end)<=0)throw new Error('Contract end must be after start');
  return{
    clubId:String(clubId),
    startDate:start,
    endDate:end,
    weeklyWage:Math.max(0,Math.round(Number(weeklyWage)||0)),
    squadRole:String(squadRole||'prospect'),
    shirtNumber:Number.isInteger(shirtNumber)&&shirtNumber>0?shirtNumber:null,
    status:'active',
    signedAt:start,
    renewedFrom:null,
  };
}

export function contractSnapshot(contract,currentDate){
  if(!contract)return{status:'free-agent',daysRemaining:0,expiring:false,canNegotiate:true};
  const today=isoDate(currentDate);
  const start=isoDate(contract.startDate),end=isoDate(contract.endDate);
  if(today<start)return{status:'future',daysRemaining:dayDiff(today,end),expiring:false,canNegotiate:false};
  const daysRemaining=dayDiff(today,end);
  if(daysRemaining<=0||contract.status==='expired')return{status:'free-agent',daysRemaining:0,expiring:false,canNegotiate:true};
  const expiring=daysRemaining<=183;
  return{status:'active',daysRemaining,expiring,canNegotiate:expiring};
}

export function expirePlayerContract(contract,currentDate){
  if(!contract)return null;
  const snapshot=contractSnapshot(contract,currentDate);
  if(snapshot.status!=='free-agent')return{...contract};
  return{...contract,status:'expired',expiredAt:isoDate(currentDate)};
}

export function renewPlayerContract(contract,{
  startDate,
  seasons=2,
  weeklyWage=contract?.weeklyWage??0,
  squadRole=contract?.squadRole??'prospect',
  shirtNumber=contract?.shirtNumber??null,
}={}){
  if(!contract?.clubId)throw new Error('Existing club contract is required');
  const renewalStart=isoDate(startDate||contract.endDate);
  if(renewalStart<isoDate(contract.startDate))throw new Error('Renewal cannot start before the original contract');
  const next=createPlayerContract({clubId:contract.clubId,startDate:renewalStart,seasons,weeklyWage,squadRole,shirtNumber});
  return{...next,renewedFrom:{startDate:contract.startDate,endDate:contract.endDate,weeklyWage:contract.weeklyWage}};
}

export function ensureCareerContract(state,{defaultSeasons=2,defaultWeeklyWage=0}={}){
  if(!state||typeof state!=='object')return null;
  if(state.contract)return state.contract;
  const clubId=state.clubId||null;
  const startDate=state.currentDate||state.calendar?.currentDate||state.createdDate||null;
  if(!clubId||!startDate)return null;
  state.contract=createPlayerContract({clubId,startDate,seasons:defaultSeasons,weeklyWage:defaultWeeklyWage,squadRole:'prospect'});
  return state.contract;
}
