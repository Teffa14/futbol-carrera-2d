const DAY_MS=24*60*60*1000;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const num=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

function isoDate(value){
  const text=String(value||'').slice(0,10);
  const date=new Date(`${text}T00:00:00Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||Number.isNaN(date.getTime()))throw new Error(`Invalid loan date: ${value}`);
  return text;
}
function dayDiff(from,to){return Math.floor((new Date(`${isoDate(to)}T00:00:00Z`)-new Date(`${isoDate(from)}T00:00:00Z`))/DAY_MS);}
function addMonths(dateText,months){
  const date=new Date(`${isoDate(dateText)}T00:00:00Z`),day=date.getUTCDate();
  date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+months);
  const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  date.setUTCDate(Math.min(day,last));
  return date.toISOString().slice(0,10);
}

export function assessLoanSuitability({player,parentClub,loanClub,squadNeed=50,projectedMinutes=50}={}){
  if(!player||!parentClub||!loanClub)return null;
  const rating=clamp(num(player.rating,60),40,99),age=clamp(num(player.age,20),15,45);
  const parentExpected=Math.max(45,num(parentClub.reputation,parentClub.prestige||78)-12);
  const loanExpected=Math.max(45,num(loanClub.reputation,loanClub.prestige||74)-12);
  const parentGap=rating-parentExpected,loanGap=rating-loanExpected;
  const minutes=clamp(num(projectedMinutes,50),0,100),need=clamp(num(squadNeed,50),0,100);
  const developmentNeed=age<=23?clamp(Math.round((4-parentGap)*2.2),0,24):clamp(Math.round((1-parentGap)*1.2),0,12);
  const levelFit=loanGap>=7?4:loanGap>=-2?18:loanGap>=-8?11:loanGap>=-13?2:-18;
  const minutesSignal=Math.round((minutes-45)*.32),needSignal=Math.round((need-50)*.18);
  const score=clamp(Math.round(42+developmentNeed+levelFit+minutesSignal+needSignal),0,100);
  const eligible=String(parentClub.id)!==String(loanClub.id)&&loanGap>=-13&&minutes>=30;
  return{
    parentClubId:String(parentClub.id||''),loanClubId:String(loanClub.id||''),score,eligible,interested:eligible&&score>=58,
    projectedMinutes:minutes,levelGap:Math.round(loanGap),developmentNeed,
    pathway:minutes>=75?'regular-starter':minutes>=55?'rotation':'prospect',
  };
}

export function createLoanAgreement({player,parentContract,parentClubId,loanClubId,startDate,months=6,wageShareParent=50,projectedRole='rotation'}={}){
  if(!player?.instanceId&&!player?.id)throw new Error('player is required');
  if(!parentContract||parentContract.status==='expired')throw new Error('active parent contract is required');
  const parent=String(parentClubId||parentContract.clubId||'');
  const loan=String(loanClubId||'');
  if(!parent||!loan||parent===loan)throw new Error('distinct parent and loan clubs are required');
  const start=isoDate(startDate),term=clamp(Math.round(num(months,6)),1,18),end=addMonths(start,term);
  if(isoDate(parentContract.endDate)<end)throw new Error('loan cannot outlast parent contract');
  const share=clamp(Math.round(num(wageShareParent,50)),0,100);
  return{
    id:`loan:${player.instanceId||player.id}:${parent}:${loan}:${start}`,
    playerId:String(player.instanceId||player.id),parentClubId:parent,loanClubId:loan,startDate:start,endDate:end,
    projectedRole:String(projectedRole||'rotation'),wageShareParent:share,wageShareLoan:100-share,status:'scheduled',returnedAt:null,
  };
}

export function loanSnapshot(loan,currentDate){
  if(!loan)return{status:'none',active:false,clubId:null,parentClubId:null,daysRemaining:0};
  const today=isoDate(currentDate),start=isoDate(loan.startDate),end=isoDate(loan.endDate);
  if(loan.status==='returned'||today>=end)return{status:'completed',active:false,clubId:loan.parentClubId,parentClubId:loan.parentClubId,daysRemaining:0};
  if(today<start)return{status:'scheduled',active:false,clubId:loan.parentClubId,parentClubId:loan.parentClubId,daysRemaining:dayDiff(today,end)};
  return{status:'active',active:true,clubId:loan.loanClubId,parentClubId:loan.parentClubId,daysRemaining:dayDiff(today,end)};
}

export function synchronizeCareerLoan(state){
  if(!state?.loan)return null;
  const currentDate=state.clock?.currentDate||state.currentDate||null;
  if(!currentDate)return null;
  const snapshot=loanSnapshot(state.loan,currentDate);
  if(snapshot.status==='active')state.loan={...state.loan,status:'active'};
  if(snapshot.status==='completed'&&state.loan.status!=='returned')state.loan={...state.loan,status:'returned',returnedAt:isoDate(currentDate)};
  state.registration={clubId:snapshot.clubId,parentClubId:snapshot.parentClubId,onLoan:snapshot.active};
  return snapshot;
}
