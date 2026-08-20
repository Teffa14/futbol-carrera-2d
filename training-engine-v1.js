import {predictBallPath,bestReachableTrajectoryPoint} from './trajectory-core-v1.js';

const W=900,H=520,LEFT=38,RIGHT=862,TOP=32,BOTTOM=488,CX=450,CY=260;
const FIELD={left:LEFT,right:RIGHT,top:TOP,bottom:BOTTOM,goalTop:200,goalBottom:320,goalDepth:0};
const BALL_DAMP=.993,BALL_BOUNCE=.64,PLAYER_DAMP=.90;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};

function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let a=hash(seed);return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function actor(x,y,r=9,role='mate'){return{x,y,vx:0,vy:0,r,role,kickCooldown:0,target:null};}
function profile(data={}){return{
  acceleration:clamp((data.pace??70)*.72+(data.dribbling??65)*.16+(data.ballControl??65)*.12,30,99),
  sprintSpeed:clamp((data.pace??70)*.87+(data.stamina??70)*.08+(data.physical??65)*.05,30,99),
  reaction:clamp((data.vision??65)*.32+(data.composure??65)*.28+(data.ballControl??65)*.22+(data.pace??70)*.18,30,99),
};}

export class TrainingEngine{
  constructor(drill,result,player){
    this.drill=drill;this.result=result;this.playerData=player;this.profile=profile(player);
    this.time=0;this.rep=0;this.repStart=0;this.repLength=Math.max(2.8,(drill.duration||18)/Math.max(1,result.reps));
    this.duration=this.repLength*Math.max(1,result.reps);this.finished=false;this.rng=rng(result.seed||drill.id);
    this.flash='';this.flashTimer=0;this.stage=0;this.flags={};
    this.player=actor(120,400,9,'user');this.ball={x:134,y:400,r:5,vx:0,vy:0,lastActor:null,lastKick:null};
    this.defenders=[];this.mates=[];this.cones=[];
    this.metrics={kicks:0,touches:0,repResets:0,maxBallSpeed:0,trajectoryReads:0,maxPlayerTravel:0,maxBallTravel:0};
    this.repOrigin={px:0,py:0,bx:0,by:0};this.resetRep(0,true);
  }

  progress(){return clamp(this.time/this.duration,0,1);}
  repProgress(){return clamp((this.time-this.repStart)/this.repLength,0,1);}
  repGood(){return this.rep<this.result.successes;}
  resetActor(a,x,y){a.x=x;a.y=y;a.vx=0;a.vy=0;a.kickCooldown=0;a.target=null;}

  resetRep(rep,initial=false){
    this.rep=rep;this.repStart=rep*this.repLength;this.stage=0;this.flags={};if(!initial)this.metrics.repResets++;
    const kind=this.drill.kind;this.defenders=[];this.mates=[];this.cones=[];
    if(kind==='cones'){
      this.resetActor(this.player,120,410);Object.assign(this.ball,{x:136,y:410,vx:0,vy:0,lastActor:null,lastKick:null});
      this.cones=[[205,370],[175,315],[250,260],[205,205],[335,150],[455,145],[575,160],[690,190]].map(([x,y])=>({x,y}));
    }else if(kind==='1v1'){
      this.resetActor(this.player,130,390);Object.assign(this.ball,{x:146,y:390,vx:0,vy:0,lastActor:null,lastKick:null});this.defenders=[actor(470,270,10,'def')];
    }else if(kind==='2v2'){
      this.resetActor(this.player,150,365);Object.assign(this.ball,{x:166,y:365,vx:0,vy:0,lastActor:null,lastKick:null});this.mates=[actor(395,215,9,'mate')];this.defenders=[actor(405,335,10,'def'),actor(620,235,10,'def')];
    }else if(kind==='3v3'){
      this.resetActor(this.player,145,370);Object.assign(this.ball,{x:161,y:370,vx:0,vy:0,lastActor:null,lastKick:null});this.mates=[actor(365,185,9,'mate'),actor(555,355,9,'mate')];this.defenders=[actor(360,325,10,'def'),actor(545,225,10,'def'),actor(700,305,10,'def')];
    }else if(kind==='through'){
      this.resetActor(this.player,185,350);Object.assign(this.ball,{x:201,y:350,vx:0,vy:0,lastActor:null,lastKick:null});this.mates=[actor(485,285,9,'runner')];this.defenders=[actor(500,225,10,'def'),actor(520,330,10,'def')];
    }else if(kind==='cross'){
      this.resetActor(this.player,135,435);Object.assign(this.ball,{x:151,y:435,vx:0,vy:0,lastActor:null,lastKick:null});this.mates=[actor(690,225,9,'runner'),actor(745,300,9,'runner')];this.defenders=[actor(660,340,10,'def'),actor(720,270,10,'def')];
    }else if(kind==='finish'){
      this.resetActor(this.player,515,315);Object.assign(this.ball,{x:335,y:410,vx:0,vy:0,lastActor:null,lastKick:null});this.mates=[actor(315,410,9,'server')];this.defenders=[actor(710,255,10,'def')];
    }else if(kind==='free-kick'){
      this.resetActor(this.player,315,260);Object.assign(this.ball,{x:350,y:260,vx:0,vy:0,lastActor:null,lastKick:null});this.defenders=[actor(585,225,9,'wall'),actor(585,248,9,'wall'),actor(585,272,9,'wall'),actor(585,295,9,'wall')];
    }else{
      this.resetActor(this.player,150,360);Object.assign(this.ball,{x:166,y:360,vx:0,vy:0,lastActor:null,lastKick:null});
    }
    this.repOrigin={px:this.player.x,py:this.player.y,bx:this.ball.x,by:this.ball.y};
  }

  allActors(){return[this.player,...this.mates,...this.defenders];}

  move(a,target,dt,scale=1){
    if(!a||!target)return;const dx=target.x-a.x,dy=target.y-a.y,d=Math.hypot(dx,dy),dir=d>.001?{x:dx/d,y:dy/d}:{x:0,y:0};
    const data=a===this.player?this.profile:{acceleration:a.role==='def'?68:72,sprintSpeed:a.role==='def'?68:74};
    const accel=(.055+(data.acceleration||65)*.0022)*scale,top=(1.0+(data.sprintSpeed||65)*.026)*scale,frame=dt*60;
    if(d>1){a.vx+=dir.x*accel*frame;a.vy+=dir.y*accel*frame;}const damp=Math.pow(PLAYER_DAMP,frame);a.vx*=damp;a.vy*=damp;
    const sp=Math.hypot(a.vx,a.vy);if(sp>top){a.vx=a.vx/sp*top;a.vy=a.vy/sp*top;}
    a.x=clamp(a.x+a.vx*frame,LEFT+a.r,RIGHT-a.r);a.y=clamp(a.y+a.vy*frame,TOP+a.r,BOTTOM-a.r);a.kickCooldown=Math.max(0,a.kickCooldown-dt);
    if(a===this.player)this.metrics.maxPlayerTravel=Math.max(this.metrics.maxPlayerTravel,Math.hypot(a.x-this.repOrigin.px,a.y-this.repOrigin.py));
  }

  kick(a,target,power,kind='pass'){
    if(!a||a.kickCooldown>0)return false;const contact=a.r+this.ball.r+2;if(dist(a,this.ball)>contact)return false;
    const desired=unit(target.x-this.ball.x,target.y-this.ball.y),quality=this.result.quality/100,error=(this.rng()-.5)*(1-quality)*.34;
    const cs=Math.cos(error),sn=Math.sin(error),dx=desired.x*cs-desired.y*sn,dy=desired.x*sn+desired.y*cs;
    this.ball.vx=dx*power+a.vx*.10;this.ball.vy=dy*power+a.vy*.10;this.ball.lastActor=a;this.ball.lastKick=kind;a.kickCooldown=.22;this.metrics.kicks++;return true;
  }

  approachKick(a,target,dt,power,kind='pass',scale=1){
    const d=unit(target.x-this.ball.x,target.y-this.ball.y),contact=a.r+this.ball.r-.6;
    const spot={x:this.ball.x-d.x*contact,y:this.ball.y-d.y*contact};this.move(a,spot,dt,scale);
    if(dist(a,spot)>4.5)return false;return this.kick(a,target,power,kind);
  }

  updateBall(dt){
    const frame=dt*60,damp=Math.pow(BALL_DAMP,frame);this.ball.vx*=damp;this.ball.vy*=damp;this.ball.x+=this.ball.vx*frame;this.ball.y+=this.ball.vy*frame;
    if(this.ball.y-this.ball.r<TOP){this.ball.y=TOP+this.ball.r;this.ball.vy=Math.abs(this.ball.vy)*BALL_BOUNCE;}
    if(this.ball.y+this.ball.r>BOTTOM){this.ball.y=BOTTOM-this.ball.r;this.ball.vy=-Math.abs(this.ball.vy)*BALL_BOUNCE;}
    if(this.ball.x-this.ball.r<LEFT){this.ball.x=LEFT+this.ball.r;this.ball.vx=Math.abs(this.ball.vx)*BALL_BOUNCE;}
    if(this.ball.x+this.ball.r>RIGHT){this.ball.x=RIGHT-this.ball.r;this.ball.vx=-Math.abs(this.ball.vx)*BALL_BOUNCE;}
    this.metrics.maxBallSpeed=Math.max(this.metrics.maxBallSpeed,Math.hypot(this.ball.vx,this.ball.vy));
    this.metrics.maxBallTravel=Math.max(this.metrics.maxBallTravel,Math.hypot(this.ball.x-this.repOrigin.bx,this.ball.y-this.repOrigin.by));
  }

  resolveContacts(){
    for(const a of this.allActors()){
      const dx=this.ball.x-a.x,dy=this.ball.y-a.y,d=Math.hypot(dx,dy)||.001,min=a.r+this.ball.r;if(d>=min)continue;
      const n={x:dx/d,y:dy/d},over=min-d+.2;this.ball.x+=n.x*over;this.ball.y+=n.y*over;
      const relativeNormal=(a.vx-this.ball.vx)*n.x+(a.vy-this.ball.vy)*n.y;
      if(relativeNormal>.015){const transfer=a.role==='def'?.34:.62,impulse=Math.max(.045,relativeNormal*transfer);this.ball.vx+=n.x*impulse;this.ball.vy+=n.y*impulse;}
      if(this.ball.lastActor!==a){this.ball.lastActor=a;this.metrics.touches++;}
    }
  }

  dribbleTo(a,target,dt){
    const ballToTarget=unit(target.x-this.ball.x,target.y-this.ball.y),contact=a.r+this.ball.r-.4,ideal={x:this.ball.x-ballToTarget.x*contact,y:this.ball.y-ballToTarget.y*contact};
    this.move(a,dist(a,this.ball)>44?this.ball:ideal,dt,1);
  }
  defend(d,target,dt){if(!d)return;const pressure=this.repGood()?.88:1.02;this.move(d,target,dt,pressure);}
  projectedIntercept(a){
    const path=predictBallPath(this.ball,{field:FIELD,horizonFrames:100,sampleEvery:2}),p=profile(a===this.player?this.playerData:{pace:70,vision:65,composure:65,ballControl:65});
    this.metrics.trajectoryReads++;return bestReachableTrajectoryPoint(a,path,p,{minFrame:2,maxFrame:95,slackFrames:3})||path[Math.min(path.length-1,5)];
  }

  scenario(dt){
    const kind=this.drill.kind,t=this.repProgress(),good=this.repGood();
    if(kind==='cones'){
      const route=[[205,400],[230,340],[185,285],[265,225],[225,175],[355,135],[475,155],[595,145],[725,195],[820,235]],target=route[Math.min(this.stage,route.length-1)];
      this.dribbleTo(this.player,{x:target[0],y:target[1]},dt);if(dist(this.ball,{x:target[0],y:target[1]})<31)this.stage=Math.min(route.length-1,this.stage+1);return;
    }
    if(kind==='1v1'){
      const d=this.defenders[0],side=this.rep%2?1:-1,goal={x:850,y:CY+side*45};this.dribbleTo(this.player,{x:735,y:CY+side*(good?58:35)},dt);
      this.defend(d,{x:this.ball.x+55,y:this.ball.y+side*18},dt);if(this.player.x>650&&!this.flags.shot)this.flags.shot=this.approachKick(this.player,goal,dt,5.2,'shot',1.02);return;
    }
    if(kind==='2v2'){
      const mate=this.mates[0],d1=this.defenders[0],d2=this.defenders[1];this.move(mate,{x:430+t*190,y:215+Math.sin(t*Math.PI)*42},dt);
      this.defend(d1,{x:(this.player.x+mate.x)/2,y:(this.player.y+mate.y)/2},dt);this.defend(d2,{x:600,y:250},dt);
      if(!this.flags.p1){this.flags.p1=t>.10&&this.approachKick(this.player,mate,dt,4.5,'pass');}
      else if(!this.flags.p2){this.move(this.player,{x:625,y:350},dt,1.05);const point=this.projectedIntercept(mate);this.move(mate,point,dt,1.03);if(t>.38)this.flags.p2=this.approachKick(mate,{x:this.player.x+90,y:this.player.y-12},dt,4.8,'wall');}
      else this.dribbleTo(this.player,{x:800,y:270},dt);return;
    }
    if(kind==='3v3'){
      const [m1,m2]=this.mates;this.move(m1,{x:365+t*110,y:185+Math.sin(t*Math.PI)*35},dt);this.move(m2,{x:555+t*115,y:350-Math.sin(t*Math.PI)*55},dt);
      this.defenders.forEach((d,i)=>this.defend(d,{x:[390,545,690][i],y:[315,230,300][i]+Math.sin(this.time*1.4+i)*24},dt));
      if(!this.flags.p1){this.flags.p1=t>.08&&this.approachKick(this.player,m1,dt,4.7,'pass');}
      else if(!this.flags.p2){this.move(m1,this.projectedIntercept(m1),dt,1.04);if(t>.34)this.flags.p2=this.approachKick(m1,m2,dt,5.0,'pass');}
      else if(!this.flags.p3){this.move(this.player,{x:705,y:245},dt,1.06);this.move(m2,this.projectedIntercept(m2),dt,1.04);if(t>.58)this.flags.p3=this.approachKick(m2,{x:this.player.x+80,y:this.player.y},dt,5.0,'third-man');}
      else this.dribbleTo(this.player,{x:815,y:255},dt);return;
    }
    if(kind==='through'){
      const runner=this.mates[0];this.move(runner,{x:810,y:210},dt,1.05);this.defenders.forEach((d,i)=>this.defend(d,{x:540+t*80,y:i?325:225},dt,.98));
      const lead={x:clamp(runner.x+95+(good?30:0),LEFT,RIGHT),y:runner.y-18};if(!this.flags.pass)this.flags.pass=t>.07&&this.approachKick(this.player,lead,dt,5.5,'through');
      if(this.flags.pass)this.move(runner,this.projectedIntercept(runner),dt,1.06);return;
    }
    if(kind==='cross'){
      const [near,far]=this.mates;this.move(near,{x:790,y:250},dt,1.04);this.move(far,{x:770,y:315},dt,1.02);this.defenders.forEach((d,i)=>this.defend(d,{x:700+i*45,y:285+i*30},dt));
      if(!this.flags.cross){this.dribbleTo(this.player,{x:730,y:425},dt);if(this.player.x>575&&t>.32){const target=good?far:near;this.flags.cross=this.approachKick(this.player,{x:target.x+35,y:target.y},dt,5.7,'cross',1.02);}}
      else{this.move(near,this.projectedIntercept(near),dt);this.move(far,this.projectedIntercept(far),dt);}return;
    }
    if(kind==='finish'){
      const server=this.mates[0],def=this.defenders[0];this.defend(def,{x:720,y:270},dt,.92);
      if(!this.flags.service){this.flags.service=t>.05&&this.approachKick(server,{x:570,y:300},dt,5.0,'service');}
      if(this.flags.service&&!this.flags.shot){const intercept=this.projectedIntercept(this.player);this.move(this.player,intercept,dt,1.06);if(t>.30)this.flags.shot=this.approachKick(this.player,{x:850,y:good?235:CY},dt,6.25,'shot',1.04);}return;
    }
    if(kind==='free-kick'){
      const target={x:850,y:good?220+(this.rep%2)*80:250};if(t>.06&&!this.flags.shot)this.flags.shot=this.approachKick(this.player,target,dt,6.5,'free-kick',.96);return;
    }
    this.dribbleTo(this.player,{x:800,y:220},dt);
  }

  step(dt){
    if(this.finished)return;dt=Math.min(.04,Math.max(.001,dt));this.time+=dt;this.flashTimer=Math.max(0,this.flashTimer-dt);if(this.flashTimer<=0)this.flash='';
    const nextRep=Math.min(this.result.reps-1,Math.floor(this.time/this.repLength));if(nextRep!==this.rep&&this.time<this.duration){this.resetRep(nextRep);this.flash=nextRep<this.result.successes?'SIGUIENTE':'CORREGIR';this.flashTimer=.5;}
    this.scenario(dt);this.updateBall(dt);this.resolveContacts();
    if(this.time>=this.duration){this.time=this.duration;this.finished=true;this.flash=`${this.result.grade} · ${this.result.quality}`;this.flashTimer=99;}
  }

  draw(ctx,width=W,height=H){
    const sx=width/W,sy=height/H;ctx.save();ctx.scale(sx,sy);ctx.clearRect(0,0,W,H);ctx.fillStyle='#17693b';ctx.fillRect(LEFT,TOP,RIGHT-LEFT,BOTTOM-TOP);
    ctx.strokeStyle='rgba(255,255,255,.82)';ctx.lineWidth=2;ctx.strokeRect(LEFT,TOP,RIGHT-LEFT,BOTTOM-TOP);ctx.beginPath();ctx.moveTo(CX,TOP);ctx.lineTo(CX,BOTTOM);ctx.stroke();ctx.beginPath();ctx.arc(CX,CY,58,0,Math.PI*2);ctx.stroke();ctx.strokeRect(RIGHT-135,CY-100,135,200);ctx.strokeRect(LEFT,CY-100,135,200);
    for(const c of this.cones){ctx.fillStyle='#ff9b2f';ctx.beginPath();ctx.moveTo(c.x,c.y-8);ctx.lineTo(c.x-6,c.y+7);ctx.lineTo(c.x+6,c.y+7);ctx.closePath();ctx.fill();}
    const drawP=(p,color,label)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,p.r||9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();if(label){ctx.fillStyle='#fff';ctx.font='700 11px system-ui';ctx.textAlign='center';ctx.fillText(label,p.x,p.y-15);}};
    for(const d of this.defenders)drawP(d,d.role==='wall'?'#f0f0f0':'#e53b3b',d.role==='wall'?'BARRERA':'DEF');for(const m of this.mates)drawP(m,'#4ea5ff',m.role==='server'?'AP':'COMP');drawP(this.player,'#d8ff4c',this.playerData?.name||'TU JUGADOR');
    const path=Math.hypot(this.ball.vx,this.ball.vy)>1?predictBallPath(this.ball,{field:FIELD,horizonFrames:54,sampleEvery:6}):[];if(path.length>1){ctx.fillStyle='rgba(216,255,76,.20)';for(const p of path.slice(1)){ctx.beginPath();ctx.arc(p.x,p.y,2.2,0,Math.PI*2);ctx.fill();}}
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(this.ball.x,this.ball.y,this.ball.r||5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#111';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle='rgba(5,15,10,.82)';ctx.fillRect(LEFT+10,TOP+10,320,58);ctx.fillStyle='#d8ff4c';ctx.font='800 14px system-ui';ctx.textAlign='left';ctx.fillText(this.drill.name,LEFT+22,TOP+31);ctx.fillStyle='#fff';ctx.font='12px system-ui';ctx.fillText(`Rep ${Math.min(this.result.reps,this.rep+1)}/${this.result.reps} · pelota libre · ${this.metrics.kicks} kicks`,LEFT+22,TOP+51);
    if(this.flash){ctx.textAlign='center';ctx.font='900 28px system-ui';ctx.fillStyle=this.flash.startsWith('CORREGIR')?'#ffb156':'#d8ff4c';ctx.fillText(this.flash,CX,80);}
    ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(LEFT,BOTTOM+8,RIGHT-LEFT,8);ctx.fillStyle='#d8ff4c';ctx.fillRect(LEFT,BOTTOM+8,(RIGHT-LEFT)*this.progress(),8);ctx.restore();
  }
}
