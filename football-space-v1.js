const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function axisValue(point,attackDirection){return (Number(point?.x)||0)*(attackDirection>=0?1:-1);}
function lateralValue(point){return Number(point?.y)||0;}

function median(values){const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;if(!n)return 0;const mid=Math.floor(n/2);return n%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;}

export function identifyDefensiveLines(defenders,{attackDirection=1,maxDepthGap=46,minLineSize=2,lateralPadding=18}={}){
  const dir=attackDirection>=0?1:-1;
  const valid=(defenders||[]).filter(p=>Number.isFinite(Number(p?.x))&&Number.isFinite(Number(p?.y)));
  const ordered=[...valid].sort((a,b)=>axisValue(a,dir)-axisValue(b,dir));
  const clusters=[];
  for(const defender of ordered){
    const depth=axisValue(defender,dir),last=clusters[clusters.length-1];
    if(!last||Math.abs(depth-last.anchorDepth)>maxDepthGap){clusters.push({members:[defender],depths:[depth],anchorDepth:depth});continue;}
    last.members.push(defender);last.depths.push(depth);last.anchorDepth=median(last.depths);
  }
  return clusters.filter(c=>c.members.length>=minLineSize).map((cluster,index)=>{
    const ys=cluster.members.map(lateralValue),depth=median(cluster.depths),minY=Math.min(...ys)-lateralPadding,maxY=Math.max(...ys)+lateralPadding;
    return{id:`line-${index+1}`,depth,x:depth*dir,minY,maxY,width:maxY-minY,memberCount:cluster.members.length,members:[...cluster.members]};
  });
}

export function evaluateLineBreak(from,to,defenders,{attackDirection=1,maxDepthGap=46,minLineSize=2,lateralPadding=18,minProgress=1}={}){
  const dir=attackDirection>=0?1:-1,fromDepth=axisValue(from,dir),toDepth=axisValue(to,dir),progress=toDepth-fromDepth;
  const lines=identifyDefensiveLines(defenders,{attackDirection:dir,maxDepthGap,minLineSize,lateralPadding});
  if(progress<minProgress)return{isLineBreak:false,progress,crossedLines:[],lineCount:lines.length};
  const crossedLines=[];
  for(const line of lines){
    if(!(fromDepth<line.depth&&toDepth>line.depth))continue;
    const t=clamp((line.depth-fromDepth)/Math.max(progress,1e-9),0,1),crossY=lateralValue(from)+(lateralValue(to)-lateralValue(from))*t;
    if(crossY<line.minY||crossY>line.maxY)continue;
    crossedLines.push({...line,crossY,segmentT:t});
  }
  return{isLineBreak:crossedLines.length>0,progress,crossedLines,lineCount:lines.length};
}

export function lineBreakValue(from,to,defenders,options={}){
  const result=evaluateLineBreak(from,to,defenders,options);
  if(!result.isLineBreak)return 0;
  const depthGain=Math.min(1.5,Math.max(0,result.progress)/120);
  return Number((result.crossedLines.length*(1+depthGain)).toFixed(3));
}
