import {COUNTRIES,SOURCE_PLAYERS,OPEN_NAMES} from './data.js';
import {DIVISION_B_COUNTRY} from './division-b-data-v1.js';
import {LIVE_ROSTER_META,LIVE_ROSTER_PLAYERS} from './live-rosters.generated.js';

const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');

if(!COUNTRIES.some(country=>country.id===DIVISION_B_COUNTRY.id))COUNTRIES.push(DIVISION_B_COUNTRY);

const seen=new Set(SOURCE_PLAYERS.map(player=>player.externalId?`id:${player.externalId}`:`n:${norm(player.name)}|${norm(player.team)}`));
for(const player of LIVE_ROSTER_PLAYERS){
  const key=player.externalId?`id:${player.externalId}`:`n:${norm(player.name)}|${norm(player.team)}`;
  if(seen.has(key))continue;
  SOURCE_PLAYERS.push(player);
  seen.add(key);
}

// Never disguise a missing live-roster row as a plausible real footballer.
// Until the refresh pipeline has a verified identity, generated depth is visibly academy data.
for(const key of Object.keys(OPEN_NAMES)){
  OPEN_NAMES[key]=Array.from({length:2400},(_,index)=>`Juvenil ${key}-${String(index+1).padStart(4,'0')}`);
}

export {DIVISION_B_COUNTRY,LIVE_ROSTER_META};
