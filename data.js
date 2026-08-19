function club(id,name,country,color,reputation,budget){return {id,name,country,color,reputation,budget};}

export const COUNTRIES=[
  {id:'EN',name:'England',flag:'🇬🇧',league:'Premier League',clubs:[club('liverpool','Liverpool','EN','#c8102e',92,185),club('arsenal','Arsenal','EN','#ef0107',90,165),club('man-city','Manchester City','EN','#6cabdd',93,220),club('chelsea','Chelsea','EN','#034694',87,150),club('tottenham','Tottenham','EN','#132257',86,145),club('newcastle','Newcastle United','EN','#161616',84,120)]},
  {id:'AR',name:'Argentina',flag:'🇦🇷',league:'Liga Profesional',clubs:[club('river','River Plate','AR','#d71920',84,42),club('boca','Boca Juniors','AR','#003b75',83,40),club('racing','Racing Club','AR','#5bb8e8',78,27),club('central','Rosario Central','AR','#f5c400',76,22),club('independiente','Independiente','AR','#d71920',76,20),club('estudiantes','Estudiantes','AR','#c51d32',77,24)]},
  {id:'ES',name:'Spain',flag:'🇪🇸',league:'LaLiga',clubs:[club('real-madrid','Real Madrid','ES','#eeeeee',94,240),club('barcelona','Barcelona','ES','#a50044',92,210),club('atletico','Atlético Madrid','ES','#d71920',88,145),club('athletic','Athletic Club','ES','#e31b23',82,70),club('real-sociedad','Real Sociedad','ES','#1f5fae',82,75),club('villarreal','Villarreal','ES','#f4df2b',80,62)]},
  {id:'IT',name:'Italy',flag:'🇮🇹',league:'Serie A',clubs:[club('inter','Inter','IT','#00529f',89,150),club('milan','AC Milan','IT','#fb090b',87,135),club('juventus','Juventus','IT','#eeeeee',88,150),club('napoli','Napoli','IT','#12a0d7',85,105),club('roma','Roma','IT','#8e1f2d',82,80),club('atalanta','Atalanta','IT','#1b4b99',84,92)]},
  {id:'DE',name:'Germany',flag:'🇩🇪',league:'Bundesliga',clubs:[club('bayern','Bayern Munich','DE','#dc052d',91,190),club('dortmund','Borussia Dortmund','DE','#fde100',86,120),club('leverkusen','Bayer Leverkusen','DE','#e32221',87,115),club('leipzig','RB Leipzig','DE','#dd0741',82,85),club('frankfurt','Eintracht Frankfurt','DE','#e1000f',80,72),club('stuttgart','VfB Stuttgart','DE','#e32221',79,64)]},
  {id:'FR',name:'France',flag:'🇫🇷',league:'Ligue 1',clubs:[club('psg','Paris Saint-Germain','FR','#004170',92,225),club('marseille','Marseille','FR','#2faee0',82,90),club('monaco','Monaco','FR','#e51b23',83,90),club('lyon','Lyon','FR','#1f4a91',79,65),club('lille','Lille','FR','#d71920',79,62),club('nice','Nice','FR','#c51b2f',78,60)]},
  {id:'BR',name:'Brazil',flag:'🇧🇷',league:'Brasileirão',clubs:[club('flamengo','Flamengo','BR','#c52613',84,55),club('palmeiras','Palmeiras','BR','#006437',85,58),club('botafogo','Botafogo','BR','#111111',81,42),club('sao-paulo','São Paulo','BR','#e31b23',80,38),club('fluminense','Fluminense','BR','#7d1f35',79,36),club('gremio','Grêmio','BR','#4aa3d8',78,34)]},
  {id:'PT',name:'Portugal',flag:'🇵🇹',league:'Primeira Liga',clubs:[club('benfica','Benfica','PT','#e83030',84,88),club('porto','Porto','PT','#0b4ea2',83,82),club('sporting','Sporting CP','PT','#1f8f4e',85,95),club('braga','Braga','PT','#d31826',78,48),club('vitoria','Vitória SC','PT','#eeeeee',74,28),club('boavista','Boavista','PT','#111111',72,24)]},
];

function p(name,team,country,rating,position,pace,shooting,passing,dribbling,defense,physical,age){return {id:slug(`${team}-${name}`),name,team,country,rating,position,pace,shooting,passing,dribbling,defense,physical,age,source:'fc26-pl-cc0'};}
function slug(s){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}

// CC0: Yusufhan30/FC26-premier-league-dataset. These are the bundled real-data seeds.
export const SOURCE_PLAYERS=[
  p('Alisson Becker','Liverpool','Brazil',89,'GK',86,55,85,80,89,90,32),p('Virgil van Dijk','Liverpool','Netherlands',89,'CB',78,60,71,71,89,86,34),p('Ibrahima Konaté','Liverpool','France',83,'CB',75,34,59,68,83,84,26),p('Andrew Robertson','Liverpool','Scotland',85,'LB',78,61,82,79,81,78,31),p('Jeremie Frimpong','Liverpool','Netherlands',84,'RB',93,62,75,86,75,69,24),p('Alexis Mac Allister','Liverpool','Argentina',86,'CM',69,87,82,88,65,75,26),p('Florian Wirtz','Liverpool','Germany',88,'CAM',81,78,87,89,50,67,22),p('Dominik Szoboszlai','Liverpool','Hungary',81,'CAM',82,80,84,80,59,70,24),p('Luis Díaz','Liverpool','Colombia',84,'LW',90,80,75,87,39,75,28),p('Mohamed Salah','Liverpool','Egypt',89,'RW',89,87,82,88,45,75,33),p('Cody Gakpo','Liverpool','Netherlands',83,'ST',82,83,78,83,48,75,26),p('Darwin Núñez','Liverpool','Uruguay',82,'ST',90,80,72,78,46,86,26),
  p('David Raya','Arsenal','Spain',83,'GK',82,48,86,82,84,81,29),p('William Saliba','Arsenal','France',87,'CB',82,39,70,74,87,83,24),p('Gabriel Magalhães','Arsenal','Brazil',86,'CB',69,41,63,61,86,82,27),p('Riccardo Calafiori','Arsenal','Italy',78,'LB',69,65,70,72,78,77,23),p('Ben White','Arsenal','England',84,'RB',73,35,77,78,83,80,27),p('Declan Rice','Arsenal','England',87,'CM',73,72,82,79,84,85,26),p('Martin Ødegaard','Arsenal','Norway',89,'CAM',70,82,89,89,67,66,26),p('Gabriel Martinelli','Arsenal','Brazil',83,'LW',89,78,75,85,46,72,24),p('Bukayo Saka','Arsenal','England',87,'RW',85,83,81,88,60,70,23),p('Viktor Gyökeres','Arsenal','Sweden',84,'ST',90,83,67,80,36,91,27),p('Kai Havertz','Arsenal','Germany',83,'ST',77,81,80,82,49,72,26),
  p('Ederson Moraes','Manchester City','Brazil',88,'GK',87,50,91,89,88,86,31),p('Rúben Dias','Manchester City','Portugal',88,'CB',67,39,70,69,89,87,28),p('John Stones','Manchester City','England',85,'CB',69,58,75,79,85,77,31),p('Joško Gvardiol','Manchester City','Croatia',83,'LB',79,69,74,78,83,83,23),p('Rico Lewis','Manchester City','England',76,'RB',78,54,73,81,71,57,20),p('Rodri','Manchester City','Spain',91,'CDM',66,80,86,84,87,85,29),p('Bernardo Silva','Manchester City','Portugal',88,'CM',75,78,86,92,71,69,30),p('Phil Foden','Manchester City','England',88,'RW',86,86,85,90,57,73,25),p('Jérémy Doku','Manchester City','Belgium',80,'LW',92,72,73,86,30,68,23),p('Erling Haaland','Manchester City','Norway',91,'ST',88,92,70,81,45,88,25),p('Omar Marmoush','Manchester City','Egypt',79,'ST',89,78,66,83,32,71,26),
  p('Robert Sánchez','Chelsea','Spain',79,'GK',79,45,75,78,80,79,27),p('Levi Colwill','Chelsea','England',77,'CB',69,40,68,68,77,77,22),p('Wesley Fofana','Chelsea','France',78,'CB',67,40,60,65,80,75,24),p('Marc Cucurella','Chelsea','Spain',82,'LB',75,60,80,80,78,76,27),p('Reece James','Chelsea','England',82,'RB',78,72,83,82,82,82,25),p('Moisés Caicedo','Chelsea','Ecuador',82,'CDM',75,63,75,78,79,78,23),p('Enzo Fernández','Chelsea','Argentina',82,'CM',69,73,82,80,73,77,24),p('Cole Palmer','Chelsea','England',85,'CAM',75,82,83,86,50,66,23),p('Pedro Neto','Chelsea','Portugal',79,'RW',88,74,72,83,31,59,25),p('Christopher Nkunku','Chelsea','France',84,'CAM',81,81,81,86,60,67,27),p('Nicolas Jackson','Chelsea','Senegal',79,'ST',83,78,65,80,40,73,24),
  p('Guglielmo Vicario','Tottenham','Italy',84,'GK',84,45,79,80,85,84,28),p('Cristian Romero','Tottenham','Argentina',84,'CB',68,46,59,66,85,81,27),p('Micky van de Ven','Tottenham','Netherlands',82,'CB',88,47,64,71,83,81,24),p('Destiny Udogie','Tottenham','Italy',82,'LB',88,65,74,80,78,80,22),p('Pedro Porro','Tottenham','Spain',83,'RB',82,73,80,81,78,77,25),p('Rodrigo Bentancur','Tottenham','Uruguay',81,'CM',67,68,80,82,79,76,28),p('Pape Matar Sarr','Tottenham','Senegal',79,'CDM',70,65,75,78,76,75,22),p('Dejan Kulusevski','Tottenham','Sweden',82,'RW',75,77,80,83,57,80,25),p('James Maddison','Tottenham','England',85,'CAM',71,81,86,86,54,63,28),p('Heung-min Son','Tottenham','South Korea',87,'ST',87,89,81,85,42,73,33),
];

export const OPEN_NAMES={
  AR:['Julián Álvarez','Enzo Fernández','Thiago Almada','Alan Varela','Valentín Barco','Nico Paz','Matías Soulé','Santiago Hezze','Facundo Medina','Alejandro Garnacho','Lucas Beltrán','Santiago Castro','Exequiel Palacios','Giovani Lo Celso','Nicolás González','Nahuel Molina','Lisandro Martínez','Juan Foyth','Kevin Zenón','Claudio Echeverri','Agustín Giay','Marcos Senesi'],
  ES:['Lamine Yamal','Pedri','Gavi','Nico Williams','Dani Olmo','Martín Zubimendi','Pau Cubarsí','Alejandro Balde','Mikel Oyarzabal','Fermín López','Pedro Porro','David Raya','Álex Baena','Mikel Merino','Dani Carvajal','Fabián Ruiz','Robin Le Normand','Álvaro Morata','Dean Huijsen','Yeremy Pino','Samu Omorodion','Marc Casadó'],
  IT:['Gianluigi Donnarumma','Alessandro Bastoni','Riccardo Calafiori','Federico Dimarco','Nicolò Barella','Sandro Tonali','Davide Frattesi','Federico Chiesa','Giacomo Raspadori','Mateo Retegui','Destiny Udogie','Moise Kean','Lorenzo Pellegrini','Andrea Cambiaso','Gianluca Scamacca','Giorgio Scalvini','Manuel Locatelli','Alex Meret','Riccardo Orsolini','Samuele Ricci','Lorenzo Lucca','Raoul Bellanova'],
  DE:['Jamal Musiala','Florian Wirtz','Kai Havertz','Joshua Kimmich','Aleksandar Pavlović','Jonathan Tah','Antonio Rüdiger','David Raum','Leroy Sané','Serge Gnabry','Nico Schlotterbeck','Marc-André ter Stegen','Pascal Groß','Robert Andrich','Maximilian Mittelstädt','Niclas Füllkrug','Deniz Undav','Oliver Baumann','Karim Adeyemi','Angelo Stiller','Chris Führich','Robin Koch'],
  FR:['Kylian Mbappé','Eduardo Camavinga','Aurélien Tchouaméni','William Saliba','Dayot Upamecano','Ousmane Dembélé','Bradley Barcola','Michael Olise','Randal Kolo Muani','Theo Hernández','Warren Zaïre-Emery','Mike Maignan','Jules Koundé','Ibrahima Konaté','Kingsley Coman','Adrien Rabiot','Marcus Thuram','Lucas Hernández','Désiré Doué','Castello Lukeba','Mathys Tel','Jean-Clair Todibo'],
  BR:['Vinícius Júnior','Rodrygo','Raphinha','Gabriel Martinelli','Bruno Guimarães','Lucas Paquetá','Éder Militão','Gabriel Magalhães','Marquinhos','Alisson Becker','Endrick','Savinho','João Gomes','André Trindade','Bremer','Yan Couto','Gabriel Jesus','Ederson Moraes','Estêvão','Vitor Roque','Murillo','Bento'],
  PT:['Bruno Fernandes','Bernardo Silva','Rúben Dias','Vitinha','João Neves','Nuno Mendes','Diogo Costa','Pedro Neto','Rafael Leão','João Félix','Gonçalo Inácio','Diogo Dalot','Francisco Conceição','João Palhinha','Rúben Neves','Gonçalo Ramos','António Silva','José Sá','Geovany Quenda','Tomás Araújo','Fábio Vieira','Nuno Tavares'],
  EN:['Jude Bellingham','Bukayo Saka','Phil Foden','Declan Rice','Cole Palmer','Trent Alexander-Arnold','Anthony Gordon','Ollie Watkins','Marc Guéhi','Jordan Pickford','Kobbie Mainoo','Eberechi Eze','Harry Kane','John Stones','Jarrad Branthwaite','Morgan Gibbs-White','Dominic Solanke','Dean Henderson','Curtis Jones','Adam Wharton','Tino Livramento','Levi Colwill'],
};

export const POSITIONS=[
  {id:'ST',name:'Delantero centro'},{id:'LW',name:'Extremo izquierdo'},{id:'RW',name:'Extremo derecho'},
  {id:'CAM',name:'Mediapunta'},{id:'CM',name:'Mediocampista'},{id:'CDM',name:'Mediocentro defensivo'},
  {id:'LB',name:'Lateral izquierdo'},{id:'RB',name:'Lateral derecho'},{id:'CB',name:'Defensor central'},
];

export const BUILDS=[
  {id:'finisher',name:'Finisher',desc:'Ataca el área y define rápido.',mods:{shooting:8,composure:6,pace:2,passing:-2,defense:-4},tendencies:{shoot:1.35,dribble:.9,pass:.85}},
  {id:'creator',name:'Creator',desc:'Visión, pase final y juego entre líneas.',mods:{passing:8,vision:8,ballControl:4,shooting:-1,physical:-3},tendencies:{shoot:.8,dribble:1,pass:1.35}},
  {id:'technician',name:'Technician',desc:'Conducción, primer toque y 1v1.',mods:{dribbling:9,ballControl:8,pace:3,physical:-4,defense:-2},tendencies:{shoot:.9,dribble:1.45,pass:1}},
  {id:'engine',name:'Engine',desc:'Recorre metros, presiona y llega a las dos áreas.',mods:{stamina:10,physical:5,pace:3,passing:3,shooting:-1},tendencies:{shoot:.9,dribble:.95,pass:1.1}},
  {id:'ball-winner',name:'Ball Winner',desc:'Anticipa, roba y domina duelos.',mods:{defense:9,physical:7,stamina:6,dribbling:-4,shooting:-4},tendencies:{shoot:.65,dribble:.7,pass:1.05}},
  {id:'speedster',name:'Speedster',desc:'Aceleración, ruptura y conducción larga.',mods:{pace:10,dribbling:5,stamina:3,passing:-3,physical:-2},tendencies:{shoot:1,dribble:1.35,pass:.85}},
  {id:'target',name:'Target Forward',desc:'Protege la pelota, fija centrales y remata.',mods:{physical:10,shooting:6,ballControl:4,pace:-5,dribbling:-2},tendencies:{shoot:1.25,dribble:.75,pass:.95}},
];

export const SKILLS=[
  {id:'first-touch',name:'Primer toque',desc:'Más control al recibir pases rápidos.',effects:{control:10}},
  {id:'quick-step',name:'Arranque explosivo',desc:'Aceleración extra después de ganar un duelo.',effects:{burst:10}},
  {id:'technical',name:'Técnico',desc:'Más éxito en regates y cambios de dirección.',effects:{dribble:10}},
  {id:'press-proof',name:'Press proof',desc:'Pierde menos la pelota bajo presión.',effects:{shield:10}},
  {id:'threaded-pass',name:'Pase filtrado',desc:'Mejor precisión al buscar receptores entre líneas.',effects:{pass:10}},
  {id:'finesse',name:'Tiro colocado',desc:'Mejor precisión cerca del área.',effects:{finesse:10}},
  {id:'power-shot',name:'Remate potente',desc:'Más velocidad de pelota en tiros lejanos.',effects:{shotPower:10}},
  {id:'interceptor',name:'Interceptor',desc:'Mayor radio y éxito de intercepción.',effects:{intercept:10}},
  {id:'relentless',name:'Incansable',desc:'La stamina cae más lento durante el partido.',effects:{stamina:12}},
  {id:'aerial',name:'Dominio físico',desc:'Mejora los duelos de cuerpo y protección.',effects:{physical:10}},
];

export const FORMATIONS={
  '4-3-3':{name:'4-3-3',slots:['GK','LB','CB','CB','RB','CM','CM','CAM','LW','ST','RW'],anchors:[[.06,.50],[.22,.16],[.19,.38],[.19,.62],[.22,.84],[.42,.30],[.42,.70],[.52,.50],[.69,.18],[.74,.50],[.69,.82]]},
  '4-2-3-1':{name:'4-2-3-1',slots:['GK','LB','CB','CB','RB','CDM','CDM','LW','CAM','RW','ST'],anchors:[[.06,.50],[.22,.16],[.19,.38],[.19,.62],[.22,.84],[.39,.37],[.39,.63],[.58,.18],[.57,.50],[.58,.82],[.75,.50]]},
  '4-4-2':{name:'4-4-2',slots:['GK','LB','CB','CB','RB','LM','CM','CM','RM','ST','ST'],anchors:[[.06,.50],[.22,.16],[.19,.38],[.19,.62],[.22,.84],[.45,.17],[.42,.39],[.42,.61],[.45,.83],[.72,.38],[.72,.62]]},
};

export const ATTRIBUTE_INFO={
  pace:'Velocidad máxima, aceleración y capacidad para separarse.',shooting:'Precisión, potencia y calidad de definición.',passing:'Precisión, velocidad y dificultad de los pases.',dribbling:'Éxito en 1v1, cambios de dirección y conducción.',defense:'Robos, anticipación e intercepciones.',physical:'Protección, equilibrio y duelos de cuerpo.',ballControl:'Primer toque y retención de pelota.',vision:'Elección de pase y lectura de espacios.',stamina:'Cuánto mantiene sus capacidades durante el partido.',composure:'Errores técnicos cuando recibe presión o define.',
};

export const DATA_SOURCES=[
  {name:'FC26 Premier League dataset',repo:'Yusufhan30/FC26-premier-league-dataset',license:'CC0-1.0',usage:'Nombres, clubes y seis atributos base para el pack de Premier League.'},
  {name:'openfootball/players',repo:'openfootball/players',license:'CC0-1.0 / public domain',usage:'Pools de nombres y posiciones para completar planteles y juveniles.'},
  {name:'transfermarkt-datasets',repo:'dcaribou/transfermarkt-datasets',license:'CC0-1.0',usage:'Referencia de estructura de datos de clubes, competiciones y mercado; no se incluye el payload DVC.'},
];
