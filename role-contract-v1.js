import {PHASES} from './tactics.js';
import {authorityPermissions} from './career-authority-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const FAMILY_BY_ROLE={
  GK:'keeper',CB:'centre-back',LB:'fullback',RB:'fullback',LWB:'fullback',RWB:'fullback',
  CDM:'midfielder',CM:'midfielder',CAM:'midfielder',LM:'winger',RM:'winger',LW:'winger',RW:'winger',ST:'striker',
};

const BASE_FREEDOM={keeper:18,'centre-back':24,fullback:38,midfielder:48,winger:62,striker:54};

const COMMON_TRANSITION={
  [PHASES.ATTACKING_TRANSITION]:[{id:'transition-support',action:'support-fastest-progressive-option',priority:72}],
  [PHASES.DEFENSIVE_TRANSITION]:[{id:'transition-reaction',action:'protect-centre-or-counterpress-by-distance',priority:92}],
};

const TEMPLATES={
  keeper:{
    [PHASES.BUILD_UP]:[{id:'gk-support',action:'offer-safe-reset-angle',priority:88}],
    [PHASES.PROGRESSION]:[{id:'gk-balance',action:'hold-sweeper-support-depth',priority:74}],
    [PHASES.OUT_OF_POSSESSION]:[{id:'gk-line',action:'protect-goal-and-sweep-behind-line',priority:95}],
  },
  'centre-back':{
    [PHASES.BUILD_UP]:[{id:'cb-spacing',action:'create-first-line-passing-angle',priority:92},{id:'cb-security',action:'protect-central-rest-defence',priority:86}],
    [PHASES.PROGRESSION]:[{id:'cb-support',action:'stay-behind-ball-as-secure-recycle',priority:84}],
    [PHASES.FINAL_THIRD]:[{id:'cb-rest-defence',action:'control-opposition-outlet-and-second-ball',priority:94}],
    [PHASES.OUT_OF_POSSESSION]:[{id:'cb-line',action:'protect-depth-and-maintain-defensive-line',priority:96}],
  },
  fullback:{
    [PHASES.BUILD_UP]:[{id:'fb-build-width',action:'provide-outside-build-up-angle',priority:84}],
    [PHASES.PROGRESSION]:[{id:'fb-support-lane',action:'support-winger-with-overlap-or-underlap-lane',priority:82}],
    [PHASES.FINAL_THIRD]:[{id:'fb-balance',action:'join-attack-only-if-rest-defence-remains-covered',priority:88}],
    [PHASES.OUT_OF_POSSESSION]:[{id:'fb-defend-channel',action:'protect-wide-channel-and-back-post',priority:94}],
  },
  midfielder:{
    [PHASES.BUILD_UP]:[{id:'mid-show',action:'show-between-first-pressure-lines',priority:88},{id:'mid-scan',action:'receive-profiled-after-scan',priority:86}],
    [PHASES.PROGRESSION]:[{id:'mid-line-break',action:'seek-line-break-or-third-man-support',priority:90}],
    [PHASES.FINAL_THIRD]:[{id:'mid-balance',action:'occupy-free-interior-lane-with-rest-defence-awareness',priority:82}],
    [PHASES.OUT_OF_POSSESSION]:[{id:'mid-screen',action:'screen-centre-and-track-runner-through-zone',priority:92}],
  },
  winger:{
    [PHASES.BUILD_UP]:[{id:'wing-hold-width',action:'hold-width-to-stretch-first-block',priority:88}],
    [PHASES.PROGRESSION]:[{id:'wing-isolate',action:'hold-width-until-isolation-or-combination-trigger',priority:90}],
    [PHASES.FINAL_THIRD]:[{id:'wing-final-third',action:'attack-fullback-or-combine-based-on-cover',priority:92}],
    [PHASES.BOX_ATTACK]:[{id:'wing-box',action:'attack-far-post-or-cutback-zone-by-ball-side',priority:90}],
    [PHASES.OUT_OF_POSSESSION]:[{id:'wing-recover',action:'recover-to-wide-midfield-line-and-screen-fullback',priority:90}],
  },
  striker:{
    [PHASES.BUILD_UP]:[{id:'st-pin',action:'pin-centre-backs-and-preserve-depth',priority:86}],
    [PHASES.PROGRESSION]:[{id:'st-link-depth',action:'alternate-set-support-with-depth-run',priority:90}],
    [PHASES.FINAL_THIRD]:[{id:'st-box-entry',action:'attack-centre-back-blindside-and-box-lane',priority:94}],
    [PHASES.BOX_ATTACK]:[{id:'st-finish',action:'occupy-high-value-finishing-lane',priority:98}],
    [PHASES.OUT_OF_POSSESSION]:[{id:'st-press',action:'screen-central-exit-and-press-trigger-source',priority:88}],
  },
};

function cloneRules(rules=[]){return rules.map(rule=>({...rule}));}
function addRule(map,phase,rule){(map[phase]??=[]).push(rule);}

export function roleFamily(role){return FAMILY_BY_ROLE[role]||'midfielder';}

export function createRoleContract({role='CM',tactics={},trust=0,influence=0}={}){
  const family=roleFamily(role),responsibilities={};
  for(const [phase,rules] of Object.entries({...TEMPLATES[family],...COMMON_TRANSITION}))responsibilities[phase]=cloneRules(rules);

  if(family==='winger'&&(tactics.width??50)>=60){
    addRule(responsibilities,PHASES.PROGRESSION,{id:'coach-max-width',action:'stay-wide-until-opponent-fullback-commits',priority:95,source:'coach'});
  }
  if(family==='fullback'&&(tactics.width??50)>=62){
    addRule(responsibilities,PHASES.PROGRESSION,{id:'coach-overlap-access',action:'provide-outside-overlap-when-winger-moves-inside',priority:91,source:'coach'});
  }
  if(family==='striker'&&(tactics.directness??50)>=64){
    addRule(responsibilities,PHASES.PROGRESSION,{id:'coach-direct-depth',action:'threaten-depth-as-direct-pass-window-opens',priority:96,source:'coach'});
  }
  if((tactics.pressing??50)>=65&&family!=='keeper'){
    addRule(responsibilities,PHASES.OUT_OF_POSSESSION,{id:'coach-high-press',action:'jump-on-valid-press-trigger-with-cover-shadow',priority:97,source:'coach'});
  }
  if((tactics.directness??50)<=42&&['midfielder','centre-back'].includes(family)){
    addRule(responsibilities,PHASES.BUILD_UP,{id:'coach-patient-build',action:'prefer-supported-progression-over-forced-direct-ball',priority:94,source:'coach'});
  }

  const permissions=authorityPermissions({coachTrust:trust,tacticalInfluence:influence});
  const authority=permissions.tacticalFreedom;
  const creativeFreedom=clamp(Math.round((BASE_FREEDOM[family]??45)+authority*.22),10,88);
  const roleDiscipline=clamp(Math.round(100-creativeFreedom*.55),48,94);

  return{
    version:1,
    role,
    family,
    coachModel:{
      pressing:tactics.pressing??50,
      width:tactics.width??50,
      directness:tactics.directness??50,
      tempo:tactics.tempo??50,
    },
    authority:{trust:permissions.coachTrust,influence:permissions.tacticalInfluence,permissions},
    creativeFreedom,
    roleDiscipline,
    responsibilities,
  };
}

export function responsibilitiesForPhase(contract,phase){
  return cloneRules(contract?.responsibilities?.[phase]||[]).sort((a,b)=>(b.priority??0)-(a.priority??0));
}

export function primaryResponsibility(contract,phase){
  return responsibilitiesForPhase(contract,phase)[0]||null;
}
