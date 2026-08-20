import {COUNTRIES,SOURCE_PLAYERS,OPEN_NAMES} from './data.js';
import {DIVISION_B_COUNTRY} from './division-b-data-v1.js';
import {LIVE_ROSTER_META,LIVE_ROSTER_PLAYERS} from './live-rosters.generated.js';

const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const identityKey=player=>`${norm(player?.name)}|${norm(player?.team)}`;

if(!COUNTRIES.some(country=>country.id===DIVISION_B_COUNTRY.id))COUNTRIES.push(DIVISION_B_COUNTRY);

// A live-covered club must not keep an older static seed for the same squad.
const liveTeams=new Set(LIVE_ROSTER_PLAYERS.map(player=>norm(player.team)).filter(Boolean));
for(let index=SOURCE_PLAYERS.length-1;index>=0;index--){
  if(liveTeams.has(norm(SOURCE_PLAYERS[index]?.team)))SOURCE_PLAYERS.splice(index,1);
}

const seenExternal=new Set(),seenIdentity=new Set();
for(const player of LIVE_ROSTER_PLAYERS){
  const external=String(player?.externalId||''),identity=identityKey(player);
  if((external&&seenExternal.has(external))||seenIdentity.has(identity))continue;
  SOURCE_PLAYERS.push(player);
  if(external)seenExternal.add(external);
  seenIdentity.add(identity);
}

// Offer generation can now measure the real competition for the prospect's position.
const liveByTeam=new Map();
for(const player of LIVE_ROSTER_PLAYERS){const key=norm(player.team),list=liveByTeam.get(key)||[];list.push(player);liveByTeam.set(key,list);}
for(const club of DIVISION_B_COUNTRY.clubs)club.roster=[...(liveByTeam.get(norm(club.name))||[])];

// Never disguise missing live identities as plausible real footballers.
for(const key of Object.keys(OPEN_NAMES))OPEN_NAMES[key]=Array.from({length:2400},(_,index)=>`Juvenil ${key}-${String(index+1).padStart(4,'0')}`);

export {DIVISION_B_COUNTRY,LIVE_ROSTER_META};
