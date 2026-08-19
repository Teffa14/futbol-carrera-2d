const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function duelPairId(a,b){
  if(!a||!b)return'';
  return[String(a.id),String(b.id)].sort().join('|');
}

export function classifyPhysicalDuel(contact){
  if(!contact?.a||!contact?.b||contact.a.team===contact.b.team)return null;
  const edge=clamp(Number(contact.edge)||0,-1,1);
  const leverageA=clamp(Number(contact.leverageA)||0,0,1);
  const leverageB=clamp(Number(contact.leverageB)||0,0,1);
  const leverageDelta=leverageA-leverageB;
  let winner=null,loser=null;

  if(Math.abs(edge)>=.08){winner=edge>0?contact.a:contact.b;loser=winner===contact.a?contact.b:contact.a;}
  else if(Math.abs(leverageDelta)>=.055){winner=leverageDelta>0?contact.a:contact.b;loser=winner===contact.a?contact.b:contact.a;}
  else return null;

  const winnerLeverage=winner===contact.a?leverageA:leverageB;
  const loserLeverage=winner===contact.a?leverageB:leverageA;
  const shielding=winnerLeverage>=.08&&winnerLeverage-loserLeverage>=.045;
  const intensity=clamp(Math.abs(edge)*.72+Math.abs(leverageDelta)*.9+(contact.headOn?.12:0),0,1);

  return{
    pairId:duelPairId(contact.a,contact.b),
    winnerId:winner.id,
    loserId:loser.id,
    winnerTeam:winner.team,
    loserTeam:loser.team,
    kind:shielding?'shielding':'body',
    intensity,
    headOn:Boolean(contact.headOn),
    edge,
    winnerLeverage,
    loserLeverage
  };
}

export function createDuelLedger(){return new Map();}

export function collectDuelEvents(contacts,ledger,tick,{releaseTicks=3}={}){
  const book=ledger instanceof Map?ledger:new Map();
  const now=Math.max(0,Number(tick)||0),seen=new Set(),events=[];

  for(const contact of contacts||[]){
    if(!contact?.a||!contact?.b||contact.a.team===contact.b.team)continue;
    const key=duelPairId(contact.a,contact.b);if(!key)continue;seen.add(key);
    const state=book.get(key)||{active:false,lastSeen:-Infinity};
    const separated=now-state.lastSeen>releaseTicks;
    if(separated)state.active=false;
    state.lastSeen=now;
    const duel=classifyPhysicalDuel(contact);
    if(duel&&!state.active){events.push({...duel,tick:now});state.active=true;}
    book.set(key,state);
  }

  for(const [key,state] of book){
    if(seen.has(key))continue;
    if(now-state.lastSeen>releaseTicks)state.active=false;
    if(now-state.lastSeen>releaseTicks*20)book.delete(key);
  }
  return events;
}
