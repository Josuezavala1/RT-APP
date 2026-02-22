(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RTCalc = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const GAMMA_CONSTANTS = {
    'Ir-192': 5200,
    'Co-60': 14000,
    'Se-75': 2200,
  };

  const TARGETS = {
    publicBoundary: 2,
    highRadArea: 100,
  };

  const MATERIAL_HVL_IN = {
    Concrete: { 'Ir-192': 1.9, 'Co-60': 2.6, 'Se-75': 1.4 },
    Steel: { 'Ir-192': 0.65, 'Co-60': 0.9, 'Se-75': 0.45 },
    Lead: { 'Ir-192': 0.25, 'Co-60': 0.45, 'Se-75': 0.15 },
    Tungsten: { 'Ir-192': 0.19, 'Co-60': 0.33, 'Se-75': 0.12 },
  };

  function layerAttenuation(hvlCount) {
    return Math.pow(0.5, Number(hvlCount));
  }

  function combinedAttenuation(hvlCounts) {
    return hvlCounts.reduce((acc, hvl) => acc * layerAttenuation(hvl), 1);
  }

  function timeFractionFromInputs({ exposuresPerHour, secondsPerExposure, totalSecondsPerHour }) {
    const hasTotal = Number.isFinite(totalSecondsPerHour) && totalSecondsPerHour >= 0;
    if (hasTotal) return totalSecondsPerHour / 3600;

    if (!Number.isFinite(exposuresPerHour) || !Number.isFinite(secondsPerExposure) || exposuresPerHour < 0 || secondsPerExposure < 0) {
      return null;
    }

    return (exposuresPerHour * secondsPerExposure) / 3600;
  }

  function barricadeDistanceFt({ activityCi, gammaConstantMrPerHrPerCi, timeFraction, attenuationFactor, targetMrPerHr }) {
    return Math.sqrt((activityCi * gammaConstantMrPerHrPerCi * timeFraction * attenuationFactor) / targetMrPerHr);
  }

  return {
    GAMMA_CONSTANTS,
    TARGETS,
    MATERIAL_HVL_IN,
    layerAttenuation,
    combinedAttenuation,
    timeFractionFromInputs,
    barricadeDistanceFt,
  };
});
