import {observePlayerSpace} from './player-spatial-observation-v1.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function compare(actual,operator,expected){
  if(operator==='>')return actual>expected;
  if(operator==='>=')return actual>=expected;
  if(operator==='<')return actual<expected;
  if(operator==='<=')return actual<=expected;
  if(operator==='!=')return actual!==expected;
  return actual===expected;
}

function readCondition(observation,condition){
  if(!condition)return true;
  const source=condition.source||'spatial';
  let actual;
  if(source==='spatial')actual=condition.path?.split('.').reduce((value,key)=>value?.[key],observation);
  else if(source==='phase')actual=observation.phase;
  else return false;
  return compare(actual,condition.operator||'==',condition.value);
}

export function evaluateProgrammingRule({rule,observation}){
  if(!rule||!observation)return{matched:false,reason:'missing-input'};
  if(rule.when&&!readCondition(observation,rule.when))return{matched:false,reason:'when'};
  for(const condition of rule.if||[])if(!readCondition(observation,condition))return{matched:false,reason:'if'};
  for(const condition of rule.and||[])if(!readCondition(observation,condition))return{matched:false,reason:'and'};
  for(const condition of rule.unless||[])if(readCondition(observation,condition))return{matched:false,reason:'unless'};
  return{matched:true,reason:'matched',action:rule.then||null,until:rule.until||null,priority:Number(rule.priority||0)};
}

export function resolvePersonalProgramming({rules=[],observation,coachPriority=0,playerFreedom=0.5,risk=0}={}){
  const candidates=rules
    .map(rule=>({rule,result:evaluateProgrammingRule({rule,observation})}))
    .filter(entry=>entry.result.matched)
    .map(entry=>{
      const specificity=(entry.rule.if?.length||0)+(entry.rule.and?.length||0)+(entry.rule.unless?.length||0)+(entry.rule.when?1:0);
      const personal=Number(entry.rule.priority||0)+specificity*.1+clamp(playerFreedom,0,1)*.08-clamp(risk,0,1)*Number(entry.rule.riskSensitivity||0);
      const coach=Number(entry.rule.coachAligned?coachPriority:0);
      return{...entry.result,ruleId:entry.rule.id||null,score:personal+coach,specificity};
    })
    .sort((a,b)=>b.score-a.score||b.specificity-a.specificity);
  return candidates[0]||null;
}

export function spatialProgrammingObservation({player,ball,roleReference,pitch,attackDirection,phase}){
  return observePlayerSpace({player,ball,roleReference,pitch,attackDirection,phase});
}

export function createMovementProgrammingIntent(program,observation){
  if(!program?.action)return null;
  const action=program.action;
  if(action.type!=='move-relative')return{...action,programRuleId:program.ruleId};
  const base=observation.attack;
  return{
    type:'move-relative',
    target:{
      x:clamp(base.x+Number(action.dx||0),0,1),
      y:clamp(base.y+Number(action.dy||0),0,1),
    },
    until:program.until||null,
    programRuleId:program.ruleId,
  };
}

export const __personalProgrammingV1={compare,readCondition};
