const W=900,H=520,LEFT=38,RIGHT=862,TOP=32,BOTTOM=488,CX=450,CY=260;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let a=hash(seed);return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

function routeFor(kind){
  if(kind==='cones')return[[120,400],[230,330],[155,250],[280,175],[210,95],[390,90],[505,155],[620,110],[760,180]];
  if(kind==='1v1')return[[130,390],[260,340],[385,285],[520,245],[650,210],[790,190]];
  if(kind==='through')return[[160,350],[245,335],[315,315]];
  if(kind==='cross')return[[135,430],[280,430],[430,425],[590,412],[730,390],[800,330]];
  if(kind==='finish')return[[520,315],[600,290],[690,270]];
  if(kind==='free-kick')return[[330,260]];
  return[[150,360],[280,300],[410,260],[540,220],[680,180]];
}

export class TrainingEngine{
  constructor(drill,result,player){
    this.drill=drill;this.result=result;this.playerData=player;this.time=0;this.duration=Math.max(10,drill.duration||18);this.finished=false;this.rng=rng(result.seed||drill.id);this.attempt=0;this.flash='';this.flashTimer=0;
    this.route=routeFor(drill.kind);this.player={x:this.route[0][0],y:this.route[0][1],r:9};this.ball={x:this.player.x+12,y:this.player.y,r:5,vx:0,vy:0};
    this.defenders=[];this.mates=[];this.cones=[];this.setup();
  }
  setup(){
    if(this.drill.kind==='cones')this.cones=[[210,365],[170,300],[245,235],[205,175],[345,125],[470,130],[585,120],[690,155]].map(([x,y])=>({x,y}));
    if(this.drill.kind==='1v1')this.defenders=[{x:470,y:270,baseY:270,r:10}];
    if(this.drill.kind==='2v2'){this.mates=[{x:420,y:220,r:9}];this.defenders=[{x:425,y:320,baseY:320,r:10},{x:610,y:230,baseY:230,r:10}];}
    if(this.drill.kind==='3v3'){this.mates=[{x:390,y:180,r:9},{x:520,y:355,r:9}];this.defenders=[{x:370,y:320,baseY:320,r:10},{x:545,y:220,baseY:220,r:10},{x:680,y:300,baseY:300,r:10}];}
    if(this.drill.kind==='through'){this.mates=[{x:520,y:245,r:9,runner:true}];this.defenders=[{x:480,y:210,baseY:210,r:10},{x:505,y:305,baseY:305,r:10}];}
    if(this.drill.kind==='cross'){this.mates=[{x:710,y:235,r:9,runner:true},{x:755,y:290,r:9,runner:true}];this.defenders=[{x:650,y:335,baseY:335,r:10},{x:720,y:270,baseY:270,r:10}];}
    if(this.drill.kind==='finish'){this.mates=[{x:360,y:420,r:9,server:true}];this.defenders=[{x:700,y:250,baseY:250,r:10}];}
    if(this.drill.kind==='free-kick')this.defenders=[{x:585,y:230,r:9},{x:585,y:250,r:9},{x:585,y:270,r:9},{x:585,y:290,r:9}];
  }
  progress(){return clamp(this.time/this.duration,0,1);}
  step(dt){
    if(this.finished)return;dt=Math.min(.05,Math.max(.001,dt));this.time+=dt;this.flashTimer=Math.max(0,this.flashTimer-dt);if(this.flashTimer<=0)this.flash='';
    const cycle=(this.time%4.5)/4.5,rep=Math.floor(this.time/4.5);if(rep!==this.attempt){this.attempt=rep;this.flash=rep<=this.result.reps?(rep<=this.result.successes?'BIEN':'CORREGIR'):'';this.flashTimer=.65;}
    this.updateActors(dt,cycle);if(this.time>=this.duration){this.time=this.duration;this.finished=true;this.flash=`${this.result.grade} · ${this.result.quality}`;this.flashTimer=99;}
  }
  updateActors(dt,cycle){
    const q=this.result.quality/100,kind=this.drill.kind;
    for(let i=0;i<this.defenders.length;i++){const d=this.defenders[i];if(d.baseY!=null)d.y=d.baseY+Math.sin(this.time*(1.35+i*.17)+i)*18*(.8+.4*q);}
    if(kind==='through'){
      const r=this.mates[0];r.x=480+cycle*260;r.y=240-Math.sin(cycle*Math.PI)*42;this.player.x=180+Math.min(cycle/.42,1)*145;this.player.y=345-40*Math.min(cycle/.42,1);
      if(cycle<.43){this.ball.x=this.player.x+12;this.ball.y=this.player.y-3;}else{const t=(cycle-.43)/.57;this.ball.x=lerp(this.player.x+12,r.x+28,t);this.ball.y=lerp(this.player.y-3,r.y,t)-Math.sin(t*Math.PI)*18*q;}
      return;
    }
    if(kind==='cross'){
      const t=Math.min(cycle/.62,1);this.player.x=lerp(135,790,t);this.player.y=lerp(430,360,t);for(let i=0;i<this.mates.length;i++){const m=this.mates[i];m.x=690+i*58+cycle*35;m.y=220+i*70;}
      if(cycle<.64){this.ball.x=this.player.x+10;this.ball.y=this.player.y-5;}else{const c=(cycle-.64)/.36,target=this.mates[cycle>.82?1:0];this.ball.x=lerp(this.player.x,target.x,c);this.ball.y=lerp(this.player.y,target.y,c)-Math.sin(c*Math.PI)*42*q;}return;
    }
    if(kind==='free-kick'){
      this.player.x=330;this.player.y=260;if(cycle<.38){this.ball.x=350;this.ball.y=260;}else{const t=(cycle-.38)/.62,aimY=235+(1-q)*55*(this.rng()-.5);this.ball.x=lerp(350,835,t);this.ball.y=lerp(260,aimY,t)-Math.sin(t*Math.PI)*72*q;}return;
    }
    if(kind==='finish'){
      const server=this.mates[0];server.x=320;server.y=410;if(cycle<.38){this.player.x=520+cycle*190;this.player.y=315-cycle*55;this.ball.x=lerp(server.x+10,this.player.x,cycle/.38);this.ball.y=lerp(server.y,this.player.y,cycle/.38);}else{const t=(cycle-.38)/.62;this.ball.x=lerp(this.player.x+8,840,t);this.ball.y=lerp(this.player.y,245+(1-q)*75*(this.rng()-.5),t);}return;
    }
    if(kind==='2v2'||kind==='3v3'){
      const nodes=kind==='2v2'?[[150,350],[365,215],[540,330],[720,210]]:[[145,355],[345,190],[510,350],[660,205],[780,300]],seg=Math.min(nodes.length-2,Math.floor(cycle*(nodes.length-1))),lt=cycle*(nodes.length-1)-seg,a=nodes[seg],b=nodes[seg+1];this.player.x=lerp(a[0],b[0],lt);this.player.y=lerp(a[1],b[1],lt);const carrierIndex=Math.floor(cycle*4)%Math.max(1,this.mates.length+1);if(carrierIndex===0){this.ball.x=this.player.x+10;this.ball.y=this.player.y;}else{const m=this.mates[carrierIndex-1];this.ball.x=m.x+10;this.ball.y=m.y;}for(let i=0;i<this.mates.length;i++){const m=this.mates[i];m.x=390+i*145+Math.sin(this.time*1.1+i)*45;m.y=210+i*110+Math.cos(this.time*.9+i)*35;}return;
    }
    const path=this.route,scaled=cycle*(path.length-1),i=Math.min(path.length-2,Math.floor(scaled)),t=scaled-i,a=path[i],b=path[i+1];this.player.x=lerp(a[0],b[0],t);this.player.y=lerp(a[1],b[1],t);const ahead=unit(b[0]-a[0],b[1]-a[1]),touch=9+Math.sin(this.time*5.2)*3*(1-q*.45);this.ball.x=this.player.x+ahead.x*touch;this.ball.y=this.player.y+ahead.y*touch;
  }
  draw(ctx,width=W,height=H){
    const sx=width/W,sy=height/H;ctx.save();ctx.scale(sx,sy);ctx.clearRect(0,0,W,H);ctx.fillStyle='#17693b';ctx.fillRect(LEFT,TOP,RIGHT-LEFT,BOTTOM-TOP);ctx.strokeStyle='rgba(255,255,255,.82)';ctx.lineWidth=2;ctx.strokeRect(LEFT,TOP,RIGHT-LEFT,BOTTOM-TOP);ctx.beginPath();ctx.moveTo(CX,TOP);ctx.lineTo(CX,BOTTOM);ctx.stroke();ctx.beginPath();ctx.arc(CX,CY,58,0,Math.PI*2);ctx.stroke();
    ctx.strokeRect(RIGHT-135,CY-100,135,200);ctx.strokeRect(LEFT,CY-100,135,200);
    for(const c of this.cones){ctx.fillStyle='#ff9b2f';ctx.beginPath();ctx.moveTo(c.x,c.y-8);ctx.lineTo(c.x-6,c.y+7);ctx.lineTo(c.x+6,c.y+7);ctx.closePath();ctx.fill();}
    const drawP=(p,color,label)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,p.r||9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();if(label){ctx.fillStyle='#fff';ctx.font='700 11px system-ui';ctx.textAlign='center';ctx.fillText(label,p.x,p.y-15);}};
    for(const d of this.defenders)drawP(d,'#e53b3b','DEF');for(const m of this.mates)drawP(m,'#4ea5ff','AP');drawP(this.player,'#d8ff4c',this.playerData?.name||'TU JUGADOR');
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(this.ball.x,this.ball.y,this.ball.r||5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#111';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle='rgba(5,15,10,.82)';ctx.fillRect(LEFT+10,TOP+10,250,54);ctx.fillStyle='#d8ff4c';ctx.font='800 14px system-ui';ctx.textAlign='left';ctx.fillText(this.drill.name,LEFT+22,TOP+31);ctx.fillStyle='#fff';ctx.font='12px system-ui';ctx.fillText(`Calidad ${this.result.quality} · ${this.result.successes}/${this.result.reps} buenas`,LEFT+22,TOP+51);
    if(this.flash){ctx.textAlign='center';ctx.font='900 30px system-ui';ctx.fillStyle=this.flash.startsWith('CORREGIR')?'#ffb156':'#d8ff4c';ctx.fillText(this.flash,CX,80);}
    ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(LEFT,BOTTOM+8,RIGHT-LEFT,8);ctx.fillStyle='#d8ff4c';ctx.fillRect(LEFT,BOTTOM+8,(RIGHT-LEFT)*this.progress(),8);ctx.restore();
  }
}
