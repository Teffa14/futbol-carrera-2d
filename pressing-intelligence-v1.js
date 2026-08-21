import {MatchEngine} from './engine.js';
import {estimateArrivalTime} from './dynamic-space-control-v1.js';

const FIELD={left:55,right:1045,top:45,bottom:655};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function pressureTarget(ball,{horizon=.22}={}){
  const seconds=clamp(Number(horizon)||0,0,.65);
  const frames=seconds*60;
  return{
    x:clamp((Number(ball?.x)||0)+(Number(ball?.vx)||0)*frames,FIELD.left,FIELD.right),
    y:clamp((Number(ball?.y)||0)+(Number(ball?.vy)||0)*frames,FIELD.top,FIELD.bottom)
  };
}

export function rankPressers(players,ball,team,{limit=2,horizon=.22}={}){
  const target=pressureTarget(ball,{horizon});
  return (players||[])
    .filter(player=>player&&player.team===team&&player.role!=='GK')
    .map(player=>({
      player,
      target,
      arrivalTime:estimateArrivalTime(player,target),
      currentBallArrivalTime:estimateArrivalTime(player,ball)
    }))
    .sort((a,b)=>{
      const arrival=a.arrivalTime-b.arrivalTime;
      if(Math.abs(arrival)>.01)return arrival;
      const current=a.currentBallArrivalTime-b.currentBallArrivalTime;
      if(Math.abs(current)>.01)return current;
      return String(a.player.id||'').localeCompare(String(b.player.id||''));
    })
    .slice(0,Math.max(0,Number(limit)||0));
}

export function selectPressureAssignments(players,ball,team,options={}){
  return rankPressers(players,ball,team,options).map(entry=>entry.player.id);
}

const previousSelectPressers=MatchEngine.prototype.selectPressers;

MatchEngine.prototype.selectPressers=function dynamicArrivalPressers(team){
  const speed=Math.hypot(Number(this.ball?.vx)||0,Number(this.ball?.vy)||0);
  const horizon=clamp(.16+speed*.018,.16,.42);
  const ranked=selectPressureAssignments(this.players,this.ball,team,{limit:2,horizon});
  if(ranked.length)return ranked;
  return previousSelectPressers.call(this,team);
};
