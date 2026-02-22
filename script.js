const fields = {
  isotope: document.getElementById('isotope'),
  activityCi: document.getElementById('activityCi'),
  gammaConstant: document.getElementById('gammaConstant'),
  collimatorHvl: document.getElementById('collimatorHvl'),
  additionalHvl: document.getElementById('additionalHvl'),
  timeMode: document.getElementById('timeMode'),
  singleMinutes: document.getElementById('singleMinutes'),
  exposuresPerHour: document.getElementById('exposuresPerHour'),
  exposureCount: document.getElementById('exposureCount'),
  secondsPerExposure: document.getElementById('secondsPerExposure'),
  roundingMode: document.getElementById('roundingMode'),
};

const ui = {
  totalHvl: document.getElementById('totalHvl'),
  attenuation: document.getElementById('attenuation'),
  timeHours: document.getElementById('timeHours'),
  distance2: document.getElementById('distance2'),
  distance100: document.getElementById('distance100'),
  validation: document.getElementById('validation'),
  singleMinutesWrap: document.getElementById('singleMinutesWrap'),
  exposuresPerHourWrap: document.getElementById('exposuresPerHourWrap'),
  exposureCountWrap: document.getElementById('exposureCountWrap'),
  secondsPerExposureWrap: document.getElementById('secondsPerExposureWrap'),
};

function n(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function setGammaText() {
  const gamma = RTCalc.GAMMA_CONSTANTS[fields.isotope.value];
  fields.gammaConstant.value = `${gamma} mR/hr per Ci @ 1 ft`;
}

function setTimeModeVisibility() {
  const singleMode = fields.timeMode.value === 'single-plus-rate';
  ui.singleMinutesWrap.classList.toggle('hidden', !singleMode);
  ui.exposuresPerHourWrap.classList.toggle('hidden', !singleMode);
  ui.exposureCountWrap.classList.toggle('hidden', singleMode);
  ui.secondsPerExposureWrap.classList.toggle('hidden', singleMode);
}

function clearValidation() {
  ui.validation.innerHTML = '';
}

function pushValidation(message) {
  const entry = document.createElement('div');
  entry.className = 'warning red';
  entry.textContent = message;
  ui.validation.appendChild(entry);
}

function formatDistance(value, mode) {
  if (mode === 'field') {
    return `${RTCalc.roundUpToNearestFive(value)} ft`;
  }
  return `${value.toFixed(2)} ft`;
}

function evaluate() {
  clearValidation();
  setTimeModeVisibility();

  const activityCi = n(fields.activityCi.value);
  const gamma = RTCalc.GAMMA_CONSTANTS[fields.isotope.value];
  const collimatorHvl = n(fields.collimatorHvl.value);
  const additionalHvl = n(fields.additionalHvl.value);

  if (activityCi === null || activityCi < 0) pushValidation('Enter a valid Source Activity (Ci).');
  if (collimatorHvl === null || collimatorHvl < 0) pushValidation('Collimator HVL must be a valid number >= 0.');
  if (additionalHvl === null || additionalHvl < 0) pushValidation('Additional HVL must be a valid number >= 0.');

  const totalHvl = (collimatorHvl ?? 0) + (additionalHvl ?? 0);
  const attenuation = RTCalc.computeAttenuation(totalHvl);

  ui.totalHvl.textContent = totalHvl.toFixed(4);
  ui.attenuation.textContent = attenuation.toFixed(8);

  const timeHours = RTCalc.timeHoursFromWorkflow({
    mode: fields.timeMode.value,
    minutesPerExposure: n(fields.singleMinutes.value),
    exposuresPerHour: n(fields.exposuresPerHour.value),
    exposureCount: n(fields.exposureCount.value),
    secondsPerExposure: n(fields.secondsPerExposure.value),
  });

  if (timeHours === null) {
    pushValidation('Enter valid time inputs for the selected workflow.');
    ui.timeHours.textContent = '—';
    ui.distance2.textContent = '—';
    ui.distance100.textContent = '—';
    return;
  }

  ui.timeHours.textContent = `${timeHours.toFixed(6)} hr`;

  if (timeHours === 0) {
    pushValidation('No exposure time entered.');
    ui.distance2.textContent = '0 ft';
    ui.distance100.textContent = '0 ft';
    return;
  }

  if (ui.validation.childElementCount > 0) {
    ui.distance2.textContent = '—';
    ui.distance100.textContent = '—';
    return;
  }

  const d2 = RTCalc.barricadeDistanceFt({
    activityCi,
    gammaConstantMrPerHrPerCi: gamma,
    timeHours,
    attenuation,
    targetMrPerHr: RTCalc.TARGETS.publicBoundary,
  });

  const d100 = RTCalc.barricadeDistanceFt({
    activityCi,
    gammaConstantMrPerHrPerCi: gamma,
    timeHours,
    attenuation,
    targetMrPerHr: RTCalc.TARGETS.highRadArea,
  });

  ui.distance2.textContent = `${formatDistance(d2, fields.roundingMode.value)} (mR/hr, ft)`;
  ui.distance100.textContent = `${formatDistance(d100, fields.roundingMode.value)} (mR/hr, ft)`;
}

Object.values(fields).forEach((field) => {
  field.addEventListener('input', evaluate);
  field.addEventListener('change', evaluate);
});

setGammaText();
fields.isotope.addEventListener('change', setGammaText);
evaluate();
