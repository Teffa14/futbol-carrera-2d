import { FORMATIONS } from './data.js';

const FIELD={left:64,right:896,top:48,bottom:512,goalTop:218,goalBottom:342,goalDepth:42,midX:480,midY:280};
const PHYS={playerRadius:12,ballRadius:7,playerDamping:.958,ballDamping:.992,playerBounce:.48,ballBounce:.55,acceleration:.115,kickStrength:5.15,dribbleStrength:1.22};

export class MatchEngine{
  constructor(home,away,options={}){
    this.names=[options.homeName||'Home',options.awayName||'Away'];
    this.colors=[options.homeColor||'#e14646',options.awayColor||'#4d82ff'];
    this.tactics=[normalizeTactics(options.homeTactics),normalizeTactics(options.awayTactics)];
    this.bonuses=[Number(options.homeBonus)||0,Number(options.awayBonus)||0];
    this.seed=hashString(options.seed||`${this.names[0]}-${this.names[1]}`);this.rng=mulberry32(this.seed);
    this.score=[0,0];this.minute=0;this.finished=false;this.events=[];this.scorers=[];
    this.stats={shots:[0,0],shotsOnTarget:[0,0],saves:[0,0],touches:[0,0],passes:[0,0],passesCompleted:[0,0],tackles:[0,0],possessionTicks:[0,0]};
    this.players=[];this.ball={x:FIELD.midX,y:FIELD.midY,vx:0,vy:0,r:PHYS.ballRadius,lastTeam:null,lastPlayer:null,lastTouchMinute:0};
    this.pendingPass=null;this.lastPossession=null;this.makeTeam(home,0);this.makeTeam(away,1);this.resetPositions();
  }

  makeTeam(lineup,team){
    const tactic=this.tactics[team],formation=FORMATIONS[tactic.formation]||FORMATIONS['1-2-1'];
    lineup.slice(0,5).forEach((data,i)=>{
      const a=formation.anchors[i]||formation.anchors[formation.anchors.length-1];
      const pos=anchorToField(a,team);
      this.players.push({data,team,slot:i,role:formation.slots[i]||'MID',x:pos.x,y:pos.y,homeX:pos.x,homeY:pos.y,vx:0,vy:0,r:PHYS.playerRadius,kickCooldown:0,fatigue:0,decisionCooldown:0,lastAction:null});
    });
  }

  resetPositions(scoringTeam=null){
    for(const p of this.players){const formation=FORMATIONS[this.tactics[p.team].formation]||FORMATIONS['1-2-1'];const a=formation.anchors[p.slot]||formation.anchors[formation.anchors.length-1];const pos=anchorToField(a,p.team);p.x=pos.x;p.y=pos.y;p.homeX=pos.x;p.homeY=pos.y;p.vx=0;p.vy=0;p.kickCooldown=0;p.decisionCooldown=0;}
    this.ball.x=FIELD.midX+(scoringTeam===0?-10:scoringTeam===1?10:0);this.ball.y=FIELD.midY;this.ball.vx=0;this.ball.vy=0;this.pendingPass=null;
  }

  step(dt){
    if(this.finished)return;dt=Math.min(dt,.05);this.minute+=dt;if(this.minute>=90){this.minute=90;this.finished=true;this.pushEvent('Full time',null,'end');return;}
    const scale=dt*60;
    const contexts=[this.teamContext(0),this.teamContext(1)];
    for(const p of this.players)this.updatePlayer(p,scale,contexts[p.team]);
    for(const p of this.players)this.resolvePlayerBoundary(p);
    this.resolvePlayerCollisions();
    this.updateBall(scale);
    this.resolvePostCollisions();
    this.resolveBallPlayerCollisions();
    this.checkGoal();
    const poss=this.closestPlayer();if(poss&&dist(poss,this.ball)<34){this.stats.possessionTicks[poss.team]++;this.lastPossession=poss.team;}
  }

  teamContext(team){
    const mates=this.players.filter(p=>p.team===team),opps=this.players.filter(p=>p.team!==team);
    const nearest=mates.reduce((best,p)=>!best||dist(p,this.ball)<dist(best,this.ball)?p:best,null);
    const closestOpp=opps.reduce((best,p)=>!best||dist(p,this.ball)<dist(best,this.ball)?p:best,null);
    const hasBall=this.ball.lastTeam===team&&this.minute-this.ball.lastTouchMinute<2.8;
    return{mates,opps,nearest,closestOpp,hasBall};
  }

  updatePlayer(p,scale,ctx){
    if(p.kickCooldown>0)p.kickCooldown-=scale;if(p.decisionCooldown>0)p.decisionCooldown-=scale;
    const target=this.aiTarget(p,ctx),dx=target.x-p.x,dy=target.y-p.y,len=Math.hypot(dx,dy)||1;
    const pace=p.data.pace??70,physical=p.data.physical??70,fit=clamp((p.data.contract?.fitness??100)-p.fatigue*.08,35,100)/100;
    const tactic=this.tactics[p.team],pressLoad=.92+(tactic.pressing/100)*.16,tempoLoad=.92+(tactic.tempo/100)*.14;
    const bonus=this.bonuses[p.team]||0;const accel=PHYS.acceleration*(.72+pace/135)*fit*pressLoad*(1+bonus/500);
    p.vx+=(dx/len)*accel*scale;p.vy+=(dy/len)*accel*scale;
    const damping=Math.pow(PHYS.playerDamping,scale);p.vx*=damping;p.vy*=damping;
    const max=(2.85+pace/100*1.7)*(0.88+physical/500)*fit;
    const speed=Math.hypot(p.vx,p.vy);if(speed>max){p.vx=p.vx/speed*max;p.vy=p.vy/speed*max;}
    p.x+=p.vx*scale;p.y+=p.vy*scale;p.fatigue+=(0.0021*pressLoad*tempoLoad)*scale;
    this.tryBallAction(p,ctx);
  }

  aiTarget(p,ctx){
    const team=p.team,tactic=this.tactics[team],dir=team===0?1:-1,ownGoalX=team===0?FIELD.left:FIELD.right;
    const ball=this.ball,scoreDiff=this.score[team]-this.score[1-team],late=this.minute>68,mentality=mentalityValue(tactic.mentality)+(late&&scoreDiff<0?0.14:late&&scoreDiff>0?-0.08:0);
    if(p.role==='GK'){
      const danger=team===0?ball.x<FIELD.left+260:ball.x>FIELD.right-260;
      const projectedY=clamp(ball.y+ball.vy*8,FIELD.goalTop+16,FIELD.goalBottom-16);
      if(danger){const chaseX=clamp(ball.x,team===0?FIELD.left+18:FIELD.right-145,team===0?FIELD.left+145:FIELD.right-18);return{x:chaseX,y:projectedY};}
      return{x:ownGoalX+dir*38,y:clamp(FIELD.midY+(ball.y-FIELD.midY)*.22,FIELD.goalTop+25,FIELD.goalBottom-25)};
    }
    const pressDistance=150+(tactic.pressing-50)*2.2;
    const isPrimary=p===ctx.nearest;
    const ballInZone=Math.abs(p.x-ball.x)<pressDistance&&Math.abs(p.y-ball.y)<pressDistance*.75;
    if(isPrimary||(!ctx.hasBall&&ballInZone&&p.role!=='FWD'&&this.rng()<.008+tactic.pressing/18000))return{x:ball.x-dir*3,y:ball.y};

    let baseX=p.homeX,baseY=p.homeY;
    const ballFlowX=(ball.x-FIELD.midX)*(.18+mentality*.16),ballFlowY=(ball.y-FIELD.midY)*(.22+tactic.width/500);
    baseX+=ballFlowX+dir*mentality*70;baseY+=ballFlowY;

    if(ctx.hasBall){
      if(p.role==='FWD'){baseX+=dir*(55+tactic.tempo*.35);baseY=FIELD.midY+(p.homeY-FIELD.midY)*(0.7+tactic.width/130);}
      else if(p.role==='MID'){baseX+=dir*(25+tactic.tempo*.18);}
      else if(p.role==='DEF'){baseX+=dir*18;}
    }else{
      const mark=this.bestMark(p,ctx.opps);if(mark){const goalBias={x:ownGoalX,y:FIELD.midY};baseX=mark.x*.62+goalBias.x*.38;baseY=mark.y*.72+goalBias.y*.28;}
      if(p.role==='DEF')baseX-=dir*(28+Math.max(0,mentality)*18);
    }
    if(scoreDiff<0&&late)baseX+=dir*38;if(scoreDiff>0&&late)baseX-=dir*28;
    const minX=FIELD.left+25,maxX=FIELD.right-25;return{x:clamp(baseX,minX,maxX),y:clamp(baseY,FIELD.top+24,FIELD.bottom-24)};
  }

  bestMark(p,opps){
    const candidates=opps.filter(o=>o.role!=='GK');if(!candidates.length)return null;
    return candidates.reduce((best,o)=>{const zone=Math.abs(o.y-p.homeY)+Math.abs(o.x-p.homeX)*.35;return!best||zone<best.zone?{o,zone}:best;},null).o;
  }

  tryBallAction(p,ctx){
    const d=dist(p,this.ball),touchRange=p.r+this.ball.r+6;if(d>touchRange)return;
    const relativeSpeed=Math.hypot(this.ball.vx-p.vx,this.ball.vy-p.vy);
    if(p.role==='GK'&&this.ball.lastTeam!==p.team&&relativeSpeed>2.2){this.stats.saves[p.team]++;this.pushEvent(`${p.data.name} saves`,p.team,'save');}
    if(this.pendingPass&&this.ball.lastTeam===p.team&&this.pendingPass.from!==p.data.name){this.stats.passesCompleted[p.team]++;this.pendingPass=null;}
    if(this.ball.lastTeam!==null&&this.ball.lastTeam!==p.team&&relativeSpeed<4.5){this.stats.tackles[p.team]++;if(this.rng()<.09)this.pushEvent(`${p.data.name} wins the ball`,p.team,'tackle');}
    this.ball.lastTeam=p.team;this.ball.lastPlayer=p.data.name;this.ball.lastTouchMinute=this.minute;this.stats.touches[p.team]++;
    if(p.kickCooldown>0){this.dribbleTouch(p);return;}
    p.kickCooldown=15;p.decisionCooldown=10;
    const tactic=this.tactics[p.team],dir=p.team===0?1:-1,goal={x:p.team===0?FIELD.right+28:FIELD.left-28,y:FIELD.midY};
    const progress=p.team===0?(p.x-FIELD.left)/(FIELD.right-FIELD.left):(FIELD.right-p.x)/(FIELD.right-FIELD.left);
    const goalDist=Math.hypot(goal.x-p.x,goal.y-p.y),angle=Math.abs(Math.atan2(goal.y-p.y,goal.x-p.x));
    const teamBonus=this.bonuses[p.team]||0,shooting=clamp((p.data.shooting??65)+teamBonus*.22,30,99),passing=clamp((p.data.passing??65)+teamBonus*.22,30,99),dribbling=clamp((p.data.dribbling??65)+teamBonus*.16,30,99);
    const shotScore=progress*.58+(shooting/100)*.30+(goalDist<210?.18:0)-Math.min(.12,angle*.05)+(tactic.mentality==='Attacking'?.08:0);
    const shouldShoot=shotScore>.67||progress>.78||this.rng()<Math.max(.04,(shotScore-.45)*.25);
    if(shouldShoot){this.shoot(p,goal,shooting,goalDist);return;}
    const pass=this.bestPass(p,ctx.mates,ctx.opps,tactic);
    if(pass&&pass.score>.12){this.pass(p,pass.player,passing,tactic);return;}
    this.dribbleTouch(p,dir,dribbling);
  }

  shoot(p,goal,shooting,goalDist){
    const team=p.team;this.stats.shots[team]++;
    const keeper=this.players.find(x=>x.team!==team&&x.role==='GK');const keeperY=keeper?.y??FIELD.midY;
    const corners=[FIELD.goalTop+18,FIELD.goalBottom-18];let ty=corners[Math.abs(keeperY-corners[0])>Math.abs(keeperY-corners[1])?0:1];
    const error=(100-shooting)*.75*(.7+goalDist/700);ty+=gaussianish(this.rng)*error;
    const tx=goal.x,dx=tx-this.ball.x,dy=ty-this.ball.y,len=Math.hypot(dx,dy)||1;const power=PHYS.kickStrength*(.92+shooting/170)*(goalDist>300?1.08:1);
    this.ball.vx=dx/len*power+p.vx*.18;this.ball.vy=dy/len*power+p.vy*.18;this.stats.shotsOnTarget[team]+=ty>FIELD.goalTop&&ty<FIELD.goalBottom?1:0;this.pendingPass=null;
    if(this.rng()<.35)this.pushEvent(`${p.data.name} shoots`,team,'shot');p.lastAction='shot';
  }

  bestPass(p,mates,opps,tactic){
    const dir=p.team===0?1:-1;let best=null;
    for(const m of mates){if(m===p||m.role==='GK'&&p.role!=='GK')continue;const dx=(m.x-p.x)*dir,dy=Math.abs(m.y-p.y),distance=dist(p,m);if(distance<35||distance>360)continue;
      const openness=Math.min(...opps.map(o=>distanceToSegment(o.x,o.y,p.x,p.y,m.x,m.y)),180);const forward=dx/260;const lane=openness/90;const spacing=Math.min(1,distance/150);let score=forward*.65+lane*.55+spacing*.12-dy/700;
      if(tactic.passing==='Short')score-=Math.max(0,distance-170)/260;if(tactic.passing==='Direct')score+=forward*.24;if(m.role==='FWD')score+=.08;
      if(!best||score>best.score)best={player:m,score};}
    return best;
  }

  pass(p,mate,passing,tactic){
    const lead=6+(tactic.tempo/100)*10,tx=mate.x+mate.vx*lead,ty=mate.y+mate.vy*lead;let dx=tx-this.ball.x,dy=ty-this.ball.y;const len=Math.hypot(dx,dy)||1;const error=(100-passing)/100*.16;const rot=(this.rng()-.5)*error;const cs=Math.cos(rot),sn=Math.sin(rot),nx=dx/len,ny=dy/len,rx=nx*cs-ny*sn,ry=nx*sn+ny*cs;const power=PHYS.kickStrength*(.62+passing/230)*(tactic.passing==='Direct'?1.12:.94);
    this.ball.vx=rx*power+p.vx*.22;this.ball.vy=ry*power+p.vy*.22;this.stats.passes[p.team]++;this.pendingPass={team:p.team,from:p.data.name,to:mate.data.name,minute:this.minute};p.lastAction='pass';
  }

  dribbleTouch(p,dir=p.team===0?1:-1,dribbling=p.data.dribbling??65){
    const factor=PHYS.dribbleStrength*(.75+dribbling/230),targetY=clamp(FIELD.midY+(p.homeY-FIELD.midY)*.55,FIELD.top+25,FIELD.bottom-25);let dx=dir*1,dy=(targetY-this.ball.y)/180;const len=Math.hypot(dx,dy)||1;this.ball.vx=this.ball.vx*.35+dx/len*factor+p.vx*.55;this.ball.vy=this.ball.vy*.35+dy/len*factor+p.vy*.55;p.lastAction='dribble';
  }

  updateBall(scale){
    const damp=Math.pow(PHYS.ballDamping,scale);this.ball.vx*=damp;this.ball.vy*=damp;this.ball.x+=this.ball.vx*scale;this.ball.y+=this.ball.vy*scale;
    if(this.ball.y-this.ball.r<FIELD.top){this.ball.y=FIELD.top+this.ball.r;this.ball.vy=Math.abs(this.ball.vy)*PHYS.ballBounce;}
    if(this.ball.y+this.ball.r>FIELD.bottom){this.ball.y=FIELD.bottom-this.ball.r;this.ball.vy=-Math.abs(this.ball.vy)*PHYS.ballBounce;}
    const mouth=this.ball.y>FIELD.goalTop&&this.ball.y<FIELD.goalBottom;
    if(!mouth&&this.ball.x-this.ball.r<FIELD.left){this.ball.x=FIELD.left+this.ball.r;this.ball.vx=Math.abs(this.ball.vx)*PHYS.ballBounce;}
    if(!mouth&&this.ball.x+this.ball.r>FIELD.right){this.ball.x=FIELD.right-this.ball.r;this.ball.vx=-Math.abs(this.ball.vx)*PHYS.ballBounce;}
    if(mouth){if(this.ball.x<FIELD.left-FIELD.goalDepth){this.ball.x=FIELD.left-FIELD.goalDepth;this.ball.vx=Math.abs(this.ball.vx)*.45;}if(this.ball.x>FIELD.right+FIELD.goalDepth){this.ball.x=FIELD.right+FIELD.goalDepth;this.ball.vx=-Math.abs(this.ball.vx)*.45;}}
  }

  resolvePostCollisions(){
    const posts=[{x:FIELD.left,y:FIELD.goalTop},{x:FIELD.left,y:FIELD.goalBottom},{x:FIELD.right,y:FIELD.goalTop},{x:FIELD.right,y:FIELD.goalBottom}];
    for(const post of posts){const dx=this.ball.x-post.x,dy=this.ball.y-post.y,d=Math.hypot(dx,dy)||.01,min=this.ball.r+5;if(d<min){const nx=dx/d,ny=dy/d,over=min-d;this.ball.x+=nx*over;this.ball.y+=ny*over;const rel=this.ball.vx*nx+this.ball.vy*ny;if(rel<0){this.ball.vx-=rel*(1+PHYS.ballBounce)*nx;this.ball.vy-=rel*(1+PHYS.ballBounce)*ny;}if(this.rng()<.25)this.pushEvent('Off the post',this.ball.lastTeam,'post');}}
  }

  resolvePlayerBoundary(p){
    p.y=clamp(p.y,FIELD.top+p.r,FIELD.bottom-p.r);
    const mouth=p.y>FIELD.goalTop+p.r&&p.y<FIELD.goalBottom-p.r;
    if(mouth&&p.role==='GK'){p.x=clamp(p.x,FIELD.left-FIELD.goalDepth/2+p.r,FIELD.right+FIELD.goalDepth/2-p.r);}else p.x=clamp(p.x,FIELD.left+p.r,FIELD.right-p.r);
  }

  resolvePlayerCollisions(){
    for(let i=0;i<this.players.length;i++)for(let j=i+1;j<this.players.length;j++){const a=this.players[i],b=this.players[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.01,min=a.r+b.r;if(d>=min)continue;const nx=dx/d,ny=dy/d,over=(min-d)/2;a.x-=nx*over;a.y-=ny*over;b.x+=nx*over;b.y+=ny*over;const rvx=b.vx-a.vx,rvy=b.vy-a.vy,sep=rvx*nx+rvy*ny;if(sep<0){const physA=(a.data.physical??70)/100,physB=(b.data.physical??70)/100,impulse=-sep*(1+PHYS.playerBounce)*.5;a.vx-=impulse*nx*(1.1-physA*.2);a.vy-=impulse*ny*(1.1-physA*.2);b.vx+=impulse*nx*(1.1-physB*.2);b.vy+=impulse*ny*(1.1-physB*.2);}}
  }

  resolveBallPlayerCollisions(){
    for(const p of this.players){const dx=this.ball.x-p.x,dy=this.ball.y-p.y,d=Math.hypot(dx,dy)||.01,min=this.ball.r+p.r;if(d>=min)continue;const nx=dx/d,ny=dy/d,over=min-d;this.ball.x+=nx*over;this.ball.y+=ny*over;const rel=(this.ball.vx-p.vx)*nx+(this.ball.vy-p.vy)*ny;if(rel<0){const impulse=-rel*(1+PHYS.ballBounce);this.ball.vx+=impulse*nx;this.ball.vy+=impulse*ny;}this.ball.lastTeam=p.team;this.ball.lastPlayer=p.data.name;this.ball.lastTouchMinute=this.minute;}
  }

  checkGoal(){
    if(this.ball.y<FIELD.goalTop||this.ball.y>FIELD.goalBottom)return;let scoring=null;if(this.ball.x<FIELD.left-13)scoring=1;if(this.ball.x>FIELD.right+13)scoring=0;if(scoring===null)return;
    this.score[scoring]++;const scorer=this.ball.lastTeam===scoring?this.ball.lastPlayer:'Own goal';if(scorer!=='Own goal')this.scorers.push(scorer);this.pushEvent(`GOAL — ${scorer}`,scoring,'goal');this.pendingPass=null;this.resetPositions(scoring);
  }

  pushEvent(text,team=null,type='info'){this.events.unshift({minute:Math.max(1,Math.round(this.minute)),text,team,type});if(this.events.length>70)this.events.length=70;}
  closestPlayer(){return this.players.reduce((best,p)=>!best||dist(p,this.ball)<dist(best,this.ball)?p:best,null);}
  possessionPercent(){const total=this.stats.possessionTicks[0]+this.stats.possessionTicks[1];if(!total)return[50,50];const h=Math.round(this.stats.possessionTicks[0]/total*100);return[h,100-h];}
  report(){return{score:[...this.score],stats:JSON.parse(JSON.stringify(this.stats)),possession:this.possessionPercent(),scorers:[...this.scorers],events:[...this.events]};}

  draw(ctx,width=960,height=560){
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#0c2819';ctx.fillRect(0,0,width,height);ctx.fillStyle='#1b5a37';ctx.fillRect(FIELD.left,FIELD.top,FIELD.right-FIELD.left,FIELD.bottom-FIELD.top);
    ctx.strokeStyle='rgba(255,255,255,.78)';ctx.lineWidth=2;ctx.strokeRect(FIELD.left,FIELD.top,FIELD.right-FIELD.left,FIELD.bottom-FIELD.top);ctx.beginPath();ctx.moveTo(FIELD.midX,FIELD.top);ctx.lineTo(FIELD.midX,FIELD.bottom);ctx.stroke();ctx.beginPath();ctx.arc(FIELD.midX,FIELD.midY,72,0,Math.PI*2);ctx.stroke();
    ctx.strokeRect(FIELD.left-FIELD.goalDepth,FIELD.goalTop,FIELD.goalDepth,FIELD.goalBottom-FIELD.goalTop);ctx.strokeRect(FIELD.right,FIELD.goalTop,FIELD.goalDepth,FIELD.goalBottom-FIELD.goalTop);ctx.strokeRect(FIELD.left,174,122,212);ctx.strokeRect(FIELD.right-122,174,122,212);
    for(const post of [{x:FIELD.left,y:FIELD.goalTop},{x:FIELD.left,y:FIELD.goalBottom},{x:FIELD.right,y:FIELD.goalTop},{x:FIELD.right,y:FIELD.goalBottom}]){ctx.beginPath();ctx.arc(post.x,post.y,5,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();}
    for(const p of this.players){ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=this.colors[p.team];ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff';ctx.font='700 9px system-ui';ctx.textAlign='center';ctx.fillText(shortName(p.data.name),p.x,p.y-17);if(p.role==='GK'){ctx.font='800 8px system-ui';ctx.fillText('GK',p.x,p.y+3);}}
    ctx.beginPath();ctx.arc(this.ball.x,this.ball.y,this.ball.r,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#111';ctx.lineWidth=1.4;ctx.stroke();
  }
}

function normalizeTactics(t={}){return{formation:t.formation||'1-2-1',mentality:t.mentality||'Balanced',pressing:clamp(Number(t.pressing)||55,20,95),tempo:clamp(Number(t.tempo)||55,25,95),width:clamp(Number(t.width)||55,25,90),passing:t.passing||'Balanced'};}
function mentalityValue(m){return m==='Attacking'?.38:m==='Defensive'?-.3:0;}
function anchorToField(a,team){const x=FIELD.left+(FIELD.right-FIELD.left)*(team===0?a[0]:1-a[0]),y=FIELD.top+(FIELD.bottom-FIELD.top)*a[1];return{x,y};}
function distanceToSegment(px,py,x1,y1,x2,y2){const A=px-x1,B=py-y1,C=x2-x1,D=y2-y1,dot=A*C+B*D,len=C*C+D*D;let t=len?dot/len:0;t=clamp(t,0,1);const x=x1+t*C,y=y1+t*D;return Math.hypot(px-x,py-y);}
function shortName(name){const parts=String(name).split(' ');return parts[parts.length-1].slice(0,11);}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function gaussianish(r){return(r()+r()+r()+r()-2);}
function hashString(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
