import {TrainingMatchEngine as TrainingMatchEngineV14} from './training-match-engine-v14.js';

export const TRAINING_MATCH_ENGINE_VERSION=15;

export class TrainingMatchEngine extends TrainingMatchEngineV14{
  constructor(drill,result,player){super(drill,result,player);this.trainingEngineVersion=15;}
  resetRep(rep,initial=false){return super.resetRep(rep,initial);}
  scenario(dt){return super.scenario(dt);}
  sessionResult(){return{...super.sessionResult(),engineVersion:15};}
}
