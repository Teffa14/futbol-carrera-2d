import {gunzipSync} from 'node:zlib';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {COUNTRIES} from '../data.js';
import {DIVISION_B_COUNTRY} from '../division-b-data-v1.js';

const TRANSFER_PLAYERS_URL=process.env.TRANSFER_PLAYERS_URL||'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/players.csv.gz';
const FC26_URL=process.env.FC26_URL||'https://raw.githubusercontent.com/ismailoksuz/EAFC26-DataHub/main/data/players.csv';
const ESPN_BASE=process.env.ESPN_ARG2_BASE||'https://site.api.espn.com/apis/site/v2/sports/soccer/arg.2';
const OUTPUT=new URL('../live-rosters.generated.js',import.meta.url);

export function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;continue;}
    if(ch==='"'){quoted=true;continue;}if(ch===','){row.push(cell);cell='';continue;}if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';continue;}cell+=ch;
  }
  if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}if(!rows.length)return[];
  const headers=rows.shift().map(value=>value.trim());
  return rows.filter(values=>values.some(Boolean)).map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??''])));
}

export const normalize=value=>String(value||'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/^\s*(?:c\s*[.\-]?\s*a|a\s*[.\-]?\s*c|c\s*[.\-]?\s*f|f\s*[.\-]?\s*c)\s*[.\-]?\s+/,'')
  .replace(/&/g,' and ')
  .replace(/\b(club|football|futbol|fc|cf|ac|ca|cd|sc|sv|afc|calcio|1907|1913)\b/g,' ')
  .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const tokens=value=>new Set(normalize(value).split(' ').filter(Boolean));
function similarity(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let overlap=0;for(const token of A)if(B.has(token))overlap++;return overlap/Math.max(A.size,B.size);}
const MANUAL_ALIASES={
  'river plate':['ca river plate'],'boca juniors':['ca boca juniors'],'inter':['inter milan'],'milan':['ac milan'],'marseille':['olympique marseille'],'lyon':['olympique lyon'],'atletico de madrid':['atletico madrid'],'real sociedad':['real sociedad san sebastian'],'athletic club':['athletic bilbao'],'betis':['real betis balompie'],'brighton and hove albion':['brighton hove albion'],'newcastle united':['newcastle utd'],'tottenham hotspur':['tottenham'],'nottingham forest':['nottm forest'],'paris saint germain':['paris saint germain fc'],'sporting cp':['sporting lisbon'],'vitoria sc':['vitoria guimaraes'],
  'estudiantes buenos aires':['estudiantes ba','estudiantes b a','estudiantes de buenos aires','estudiantes de caseros','ca estudiantes caseros','estudiantes caseros'],'atletico de rafaela':['atletico rafaela'],'gimnasia de jujuy':['gimnasia y esgrima jujuy','gimnasia y esgrima de jujuy'],'gimnasia y tiro':['gimnasia y tiro salta'],'san martin de tucuman':['san martin tucuman'],'san martin de san juan':['san martin san juan'],'guemes santiago del estero':['guemes','club atletico guemes'],'mitre santiago del estero':['club atletico mitre'],'deportivo maipu':['deportivo maipu mendoza'],'tristan suarez':['tristan suarez'],'ciudad de bolivar':['ciudad bolivar'],'ferro carril oeste':['ferro'],'chaco for ever':['chaco forever'],'defensores de belgrano':['defensores'],'deportivo moron':['dep moron'],'godoy cruz':['godoy cruz antonio tomba'],'colon':['colon santa fe'],'racing de cordoba':['racing cordoba']
};

function playableClubs(){
  const clubs=[...COUNTRIES.flatMap(country=>country.clubs.map(club=>({...club,countryId:country.id,league:country.league}))),...DIVISION_B_COUNTRY.clubs.map(club=>({...club,countryId:'ARB',league:DIVISION_B_COUNTRY.league}))];
  const seen=new Set();return clubs.filter(club=>!seen.has(club.id)&&seen.add(club.id));
}
function clubAliases(club){return[club.name,...(MANUAL_ALIASES[normalize(club.name)]||[])];}
export function matchClub(name,clubs=playableClubs()){
  const key=normalize(name);if(!key)return null;let best=null,bestScore=0;
  for(const club of clubs)for(const alias of clubAliases(club)){const candidate=normalize(alias);if(key===candidate)return club;const score=similarity(key,candidate);if(score>bestScore){best=club;bestScore=score;}}
  return bestScore>=.72?best:null;
}

function number(value,fallback=null){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function ageFromBirth(date){const birth=new Date(date);if(Number.isNaN(birth.getTime()))return null;const now=new Date();let age=now.getUTCFullYear()-birth.getUTCFullYear();if(now.getUTCMonth()<birth.getUTCMonth()||(now.getUTCMonth()===birth.getUTCMonth()&&now.getUTCDate()<birth.getUTCDate()))age--;return age;}
function positionCode(row){
  const sub=normalize(row.sub_position),broad=normalize(row.position);
  if(['g','gk','goalkeeper'].includes(broad)||broad.includes('goalkeeper'))return'GK';if(sub.includes('centre back')||sub.includes('center back'))return'CB';if(sub.includes('left back'))return'LB';if(sub.includes('right back'))return'RB';if(sub.includes('defensive midfield'))return'CDM';if(sub.includes('attacking midfield'))return'CAM';if(sub.includes('central midfield'))return'CM';if(sub.includes('left winger')||sub.includes('left midfield'))return'LW';if(sub.includes('right winger')||sub.includes('right midfield'))return'RW';if(sub.includes('centre forward')||sub.includes('center forward')||sub.includes('second striker'))return'ST';if(['d','df','def'].includes(broad)||broad.includes('defender'))return'CB';if(['m','mf','mid'].includes(broad)||broad.includes('midfield'))return'CM';if(['f','fw','att'].includes(broad)||broad.includes('attack')||broad.includes('forward'))return'ST';return'CM';
}
function fcIndex(rows){const map=new Map();for(const row of rows)for(const raw of [row.long_name,row.short_name]){const key=normalize(raw);if(!key)continue;const list=map.get(key)||[];list.push(row);map.set(key,list);}return map;}
function matchRating(player,index){const candidates=index.get(normalize(player.name))||[];if(!candidates.length)return null;const age=ageFromBirth(player.date_of_birth);const filtered=age==null?candidates:candidates.filter(row=>Math.abs(number(row.age,age)-age)<=1);return(filtered.length?filtered:candidates).sort((a,b)=>number(b.overall,0)-number(a.overall,0))[0]||null;}
function derivedOverall(player,fallback=59){const value=Math.max(0,number(player.market_value_in_eur,0));const age=ageFromBirth(player.date_of_birth)??26;if(!value)return Math.round(fallback);return Math.round(Math.max(51,Math.min(82,45+Math.log10(value+10000)*4.1-(age>32?(age-32)*.35:0))));}
function derivedAttrs(overall,pos){const r=overall,templates={GK:[50,35,58,48,75,72],CB:[r-7,r-24,r-6,r-10,r+7,r+7],LB:[r+5,r-16,r,r+1,r+2,r+2],RB:[r+5,r-16,r,r+1,r+2,r+2],CDM:[r-3,r-15,r+3,r-2,r+6,r+5],CM:[r-1,r-8,r+5,r+2,r,r+1],CAM:[r+2,r+1,r+5,r+6,r-14,r-4],LW:[r+7,r+3,r+1,r+7,r-20,r-5],RW:[r+7,r+3,r+1,r+7,r-20,r-5],ST:[r+3,r+7,r-5,r+1,r-22,r+4]};return(templates[pos]||templates.CM).map(value=>Math.max(30,Math.min(95,Math.round(value))));}
function ratingAttrs(row,overall,pos){if(row&&pos!=='GK'&&number(row.pace)!=null)return[number(row.pace),number(row.shooting),number(row.passing),number(row.dribbling),number(row.defending),number(row.physic)];return derivedAttrs(overall,pos);}
function makePlayer({externalId,name,team,country,birthDate,pos,overall,ratingRow,source}){const age=ageFromBirth(birthDate)??number(ratingRow?.age,24),[pace,shooting,passing,dribbling,defense,physical]=ratingAttrs(ratingRow,overall,pos);return{id:externalId.replace(':','-'),externalId,name,team,country:country||'Argentina',birthDate:birthDate||null,rating:Math.max(45,Math.min(94,Math.round(overall))),position:pos,pace:Math.round(pace),shooting:Math.round(shooting),passing:Math.round(passing),dribbling:Math.round(dribbling),defense:Math.round(defense),physical:Math.round(physical),age:Math.max(16,Math.min(45,Math.round(age))),source};}
function toTransferPlayer(row,club,ratingRow){const pos=positionCode(row),overall=ratingRow?number(ratingRow.overall,derivedOverall(row)):derivedOverall(row);return makePlayer({externalId:`tm:${row.player_id}`,name:row.name,team:club.name,country:row.country_of_citizenship,birthDate:row.date_of_birth,pos,overall,ratingRow,source:ratingRow?'transfermarkt-live+fc26-attributes':'transfermarkt-live+market-value-derived'});}

async function getText(url,{gzip=false}={}){const response=await fetch(url,{headers:{'user-agent':'Career-Eleven-data-refresh/1.0'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`${url}: HTTP ${response.status}`);if(gzip)return gunzipSync(Buffer.from(await response.arrayBuffer())).toString('utf8');return response.text();}
async function getJson(url){const response=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 Career-Eleven-roster-refresh/1.0','accept':'application/json'},signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`${url}: HTTP ${response.status}`);return response.json();}

export function espnTeams(payload){const direct=payload?.sports?.[0]?.leagues?.[0]?.teams||payload?.teams||[];return direct.map(entry=>entry?.team||entry).filter(team=>team?.id&&(team.displayName||team.name));}
export function espnAthletes(payload){const found=new Map();const visit=value=>{if(!value)return;if(Array.isArray(value)){for(const item of value)visit(item);return;}if(typeof value!=='object')return;const name=value.fullName||value.displayName||value.name;if(value.id&&name&&(value.position||value.dateOfBirth||value.age!=null||value.jersey!=null)){found.set(String(value.id),value);}for(const [key,child] of Object.entries(value)){if(['links','logos','images'].includes(key))continue;if(child&&typeof child==='object')visit(child);}};visit(payload?.athletes||payload?.roster||payload);return[...found.values()];}
function espnBirthDate(player){return player?.dateOfBirth||player?.birthDate||null;}
function espnCountry(player){return player?.citizenshipCountry?.name||player?.citizenship?.name||player?.country?.name||player?.nationality||'Argentina';}
function toEspnPlayer(player,club,ratingRow){const birthDate=espnBirthDate(player),age=ageFromBirth(birthDate)??number(player.age,null);if(Number.isFinite(age)&&(age<16||age>45))return null;const position=player.position||{},pos=positionCode({position:position.abbreviation||position.name||position.displayName||'',sub_position:position.displayName||position.name||''}),overall=ratingRow?number(ratingRow.overall,club.reputation-8):Math.max(52,Math.min(72,Math.round(Number(club.reputation||66)-8)));return makePlayer({externalId:`espn:${player.id}`,name:player.fullName||player.displayName||player.name,team:club.name,country:espnCountry(player),birthDate,pos,overall,ratingRow,source:ratingRow?'espn-arg2-live+fc26-attributes':'espn-arg2-live+role-derived'});}
async function buildEspnDivisionB(ratings){
  const teams=espnTeams(await getJson(`${ESPN_BASE}/teams?limit=100`)),matched=teams.map(team=>({team,club:matchClub(team.displayName||team.name,DIVISION_B_COUNTRY.clubs)})).filter(entry=>entry.club),out=[];
  for(let start=0;start<matched.length;start+=6){
    const batch=matched.slice(start,start+6);
    const rows=await Promise.all(batch.map(async({team,club})=>{const payload=await getJson(`${ESPN_BASE}/teams/${team.id}/roster?season=2026`),players=[];for(const athlete of espnAthletes(payload)){const birthDate=espnBirthDate(athlete),ratingRow=matchRating({name:athlete.fullName||athlete.displayName||athlete.name,date_of_birth:birthDate},ratings),player=toEspnPlayer(athlete,club,ratingRow);if(player)players.push(player);}return players;}));
    for(const players of rows)out.push(...players);
  }
  return{players:out,teamsListed:teams.length,teamsMatched:matched.length};
}
function mergePlayers(base,overlay){const map=new Map(),identity=player=>player.birthDate?`${normalize(player.name)}|${player.birthDate}`:`${normalize(player.name)}|${normalize(player.team)}`;for(const player of base)map.set(identity(player),player);for(const player of overlay)map.set(identity(player),player);return[...map.values()];}

export async function buildLiveRoster(){
  const [playersText,fcText]=await Promise.all([getText(TRANSFER_PLAYERS_URL,{gzip:true}),getText(FC26_URL)]),transfer=parseCsv(playersText),ratings=fcIndex(parseCsv(fcText)),clubs=playableClubs(),base=[];
  for(const row of transfer){const club=matchClub(row.current_club_name,clubs);if(club)base.push(toTransferPlayer(row,club,matchRating(row,ratings)));}
  let espn={players:[],teamsListed:0,teamsMatched:0},espnError=null;try{espn=await buildEspnDivisionB(ratings);}catch(error){espnError=String(error?.message||error);}
  const players=mergePlayers(base,espn.players),coverage=Object.fromEntries(clubs.map(club=>[club.id,0]));let ratingMatches=0;
  for(const player of players){const club=matchClub(player.team,clubs);if(club)coverage[club.id]++;if(player.source.includes('fc26-attributes'))ratingMatches++;}
  players.sort((a,b)=>a.team.localeCompare(b.team)||b.rating-a.rating||a.name.localeCompare(b.name));
  return{players,meta:{generatedAt:new Date().toISOString(),rosterSource:'dcaribou weekly CC0 + ESPN arg.2 current roster fallback',ratingSource:'public FC26 attributes + conservative role/value fallback',players:players.length,clubs:Object.values(coverage).filter(Boolean).length,ratingMatches,espnTeamsListed:espn.teamsListed,espnTeamsMatched:espn.teamsMatched,espnError,coverage}};
}
function serialize({players,meta}){return`// Generated by scripts/refresh-live-rosters.mjs. Do not hand-edit player rows.\nexport const LIVE_ROSTER_META=Object.freeze(${JSON.stringify(meta,null,2)});\nexport const LIVE_ROSTER_PLAYERS=Object.freeze(${JSON.stringify(players,null,2)});\n`;}
export async function main(){const built=await buildLiveRoster(),bIds=new Set(DIVISION_B_COUNTRY.clubs.map(club=>club.id)),coverage=Object.entries(built.meta.coverage).filter(([id])=>bIds.has(id)),bPlayers=coverage.reduce((sum,[,count])=>sum+count,0),bClubs=coverage.filter(([,count])=>count>=11).length;console.log(`Live roster refresh: ${built.meta.players} players / ${built.meta.clubs} playable clubs / ${built.meta.ratingMatches} FC26 matches / ${bPlayers} División B players across ${bClubs} clubs / ESPN ${built.meta.espnTeamsMatched}/${built.meta.espnTeamsListed} teams matched.`);if(bPlayers<450||bClubs<30)throw new Error(`División B roster quality gate failed: ${bPlayers} players across ${bClubs} clubs. ESPN fallback: ${built.meta.espnError||`${built.meta.espnTeamsMatched}/${built.meta.espnTeamsListed} teams matched`}`);await writeFile(OUTPUT,serialize(built),'utf8');}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error);process.exitCode=1;});
