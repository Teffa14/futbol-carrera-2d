import {MatchEngine} from './engine.js';

const FIELD={left:55,right:1045,top:45,bottom:655,centerX:550,centerY:350};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d};};
const hash=(value)=>{let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const lerp=(a,b,t)=>a+(b-a)*t;

const ROLE_PROFILE={
  GK:{advance:0,drop:0,followX:.02,followY:.18,looseX:.02,looseY:.12},
  CB:{advance:8,drop:32,followX:.08,followY:.24,looseX:.07,looseY:.18},
  LB:{advance:26,drop:24,followX:.15,followY:.48,looseX:.12,looseY:.35,wide:true},
  RB:{advance:26,drop:24,followX:.15,followY:.48,looseX:.12,looseY:.35,wide:true},
  CDM:{advance:18,drop:22,followX:.16,followY:.34,looseX:.14,looseY:.30},
  CM:{advance:30,drop:18,followX:.23,followY:.42,looseX:.20,looseY:.37},
  CAM:{advance:46,drop:12,followX:.31,followY:.48,looseX:.27,looseY:.43},
  LW:{advance:58,drop:10,followX:.35,followY:.56,looseX:.30,looseY:.50,wide:true},
  RW:{advance:58,drop:10,followX:.35,followY:.56,looseX:.30,looseY:.50,wide:true},
  ST:{advance:66,drop:8,followX:.38,followY:.30,looseX:.34,looseY:.27}
};

function profile(p){return ROLE_PROFILE[p.role]||ROLE_PROFILE.CM;}
function personalBias(p){return((hash(p.id||p.data?.instanceId||p.data?.name||'player')%2001)/1000)-1;}
function wallForBall(ball){
  const top=ball.y-FIELD.top,bottom=FIELD.bottom-ball.y;
  if(top<=34&&top<=bottom)return{side:'top',wallY:FIELD.top,inside:1};
  if(bottom<=34)return{side:'bottom',wallY:FIELD.bottom,inside:-1};
  return null;
}
function physicalClamp(p,target){
  return{
    x:clamp(target.x,FIELD.left+(p.r||10),FIELD.right-(p.r||10)),
    y:clamp(target.y,FIELD.top+(p.r||10),FIELD.bottom-(p.r||10))
  };
}
function actorWallTarget(engine,p){
  const wall=wallForBall(engine.ball);if(!wall)return null;
  const ballDistance=dist(p,engine.ball);if(ballDistance>145)return null;
  const dir=p.team===0?1:-1,pr=p.r||10,br=engine.ball.r||5,contact=Math.max(3,pr+br-.8);
  const py=wall.side==='top'?FIELD.top+pr:FIELD.bottom-pr;
  const vertical=Math.abs(engine.ball.y-py),horizontal=Math.sqrt(Math.max(16,contact*contact-vertical*vertical));
  // Each team approaches from behind the ball relative to its attacking direction.
  // This means opposing actors naturally use different sides instead of mirroring.
  const px=engine.ball.x-dir*horizontal;
  p.wallApproachTicks=Math.max(Number(p.wallApproachTicks)||0,4);
  return physicalClamp(p,{x:px,y:py});
}
function roleTarget(engine,p,possession){
  const pr=profile(p),dir=p.team===0?1:-1,bx=engine.ball.x-FIELD.centerX,by=engine.ball.y-FIELD.centerY;
  const anchorX=p.homeX??p.x,anchorY=p.homeY??p.y,bias=personalBias(p);
  const instructions=p.data?.instructions||{},risk=((instructions.risk??50)-50)/50,dribble=((instructions.dribble??50)-50)/50,shoot=((instructions.shoot??50)-50)/50;
  const our=possession===p.team,enemy=possession!==null&&possession!==p.team;
  let x=anchorX,y=anchorY;

  if(our){
    const extra=pr.advance*(1+risk*.18)+(p.role==='ST'||p.role==='CAM'?shoot*8:0);
    x+=dir*extra+bx*pr.followX;
    y+=by*pr.followY;
    if(pr.wide){
      const lane=Math.sign(anchorY-FIELD.centerY)||1,sameSide=Math.sign(by||lane)===lane;
      y+=lane*(sameSide?18+Math.max(0,dribble)*8:-6);
      if(!sameSide)y=lerp(y,FIELD.centerY,.14);
    }
  }else if(enemy){
    x-=dir*pr.drop+bx*Math.min(.12,pr.followX*.45);
    y+=by*Math.min(.38,pr.followY*.72);
    if(['CB','LB','RB','CDM'].includes(p.role))y=lerp(y,FIELD.centerY,.10);
  }else{
    x+=bx*pr.looseX;
    y+=by*pr.looseY;
    if(pr.wide){const lane=Math.sign(anchorY-FIELD.centerY)||1;y+=lane*10;}
  }

  // Small deterministic individuality keeps same-role players from selecting
  // identical coordinates while role and phase remain the dominant factors.
  x+=dir*bias*7;y+=bias*9;
  return physicalClamp(p,{x,y});
}

const previousBoundarySafeTarget=MatchEngine.prototype.boundarySafeTarget;
const previousAiTarget=MatchEngine.prototype.aiTarget;

MatchEngine.prototype.boundarySafeTarget=function wallAwareBoundaryTarget(p,target){
  if(p?.wallApproachTicks>0){
    p.wallApproachTicks--;
    return physicalClamp(p,target);
  }
  return previousBoundarySafeTarget.call(this,p,target);
};

MatchEngine.prototype.aiTarget=function positionalFootballTarget(p,pressers,actor,possession){
  const base=previousAiTarget.call(this,p,pressers,actor,possession);
  if(!p||p.role==='GK'||this.restart?.active)return base;
  const isActor=actor?.id===p.id;
  const primaryPresser=possession!==null&&possession!==p.team&&Array.isArray(pressers)&&pressers[0]===p.id;

  if(isActor){
    const wallTarget=actorWallTarget(this,p);
    if(wallTarget)return wallTarget;
    return base;
  }
  if(primaryPresser)return base;

  // Off-ball movement is role/phase specific. Players no longer mirror the
  // nearest opponent or all collapse onto the same ball coordinate.
  const target=roleTarget(this,p,possession);
  const nearestMate=this.players
    .filter(q=>q.team===p.team&&q.id!==p.id)
    .sort((a,b)=>dist(a,p)-dist(b,p))[0];
  if(nearestMate&&dist(nearestMate,target)<25){
    const away=unit(target.x-nearestMate.x,target.y-nearestMate.y),side=personalBias(p)>=0?1:-1;
    target.x+=away.x*18-away.y*side*10;
    target.y+=away.y*18+away.x*side*10;
  }
  return physicalClamp(p,target);
};
