const assert = require('node:assert/strict');
const calc = require('./calc.js');

function assertClose(actual, expected, tolerance, message) {
  const delta = Math.abs(actual - expected);
  assert.ok(delta <= tolerance, `${message}: expected ${expected}, got ${actual}, delta ${delta}`);
}

(function run() {
  const timeHours1 = 1;
  const attenuation1 = calc.computeAttenuation(0);
  const d2 = calc.barricadeDistanceFt({
    activityCi: 67,
    gammaConstantMrPerHrPerCi: calc.GAMMA_CONSTANTS['Ir-192'],
    timeHours: timeHours1,
    attenuation: attenuation1,
    targetMrPerHr: calc.TARGETS.publicBoundary,
  });
  const d100 = calc.barricadeDistanceFt({
    activityCi: 67,
    gammaConstantMrPerHrPerCi: calc.GAMMA_CONSTANTS['Ir-192'],
    timeHours: timeHours1,
    attenuation: attenuation1,
    targetMrPerHr: calc.TARGETS.highRadArea,
  });

  assertClose(d2, 417.37, 0.1, '67 Ci Ir-192 @ 2 mR/hr');
  assertClose(d100, 59.02, 0.1, '67 Ci Ir-192 @ 100 mR/hr');

  const timeHours2 = calc.timeHoursFromWorkflow({
    mode: 'count-plus-seconds',
    exposureCount: 16,
    secondsPerExposure: 10,
  });

  const attenuation2 = calc.computeAttenuation(4);
  const d2Scenario2 = calc.barricadeDistanceFt({
    activityCi: 35,
    gammaConstantMrPerHrPerCi: calc.GAMMA_CONSTANTS['Ir-192'],
    timeHours: timeHours2,
    attenuation: attenuation2,
    targetMrPerHr: calc.TARGETS.publicBoundary,
  });

  assert.ok(d2Scenario2 >= 15 && d2Scenario2 <= 16, `Expected 15-16 ft range, got ${d2Scenario2}`);

  console.log('All barricade calculator tests passed.');
})();
