import {TrainingMatchEngine,TRAINING_MATCH_ENGINE_VERSION} from './training-match-engine-latest.js';
import './training-framework-v2.js';
import './training-intelligence-v7.js';
import './training-small-sided-v8.js';
import './training-transfer-v1.js';
import './training-competitive-v2.js';
import './training-role-scenarios-v1.js';

export const TRAINING_RUNTIME_VERSIONS=Object.freeze({
  matchEngine:TRAINING_MATCH_ENGINE_VERSION,
  framework:2,
  intelligence:7,
  smallSided:8,
  transfer:1,
  competitive:2,
  roleScenarios:1,
  liveUi:5,
});

export {TrainingMatchEngine};
