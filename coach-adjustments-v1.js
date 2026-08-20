import {MatchEngine} from './engine.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const FIELD={left:55,right:1045};
function shiftLine(engine,team,amount){const dir=team===0?1:-1;for(const p of engine.players){if(p.team!==team||p.role==='GK')continue;const roleFactor=['ST','LW','RW'].includes(p.role)?1:['CAM','CM'].includes(p.role)?.82:['CDM','LB','RB'].includes(p.role)?.55:.32;p.homeX=clamp(p.homeX+dir*amount*roleFactor,FIELD.left+p.r+8,FIELD.right-p.r-8);}}
function adjust(engine,team,kind,minute){const t=engine.tactics[team],name=engine.names[team];if(kind==='chase'){t.tempo=clamp(t.tempo+11,25,92);t.directness=clamp(t.directness+13,20,92);t.pressing=clamp(t.pressing+10,20,94);t.width=clamp(t.width+5,25,88);shiftLine(engine,team,34);engine.pushEvent(`${name}: el DT adelanta líneas y pide atacar más rápido`,team,'coach');}
else if(kind==='control'){t.tempo=clamp(t.tempo-9,25,90);t.directness=clamp(t.directness-7,20,90);t.pressing=clamp(t.pressing-5,20,90);t.width=clamp(t.width-6,25,90);shiftLine(engine,team,-18);engine.pushEvent(`${name}: el DT pide juntar líneas y controlar el ritmo`,team,'coach');}
else if(kind==='unlock'){t.tempo=clamp(t.tempo+7,25,90);t.width=clamp(t.width+10,25,92);t.directness=clamp(t.directness+5,20,90);shiftLine(engine,team,18);engine.pushEvent(`${name}: ajuste táctico para abrir la cancha y generar el hombre libre`,team,'coach');}
engine.coachChanges??=[];engine.coachChanges.push({minute,team,kind,tactics:{...t}});}
function checkpoint(engine,minute){engine._coachCheckpoints??=new Set();if(engine._coachCheckpoints.has(minute)||engine.minute<minute)return;engine._coachCheckpoints.add(minute);const diff=engine.score[0]-engine.score[1],shots=(engine.stats.shots?.[0]||0)+(engine.stats.shots?.[1]||0);
for(const team of [0,1]){const td=team===0?diff:-diff;if(minute>=72&&td<0)adjust(engine,team,'chase',minute);else if(minute>=72&&td>0)adjust(engine,team,'control',minute);else if(minute>=58&&td<0)adjust(engine,team,'chase',minute);else if(minute>=58&&td===0&&shots<5)adjust(engine,team,'unlock',minute);else if(minute>=30&&td===0&&shots<2)adjust(engine,team,'unlock',minute);}}
const originalStep=MatchEngine.prototype.step;
MatchEngine.prototype.step=function coachAwareStep(dt){const result=originalStep.call(this,dt);if(!this.finished){checkpoint(this,30);checkpoint(this,58);checkpoint(this,72);}return result;};
