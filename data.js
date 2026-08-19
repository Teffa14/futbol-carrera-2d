export const COUNTRIES = [
  { id:'EN', name:'England', flag:'🇬🇧', league:'Premier League', currency:'€', clubs:[
    club('liverpool','Liverpool','EN','#c8102e',92,185), club('arsenal','Arsenal','EN','#ef0107',90,165), club('man-city','Manchester City','EN','#6cabdd',93,220), club('chelsea','Chelsea','EN','#034694',87,150), club('tottenham','Tottenham','EN','#132257',86,145), club('newcastle','Newcastle United','EN','#111111',84,120),
  ]},
  { id:'AR', name:'Argentina', flag:'🇦🇷', league:'Liga Profesional', currency:'€', clubs:[
    club('river','River Plate','AR','#d71920',84,42), club('boca','Boca Juniors','AR','#003b75',83,40), club('racing','Racing Club','AR','#5bb8e8',78,27), club('central','Rosario Central','AR','#f5c400',76,22), club('independiente','Independiente','AR','#d71920',76,20), club('estudiantes','Estudiantes','AR','#d31b2b',77,24),
  ]},
  { id:'ES', name:'Spain', flag:'🇪🇸', league:'LaLiga', currency:'€', clubs:[
    club('real-madrid','Real Madrid','ES','#eeeeee',94,240), club('barcelona','Barcelona','ES','#a50044',92,210), club('atletico','Atlético Madrid','ES','#d71920',88,145), club('athletic','Athletic Club','ES','#e31b23',82,70), club('real-sociedad','Real Sociedad','ES','#1f5fae',82,75), club('villarreal','Villarreal','ES','#f4df2b',80,62),
  ]},
  { id:'IT', name:'Italy', flag:'🇮🇹', league:'Serie A', currency:'€', clubs:[
    club('inter','Inter','IT','#00529f',89,150), club('milan','AC Milan','IT','#fb090b',87,135), club('juventus','Juventus','IT','#eeeeee',88,150), club('napoli','Napoli','IT','#12a0d7',85,105), club('roma','Roma','IT','#8e1f2d',82,80), club('atalanta','Atalanta','IT','#1b4b99',84,92),
  ]},
  { id:'DE', name:'Germany', flag:'🇩🇪', league:'Bundesliga', currency:'€', clubs:[
    club('bayern','Bayern Munich','DE','#dc052d',91,190), club('dortmund','Borussia Dortmund','DE','#fde100',86,120), club('leverkusen','Bayer Leverkusen','DE','#e32221',87,115), club('leipzig','RB Leipzig','DE','#dd0741',82,85), club('frankfurt','Eintracht Frankfurt','DE','#e1000f',80,72), club('stuttgart','VfB Stuttgart','DE','#e32221',79,64),
  ]},
  { id:'FR', name:'France', flag:'🇫🇷', league:'Ligue 1', currency:'€', clubs:[
    club('psg','Paris Saint-Germain','FR','#004170',92,225), club('marseille','Marseille','FR','#2faee0',82,90), club('monaco','Monaco','FR','#e51b23',83,90), club('lyon','Lyon','FR','#1f4a91',79,65), club('lille','Lille','FR','#d71920',79,62), club('nice','Nice','FR','#c51b2f',78,60),
  ]},
  { id:'BR', name:'Brazil', flag:'🇧🇷', league:'Brasileirão', currency:'€', clubs:[
    club('flamengo','Flamengo','BR','#c52613',84,55), club('palmeiras','Palmeiras','BR','#006437',85,58), club('botafogo','Botafogo','BR','#111111',81,42), club('sao-paulo','São Paulo','BR','#e31b23',80,38), club('fluminense','Fluminense','BR','#7d1f35',79,36), club('gremio','Grêmio','BR','#4aa3d8',78,34),
  ]},
  { id:'PT', name:'Portugal', flag:'🇵🇹', league:'Primeira Liga', currency:'€', clubs:[
    club('benfica','Benfica','PT','#e83030',84,88), club('porto','Porto','PT','#0b4ea2',83,82), club('sporting','Sporting CP','PT','#1f8f4e',85,95), club('braga','Braga','PT','#d31826',78,48), club('vitoria','Vitória SC','PT','#eeeeee',74,28), club('boavista','Boavista','PT','#111111',72,24),
  ]},
];

function club(id,name,country,color,reputation,budget){return {id,name,country,color,reputation,budget};}

// CC0 source: Yusufhan30/FC26-premier-league-dataset.
export const SOURCE_PLAYERS = [
  p('Alisson Becker','Liverpool','Brazil',89,'GK',86,85,85,89,56,90,32),p('Virgil van Dijk','Liverpool','Netherlands',89,'CB',78,60,71,71,89,86,34),p('Ibrahima Konaté','Liverpool','France',83,'CB',75,34,59,68,83,84,26),p('Andrew Robertson','Liverpool','Scotland',85,'LB',78,61,82,79,81,78,31),p('Jeremie Frimpong','Liverpool','Netherlands',84,'RB',93,62,75,86,75,69,24),p('Alexis Mac Allister','Liverpool','Argentina',86,'CM',69,87,82,88,45,75,26),p('Florian Wirtz','Liverpool','Germany',88,'CAM',81,78,87,89,50,67,22),p('Dominik Szoboszlai','Liverpool','Hungary',81,'CAM',82,80,84,80,59,70,24),p('Luis Díaz','Liverpool','Colombia',84,'LW',90,80,75,87,39,75,28),p('Mohamed Salah','Liverpool','Egypt',89,'RW',89,87,82,88,45,75,33),p('Cody Gakpo','Liverpool','Netherlands',83,'ST',82,83,78,83,48,75,26),p('Darwin Núñez','Liverpool','Uruguay',82,'ST',90,80,72,78,46,86,26),
  p('David Raya','Arsenal','Spain',83,'GK',82,81,86,82,57,81,29),p('William Saliba','Arsenal','France',87,'CB',82,39,70,74,87,83,24),p('Gabriel Magalhães','Arsenal','Brazil',86,'CB',69,41,63,61,86,82,27),p('Riccardo Calafiori','Arsenal','Italy',78,'LB',69,65,70,72,78,77,23),p('Ben White','Arsenal','England',84,'RB',73,35,77,78,83,80,27),p('Declan Rice','Arsenal','England',87,'CM',73,72,82,79,84,85,26),p('Martin Ødegaard','Arsenal','Norway',89,'CAM',70,82,89,89,67,66,26),p('Gabriel Martinelli','Arsenal','Brazil',83,'LW',89,78,75,85,46,72,24),p('Bukayo Saka','Arsenal','England',87,'RW',85,83,81,88,60,70,23),p('Viktor Gyökeres','Arsenal','Sweden',84,'ST',90,83,67,80,36,91,27),p('Kai Havertz','Arsenal','Germany',83,'ST',77,81,80,82,49,72,26),
  p('Ederson Moraes','Manchester City','Brazil',88,'GK',87,82,91,97,64,86,31),p('Rúben Dias','Manchester City','Portugal',88,'CB',67,39,70,69,89,87,28),p('John Stones','Manchester City','England',85,'CB',69,58,75,79,85,77,31),p('Joško Gvardiol','Manchester City','Croatia',83,'LB',79,69,74,78,83,83,23),p('Rico Lewis','Manchester City','England',76,'RB',78,54,73,81,71,57,20),p('Rodri','Manchester City','Spain',91,'CDM',66,80,86,84,87,85,29),p('Bernardo Silva','Manchester City','Portugal',88,'CM',75,78,86,92,71,69,30),p('Phil Foden','Manchester City','England',88,'RW',86,86,85,90,57,93,25),p('Jérémy Doku','Manchester City','Belgium',80,'LW',92,72,73,86,30,68,23),p('Erling Haaland','Manchester City','Norway',91,'ST',88,92,70,81,45,88,25),p('Omar Marmoush','Manchester City','Egypt',79,'ST',89,78,66,83,32,71,26),
  p('Robert Sánchez','Chelsea','Spain',79,'GK',79,77,75,80,58,79,27),p('Levi Colwill','Chelsea','England',77,'CB',69,40,68,68,77,77,22),p('Wesley Fofana','Chelsea','France',78,'CB',67,40,60,65,80,75,24),p('Marc Cucurella','Chelsea','Spain',82,'LB',75,60,80,80,78,76,27),p('Reece James','Chelsea','England',82,'RB',78,72,83,82,82,82,25),p('Moisés Caicedo','Chelsea','Ecuador',82,'CDM',75,63,75,78,79,78,23),p('Enzo Fernández','Chelsea','Argentina',82,'CM',69,73,82,80,73,77,24),p('Cole Palmer','Chelsea','England',85,'CAM',75,82,83,86,50,66,23),p('Pedro Neto','Chelsea','Portugal',79,'RW',88,74,72,83,31,59,25),p('Christopher Nkunku','Chelsea','France',84,'CAM',81,81,81,86,60,67,27),p('Nicolas Jackson','Chelsea','Senegal',79,'ST',83,78,65,80,40,73,24),
  p('Guglielmo Vicario','Tottenham','Italy',84,'GK',84,80,79,87,52,84,28),p('Cristian Romero','Tottenham','Argentina',84,'CB',68,46,59,66,85,81,27),p('Micky van de Ven','Tottenham','Netherlands',82,'CB',88,47,64,71,83,81,24),p('Destiny Udogie','Tottenham','Italy',82,'LB',88,65,74,80,78,80,22),p('Pedro Porro','Tottenham','Spain',83,'RB',82,73,80,81,78,77,25),p('Rodrigo Bentancur','Tottenham','Uruguay',81,'CM',67,68,80,82,79,76,28),p('Pape Matar Sarr','Tottenham','Senegal',79,'CDM',70,65,75,78,76,75,22),p('Dejan Kulusevski','Tottenham','Sweden',82,'RW',75,77,80,83,57,80,25),p('James Maddison','Tottenham','England',85,'CAM',71,81,86,86,54,63,28),p('Heung-min Son','Tottenham','South Korea',87,'ST',87,89,81,85,42,73,33),
];

function p(name,team,country,rating,position,pace,shooting,passing,dribbling,defense,physical,age){return {id:slug(`${team}-${name}`),name,team,country,rating,position,pace,shooting,passing,dribbling,defense,physical,age,source:'fc26-pl-cc0'};}
function slug(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}

// Public-domain player name pools adapted from openfootball/players.
export const OPEN_NAMES = {
  AR:['Julián Álvarez','Enzo Fernández','Thiago Almada','Alan Varela','Valentín Barco','Nico Paz','Matías Soulé','Santiago Hezze','Facundo Medina','Alejandro Garnacho','Lucas Beltrán','Santiago Castro','Exequiel Palacios','Giovani Lo Celso','Nicolás González','Nahuel Molina','Lisandro Martínez','Juan Foyth'],
  ES:['Lamine Yamal','Pedri','Gavi','Nico Williams','Dani Olmo','Martín Zubimendi','Pau Cubarsí','Alejandro Balde','Mikel Oyarzabal','Fermín López','Pedro Porro','David Raya','Álex Baena','Mikel Merino','Dani Carvajal','Fabián Ruiz','Robin Le Normand','Álvaro Morata'],
  IT:['Gianluigi Donnarumma','Alessandro Bastoni','Riccardo Calafiori','Federico Dimarco','Nicolò Barella','Sandro Tonali','Davide Frattesi','Federico Chiesa','Giacomo Raspadori','Mateo Retegui','Destiny Udogie','Moise Kean','Lorenzo Pellegrini','Andrea Cambiaso','Gianluca Scamacca','Giorgio Scalvini','Manuel Locatelli','Alex Meret'],
  DE:['Jamal Musiala','Florian Wirtz','Kai Havertz','Joshua Kimmich','Aleksandar Pavlović','Jonathan Tah','Antonio Rüdiger','David Raum','Leroy Sané','Serge Gnabry','Nico Schlotterbeck','Marc-André ter Stegen','Pascal Groß','Robert Andrich','Maximilian Mittelstädt','Niclas Füllkrug','Deniz Undav','Oliver Baumann'],
  FR:['Kylian Mbappé','Eduardo Camavinga','Aurélien Tchouaméni','William Saliba','Dayot Upamecano','Ousmane Dembélé','Bradley Barcola','Michael Olise','Randal Kolo Muani','Theo Hernández','Warren Zaïre-Emery','Mike Maignan','Jules Koundé','Ibrahima Konaté','Kingsley Coman','Adrien Rabiot','Marcus Thuram','Lucas Hernández'],
  BR:['Vinícius Júnior','Rodrygo','Raphinha','Gabriel Martinelli','Bruno Guimarães','Lucas Paquetá','Éder Militão','Gabriel Magalhães','Marquinhos','Alisson Becker','Endrick','Savinho','João Gomes','André Trindade','Bremer','Yan Couto','Gabriel Jesus','Ederson Moraes'],
  PT:['Bruno Fernandes','Bernardo Silva','Rúben Dias','Vitinha','João Neves','Nuno Mendes','Diogo Costa','Pedro Neto','Rafael Leão','João Félix','Gonçalo Inácio','Diogo Dalot','Francisco Conceição','João Palhinha','Rúben Neves','Gonçalo Ramos','António Silva','José Sá'],
  EN:['Jude Bellingham','Bukayo Saka','Phil Foden','Declan Rice','Cole Palmer','Trent Alexander-Arnold','Anthony Gordon','Ollie Watkins','Marc Guéhi','Jordan Pickford','Kobbie Mainoo','Eberechi Eze','Harry Kane','John Stones','Jarrad Branthwaite','Morgan Gibbs-White','Dominic Solanke','Dean Henderson'],
};

export const STAFF_NAMES=['Marco Silva','Paulo Bento','Nicolás Roldán','Sergio Costa','Matteo Bianchi','Lucas Morel','Daniel Foster','Rafael Nunes','Jonas Keller','Theo Martin','Miguel Santos','Franco Ferrer','Adrián Suárez','Julien Moreau','Tom Becker','Gustavo Freitas','Luca Romano','Martín Pereyra'];

export const STAFF_ROLES=[
  {role:'Head Coach',effect:'development',baseWage:55},
  {role:'Assistant Coach',effect:'morale',baseWage:35},
  {role:'Scout',effect:'scouting',baseWage:32},
  {role:'Physio',effect:'recovery',baseWage:30},
  {role:'Data Analyst',effect:'match',baseWage:34},
  {role:'Youth Coach',effect:'youth',baseWage:28},
];

export const MANAGER_STYLES=[
  {id:'tactician',name:'Tactician',desc:'Better match preparation and tactical adaptation.',bonus:{match:5}},
  {id:'developer',name:'Developer',desc:'Young players improve faster.',bonus:{development:8}},
  {id:'motivator',name:'Motivator',desc:'Morale recovers faster after setbacks.',bonus:{morale:8}},
  {id:'recruiter',name:'Recruiter',desc:'Better scouting and transfer negotiations.',bonus:{scouting:7,negotiation:5}},
];

export const FORMATIONS={
  '1-2-1':{name:'1-2-1 Diamond',slots:['GK','DEF','MID','MID','FWD'],anchors:[[0.08,0.50],[0.28,0.50],[0.50,0.30],[0.50,0.70],[0.73,0.50]]},
  '2-1-1':{name:'2-1-1 Control',slots:['GK','DEF','DEF','MID','FWD'],anchors:[[0.08,0.50],[0.29,0.34],[0.29,0.66],[0.53,0.50],[0.74,0.50]]},
  '1-1-2':{name:'1-1-2 Attack',slots:['GK','DEF','MID','FWD','FWD'],anchors:[[0.08,0.50],[0.29,0.50],[0.49,0.50],[0.70,0.32],[0.70,0.68]]},
};

export const SPONSORS=[
  {id:'vertex',name:'Vertex Mobile',upfront:12,weekly:0.8,target:'Finish top half',bonus:16},
  {id:'orbit',name:'Orbit Energy',upfront:8,weekly:1.2,target:'Score 18 league goals',bonus:20},
  {id:'northstar',name:'Northstar Sports',upfront:16,weekly:0.5,target:'Reach cup final',bonus:24},
  {id:'forge',name:'Forge Finance',upfront:20,weekly:0.35,target:'Finish top 2',bonus:28},
  {id:'pulse',name:'Pulse Nutrition',upfront:10,weekly:0.9,target:'Keep squad morale above 70',bonus:15},
];

export const NARRATIVE_EVENTS=[
  event('captain-rest','Captain asks for rest','Your captain says the group is carrying fatigue into the next match.',[
    choice('Protect the squad','Rest starters in training',{morale:3,fitness:7,trainingPenalty:-2}),
    choice('Push through','Keep intensity high',{development:3,fitness:-7,morale:-2}),
    choice('Delegate to staff','Let the assistant decide',{morale:1,board:1}),
  ]),
  event('press-pressure','Press conference pressure','Local media asks whether your team is good enough to meet the board target.',[
    choice('Back the players','Take the pressure yourself',{morale:5,media:2,board:-1}),
    choice('Demand more','Challenge the dressing room',{morale:-3,development:4,board:2}),
    choice('Stay measured','Avoid headlines',{media:-1,board:1}),
  ]),
  event('agent-rumour','Agent creates a transfer rumour','An agent tells the press that one of your starters wants a bigger club.',[
    choice('Speak privately','Try to settle it internally',{morale:3,media:-1}),
    choice('Set a price','Signal that nobody is untouchable',{budget:2,board:2,morale:-2}),
    choice('Publicly reject it','Draw a hard line',{media:3,morale:1,board:-1}),
  ]),
  event('academy-call','Youth staff recommends a prospect','The academy has a player who could train with the senior group.',[
    choice('Promote now','Give the prospect a senior place',{youth:7,morale:1}),
    choice('Individual plan','Keep him developing below',{development:4,youth:3}),
    choice('Loan pathway','Prepare an external loan',{budget:1,youth:2}),
  ]),
  event('sponsor-day','Sponsor activation request','The sponsor wants several first-team players at a commercial event before matchday.',[
    choice('Send the stars','Maximise commercial value',{budget:3,fitness:-4,board:1}),
    choice('Send reserves','Protect the first team',{budget:1,morale:1}),
    choice('Decline','Prioritise football completely',{fitness:2,board:-2}),
  ]),
  event('training-clash','Training ground argument','Two players clash after a hard challenge in training.',[
    choice('Fine both','Reassert standards',{board:2,morale:-2}),
    choice('Team meeting','Resolve it together',{morale:4}),
    choice('Increase competition','Use it as fuel',{development:3,morale:-1}),
  ]),
  event('tactical-leak','Opponent may know your plan','The analyst believes your expected formation has leaked before a major fixture.',[
    choice('Change shape','Prepare a surprise',{match:5,development:-1}),
    choice('Trust the plan','Double down on execution',{match:2,morale:2}),
    choice('Create a decoy','Feed a false setup',{match:4,media:1,board:-1}),
  ]),
  event('keeper-confidence','Goalkeeper confidence issue','Your goalkeeper asks for reassurance after a costly mistake.',[
    choice('Keep him starting','Show full trust',{morale:5,match:-1}),
    choice('Open competition','Make selection merit-based',{development:2,morale:-2}),
    choice('Extra keeper work','Use specialist sessions',{development:3,fitness:-2}),
  ]),
  event('derby-week','Derby atmosphere','Supporters demand aggression and a result in the next rivalry match.',[
    choice('Use the emotion','Raise intensity',{match:4,fitness:-4,media:2}),
    choice('Keep control','Lower the temperature',{match:2,morale:2}),
    choice('Attack publicly','Promise front-foot football',{match:3,media:4,board:-2}),
  ]),
  event('contract-room','Contract hierarchy questioned','A senior player believes a teammate is earning too much compared with his role.',[
    choice('Promise a review','Keep the room calm',{morale:3,budget:-1}),
    choice('Defend the structure','Protect wage discipline',{board:3,morale:-2}),
    choice('Offer performance bonus','Tie money to results',{morale:2,board:1,budget:-1}),
  ]),
  event('injury-risk','Medical warning','The physio flags three players as high risk if intensity stays unchanged.',[
    choice('Reduce intensity','Protect availability',{fitness:6,development:-2}),
    choice('Individual recovery','Target only the risk group',{fitness:4}),
    choice('Ignore warning','Keep the full programme',{development:3,fitness:-6,board:-1}),
  ]),
  event('fan-pressure','Supporter pressure','A poor run has produced whistles and online criticism.',[
    choice('Open training','Reconnect with supporters',{media:4,morale:2}),
    choice('Shield the squad','Close ranks internally',{morale:4,media:-2}),
    choice('Make changes','Promise selection consequences',{board:2,morale:-2,match:2}),
  ]),
  event('scout-tip','Scout finds a market inefficiency','Your scout identifies a player whose club appears willing to sell below perceived value.',[
    choice('Scout deeply','Spend time verifying the target',{scouting:6}),
    choice('Move fast','Prepare an aggressive bid',{negotiation:4,budget:-1}),
    choice('Pass','Keep focus on current targets',{board:1}),
  ]),
  event('board-dinner','Board relationship','Directors invite you to discuss the sporting plan away from the training ground.',[
    choice('Ask for investment','Push for more transfer support',{budget:4,board:-1}),
    choice('Show academy plan','Sell the long-term project',{board:4,youth:3}),
    choice('Promise results','Tie yourself to this season',{board:2,match:2,media:2}),
  ]),
  event('player-party','Night out before recovery day','Photos emerge of several players out late after a win.',[
    choice('Keep it internal','Treat it as a minor issue',{morale:2,media:-1}),
    choice('Fine the group','Enforce standards',{board:3,morale:-3}),
    choice('Use leadership group','Make captains handle it',{morale:3,board:1}),
  ]),
  event('data-dispute','Coach vs analyst','Your head coach dislikes a data recommendation about the starting five.',[
    choice('Back the analyst','Follow the numbers',{match:4,morale:-1}),
    choice('Back the coach','Trust football judgement',{morale:3,match:1}),
    choice('Blend both','Run a final tactical test',{match:3,development:1}),
  ]),
  event('young-star','Young player wants minutes','A high-potential youngster says he needs real match time to continue developing.',[
    choice('Promise minutes','Put him in the rotation',{youth:5,morale:3}),
    choice('Loan him','Prioritise development elsewhere',{youth:4,budget:1}),
    choice('No guarantees','Make him earn it',{development:2,morale:-2}),
  ]),
  event('record-chase','Club record in reach','The team can equal a club record if it wins the next league match.',[
    choice('Make it a theme','Use the record as motivation',{match:4,media:3}),
    choice('Ignore it','Keep preparation normal',{match:2,morale:1}),
    choice('Reward the squad','Offer a win bonus',{match:3,morale:3,budget:-2}),
  ]),
];
function event(id,title,text,choices){return {id,title,text,choices};}
function choice(label,detail,effects){return {label,detail,effects};}

export const DATA_SOURCES=[
  {name:'FC26 Premier League dataset',repo:'Yusufhan30/FC26-premier-league-dataset',license:'CC0-1.0',usage:'Player names, clubs and gameplay attributes for the bundled Premier League player pack.'},
  {name:'openfootball/players',repo:'openfootball/players',license:'CC0-1.0',usage:'Public-domain player names and positional context used for additional squads and prospects.'},
  {name:'transfermarkt-datasets',repo:'dcaribou/transfermarkt-datasets',license:'CC0-1.0',usage:'Reference for football competition/player data architecture and market-value modelling; no proprietary assets copied.'},
  {name:'Football Squads cache',repo:'footballcsv/cache.footballsquads',license:'CC0-1.0',usage:'Reference for public-domain club squad naming/position structure.'},
];
