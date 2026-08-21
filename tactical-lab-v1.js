import {PHASES,conditionsMatch,resolvePatternBranch} from './tactics.js';

const TEAM_PHASES=new Set(Object.values(PHASES));
const RULE_KINDS=new Set(['shape','role','zone','press','transition','pattern','set-piece','substitution']);
const AUTHORITY={campaign:new Set(['role','zone','pattern']),competitive:RULE_KINDS};

const clone=value=>JSON.parse(JSON.stringify(value));
const normalizePriority=value=>Math.max(0,Math.min(100,Math.round(Number(value)||50)));

function validateCondition(condition,path){
  if(!condition||typeof condition!=='object')return`${path} must be an object`;
  if(!condition.path)return`${path}.path is required`;
  return null;
}

function validateRule(rule,index,mode){
  const errors=[];
  const at=`rules[${index}]`;
  if(!rule?.id)errors.push(`${at}.id is required`);
  if(!RULE_KINDS.has(rule?.kind))errors.push(`${at}.kind is invalid`);
  if(rule?.phase&&!TEAM_PHASES.has(rule.phase))errors.push(`${at}.phase is invalid`);
  if(rule?.kind&&!AUTHORITY[mode]?.has(rule.kind))errors.push(`${at}.kind is not available in ${mode}`);
  for(const [key,list] of [['when',rule?.when],['unless',rule?.unless],['abort',rule?.abort]]){
    if(list!=null&&!Array.isArray(list))errors.push(`${at}.${key} must be an array`);
    if(Array.isArray(list))list.forEach((condition,i)=>{const error=validateCondition(condition,`${at}.${key}[${i}]`);if(error)errors.push(error);});
  }
  if(rule?.kind==='pattern'){
    if(!rule.pattern?.id)errors.push(`${at}.pattern.id is required`);
    if(!rule.pattern?.primaryAction)errors.push(`${at}.pattern.primaryAction is required`);
    if(!Array.isArray(rule.pattern?.abort)||rule.pattern.abort.length===0)errors.push(`${at}.pattern.abort requires at least one abort condition`);
  }else if(!rule?.action){
    errors.push(`${at}.action is required`);
  }
  return errors;
}

export function validateTacticalPlan(plan){
  const errors=[];
  if(!plan||typeof plan!=='object')return{valid:false,errors:['plan must be an object']};
  const mode=plan.mode||'competitive';
  if(!AUTHORITY[mode])errors.push('mode must be campaign or competitive');
  if(!Array.isArray(plan.rules))errors.push('rules must be an array');
  const ids=new Set();
  for(const [index,rule] of (plan.rules||[]).entries()){
    errors.push(...validateRule(rule,index,mode));
    if(rule?.id){if(ids.has(rule.id))errors.push(`duplicate rule id: ${rule.id}`);ids.add(rule.id);}
  }
  return{valid:errors.length===0,errors};
}

export function createTacticalPlan({id='tactical-plan',name='Tactical Plan',mode='competitive',baseFormation='4-3-3',rules=[]}={}){
  const plan={version:1,id:String(id),name:String(name),mode,baseFormation:String(baseFormation),rules:clone(rules)};
  const validation=validateTacticalPlan(plan);
  if(!validation.valid)throw new Error(validation.errors.join('; '));
  return plan;
}

function ruleMatches(rule,context){
  if(rule.phase&&rule.phase!==context.phase)return false;
  if(!conditionsMatch(rule.when||[],context))return false;
  if((rule.unless||[]).some(condition=>conditionsMatch([condition],context)))return false;
  return true;
}

export function resolveTacticalPlan(plan,context={}){
  const validation=validateTacticalPlan(plan);
  if(!validation.valid)return{ok:false,errors:validation.errors,instructions:[]};
  const instructions=[];
  for(const rule of plan.rules){
    if(!ruleMatches(rule,context))continue;
    if(rule.kind==='pattern'){
      const resolved=resolvePatternBranch(rule.pattern,context);
      if(!resolved)continue;
      instructions.push({ruleId:rule.id,kind:rule.kind,priority:normalizePriority(rule.priority),...resolved});
      continue;
    }
    const aborted=Array.isArray(rule.abort)&&rule.abort.some(condition=>conditionsMatch([condition],context));
    instructions.push({
      ruleId:rule.id,
      kind:rule.kind,
      priority:normalizePriority(rule.priority),
      action:aborted?(rule.abortAction||'recover-structure'):rule.action,
      aborted,
      target:clone(rule.target||null),
      until:clone(rule.until||null),
    });
  }
  instructions.sort((a,b)=>b.priority-a.priority||a.ruleId.localeCompare(b.ruleId));
  return{ok:true,instructions};
}

export function phaseRules(plan,phase){
  if(!TEAM_PHASES.has(phase))return[];
  return(plan?.rules||[]).filter(rule=>!rule.phase||rule.phase===phase).map(clone);
}

export function tacticalLabCapabilities(mode='competitive'){
  return[...(AUTHORITY[mode]||new Set())];
}

export const TACTICAL_LAB_TEMPLATES={
  'overlap-branch':{
    id:'overlap-branch',kind:'pattern',phase:PHASES.PROGRESSION,priority:75,
    when:[{path:'ballCarrierWide',op:'truthy'}],
    pattern:{
      id:'lab-overlap',principle:'Create a two-versus-one outside without forcing a fixed pass sequence.',participants:['wide-ball-carrier','outside-runner','inside-support'],
      trigger:[{path:'ballCarrierWide',op:'truthy'},{path:'outsideRunnerAvailable',op:'truthy'}],
      primaryAction:'outside-runner-overlaps-ball-carrier-holds-defender',
      branches:[
        {id:'runner-free',when:[{path:'fullbackTracksRunner',op:'falsy'}],action:'release-overlap'},
        {id:'runner-tracked',when:[{path:'fullbackTracksRunner',op:'truthy'}],action:'ball-carrier-drives-inside'},
      ],
      abort:[{path:'possessionLost',op:'truthy'},{path:'outsideRunnerAvailable',op:'falsy'}],
      abortAction:'recover-structure',
    },
  },
  'bad-touch-press':{
    id:'bad-touch-press',kind:'press',phase:PHASES.OUT_OF_POSSESSION,priority:85,
    when:[{path:'receiverTouchError',op:'gte',value:.6}],
    unless:[{path:'restDefenceReady',op:'falsy'}],
    action:'nearest-access-player-presses-support-covers-centre',
    abort:[{path:'firstPressLineBroken',op:'truthy'}],abortAction:'recover-mid-block',
  },
};
