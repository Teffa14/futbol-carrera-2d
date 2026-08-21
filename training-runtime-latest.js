import './training-framework-v2.js';
import {TrainingMatchEngine,TRAINING_MATCH_ENGINE_VERSION} from './training-match-engine-latest.js';

export const TRAINING_RUNTIME_VERSIONS=Object.freeze({
  matchEngine:TRAINING_MATCH_ENGINE_VERSION,
  framework:2,
  authoritativeScenarios:4,
  liveUi:5,
});

export {TrainingMatchEngine};
