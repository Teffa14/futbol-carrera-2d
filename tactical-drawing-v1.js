import {PHASES} from './tactics.js';

const ACTION_TYPES=new Set(['run','pass','cross','shot','position']);
const PHASE_VALUES=new Set(Object.values(PHASES));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const round=v=>Math.round(Number(v)*1000)/1000;
const clone=v=>JSON.parse(JSON.stringify(v));

export function normalizeTacticalPoint(point={}){
  return{x:round(clamp(Number(point.x)||0,0,1)),y:round(clamp(Number(point.y)||0,0,1))};
}

export function createVisualAction({id,type,actorId,start,end,targetParticipantId=null,phase=PHASES.PROGRESSION,priority=60,trigger=[],unless=[],abort=[],label=''}={}){
  if(!id)throw new Error('visual action id is required');
  if(!ACTION_TYPES.has(type))throw new Error(`unsupported visual action type: ${type}`);
  if(!actorId)throw new Error('visual action actorId is required');
  if(!PHASE_VALUES.has(phase))throw new Error(`unsupported visual action phase: ${phase}`);
  return{
    id:String(id),
    type,
    actorId:String(actorId),
    targetParticipantId:targetParticipantId?String(targetParticipantId):null,
    phase,
    priority:Math.max(0,Math.min(100,Math.round(Number(priority)||60))),
    start:normalizeTacticalPoint(start),
    end:normalizeTacticalPoint(end),
    trigger:clone(trigger),
    unless:clone(unless),
    abort:clone(abort),
    label:String(label||''),
  };
}

function defaultAbort(){return[{path:'possessionLost',op:'truthy'}];}
function pointTarget(point){return{reference:'normalized-pitch',point:normalizeTacticalPoint(point)};}

export function visualActionToTacticalRule(action){
  const a=createVisualAction(action);
  const common={id:`draw-${a.id}`,phase:a.phase,priority:a.priority,when:a.trigger,unless:a.unless};
  const abort=a.abort.length?a.abort:defaultAbort();

  if(a.type==='position')return{
    ...common,
    kind:'zone',
    action:'occupy-drawn-reference',
    target:{participant:a.actorId,...pointTarget(a.end)},
    abort,
    abortAction:'recover-role-reference',
  };

  const actionName={run:'attack-drawn-space',pass:'play-to-drawn-space',cross:'deliver-to-drawn-space',shot:'finish-toward-drawn-target'}[a.type];
  return{
    ...common,
    kind:'pattern',
    pattern:{
      id:`draw-pattern-${a.id}`,
      principle:a.label||`Execute a ${a.type} only while the drawn football reference remains valid.`,
      participants:[a.actorId,...(a.targetParticipantId?[a.targetParticipantId]:[])],
      trigger:a.trigger,
      spatialReferences:{
        start:pointTarget(a.start),
        target:pointTarget(a.end),
      },
      primaryAction:actionName,
      reads:[],
      branches:[],
      abort,
      abortAction:'recover-structure',
      reactionToLoss:'recover-structure',
      successCondition:a.type==='run'?'actor-reaches-target-space':a.type==='shot'?'shot-physically-executed':'ball-physically-reaches-target-space',
    },
  };
}

export function compileVisualPlay({id='drawn-play',name='Drawn Play',phase=PHASES.PROGRESSION,baseFormation='4-3-3',actions=[]}={}){
  if(!PHASE_VALUES.has(phase))throw new Error(`unsupported visual play phase: ${phase}`);
  const rules=actions.map((action,index)=>visualActionToTacticalRule({...action,phase:action.phase||phase,id:action.id||`action-${index+1}`}));
  const participants=[...new Set(actions.flatMap(action=>[action.actorId,action.targetParticipantId].filter(Boolean).map(String)))];
  return{
    version:1,
    id:String(id),
    name:String(name),
    mode:'competitive',
    baseFormation:String(baseFormation),
    source:'visual-editor',
    phase,
    participants,
    rules,
  };
}

export function drawingPreview(action){
  const a=createVisualAction(action);
  return{
    id:a.id,
    type:a.type,
    from:a.start,
    to:a.end,
    actorId:a.actorId,
    targetParticipantId:a.targetParticipantId,
    arrow:a.type!=='position',
  };
}

export const TACTICAL_DRAWING_ACTIONS=[...ACTION_TYPES];
