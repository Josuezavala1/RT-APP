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
    'Yb-169': 1300,
    'Cs-137': 3400,
  };

  const TARGETS = {
    publicBoundary: 2,
    highRadArea: 100,
  };

  function computeAttenuation(totalHVL) {
    return Math.pow(0.5, totalHVL);
  }

  function timeHoursFromWorkflow(input) {
    if (input.mode === 'single-plus-rate') {
      const minutes = Number(input.minutesPerExposure);
      const exposuresPerHour = Number(input.exposuresPerHour);
      if (!Number.isFinite(minutes) || !Number.isFinite(exposuresPerHour) || minutes < 0 || exposuresPerHour < 0) return null;
      return (minutes * 60 * exposuresPerHour) / 3600;
    }

    if (input.mode === 'count-plus-seconds') {
      const exposureCount = Number(input.exposureCount);
      const secondsPerExposure = Number(input.secondsPerExposure);
      if (!Number.isFinite(exposureCount) || !Number.isFinite(secondsPerExposure) || exposureCount < 0 || secondsPerExposure < 0) return null;
      return (exposureCount * secondsPerExposure) / 3600;
    }

    return null;
  }

  function barricadeDistanceFt({ activityCi, gammaConstantMrPerHrPerCi, timeHours, attenuation, targetMrPerHr }) {
    return Math.sqrt((activityCi * gammaConstantMrPerHrPerCi * timeHours * attenuation) / targetMrPerHr);
  }

  function roundUpToNearestFive(value) {
    return Math.ceil(value / 5) * 5;
  }

  return {
    GAMMA_CONSTANTS,
    TARGETS,
    computeAttenuation,
    timeHoursFromWorkflow,
    barricadeDistanceFt,
    roundUpToNearestFive,
  };
});
