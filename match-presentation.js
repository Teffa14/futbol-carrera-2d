import {MatchEngine} from './engine.js';

export const MATCH_BALL_RADIUS=5;
export const MOBILE_MATCH_CSS=`
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{overflow-x:hidden}
.main,.live-layout,.canvas-card,.match-controls,.match-controls>div{min-width:0;max-width:100%}
@media(max-width:720px){
  .main{width:100%;overflow:hidden}
  .live-layout{display:block;width:100%;max-width:100%;overflow:hidden}
  .canvas-card{width:100%;max-width:100%;padding:4px;overflow:hidden;margin-bottom:8px}
  #canvas{display:block;width:100%!important;max-width:100%!important;height:auto!important;aspect-ratio:11/7;border-radius:8px}
  .match-controls{display:grid;grid-template-columns:1fr;gap:7px;width:100%;padding:7px 2px 2px}
  .match-controls>div{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;width:100%}
  .speed{min-width:0;width:100%;margin:0;padding:8px 2px;font-size:12px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:clip}
  .match-controls .btn{width:100%;max-width:100%;padding:10px 8px;font-size:13px;line-height:1.15;white-space:normal}
  .hud{width:100%;max-width:100%;margin-top:8px;position:static;overflow:hidden}
  .live-rating b{font-size:32px}
  .hero h1{max-width:100%;font-size:24px;overflow-wrap:anywhere}
}
@media(max-width:430px){
  .match-controls>div{grid-template-columns:repeat(4,minmax(0,1fr))}
  #camera{grid-column:1/-1}
  .speed{font-size:11px;padding:7px 1px}
}
`;

if(typeof document!=='undefined'&&!document.querySelector('style[data-career-eleven-mobile-match]')){
  const style=document.createElement('style');
  style.dataset.careerElevenMobileMatch='1';
  style.textContent=MOBILE_MATCH_CSS;
  document.head.appendChild(style);
}

const ROLE_NUMBERS={
  GK:[1,12,13],RB:[2,22],LB:[3,23],CB:[4,5,6,14],CDM:[5,6,16],CM:[8,6,18],CAM:[10,8,20],RW:[7,17,27],LW:[11,19,21],ST:[9,18,99]
};

function hashString(value){let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function validNumber(value){const n=Number(value);return Number.isInteger(n)&&n>=1&&n<=99?n:null;}
function playerKey(player){return String(player?.id||player?.data?.instanceId||player?.data?.id||player?.data?.name||'player');}

export function assignMatchSquadNumbers(players){
  const used=new Set();
  const ordered=[...players].sort((a,b)=>playerKey(a).localeCompare(playerKey(b)));
  for(const player of ordered){
    const existing=validNumber(player.data?.squadNumber);
    if(existing&&!used.has(existing)){used.add(existing);continue;}
    const preferred=ROLE_NUMBERS[player.role]||[];
    let number=preferred.find(n=>!used.has(n));
    if(!number){
      const start=1+(hashString(playerKey(player))%99);
      for(let offset=0;offset<99;offset++){
        const candidate=1+((start-1+offset*37)%99);
        if(!used.has(candidate)){number=candidate;break;}
      }
    }
    number=number||1;
    player.data.squadNumber=number;
    used.add(number);
  }
  return players;
}

const originalMakeTeam=MatchEngine.prototype.makeTeam;
MatchEngine.prototype.makeTeam=function makeTeamWithSquadNumbers(lineup,team){
  const before=this.players.length;
  const result=originalMakeTeam.call(this,lineup,team);
  assignMatchSquadNumbers(this.players.slice(before));
  return result;
};

const originalResetPositions=MatchEngine.prototype.resetPositions;
MatchEngine.prototype.resetPositions=function resetPositionsWithSmallerBall(...args){
  const result=originalResetPositions.apply(this,args);
  this.ball.r=MATCH_BALL_RADIUS;
  return result;
};

const originalDrawPlayer=MatchEngine.prototype.drawPlayer;
MatchEngine.prototype.drawPlayer=function drawPlayerWithShirtNumber(ctx,player){
  originalDrawPlayer.call(this,ctx,player);
  const number=validNumber(player.data?.squadNumber);
  if(!number)return;
  ctx.save();
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 8px system-ui';
  ctx.lineWidth=2.4;ctx.strokeStyle='rgba(0,0,0,.72)';ctx.fillStyle='#fff';
  ctx.strokeText(String(number),player.x,player.y+.5);
  ctx.fillText(String(number),player.x,player.y+.5);
  ctx.restore();
};

MatchEngine.prototype.drawUserBadge=function drawUserBadgeOutsideCanvas(){
  // The live HTML HUD already shows the player's rating and stats. Keeping a
  // second badge inside the canvas was covering the pitch on narrow screens.
};
