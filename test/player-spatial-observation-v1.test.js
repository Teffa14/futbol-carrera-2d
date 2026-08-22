import test from 'node:test';
import assert from 'node:assert/strict';
import { observePlayerSpace, createSpatialTrace } from '../player-spatial-observation-v1.js';

const pitch = { width: 100, height: 60 };

test('normalizes attacking and defensive coordinates for both directions', () => {
  const right = observePlayerSpace({ player: { x: 75, y: 30 }, ball: { x: 50, y: 30 }, pitch, attackDirection: 1 });
  const left = observePlayerSpace({ player: { x: 25, y: 30 }, ball: { x: 50, y: 30 }, pitch, attackDirection: -1 });
  assert.deepEqual(right.attack, left.attack);
  assert.deepEqual(right.defence, left.defence);
  assert.equal(right.third, 'final-third');
});

test('expresses player position relative to free ball and role reference', () => {
  const obs = observePlayerSpace({
    player: { x: 60, y: 24 },
    ball: { x: 45, y: 30 },
    roleReference: { x: 50, y: 30 },
    pitch,
    attackDirection: 1,
    phase: 'MIDDLE_THIRD_PROGRESSION',
  });
  assert.equal(obs.phase, 'MIDDLE_THIRD_PROGRESSION');
  assert.equal(obs.aheadOfBall, true);
  assert.ok(obs.relativeToBall.x < 0);
  assert.ok(obs.relativeToRole.x > 0);
  assert.equal(obs.lane, 'left-half-space');
});

test('trace exposes bounded movement flow and heatmap data', () => {
  const trace = createSpatialTrace({ maxSamples: 3 });
  for (let i = 0; i < 4; i += 1) {
    trace.record(observePlayerSpace({ player: { x: 10 + i * 20, y: 30 }, ball: { x: 40, y: 30 }, pitch, attackDirection: 1, phase: 'BUILD_UP' }), i);
  }
  assert.equal(trace.samples().length, 3);
  assert.equal(trace.flow().length, 2);
  assert.equal(trace.flow()[0].phase, 'BUILD_UP');
  const total = trace.heatmap({ columns: 5, rows: 3 }).flat().reduce((sum, n) => sum + n, 0);
  assert.equal(total, 3);
});

test('spatial observation never creates ball ownership or steering state', () => {
  const obs = observePlayerSpace({ player: { x: 20, y: 20 }, ball: { x: 21, y: 20 }, pitch });
  assert.equal('ownerId' in obs, false);
  assert.equal('targetPlayerId' in obs, false);
  assert.equal('velocity' in obs.ball, false);
});
