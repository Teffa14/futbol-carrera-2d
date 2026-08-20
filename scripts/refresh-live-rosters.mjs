import {gunzipSync} from 'node:zlib';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {COUNTRIES} from '../data.js';
import {DIVISION_B_COUNTRY} from '../division-b-data-v1.js';

const TRANSFER_PLAYERS_URL=process.env.TRANSFER_PLAYERS_URL||'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/players.csv.gz';
const FC26_URL=process.env.FC26_URL||'https://raw.githubusercontent.com/ismailoksuz/EAFC26-DataHub/main/data/players.csv';
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

export const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/\b(club|football|futbol|fc|cf|ac|ca|cd|sc|sv|afc|calcio|1907|1913)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const tokens=value=>new Set(normalize(value).split(' ').filter(Boolean));
function similarity(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let overlap=0;for(const token of A)if(B.has(token))overlap++;return overlap/Math.max(A.size,B.size);}
const MANUAL_ALIASES={
  'river plate':['ca river plate'],'boca juniors':['ca boca juniors'],'inter':['inter milan'],'milan':['ac milan'],'marseille':['olympique marseille'],'lyon':['olympique lyon'],'atletico de madrid':['atletico madrid'],'real sociedad':['real sociedad san sebastian'],'athletic club':['athletic bilbao'],'betis':['real betis balompie'],'brighton and hove albion':['brighton hove albion'],'newcastle united':['newcastle utd'],'tottenham hotspur':['tottenham'],'nottingham forest':['nottm forest'],'paris saint germain':['paris saint germain fc'],'sporting cp':['sporting lisbon'],'vitoria sc':['vitoria guimaraes'],'atletico de rafaela':['atletico rafaela'],'gimnasia de jujuy':['gimnasia y esgrima jujuy'],'gimnasia y tiro':['gimnasia y tiro salta'],'san martin de tucuman':['san martin tucuman'],'san martin de san juan':['san martin san juan'],'guemes santiago del estero':['club atletico guemes'],'mitre santiago del estero':['club atletico mitre'],'deportivo maipu':['deportivo maipu mendoza'],'tristan suarez':['tristan suarez'],'ciudad de bolivar':['ciudad bolivar'],'ferro carril oeste':['ferro'],'chaco for ever':['chaco forever']
};

function playableClubs(){const clubs=[...COUNTRIES.flatMap(country=>country.clubs.map(club=>({...club,countryId:country.id,league:country.league}))),...DIVISION_B_COUNTRY.clubs.map(club=>({...club,countryId:'ARB',league:DIVISION_B_COUNTRY.league}))];const seen=new Set();return clubs.filter(club=>{if(seen.has(club.id))return false;seen.add(club.id);return true;});}
function clubAliases(club){return[club.name,...(MANUAL_ALIASES[normalize(club.name)]||[])];}
export function matchClub(name,clubs=playableClubs()){
  const key=normalize(name);if(!key)return null;
  let best=null,bestScore=0;
  for(const club of clubs){for(const alias of clubAliases(club)){const n=normalize(alias);if(key===n)return club;const score=similarity(key,n);if(score>bestScore){best=club;bestScore=score;}}}
  return bestScore>=.72?best:null;
}

function ageFromBirth(date){const birth=new Date(date);if(Number.isNaN(birth.getTime()))return null;const now=new Date();let age=now.getUTCFullYear()-birth.getUTCFullYear();const before=now.getUTCMonth()<birth.getUTCMonth()||(now.getUTCMonth()===birth.getUTCMonth()&&now.getUTCDate()<birth.getUTCDate());if(before)age--;return age;}
function positionCode(row){const sub=normalize(row.sub_position),broad=normalize(row.position);if(broad.includes('goalkeeper'))return'GK';if(sub.includes('centre back')||sub.includes('center back'))return'CB';if(sub.includes('left back'))return'LB';if(sub.includes('right back'))return'RB';if(sub.includes('defensive midfield'))return'CDM';if(sub.includes('attacking midfield'))return'CAM';if(sub.includes('central midfield'))return'CM';if(sub.includes('left winger')||sub.includes('left midfield'))return'LW';if(sub.includes('right winger')||sub.includes('right midfield'))return'RW';if(sub.includes('centre forward')||sub.includes('center forward')||sub.includes('second striker'))return'ST';if(broad.includes('defender'))return'CB';if(broad.includes('midfield'))return'CM';if(broad.includes('attack'))return'ST';return'CM';}
function number(value,fallback=null){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function fcIndex(rows){const map=new Map();for(const row of rows){for(const raw of [row.long_name,row.short_name]){const key=normalize(raw);if(!key)continue;const list=map.get(key)||[];list.push(row);map.set(key,list);}}return map;}
function matchRating(player,index){const candidates=index.get(normalize(player.name))||[];if(!candidates.length)return null;const age=ageFromBirth(player.date_of_birth);const filtered=age==null?candidates:candidates.filter(row=>Math.abs(number(row.age,age)-age)<=1);return(filtered.length?filtered:candidates).sort((a,b)=>number(b.overall,0)-number(a.overall,0))[0]||null;}
function derivedOverall(player){const value=Math.max(0,number(player.market_value_in_eur,0));const age=ageFromBirth(player.date_of_birth)??26;const valueScore=value?Math.log10(value+10000):4;return Math.round(Math.max(51,Math.min(82,45+valueScore*4.1-(age>32?(age-32)*.35:0))));}
function derivedAttrs(overall,pos){const r=overall;const templates={GK:[50,35,58,48,75,72],CB:[r-7,r-24,r-6,r-10,r+7,r+7],LB:[r+5,r-16,r,r+1,r+2,r+2],RB:[r+5,r-16,r,r+1,r+2,r+2],CDM:[r-3,r-15,r+3,r-2,r+6,r+5],CM:[r-1,r-8,r+5,r+2,r,r+1],CAM:[r+2,r+1,r+5,r+6,r-14,r-4],LW:[r+7,r+3,r+1,r+7,r-20,r-5],RW:[r+7,r+3,r+1,r+7,r-20,r-5],ST:[r+3,r+7,r-5,r+1,r-22,r+4]};return(templates[pos]||templates.CM).map(v=>Math.max(30,Math.min(95,Math.round(v))));}
function toGamePlayer(player,club,ratingRow){const pos=positionCode(player),age=ageFromBirth(player.date_of_birth)??number(ratingRow?.age,25),overall=ratingRow?number(ratingRow.overall,derivedOverall(player)):derivedOverall(player);let pace,shooting,passing,dribbling,defense,physical;if(ratingRow&&pos!=='GK'&&number(ratingRow.pace)!=null){pace=number(ratingRow.pace);shooting=number(ratingRow.shooting);passing=number(ratingRow.passing);dribbling=number(ratingRow.dribbling);defense=number(ratingRow.defending);physical=number(ratingRow.physic);}else [pace,shooting,passing,dribbling,defense,physical]=derivedAttrs(overall,pos);return{id:`live-${player.player_id}`,externalId:`tm:${player.player_id}`,name:player.name,team:club.name,country:player.country_of_citizenship||'Unknown',rating:Math.max(45,Math.min(94,Math.round(overall))),position:pos,pace:Math.round(pace),shooting:Math.round(shooting),passing:Math.round(passing),dribbling:Math.round(dribbling),defense:Math.round(defense),physical:Math.round(physical),age:Math.max(16,Math.min(45,Math.round(age))),source:ratingRow?'transfermarkt-live+fc26-attributes':'transfermarkt-live+derived-performance'};}

async function getText(url,{gzip=false}={}){const response=await fetch(url,{headers:{'user-agent':'Career-Eleven-data-refresh/1.0'}});if(!response.ok)throw new Error(`${url}: HTTP ${response.status}`);if(gzip){const buffer=Buffer.from(await response.arrayBuffer());return gunzipSync(buffer).toString('utf8');}return response.text();}
export async function buildLiveRoster(){const [playersText,fcText]=await Promise.all([getText(TRANSFER_PLAYERS_URL,{gzip:true}),getText(FC26_URL)]);const transfer=parseCsv(playersText),fcRows=parseCsv(fcText),ratings=fcIndex(fcRows),clubs=playableClubs(),out=[],coverage=Object.fromEntries(clubs.map(club=>[club.id,0]));let ratingMatches=0;for(const row of transfer){const club=matchClub(row.current_club_name,clubs);if(!club)continue;const rating=matchRating(row,ratings);if(rating)ratingMatches++;out.push(toGamePlayer(row,club,rating));coverage[club.id]++;}out.sort((a,b)=>a.team.localeCompare(b.team)||b.rating-a.rating||a.name.localeCompare(b.name));return{players:out,meta:{generatedAt:new Date().toISOString(),rosterSource:'dcaribou/transfermarkt-datasets weekly CC0',ratingSource:'EAFC26-DataHub public FC26 attribute dataset; gameplay-derived fallback',players:out.length,clubs:Object.values(coverage).filter(Boolean).length,ratingMatches,coverage}};}
function serialize({players,meta}){return`// Generated by scripts/refresh-live-rosters.mjs. Do not hand-edit player rows.\nexport const LIVE_ROSTER_META=Object.freeze(${JSON.stringify(meta,null,2)});\nexport const LIVE_ROSTER_PLAYERS=Object.freeze(${JSON.stringify(players,null,2)});\n`;}
export async function main(){const built=await buildLiveRoster();await writeFile(OUTPUT,serialize(built),'utf8');const bIds=new Set(DIVISION_B_COUNTRY.clubs.map(club=>club.id)),bPlayers=Object.entries(built.meta.coverage).filter(([id])=>bIds.has(id)).reduce((sum,[,count])=>sum+count,0);console.log(`Live roster refresh: ${built.meta.players} players / ${built.meta.clubs} playable clubs / ${built.meta.ratingMatches} FC26 matches / ${bPlayers} División B players.`);if(bPlayers<250)console.warn('WARNING: División B live-roster coverage is below 250 players; generated academy labels will remain visible for missing identities.');}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error);process.exitCode=1;});
