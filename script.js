const fields = {
  jobNumber: document.getElementById('jobNumber'),
  jobSite: document.getElementById('jobSite'),
  technicianName: document.getElementById('technicianName'),
  jobDate: document.getElementById('jobDate'),
  isotope: document.getElementById('isotope'),
  activityCi: document.getElementById('activityCi'),
  gammaConstant: document.getElementById('gammaConstant'),
  targetLimit: document.getElementById('targetLimit'),
  timeMode: document.getElementById('timeMode'),
  exposuresPerHour: document.getElementById('exposuresPerHour'),
  secondsPerExposure: document.getElementById('secondsPerExposure'),
  totalSecondsPerHour: document.getElementById('totalSecondsPerHour'),
};

const ui = {
  secondsPerExposureWrap: document.getElementById('secondsPerExposureWrap'),
  totalSecondsWrap: document.getElementById('totalSecondsWrap'),
  timeFraction: document.getElementById('timeFraction'),
  selectedDistance: document.getElementById('selectedDistance'),
  distance2: document.getElementById('distance2'),
  distance100: document.getElementById('distance100'),
  validation: document.getElementById('validation'),
  materials: document.getElementById('materials'),
  shots: document.getElementById('shots'),
  combinedAttenuation: document.getElementById('combinedAttenuation'),
  addMaterial: document.getElementById('addMaterial'),
  addShot: document.getElementById('addShot'),
  exportPdf: document.getElementById('exportPdf'),
};

const state = {
  materialCount: 0,
  shotCount: 0,
};

function num(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pushValidation(message) {
  const el = document.createElement('div');
  el.className = 'warning red';
  el.textContent = message;
  ui.validation.appendChild(el);
}

function clearValidation() {
  ui.validation.innerHTML = '';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setGammaConstant() {
  const gamma = RTCalc.GAMMA_CONSTANTS[fields.isotope.value];
  fields.gammaConstant.value = `${gamma} mR/hr per Ci @ 1 ft`;
}

function setTimeModeVisibility() {
  const totalMode = fields.timeMode.value === 'total-seconds';
  ui.totalSecondsWrap.classList.toggle('hidden', !totalMode);
  ui.secondsPerExposureWrap.classList.toggle('hidden', totalMode);
}

function readLayerData(layerEl) {
  const material = layerEl.querySelector('.mat-type').value;
  const manualHvl = num(layerEl.querySelector('.mat-hvl').value);
  const useThickness = layerEl.querySelector('.mat-use-thickness').checked;
  const thicknessIn = num(layerEl.querySelector('.mat-thickness').value);
  const hvlIn = RTCalc.MATERIAL_HVL_IN[material][fields.isotope.value];

  let hvlCount = manualHvl;
  if (useThickness && thicknessIn !== null) {
    hvlCount = thicknessIn / hvlIn;
  }

  if (hvlCount === null || hvlCount < 0) return { valid: false };
  const factor = RTCalc.layerAttenuation(hvlCount);
  return { valid: true, material, hvlCount, hvlIn, factor, useThickness, thicknessIn };
}

function addMaterialLayer() {
  state.materialCount += 1;
  const id = state.materialCount;
  const row = document.createElement('div');
  row.className = 'material-row';
  row.dataset.id = String(id);
  row.innerHTML = `
    <div class="grid material-grid">
      <label>
        Material
        <select class="mat-type">
          <option value="Concrete">Concrete</option>
          <option value="Steel">Steel</option>
          <option value="Lead">Lead</option>
          <option value="Tungsten">Tungsten</option>
        </select>
      </label>
      <label>
        HVL count
        <input class="mat-hvl" type="number" min="0" step="0.01" value="0" />
      </label>
      <label>
        Thickness (in, optional override)
        <input class="mat-thickness" type="number" min="0" step="0.01" placeholder="optional" />
      </label>
      <label>
        Use thickness override
        <input class="mat-use-thickness material-override" type="checkbox" />
      </label>
    </div>
    <div class="material-meta">
      <span class="layer-summary">Layer factor: 1.000000</span>
      <button class="btn btn-danger btn-small material-remove" type="button">Remove</button>
    </div>
  `;

  row.querySelector('.material-remove').addEventListener('click', () => {
    row.remove();
    evaluate();
  });

  row.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('input', evaluate);
    el.addEventListener('change', evaluate);
  });

  ui.materials.appendChild(row);
}

function addShotCard() {
  state.shotCount += 1;
  const id = state.shotCount;
  const row = document.createElement('div');
  row.className = 'shot-card';
  row.dataset.id = String(id);
  row.innerHTML = `
    <div class="shot-head">
      <h3 class="shot-name">Shot ${id}</h3>
      <button class="btn btn-danger btn-small shot-remove" type="button">Remove</button>
    </div>
    <div class="grid">
      <label>
        Shot ID / Location
        <input class="shot-id" type="text" placeholder="e.g. C-12" />
      </label>
      <label>
        UG (in)
        <input class="shot-ug" type="number" min="0" step="0.01" value="0" />
      </label>
      <label>
        SOD (in)
        <input class="shot-sod" type="number" min="0" step="0.01" value="0" />
      </label>
      <label>
        SFD (in)
        <input class="shot-sfd" type="number" min="0" step="0.01" value="0" />
      </label>
    </div>
    <div class="results">
      <div class="result-item"><strong>Blowup:</strong> <span class="shot-blowup">—</span></div>
      <div class="result-item"><strong>Effective UG on film:</strong> <span class="shot-effective">—</span></div>
    </div>
  `;

  row.querySelector('.shot-remove').addEventListener('click', () => {
    row.remove();
  });

  row.querySelectorAll('input').forEach((el) => {
    el.addEventListener('input', () => updateShot(row));
    el.addEventListener('change', () => updateShot(row));
  });

  ui.shots.appendChild(row);
  updateShot(row);
}

function updateShot(shotEl) {
  const ug = num(shotEl.querySelector('.shot-ug').value) ?? 0;
  const sod = num(shotEl.querySelector('.shot-sod').value);
  const sfd = num(shotEl.querySelector('.shot-sfd').value);

  let blowupText = '—';
  let effectiveText = '—';

  if (sod && sfd && sod > 0) {
    const blowup = sfd / sod;
    const effectiveUg = ug * blowup;
    blowupText = `${blowup.toFixed(4)}x`;
    effectiveText = `${effectiveUg.toFixed(4)} in`;
  }

  shotEl.querySelector('.shot-blowup').textContent = blowupText;
  shotEl.querySelector('.shot-effective').textContent = effectiveText;
}

function collectMaterials() {
  const layers = [...ui.materials.querySelectorAll('.material-row')]
    .map((layerEl) => {
      const data = readLayerData(layerEl);
      if (data.valid) {
        layerEl.querySelector('.layer-summary').textContent = `Layer factor: ${data.factor.toFixed(6)} (${data.material}, HVL=${data.hvlCount.toFixed(3)})`;
      } else {
        layerEl.querySelector('.layer-summary').textContent = 'Layer factor: invalid input';
      }
      return data;
    });

  return layers;
}

function evaluate() {
  clearValidation();
  setTimeModeVisibility();

  const activityCi = num(fields.activityCi.value);
  const gamma = RTCalc.GAMMA_CONSTANTS[fields.isotope.value];
  const targetLimit = num(fields.targetLimit.value);

  if (activityCi === null || activityCi < 0) pushValidation('Enter a valid Source Activity (Ci).');

  const layers = collectMaterials();
  if (layers.some((l) => !l.valid)) pushValidation('Each material layer needs valid HVL count or thickness override.');

  const validHvlCounts = layers.filter((l) => l.valid).map((l) => l.hvlCount);
  const attenuationFactor = RTCalc.combinedAttenuation(validHvlCounts);
  ui.combinedAttenuation.textContent = attenuationFactor.toFixed(8);

  const timeFraction = fields.timeMode.value === 'total-seconds'
    ? RTCalc.timeFractionFromInputs({ totalSecondsPerHour: num(fields.totalSecondsPerHour.value) })
    : RTCalc.timeFractionFromInputs({
        exposuresPerHour: num(fields.exposuresPerHour.value),
        secondsPerExposure: num(fields.secondsPerExposure.value),
      });

  if (timeFraction === null || timeFraction < 0) {
    pushValidation('Enter valid duty-cycle time inputs.');
    ui.timeFraction.textContent = '—';
    ui.selectedDistance.textContent = '—';
    ui.distance2.textContent = '—';
    ui.distance100.textContent = '—';
    return;
  }

  ui.timeFraction.textContent = `${timeFraction.toFixed(6)} (fraction of hour)`;

  if (ui.validation.childElementCount > 0) {
    ui.selectedDistance.textContent = '—';
    ui.distance2.textContent = '—';
    ui.distance100.textContent = '—';
    return;
  }

  const d2 = RTCalc.barricadeDistanceFt({
    activityCi,
    gammaConstantMrPerHrPerCi: gamma,
    timeFraction,
    attenuationFactor,
    targetMrPerHr: RTCalc.TARGETS.publicBoundary,
  });

  const d100 = RTCalc.barricadeDistanceFt({
    activityCi,
    gammaConstantMrPerHrPerCi: gamma,
    timeFraction,
    attenuationFactor,
    targetMrPerHr: RTCalc.TARGETS.highRadArea,
  });

  const selected = targetLimit === 100 ? d100 : d2;
  ui.selectedDistance.textContent = `${selected.toFixed(2)} ft`;
  ui.distance2.textContent = `${d2.toFixed(2)} ft`;
  ui.distance100.textContent = `${d100.toFixed(2)} ft`;
}

function buildPdfMarkup() {
  const layers = collectMaterials().filter((l) => l.valid);
  const shots = [...ui.shots.querySelectorAll('.shot-card')].map((shotEl, idx) => ({
    title: `Shot ${idx + 1}`,
    shotId: shotEl.querySelector('.shot-id').value || '—',
    ug: shotEl.querySelector('.shot-ug').value || '0',
    sod: shotEl.querySelector('.shot-sod').value || '0',
    sfd: shotEl.querySelector('.shot-sfd').value || '0',
    blowup: shotEl.querySelector('.shot-blowup').textContent,
    effective: shotEl.querySelector('.shot-effective').textContent,
  }));

  const rowsMaterials = layers
    .map((l, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(l.material)}</td><td>${l.hvlCount.toFixed(3)}</td><td>${l.factor.toFixed(6)}</td></tr>`)
    .join('');

  const rowsShots = shots
    .map((s) => `<tr><td>${escapeHtml(s.title)}</td><td>${escapeHtml(s.shotId)}</td><td>${s.ug}</td><td>${s.sod}</td><td>${s.sfd}</td><td>${escapeHtml(s.blowup)}</td><td>${escapeHtml(s.effective)}</td></tr>`)
    .join('');

  return `
  <!doctype html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>RT Summary PDF</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 16px; color: #111; }
      h1, h2 { margin-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      th, td { border: 1px solid #aaa; padding: 6px; font-size: 12px; }
      .kv { margin: 4px 0; font-size: 13px; }
    </style>
  </head>
  <body>
    <h1>RT Barricade Summary</h1>

    <h2>Job Information</h2>
    <div class="kv">Job Number: ${escapeHtml(fields.jobNumber.value || '—')}</div>
    <div class="kv">Customer / Site: ${escapeHtml(fields.jobSite.value || '—')}</div>
    <div class="kv">Technician Name: ${escapeHtml(fields.technicianName.value || '—')}</div>
    <div class="kv">Date: ${escapeHtml(fields.jobDate.value || '—')}</div>

    <h2>Source Information</h2>
    <div class="kv">Isotope: ${escapeHtml(fields.isotope.value)}</div>
    <div class="kv">Source Activity: ${escapeHtml(fields.activityCi.value || '0')} Ci</div>
    <div class="kv">Gamma Constant: ${escapeHtml(fields.gammaConstant.value)}</div>

    <h2>Barricade / Boundary</h2>
    <div class="kv">Target Limit: ${escapeHtml(fields.targetLimit.value)} mR/hr</div>
    <div class="kv">Time fraction: ${escapeHtml(ui.timeFraction.textContent)}</div>
    <div class="kv">Combined attenuation factor: ${escapeHtml(ui.combinedAttenuation.textContent)}</div>
    <div class="kv">Distance @ 2 mR/hr: ${escapeHtml(ui.distance2.textContent)}</div>
    <div class="kv">Distance @ 100 mR/hr: ${escapeHtml(ui.distance100.textContent)}</div>

    <h2>Materials</h2>
    <table>
      <thead><tr><th>#</th><th>Material</th><th>HVL count</th><th>Factor</th></tr></thead>
      <tbody>${rowsMaterials || '<tr><td colspan="4">No layers added</td></tr>'}</tbody>
    </table>

    <h2>Shot Cards</h2>
    <table>
      <thead><tr><th>Shot</th><th>ID</th><th>UG (in)</th><th>SOD (in)</th><th>SFD (in)</th><th>Blowup</th><th>Eff. UG (in)</th></tr></thead>
      <tbody>${rowsShots || '<tr><td colspan="7">No shots added</td></tr>'}</tbody>
    </table>
  </body>
  </html>`;
}

function exportPdf() {
  evaluate();
  const popup = window.open('', '_blank');
  if (!popup) return;
  popup.document.write(buildPdfMarkup());
  popup.document.close();
  popup.focus();
  popup.print();
}

Object.values(fields).forEach((field) => {
  field.addEventListener('input', evaluate);
  field.addEventListener('change', evaluate);
});

ui.addMaterial.addEventListener('click', () => {
  addMaterialLayer();
  evaluate();
});

ui.addShot.addEventListener('click', addShotCard);
ui.exportPdf.addEventListener('click', exportPdf);
fields.isotope.addEventListener('change', () => {
  setGammaConstant();
  evaluate();
});

setGammaConstant();
addMaterialLayer();
addShotCard();
evaluate();
