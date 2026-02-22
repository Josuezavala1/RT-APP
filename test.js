const assert = require('node:assert/strict');
const calc = require('./calc.js');

function assertClose(actual, expected, tolerance, message) {
  const delta = Math.abs(actual - expected);
  assert.ok(delta <= tolerance, `${message}: expected ${expected}, got ${actual}, delta ${delta}`);
}

(function run() {
  assert.equal(calc.GAMMA_CONSTANTS['Ir-192'], 5200, 'Ir-192 constant should stay locked');
  assert.equal(calc.GAMMA_CONSTANTS['Co-60'], 14000, 'Co-60 constant should stay locked');
  assert.equal(calc.GAMMA_CONSTANTS['Se-75'], 2200, 'Se-75 constant should stay locked');

  const timeFraction = calc.timeFractionFromInputs({ exposuresPerHour: 12, secondsPerExposure: 15 });
  assertClose(timeFraction, 0.05, 1e-12, 'Time-fraction formula should match duty-cycle requirements');

  const attenuation = calc.combinedAttenuation([1, 0.5, 2]);
  assertClose(attenuation, Math.pow(0.5, 3.5), 1e-12, 'Layer factors should multiply');

  const dist = calc.barricadeDistanceFt({
    activityCi: 67,
    gammaConstantMrPerHrPerCi: calc.GAMMA_CONSTANTS['Ir-192'],
    timeFraction,
    attenuationFactor: 1,
    targetMrPerHr: calc.TARGETS.publicBoundary,
  });

  assertClose(dist, 93.33, 0.1, 'Duty-cycle barricade distance should be correct in mR/hr');
  console.log('All RT calculator tests passed.');
})();
