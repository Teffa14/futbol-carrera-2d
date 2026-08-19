import {MatchEngine} from './engine.js';

const CLUB_SECONDARY={
  'river plate':'#111111','boca juniors':'#f7c600','independiente':'#f5f5f5','racing club':'#1b2f6b','san lorenzo':'#d71920','newell’s':'#111111','rosario central':'#173e76',
  'liverpool':'#f5f5f5','arsenal':'#f5f5f5','manchester united':'#111111','manchester city':'#f5f5f5','chelsea':'#f5f5f5','tottenham hotspur':'#111111',
  'real madrid':'#1b2f6b','fc barcelona':'#f0b323','atlético de madrid':'#1b2f6b','ac milan':'#f5f5f5','inter':'#f5f5f5','juventus':'#111111','napoli':'#f5f5f5',
  'bayern munich':'#f5f5f5','borussia dortmund':'#111111','paris saint-germain':'#f5f5f5','olympique de marseille':'#111111','flamengo':'#111111','palmeiras':'#f5f5f5',
  'sl benfica':'#f5f5f5','fc porto':'#f5f5f5','sporting cp':'#f5f5f5'
};

function parseHex(value){
  let s=String(value||'').trim().replace('#','');
  if(s.length===3)s=s.split('').map(c=>c+c).join('');
  if(!/^[0-9a-f]{6}$/i.test(s))return{r:128,g:128,b:128};
  return{r:parseInt(s.slice(0,2),16),g:parseInt(s.slice(2,4),16),b:parseInt(s.slice(4,6),16)};
}
function luminance(c){const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);}
export function colorDistance(a,b){const x=parseHex(a),y=parseHex(b);return Math.hypot(x.r-y.r,x.g-y.g,x.b-y.b);}
function genericSecondary(primary){
  const c=parseHex(primary),l=luminance(c),max=Math.max(c.r,c.g,c.b),min=Math.min(c.r,c.g,c.b);
  if(l>.72)return'#172033';
  if(l<.07)return'#f3f3f3';
  if(c.r>c.g*1.35&&c.r>c.b*1.25)return'#f3f3f3';
  if(c.b>c.r*1.22&&c.b>c.g*.92)return'#f3d21b';
  if(c.g>c.r*1.15&&c.g>c.b*.9)return'#f3f3f3';
  if(max-min<34)return l>.35?'#172033':'#f3f3f3';
  return l>.38?'#172033':'#f3f3f3';
}
export function secondaryFor(name,primary){return CLUB_SECONDARY[String(name||'').toLowerCase()]||genericSecondary(primary);}
export function resolveKitColors(homeName,awayName,homePrimary,awayPrimary){
  const home=homePrimary||'#d93030',away=awayPrimary||'#2d70dc';
  // Local always keeps its primary. Visitor changes only on a real clash.
  const clash=colorDistance(home,away)<118||Math.abs(luminance(parseHex(home))-luminance(parseHex(away)))<.055&&colorDistance(home,away)<155;
  if(!clash)return[home,away];
  let alternate=secondaryFor(awayName,away);
  if(colorDistance(home,alternate)<105)alternate=luminance(parseHex(home))>.35?'#111827':'#f8fafc';
  return[home,alternate];
}

const previousDraw=MatchEngine.prototype.draw;
MatchEngine.prototype.draw=function drawWithResolvedKits(ctx,width,height,options){
  if(!this._kitColorsResolved){this.colors=resolveKitColors(this.names?.[0],this.names?.[1],this.colors?.[0],this.colors?.[1]);this._kitColorsResolved=true;}
  return previousDraw.call(this,ctx,width,height,options);
};
