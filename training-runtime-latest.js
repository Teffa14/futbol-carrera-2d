import {TrainingMatchEngine,TRAINING_MATCH_ENGINE_VERSION} from './training-match-engine-latest.js';
import './training-intelligence-v7.js';
import './training-small-sided-v8.js';
import './training-transfer-v1.js';
import './training-competitive-v2.js';

export const TRAINING_RUNTIME_VERSIONS=Object.freeze({
  matchEngine:TRAINING_MATCH_ENGINE_VERSION,
  intelligence:7,
  smallSided:8,
  transfer:1,
  competitive:2,
  liveUi:4,
});

export {TrainingMatchEngine};
