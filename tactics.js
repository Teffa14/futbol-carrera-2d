export const DEFAULT_FIELD={left:55,right:1045,top:45,bottom:655};

export const PHASES={
  BUILD_UP:'build-up',
  PROGRESSION:'progression',
  FINAL_THIRD:'final-third',
  BOX_ATTACK:'box-attack',
  ATTACKING_TRANSITION:'attacking-transition',
  DEFENSIVE_TRANSITION:'defensive-transition',
  OUT_OF_POSSESSION:'out-of-possession',
};

export const LANES=['wide-left','left-half-space','centre','right-half-space','wide-right'];

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const readPath=(obj,path)=>String(path).split('.').reduce((v,k)=>v==null?undefined:v[k],obj);

export function attackProgress(point,team,field=DEFAULT_FIELD){
  const raw=clamp((point.x-field.left)/(field.right-field.left),0,1);
  return team===0?raw:1-raw;
}

export function pitchLane(point,field=DEFAULT_FIELD){
  const y=clamp((point.y-field.top)/(field.bottom-field.top),0,1);
  const index=Math.min(4,Math.floor(y*5));
  return LANES[index];
}

export function attackingLane(point,team,field=DEFAULT_FIELD){
  if(team===0)return pitchLane(point,field);
  const mirrored={x:point.x,y:field.top+field.bottom-point.y};
  return pitchLane(mirrored,field);
}

export function thirdFor(point,team,field=DEFAULT_FIELD){
  const p=attackProgress(point,team,field);
  if(p<.33)return'first-third';
  if(p<.67)return'middle-third';
  return'final-third';
}

export function detectTeamPhase({team,ball,ownerTeam,previousOwnerTeam=null,secondsSinceChange=99,field=DEFAULT_FIELD}){
  const progress=attackProgress(ball,team,field);
  if(ownerTeam===team){
    if(previousOwnerTeam!==team&&secondsSinceChange<=3&&progress>=.38)return PHASES.ATTACKING_TRANSITION;
    if(progress<.30)return PHASES.BUILD_UP;
    if(progress<.66)return PHASES.PROGRESSION;
    if(progress<.84)return PHASES.FINAL_THIRD;
    return PHASES.BOX_ATTACK;
  }
  if(previousOwnerTeam===team&&secondsSinceChange<=3)return PHASES.DEFENSIVE_TRANSITION;
  return PHASES.OUT_OF_POSSESSION;
}

export function conditionMatches(condition,context){
  const actual=readPath(context,condition.path);
  const expected=condition.value;
  switch(condition.op||'eq'){
    case'eq':return actual===expected;
    case'neq':return actual!==expected;
    case'gt':return actual>expected;
    case'gte':return actual>=expected;
    case'lt':return actual<expected;
    case'lte':return actual<=expected;
    case'in':return Array.isArray(expected)&&expected.includes(actual);
    case'truthy':return Boolean(actual);
    case'falsy':return!actual;
    default:return false;
  }
}

export function conditionsMatch(conditions=[],context={}){
  return conditions.every(c=>conditionMatches(c,context));
}

export function evaluateRule(rule,context){
  if(!conditionsMatch(rule.when||[],context))return null;
  if((rule.unless||[]).some(c=>conditionMatches(c,context)))return null;
  return{id:rule.id,priority:rule.priority??50,action:rule.action,until:rule.until||null,reason:rule.reason||''};
}

export function resolvePersonalPlaybook(rules,context){
  return rules.map(r=>evaluateRule(r,context)).filter(Boolean).sort((a,b)=>b.priority-a.priority)[0]||null;
}

export function resolvePatternBranch(pattern,context){
  if(!conditionsMatch(pattern.trigger||[],context))return null;
  if((pattern.abort||[]).some(c=>conditionMatches(c,context)))return{patternId:pattern.id,aborted:true,action:pattern.abortAction||'recover-structure'};
  const branch=(pattern.branches||[]).find(b=>conditionsMatch(b.when||[],context));
  return{patternId:pattern.id,aborted:false,branchId:branch?.id||'primary',action:branch?.action||pattern.primaryAction,participants:pattern.participants||[],principle:pattern.principle};
}

export function detectPressingTriggers(context){
  const found=[];
  if(context.backpass)found.push({id:'backpass',weight:80});
  if((context.receiverTouchError??0)>=.6)found.push({id:'bad-touch',weight:90});
  if(context.receiverFacingOwnGoal)found.push({id:'facing-own-goal',weight:75});
  if(context.passSpeed!=null&&context.passSpeed<.45&&Math.abs(context.passProgressDelta??1)<.06)found.push({id:'slow-horizontal-pass',weight:65});
  if(['wide-left','wide-right'].includes(context.receiverLane)&&Number(context.receiverSupportOptions??99)<=1)found.push({id:'touchline-isolation',weight:85});
  return found.sort((a,b)=>b.weight-a.weight);
}

export const PERSONAL_RULE_EXAMPLES=[
  {id:'winger-hold-width',priority:70,when:[{path:'phase',op:'in',value:[PHASES.BUILD_UP,PHASES.PROGRESSION]},{path:'sameFlankAsBall',op:'truthy'}],unless:[{path:'fullbackOverlapping',op:'truthy'}],action:'hold-maximum-width',reason:'Fix the opposing fullback and preserve the outside lane.'},
  {id:'winger-attack-depth',priority:90,when:[{path:'opponentFullbackSteps',op:'truthy'},{path:'spaceBehind',op:'gte',value:.55}],action:'attack-space-behind-fullback',reason:'Exploit the defender stepping toward the ball.'},
  {id:'receive-and-set',priority:80,when:[{path:'receivingBackToGoal',op:'truthy'},{path:'pressure',op:'gte',value:.55}],action:'set-first-time-to-support',reason:'Use a third player instead of turning into pressure.'},
];

export const PATTERN_TEMPLATES={
  'third-man':{
    id:'third-man',principle:'Use an intermediate receiver to free a third player beyond the pressure line.',participants:['source','set-player','third-player'],
    trigger:[{path:'phase',op:'in',value:[PHASES.PROGRESSION,PHASES.FINAL_THIRD]},{path:'setPlayerAvailable',op:'truthy'},{path:'thirdPlayerAvailable',op:'truthy'}],
    primaryAction:'source-to-set-then-third-player',
    branches:[
      {id:'marker-follows-third',when:[{path:'thirdPlayerMarkerFollows',op:'truthy'}],action:'set-player-lays-off-and-ball-carrier-drives-free-space'},
      {id:'set-player-can-turn',when:[{path:'setPlayerCanTurn',op:'truthy'}],action:'set-player-turns-through-line'},
    ],
    abort:[{path:'possessionLost',op:'truthy'}],abortAction:'nearest-three-counterpress-rest-defence-protect-centre',
  },
  'up-back-through':{
    id:'up-back-through',principle:'Play vertically into a set player, bounce backward, then attack beyond the line.',participants:['vertical-source','set-player','facing-player','runner'],
    trigger:[{path:'phase',op:'eq',value:PHASES.PROGRESSION},{path:'setPlayerBackToGoal',op:'truthy'},{path:'runnerHasDepthLane',op:'truthy'}],
    primaryAction:'vertical-set-back-through',
    branches:[
      {id:'depth-covered',when:[{path:'depthCovered',op:'truthy'}],action:'runner-checks-short-facing-player-carries'},
      {id:'centre-steps',when:[{path:'centreBackStepsOut',op:'truthy'}],action:'runner-attacks-centre-back-fullback-gap'},
    ],
    abort:[{path:'setPlayerIsolated',op:'falsy'}],abortAction:'secure-possession',
  },
  overlap:{
    id:'overlap',principle:'Outside runner creates a two-versus-one and forces the fullback to choose.',participants:['wide-ball-carrier','outside-runner','inside-support'],
    trigger:[{path:'ballCarrierWide',op:'truthy'},{path:'outsideRunnerAvailable',op:'truthy'}],
    primaryAction:'outside-runner-overlaps-ball-carrier-holds-defender',
    branches:[
      {id:'fullback-holds-carrier',when:[{path:'fullbackTracksRunner',op:'falsy'}],action:'release-overlap'},
      {id:'fullback-follows-runner',when:[{path:'fullbackTracksRunner',op:'truthy'}],action:'ball-carrier-drives-inside'},
      {id:'cover-midfielder-shifts',when:[{path:'coverMidfielderShiftsWide',op:'truthy'}],action:'find-inside-support'},
    ],
    abort:[{path:'possessionLost',op:'truthy'}],abortAction:'counterpress-or-recover',
  },
  underlap:{
    id:'underlap',principle:'Keep the winger wide while an interior runner attacks the channel inside the fullback.',participants:['wide-ball-carrier','inside-runner','balance-player'],
    trigger:[{path:'ballCarrierWide',op:'truthy'},{path:'insideChannelOpen',op:'truthy'}],
    primaryAction:'inside-runner-attacks-fullback-centre-back-gap',
    branches:[
      {id:'fullback-narrows',when:[{path:'fullbackTracksInsideRunner',op:'truthy'}],action:'isolate-wide-ball-carrier-one-versus-one'},
      {id:'fullback-holds-width',when:[{path:'fullbackTracksInsideRunner',op:'falsy'}],action:'play-underlap-runner'},
    ],
    abort:[{path:'insideChannelOpen',op:'falsy'}],abortAction:'recycle-and-restore-lanes',
  },
  'overload-to-isolate':{
    id:'overload-to-isolate',principle:'Create local superiority on the strong side to move the block, then switch to an isolated weak-side attacker.',participants:['strong-side-triangle','pivot','switch-player','weak-side-winger'],
    trigger:[{path:'strongSideOverload',op:'truthy'},{path:'weakSideWingerHoldingWidth',op:'truthy'}],
    primaryAction:'circulate-within-overload-to-attract-block',
    branches:[
      {id:'block-shifted',when:[{path:'opponentHorizontalShift',op:'gte',value:.65},{path:'weakSideIsolation',op:'gte',value:.6}],action:'switch-immediately-to-weak-side-winger'},
      {id:'central-lane-opens',when:[{path:'centralLaneOpen',op:'truthy'}],action:'break-central-line-before-switch'},
    ],
    abort:[{path:'restDefenceReady',op:'falsy'}],abortAction:'secure-behind-ball-before-risky-switch',
  },
  'wide-press-trap':{
    id:'wide-press-trap',principle:'Protect the centre, invite the pass toward the touchline, then collapse around the isolated receiver.',participants:['first-presser','winger','near-eight','fullback','six'],
    trigger:[{path:'teamOutOfPossession',op:'truthy'},{path:'pressTrigger',op:'in',value:['backpass','bad-touch','facing-own-goal','touchline-isolation','slow-horizontal-pass']}],
    primaryAction:'curve-press-to-block-inside-and-lock-touchline',
    branches:[
      {id:'inside-pass-blocked',when:[{path:'insideLaneClosed',op:'truthy'}],action:'fullback-jumps-eight-covers-half-space-six-protects-centre'},
      {id:'first-line-broken',when:[{path:'firstPressLineBroken',op:'truthy'}],action:'abort-press-recover-mid-block'},
    ],
    abort:[{path:'firstPressLineBroken',op:'truthy'}],abortAction:'recover-mid-block',
  },
};

export const REST_DEFENCE_PRESETS={
  '3+2':{backLine:3,screenLine:2,principles:['protect-centre','control-opposition-outlets','attack-second-ball','delay-counter']},
  '2+3':{backLine:2,screenLine:3,principles:['protect-centre','counterpress-access','cover-both-half-spaces','attack-second-ball']},
};
