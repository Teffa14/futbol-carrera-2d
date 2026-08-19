const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mag=(x,y)=>Math.hypot(x,y);
const unit=(x,y)=>{const l=mag(x,y)||1;return{x:x/l,y:y/l};};
const dot=(ax,ay,bx,by)=>ax*bx+ay*by;

function hashString(s){let h=2166136261;for(let i=0;i<String(s).length;i++){h^=String(s).charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function pairSide(a,b){const key=[String(a.id),String(b.id)].sort().join('|');return(hashString(key)&1)?1:-1;}
function physical(p){return clamp(Number(p?.data?.physical??65),20,99);}
function balance(p){return clamp(physical(p)*.72+Number(p?.data?.dribbling??65)*.18+Number(p?.data?.ballControl??65)*.10,20,99);}

export function effectiveMass(p){return .72+physical(p)/100*.88+balance(p)/100*.18;}

export function steerAroundOpponent(p,target,players,ball){
  if(!p||!target)return target;
  const dx=target.x-p.x,dy=target.y-p.y,dlen=mag(dx,dy);if(dlen<18)return target;
  const desired={x:dx/dlen,y:dy/dlen};
  let blocker=null,best=Infinity;
  for(const o of players){
    if(o===p||o.team===p.team)continue;
    const ox=o.x-p.x,oy=o.y-p.y,d=mag(ox,oy);if(d>44||d<.001||d>=dlen)continue;
    const to={x:ox/d,y:oy/d};if(dot(desired.x,desired.y,to.x,to.y)<.78)continue;
    if(d<best){best=d;blocker=o;}
  }
  if(!blocker)return target;
  const side=pairSide(p,blocker),perp={x:-desired.y*side,y:desired.x*side};
  const corridor=22+Math.max(0,72-physical(p))*.08;
  let sx=target.x+perp.x*corridor,sy=target.y+perp.y*corridor;
  if(ball){
    const ballDx=ball.x-p.x,ballDy=ball.y-p.y;
    if(mag(ballDx,ballDy)<70){sx=p.x+desired.x*34+perp.x*corridor;sy=p.y+desired.y*34+perp.y*corridor;}
  }
  return{x:sx,y:sy};
}

export function resolvePlayerContacts(players){
  const contacts=[];
  for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
    const a=players[i],b=players[j],dx=b.x-a.x,dy=b.y-a.y,d=mag(dx,dy)||.0001,min=(a.r??10)+(b.r??10);
    if(d>=min)continue;
    const nx=dx/d,ny=dy/d,over=min-d+.08,same=a.team===b.team;
    const preAForward=Math.max(0,dot(a.vx,a.vy,nx,ny)),preBForward=Math.max(0,-dot(b.vx,b.vy,nx,ny));
    const preASpeed=mag(a.vx,a.vy),preBSpeed=mag(b.vx,b.vy);
    const massA=same?1:effectiveMass(a),massB=same?1:effectiveMass(b),invA=1/massA,invB=1/massB,invTotal=invA+invB;
    const moveA=over*(invA/invTotal),moveB=over*(invB/invTotal);
    a.x-=nx*moveA;a.y-=ny*moveA;b.x+=nx*moveB;b.y+=ny*moveB;

    const rvx=b.vx-a.vx,rvy=b.vy-a.vy,rvn=dot(rvx,rvy,nx,ny);
    if(rvn<0){
      const restitution=same?.02:.08,jimp=-(1+restitution)*rvn/invTotal;
      a.vx-=nx*jimp*invA;a.vy-=ny*jimp*invA;b.vx+=nx*jimp*invB;b.vy+=ny*jimp*invB;
    }

    const forceA=physical(a)*.72+balance(a)*.16+preASpeed*5+preAForward*9;
    const forceB=physical(b)*.72+balance(b)*.16+preBSpeed*5+preBForward*9;
    const edge=clamp((forceA-forceB)/85,-.75,.75);

    if(!same&&Math.abs(edge)>.035){
      const shove=Math.abs(edge)*.54;
      if(edge>0){b.vx+=nx*shove;b.vy+=ny*shove;a.vx+=nx*shove*.10;a.vy+=ny*shove*.10;}
      else{a.vx-=nx*shove;a.vy-=ny*shove;b.vx-=nx*shove*.10;b.vy-=ny*shove*.10;}
    }

    const headOn=!same&&preAForward>.10&&preBForward>.10;
    if(headOn){
      const side=pairSide(a,b),tx=-ny*side,ty=nx*side;
      const weakerA=edge<0,weakerB=edge>0,equal=Math.abs(edge)<.12;
      const slideA=equal?.30:weakerA?.46:.12,slideB=equal?.30:weakerB?.46:.12;
      a.vx+=tx*slideA;a.vy+=ty*slideA;b.vx-=tx*slideB;b.vy-=ty*slideB;
      a.x+=tx*(equal?.22:weakerA?.34:.08);a.y+=ty*(equal?.22:weakerA?.34:.08);
      b.x-=tx*(equal?.22:weakerB?.34:.08);b.y-=ty*(equal?.22:weakerB?.34:.08);
    }
    contacts.push({a,b,edge,headOn});
  }
  return contacts;
}
