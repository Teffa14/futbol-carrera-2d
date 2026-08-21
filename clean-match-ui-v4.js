import {MatchEngine} from './engine.js';

export const CLEAN_MATCH_UI_CSS=`
body.matchday-v3-live .canvas-card{display:grid!important;grid-template-rows:minmax(0,1fr) 42px!important;align-items:stretch!important;justify-items:stretch!important;overflow:hidden!important}
body.matchday-v3-live #canvas{grid-row:1!important;align-self:center!important;justify-self:center!important;max-height:100%!important;max-width:100%!important}
body.matchday-v3-live .match-controls{position:static!important;grid-row:2!important;left:auto!important;right:auto!important;bottom:auto!important;width:100%!important;min-height:42px!important;padding:4px 7px!important;border:0!important;border-top:1px solid #405764!important;border-radius:0!important;background:#0b1820!important;backdrop-filter:none!important;box-sizing:border-box!important}
body.matchday-v3-live .match-controls .speed,body.matchday-v3-live .match-controls .btn{min-height:31px!important}
body.matchday-v3-live .hud{border-left:2px solid #76b4e3!important}
@media(max-width:1180px){body.matchday-v3-live .canvas-card{grid-template-rows:auto 42px!important}body.matchday-v3-live #canvas{width:100%!important;max-height:calc(100dvh - 190px)!important}}
`;

function install(){if(typeof document==='undefined'||document.querySelector('style[data-clean-match-ui-v4]'))return;const s=document.createElement('style');s.dataset.cleanMatchUiV4='1';s.textContent=CLEAN_MATCH_UI_CSS;document.head.appendChild(s);}
if(typeof document!=='undefined')install();

MatchEngine.prototype.drawMiniMap=function noPitchMiniMap(){};
MatchEngine.prototype.drawUserBadge=function staminaOutsidePitch(ctx,user,width,height){
  const available=Math.max(0,100-(user.fatigue||0)),stamina=Number(user.data?.stamina??user.data?.physical??70),x=70,y=Math.min(height-8,684),w=Math.min(245,width*.25),h=8;
  ctx.save();ctx.fillStyle='rgba(5,15,20,.92)';ctx.fillRect(x-8,y-21,w+16,24);ctx.fillStyle='#f3efe5';ctx.font='700 9px "Segoe UI",sans-serif';ctx.textAlign='left';ctx.fillText(`STAMINA ${Math.round(available)}% · ATR ${stamina}`,x,y-8);ctx.fillStyle='#263b47';ctx.fillRect(x,y-4,w,h);ctx.fillStyle=available>35?'#d7e86a':'#d6b264';ctx.fillRect(x,y-4,w*available/100,h);ctx.restore();
};

export const __cleanMatchUiV4={};
