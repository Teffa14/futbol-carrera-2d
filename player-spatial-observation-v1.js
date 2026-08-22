// Canonical spatial observation for autonomous football decisions and analysis.
// This module observes physical state only. It never owns, captures, or steers the ball.

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function normalizePoint(point, pitch) {
  const width = Math.max(1, Number(pitch?.width) || 105);
  const height = Math.max(1, Number(pitch?.height) || 68);
  return {
    x: clamp01((Number(point?.x) || 0) / width),
    y: clamp01((Number(point?.y) || 0) / height),
  };
}

function attackingCoordinates(point, attackDirection, pitch) {
  const absolute = normalizePoint(point, pitch);
  return attackDirection < 0
    ? { x: 1 - absolute.x, y: 1 - absolute.y }
    : absolute;
}

function relativeVector(from, to, pitch, attackDirection = 1) {
  const a = attackingCoordinates(from, attackDirection, pitch);
  const b = attackingCoordinates(to, attackDirection, pitch);
  return { x: b.x - a.x, y: b.y - a.y };
}

function classifyLane(y) {
  if (y < 0.18) return 'left-wide';
  if (y < 0.38) return 'left-half-space';
  if (y <= 0.62) return 'central';
  if (y <= 0.82) return 'right-half-space';
  return 'right-wide';
}

function classifyThird(x) {
  if (x < 1 / 3) return 'defensive-third';
  if (x < 2 / 3) return 'middle-third';
  return 'final-third';
}

export function observePlayerSpace({
  player,
  ball,
  roleReference = null,
  pitch = { width: 105, height: 68 },
  attackDirection = 1,
  phase = 'UNKNOWN',
}) {
  if (!player || !ball) throw new Error('player and free physical ball are required');

  const absolute = normalizePoint(player, pitch);
  const attack = attackingCoordinates(player, attackDirection, pitch);
  const ballAttack = attackingCoordinates(ball, attackDirection, pitch);
  const ballRelative = relativeVector(player, ball, pitch, attackDirection);
  const roleRelative = roleReference
    ? relativeVector(roleReference, player, pitch, attackDirection)
    : null;

  return {
    phase,
    absolute,
    attack,
    defence: { x: 1 - attack.x, y: 1 - attack.y },
    ball: ballAttack,
    relativeToBall: ballRelative,
    relativeToRole: roleRelative,
    third: classifyThird(attack.x),
    lane: classifyLane(attack.y),
    aheadOfBall: attack.x > ballAttack.x,
    behindBall: attack.x < ballAttack.x,
  };
}

export function createSpatialTrace({ maxSamples = 900 } = {}) {
  const samples = [];
  return {
    record(observation, time = 0) {
      samples.push({ time, ...observation });
      if (samples.length > maxSamples) samples.splice(0, samples.length - maxSamples);
      return samples[samples.length - 1];
    },
    samples() {
      return samples.slice();
    },
    flow() {
      const result = [];
      for (let i = 1; i < samples.length; i += 1) {
        result.push({
          from: samples[i - 1].attack,
          to: samples[i].attack,
          phase: samples[i].phase,
          dt: Math.max(0, samples[i].time - samples[i - 1].time),
        });
      }
      return result;
    },
    heatmap({ columns = 12, rows = 8 } = {}) {
      const grid = Array.from({ length: rows }, () => Array(columns).fill(0));
      for (const sample of samples) {
        const col = Math.min(columns - 1, Math.floor(clamp01(sample.attack.x) * columns));
        const row = Math.min(rows - 1, Math.floor(clamp01(sample.attack.y) * rows));
        grid[row][col] += 1;
      }
      return grid;
    },
  };
}
