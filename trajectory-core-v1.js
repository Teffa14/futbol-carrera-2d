export const TRAJECTORY_FIELD={left:55,right:1045,top:45,bottom:655,goalTop:295,goalBottom:405,goalDepth:46};
export const TRAJECTORY_PHYSICS={ballDamping:.993,ballBounce:.64,gravity:.026,aerialBounce:.22};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0));

export function predictBallPath(ball,options={}){
  const field=options.field||TRAJECTORY_FIELD,physics={...TRAJECTORY_PHYSICS,...(options.physics||{})},sampleEvery=Math.max(1,Math.round(options.sampleEvery||3)),horizonFrames=Math.max(sampleEvery,Math.round(options.horizonFrames||150));
  const r=Number(ball?.r??4.35);let x=Number(ball?.x||0),y=Number(ball?.y||0),vx=Number(ball?.vx||0),vy=Number(ball?.vy||0),z=Math.max(0,Number(ball?.z||0)),vz=Number(ball?.vz||0);
  const path=[{frame:0,x,y,z,vx,vy,vz,bounce:false}];
  for(let frame=1;frame<=horizonFrames;frame++){
    vx*=physics.ballDamping;vy*=physics.ballDamping;x+=vx;y+=vy;let bounce=false;
    if(z>0||vz!==0){vz-=physics.gravity;z+=vz;if(z<=0){z=0;if(Math.abs(vz)>.18)vz=-vz*physics.aerialBounce;else vz=0;}}
    if(y-r<field.top){y=field.top+r;vy=Math.abs(vy)*physics.ballBounce;bounce=true;}
    if(y+r>field.bottom){y=field.bottom-r;vy=-Math.abs(vy)*physics.ballBounce;bounce=true;}
    const mouth=y>field.goalTop&&y<field.goalBottom;
    if(!mouth&&x-r<field.left){x=field.left+r;vx=Math.abs(vx)*physics.ballBounce;bounce=true;}
    if(!mouth&&x+r>field.right){x=field.right-r;vx=-Math.abs(vx)*physics.ballBounce;bounce=true;}
    if(mouth&&x<field.left-field.goalDepth){x=field.left-field.goalDepth;vx=Math.abs(vx)*.45;bounce=true;}
    if(mouth&&x>field.right+field.goalDepth){x=field.right+field.goalDepth;vx=-Math.abs(vx)*.45;bounce=true;}
    if(frame%sampleEvery===0||bounce||frame===horizonFrames)path.push({frame,x,y,z,vx,vy,vz,bounce});
    if(Math.hypot(vx,vy)<.035&&z===0&&Math.abs(vz)<.02&&frame>24){if(path.at(-1)?.frame!==frame)path.push({frame,x,y,z,vx,vy,vz,bounce});break;}
  }
  return path;
}

export function reactionFramesFromProfile(profile={},memoryBonus=0){
  const reaction=clamp(Number(profile.reaction??65)+Number(memoryBonus||0),20,105);
  return clamp(13-(reaction-35)*.115,3,13);
}

export function estimateArrivalFrames(player,target,profile={},options={}){
  const d=dist(player,target),speed=Math.hypot(Number(player?.vx||0),Number(player?.vy||0)),sprint=clamp(Number(profile.sprintSpeed??player?.data?.pace??player?.pace??70),25,100),accel=clamp(Number(profile.acceleration??sprint),25,100),maxSpeed=.85+sprint*.025,acceleration=.035+accel*.00215;
  const reaction=Math.max(0,Number(options.reactionFrames??reactionFramesFromProfile(profile,options.memoryBonus||0)));
  if(d<1)return reaction;
  const current=Math.min(maxSpeed,speed),toMax=Math.max(0,(maxSpeed-current)/acceleration),distanceToMax=current*toMax+.5*acceleration*toMax*toMax;
  let travel;if(distanceToMax>=d){travel=(-current+Math.sqrt(Math.max(0,current*current+2*acceleration*d)))/acceleration;}else travel=toMax+(d-distanceToMax)/Math.max(.6,maxSpeed);
  return reaction+travel;
}

export function bestReachableTrajectoryPoint(player,path,profile={},options={}){
  const minFrame=Math.max(0,Number(options.minFrame||0)),maxFrame=Number(options.maxFrame||Infinity),contactHeight=Number(options.contactHeight??7.5),slack=Number(options.slackFrames??2.5),memoryBonus=Number(options.memoryBonus||0);
  let best=null;
  for(const point of path||[]){if(point.frame<minFrame||point.frame>maxFrame||Number(point.z||0)>contactHeight)continue;const arrival=estimateArrivalFrames(player,point,profile,{memoryBonus});const margin=point.frame-arrival;if(margin<-slack)continue;const candidate={...point,arrivalFrames:arrival,margin,distance:dist(player,point)};if(!best||candidate.frame<best.frame-1||(Math.abs(candidate.frame-best.frame)<=1&&candidate.margin>best.margin))best=candidate;}
  return best;
}

export function pathPointNearX(path,x,direction=1){
  let best=null,bestDelta=Infinity;for(const p of path||[]){if(direction>0&&p.vx<-.15)continue;if(direction<0&&p.vx>.15)continue;const d=Math.abs(p.x-x);if(d<bestDelta){best=p;bestDelta=d;}}return best;
}

export function ballTravelDirection(ball){const speed=Math.hypot(Number(ball?.vx||0),Number(ball?.vy||0));if(speed<.05)return{x:0,y:0,speed};return{x:Number(ball.vx)/speed,y:Number(ball.vy)/speed,speed};}

export const __trajectoryCoreTest={clamp,dist};
