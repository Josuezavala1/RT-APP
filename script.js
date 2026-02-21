const MAX_MAG_PERCENT = 20;
const DEFAULT_UG_LIMIT = 0.024;

const GAMMA_DEFAULTS = {
  "Ir-192": 5.2,
  "Co-60": 14,
  "Se-75": 2.5,
};

const HVL_LOOKUP = {
  "Ir-192": {
    Steel: 0.5,
    Concrete: 1.75,
    Lead: 0.25,
    Aluminum: 0.7,
    Water: 2.0,
    "Insulation (Generic)": 4.0,
    Air: 120.0,
  },
  "Co-60": {
    Steel: 0.85,
    Concrete: 2.38,
    Lead: 0.48,
    Aluminum: 1.3,
    Water: 4.0,
    "Insulation (Generic)": 8.0,
    Air: 300.0,
  },
  "Se-75": {
    Steel: 0.28,
    Concrete: 1.0,
    Lead: 0.12,
    Aluminum: 0.4,
    Water: 1.2,
    "Insulation (Generic)": 2.5,
    Air: 60.0,
  },
};

const fields = {
  jobWorkOrder: document.getElementById("jobWorkOrder"),
  locationUnit: document.getElementById("locationUnit"),
  jobDate: document.getElementById("jobDate"),
  technicianName: document.getElementById("technicianName"),
  isotope: document.getElementById("isotope"),
  activity: document.getElementById("activity"),
  focusSpot: document.getElementById("focusSpot"),
  sourceSerial: document.getElementById("sourceSerial"),
  gammaConstant: document.getElementById("gammaConstant"),
  estimatedTotalExposure: document.getElementById("estimatedTotalExposure"),
  exposureUnits: document.getElementById("exposureUnits"),
  numberOfExposures: document.getElementById("numberOfExposures"),
};

const ui = {
  exposureAt1ft: document.getElementById("exposureAt1ft"),
  estimatedShotDuration: document.getElementById("estimatedShotDuration"),
  estimatedTotalJobExposure: document.getElementById("estimatedTotalJobExposure"),
  totalHvls: document.getElementById("totalHvls"),
  attenuationFactor: document.getElementById("attenuationFactor"),
  boundaryExposure1ft: document.getElementById("boundaryExposure1ft"),
  boundary100mr: document.getElementById("boundary100mr"),
  boundary2mr: document.getElementById("boundary2mr"),
  globalWarningsEl: document.getElementById("globalWarnings"),
};

const addMaterialBtn = document.getElementById("addMaterial");
const materialsContainer = document.getElementById("materialsContainer");
const materialTemplate = document.getElementById("materialTemplate");

const addShotBtn = document.getElementById("addShot");
const shotsContainer = document.getElementById("shotsContainer");
const shotTemplate = document.getElementById("shotTemplate");
const generatePdfBtn = document.getElementById("generatePdf");

let shotCounter = 0;
let materialCounter = 0;

function n(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value, decimals = 2) {
  return Number.isFinite(value) ? value.toFixed(decimals) : "—";
}

function createWarning(text, level = "yellow") {
  const div = document.createElement("div");
  div.className = `warning ${level}`;
  div.textContent = text;
  return div;
}

function selectedGamma() {
  return n(fields.gammaConstant.value) ?? GAMMA_DEFAULTS[fields.isotope.value];
}

function setGammaDefault() {
  const gamma = GAMMA_DEFAULTS[fields.isotope.value];
  fields.gammaConstant.value = `${formatNumber(gamma, 1)} R/hr per Ci @ 1 ft`;
}

function getLookupHvl(isotope, material) {
  return HVL_LOOKUP[isotope]?.[material] ?? null;
}

function refreshMaterialRowFromLookup(row) {
  const materialName = row.querySelector(".material-name").value;
  const override = row.querySelector(".material-override").checked;
  const hvlInput = row.querySelector(".material-hvl");
  hvlInput.readOnly = !override;

  if (!override) {
    const hvl = getLookupHvl(fields.isotope.value, materialName);
    hvlInput.value = hvl === null ? "" : String(hvl);
  }
}

function getMaterials() {
  const rows = [...materialsContainer.querySelectorAll(".material-row")];

  return rows.map((row) => {
    const materialName = row.querySelector(".material-name").value;
    const thickness = n(row.querySelector(".material-thickness").value);
    const hvl = n(row.querySelector(".material-hvl").value);
    const override = row.querySelector(".material-override").checked;
    const hvlCount = thickness && hvl ? thickness / hvl : null;

    row.querySelector(".material-hvl-count").textContent =
      `HVL Count: ${hvlCount === null ? "—" : formatNumber(hvlCount, 3)}`;

    return { materialName, thickness, hvl, hvlCount, override };
  });
}

function getAttenuationSummary() {
  const materials = getMaterials();
  const totalHVLs = materials.reduce((sum, m) => sum + (m.hvlCount ?? 0), 0);
  const attenuationFactor = Math.pow(0.5, totalHVLs);

  ui.totalHvls.textContent = formatNumber(totalHVLs, 3);
  ui.attenuationFactor.textContent = formatNumber(attenuationFactor, 6);

  return { materials, totalHVLs, attenuationFactor };
}

function getExposureAt1ft() {
  const gamma = selectedGamma();
  const activity = n(fields.activity.value);
  if (!gamma || !activity) return null;
  return gamma * activity;
}

function estimatePlanningTimes() {
  const estimatedInput = n(fields.estimatedTotalExposure.value);
  const units = fields.exposureUnits.value;
  const exposures = n(fields.numberOfExposures.value) ?? 1;
  const exposureAt1ft = getExposureAt1ft();

  ui.exposureAt1ft.textContent = exposureAt1ft === null ? "—" : `${formatNumber(exposureAt1ft, 1)} R/hr`;

  if (!estimatedInput || exposures <= 0) {
    ui.estimatedShotDuration.textContent = "—";
    ui.estimatedTotalJobExposure.textContent = "—";
    return { perShotMinutes: null, totalMinutes: null, estimatedInput: null, units, exposures };
  }

  const totalMinutes = units === "seconds" ? estimatedInput / 60 : estimatedInput;
  const perShotMinutes = totalMinutes / exposures;

  ui.estimatedShotDuration.textContent = `${formatNumber(perShotMinutes, 1)} min`;
  ui.estimatedTotalJobExposure.textContent = `${formatNumber(totalMinutes, 1)} min`;

  return { perShotMinutes, totalMinutes, estimatedInput, units, exposures };
}

function updateBoundaries(attenuationFactor) {
  const exposure1ft = getExposureAt1ft();
  ui.boundaryExposure1ft.textContent = exposure1ft === null ? "—" : `${formatNumber(exposure1ft, 1)} R/hr`;

  if (!exposure1ft) {
    ui.boundary100mr.textContent = "—";
    ui.boundary2mr.textContent = "—";
    return { exposure1ft: null, d100: null, d2: null };
  }

  const d100 = Math.sqrt((exposure1ft * attenuationFactor) / 100);
  const d2 = Math.sqrt((exposure1ft * attenuationFactor) / 2);

  ui.boundary100mr.textContent = `${formatNumber(d100, 2)} ft`;
  ui.boundary2mr.textContent = `${formatNumber(d2, 2)} ft`;

  return { exposure1ft, d100, d2 };
}

function getExposureEstimateMinutes(spd) {
  const activity = n(fields.activity.value);
  const gamma = selectedGamma();
  if (!activity || !spd || !gamma) return null;

  const { totalHVLs } = getAttenuationSummary();
  const attenuationScale = Math.pow(2, totalHVLs);
  return (attenuationScale * Math.pow(spd, 2)) / (activity * gamma * 10);
}

function evaluateShot(shotEl) {
  const config = shotEl.querySelector(".config-input").value;
  const view = shotEl.querySelector(".view-input").value;
  const direction = shotEl.querySelector(".direction-input").value;
  const spd = n(shotEl.querySelector(".spd-input").value);
  const pdd = n(shotEl.querySelector(".pdd").value);
  const d = n(shotEl.querySelector(".d-input").value);
  const ugLimit = n(shotEl.querySelector(".ug-limit").value) ?? DEFAULT_UG_LIMIT;

  const spdMinEl = shotEl.querySelector(".spd-min");
  const pddMaxEl = shotEl.querySelector(".pdd-max");
  const ugEl = shotEl.querySelector(".ug");
  const ugStatusEl = shotEl.querySelector(".ug-status");
  const helperEl = shotEl.querySelector(".shot-helper");
  const magEl = shotEl.querySelector(".magnification");
  const exposureEl = shotEl.querySelector(".exposure");
  const shotWarningsEl = shotEl.querySelector(".shot-warnings");

  shotWarningsEl.innerHTML = "";

  if (!d || !ugLimit) {
    helperEl.textContent = "Set d and Ug_limit to enable calculations.";
    [spdMinEl, pddMaxEl, ugEl, ugStatusEl, magEl, exposureEl].forEach((el) => (el.textContent = "—"));
    return { warnings: ["Missing d or Ug_limit."], data: null };
  }

  const spdMin = pdd ? (d * pdd) / ugLimit : null;
  const pddMax = spd ? (ugLimit * spd) / d : null;
  spdMinEl.textContent = spdMin === null ? "—" : `${formatNumber(spdMin, 2)} in`;
  pddMaxEl.textContent = pddMax === null ? "—" : `${formatNumber(pddMax, 2)} in`;

  let ug = null;
  let ugPass = null;
  const warnings = [];

  if (!spd && !pdd) {
    helperEl.textContent = "Enter PDD or SPD to calculate the other distance.";
    ugEl.textContent = "—";
    ugStatusEl.textContent = "—";
  } else if (spd && pdd) {
    helperEl.textContent = "Two-way solve active with full UG validation.";
    ug = (d * pdd) / spd;
    ugPass = ug <= ugLimit;
    ugEl.textContent = formatNumber(ug, 4);
    ugStatusEl.textContent = ugPass ? "PASS" : "FAIL";

    if (!ugPass) {
      const msg = `FAIL: UG ${formatNumber(ug, 4)} > Ug_limit ${formatNumber(ugLimit, 4)}.`;
      shotWarningsEl.appendChild(createWarning(msg, "red"));
      warnings.push(msg);
    } else {
      shotWarningsEl.appendChild(createWarning(`PASS: UG ${formatNumber(ug, 4)} ≤ Ug_limit ${formatNumber(ugLimit, 4)}.`, "yellow"));
    }
  } else {
    helperEl.textContent = "Enter both PDD and SPD to compute actual UG pass/fail.";
    ugEl.textContent = "—";
    ugStatusEl.textContent = "PENDING";
  }

  const sodApprox = spd && pdd ? spd - pdd : null;
  const magPercent = sodApprox && sodApprox > 0 ? ((spd / sodApprox) - 1) * 100 : null;
  magEl.textContent = magPercent === null ? "—" : `${formatNumber(magPercent, 1)}%`;

  const exposureMinutes = spd ? getExposureEstimateMinutes(spd) : null;
  exposureEl.textContent = exposureMinutes === null ? "—" : `${formatNumber(exposureMinutes, 1)} min`;

  return { warnings, data: { config, view, direction, spd, pdd, d, ugLimit, ug, ugPass, spdMin, pddMax, magPercent, exposureMinutes } };
}

function syncShotDFixedValue() {
  const fixedD = fields.focusSpot.value;
  shotsContainer.querySelectorAll(".d-input").forEach((input) => {
    input.value = fixedD;
  });
}

function evaluateAllShots() {
  const attenuation = getAttenuationSummary();
  const planning = estimatePlanningTimes();
  const boundaries = updateBoundaries(attenuation.attenuationFactor);

  const shotResults = [...shotsContainer.querySelectorAll(".shot-card")].map((shot) => evaluateShot(shot));

  ui.globalWarningsEl.innerHTML = "";
  const missing = [];
  if (!fields.technicianName.value.trim()) missing.push("Technician Name");
  if (!fields.activity.value) missing.push("Source Activity (Ci)");
  if (!fields.focusSpot.value) missing.push("Focal Spot Size d");

  if (missing.length) {
    ui.globalWarningsEl.appendChild(createWarning(`Missing required inputs: ${missing.join(", ")}.`, "red"));
  }

  if (shotResults.some((r) => r.warnings.length > 0)) {
    ui.globalWarningsEl.appendChild(createWarning("One or more shot cards are out of UG or geometry limits.", "red"));
  }

  return { attenuation, planning, boundaries, shotResults };
}

function addMaterial(seed = {}) {
  materialCounter += 1;
  const fragment = materialTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".material-row");
  row.dataset.materialId = String(materialCounter);

  const materialSelect = row.querySelector(".material-name");
  const thicknessInput = row.querySelector(".material-thickness");
  const hvlInput = row.querySelector(".material-hvl");
  const overrideInput = row.querySelector(".material-override");

  materialSelect.value = seed.materialName ?? "Steel";
  thicknessInput.value = seed.thickness ?? "";
  overrideInput.checked = seed.override ?? false;

  refreshMaterialRowFromLookup(row);
  if (seed.hvl) hvlInput.value = seed.hvl;

  [materialSelect, thicknessInput, hvlInput, overrideInput].forEach((input) => {
    input.addEventListener("input", () => {
      if (input === materialSelect || input === overrideInput) refreshMaterialRowFromLookup(row);
      evaluateAllShots();
    });
    input.addEventListener("change", () => {
      if (input === materialSelect || input === overrideInput) refreshMaterialRowFromLookup(row);
      evaluateAllShots();
    });
  });

  row.querySelector(".remove-material").addEventListener("click", () => {
    row.remove();
    evaluateAllShots();
  });

  materialsContainer.appendChild(fragment);
  evaluateAllShots();
}

function refreshAllMaterialRowsFromLookup() {
  materialsContainer.querySelectorAll(".material-row").forEach((row) => refreshMaterialRowFromLookup(row));
}

function addShot() {
  shotCounter += 1;
  const fragment = shotTemplate.content.cloneNode(true);
  const shotEl = fragment.querySelector(".shot-card");
  shotEl.querySelector(".shot-name").textContent = `Shot ${shotCounter} — Config 1`;

  const spdInput = shotEl.querySelector(".spd-input");
  const pddInput = shotEl.querySelector(".pdd");
  const ugLimitInput = shotEl.querySelector(".ug-limit");
  const dInput = shotEl.querySelector(".d-input");
  const configInput = shotEl.querySelector(".config-input");
  const viewInput = shotEl.querySelector(".view-input");
  const directionInput = shotEl.querySelector(".direction-input");

  dInput.value = fields.focusSpot.value || "";
  ugLimitInput.value = String(DEFAULT_UG_LIMIT);
  configInput.value = "1";

  const syncHeader = () => {
    shotEl.querySelector(".shot-name").textContent = `Shot ${shotCounter} — Config ${configInput.value}`;
  };
  syncHeader();

  [spdInput, pddInput, ugLimitInput, configInput, viewInput, directionInput].forEach((input) => {
    input.addEventListener("input", () => {
      syncHeader();
      evaluateAllShots();
    });
    input.addEventListener("change", () => {
      syncHeader();
      evaluateAllShots();
    });
  });

  shotEl.querySelector(".remove-shot").addEventListener("click", () => {
    shotEl.remove();
    evaluateAllShots();
  });

  shotsContainer.appendChild(fragment);
  evaluateAllShots();
}

function buildPdfLines(summary) {
  const { attenuation, planning, boundaries, shotResults } = summary;
  const lines = [];

  lines.push("RT Shot & Safety Calculator Report");
  lines.push("=============================================");
  lines.push(`Technician Name: ${fields.technicianName.value || "-"}`);
  lines.push(`Job / Work Order: ${fields.jobWorkOrder.value || "-"}`);
  lines.push(`Location / Unit: ${fields.locationUnit.value || "-"}`);
  lines.push(`Date: ${fields.jobDate.value || "-"}`);
  lines.push("");

  lines.push("Source Information");
  lines.push(`Isotope: ${fields.isotope.value}`);
  lines.push(`Source Activity (Ci): ${fields.activity.value || "-"}`);
  lines.push(`Focal Spot Size d: ${fields.focusSpot.value || "-"}`);
  lines.push(`Source serial / camera ID: ${fields.sourceSerial.value || "-"}`);
  lines.push(`Gamma Constant (Γ): ${fields.gammaConstant.value || "-"}`);
  lines.push("");

  lines.push("ESTIMATE – Pre-job planning");
  lines.push(`Estimated total exposure input: ${fields.estimatedTotalExposure.value || "-"} ${fields.exposureUnits.value}`);
  lines.push(`Number of exposures: ${fields.numberOfExposures.value || "-"}`);
  lines.push(`Estimated exposure @ 1 ft (unshielded): ${boundaries.exposure1ft === null ? "-" : `${formatNumber(boundaries.exposure1ft, 1)} R/hr`}`);
  lines.push(`Estimated exposure per shot: ${planning.perShotMinutes === null ? "-" : `${formatNumber(planning.perShotMinutes, 1)} min`}`);
  lines.push(`Estimated total exposure time: ${planning.totalMinutes === null ? "-" : `${formatNumber(planning.totalMinutes, 1)} min`}`);
  lines.push("");

  lines.push("Material Attenuation Stack");
  attenuation.materials.forEach((m, idx) => {
    lines.push(`Layer ${idx + 1}: ${m.materialName} | Thickness: ${m.thickness ?? "-"} in | HVL: ${m.hvl ?? "-"} in | HVL_count: ${m.hvlCount === null ? "-" : formatNumber(m.hvlCount, 3)}${m.override ? " (override)" : ""}`);
  });
  lines.push(`Total_HVLs: ${formatNumber(attenuation.totalHVLs, 3)}`);
  lines.push(`Attenuation_factor (0.5 ^ total_HVLs): ${formatNumber(attenuation.attenuationFactor, 6)}`);
  lines.push("");

  lines.push("Radiation Boundaries");
  lines.push(`Exposure_1ft (unshielded): ${boundaries.exposure1ft === null ? "-" : `${formatNumber(boundaries.exposure1ft, 1)} R/hr`}`);
  lines.push(`100 mR/hr distance (Shielded): ${boundaries.d100 === null ? "-" : `${formatNumber(boundaries.d100, 2)} ft`}`);
  lines.push(`2 mR/hr distance (Shielded): ${boundaries.d2 === null ? "-" : `${formatNumber(boundaries.d2, 2)} ft`}`);
  lines.push("");

  lines.push("Shot Cards / Step 5 UG");
  shotResults.forEach((result, idx) => {
    lines.push(`Shot ${idx + 1}`);
    if (!result.data) {
      lines.push("  Incomplete shot inputs.");
      return;
    }
    lines.push(`  Shot #: ${idx + 1}`);
    lines.push(`  Config: ${result.data.config}`);
    lines.push(`  View: ${result.data.view}`);
    lines.push(`  Direction: ${result.data.direction}`);
    lines.push(`  SPD: ${result.data.spd === null ? "-" : `${formatNumber(result.data.spd, 2)} in`}`);
    lines.push(`  PDD: ${result.data.pdd === null ? "-" : `${formatNumber(result.data.pdd, 2)} in`}`);
    lines.push(`  Ug_limit: ${formatNumber(result.data.ugLimit, 4)} in`);
    lines.push(`  Minimum SPD required: ${result.data.spdMin === null ? "-" : `${formatNumber(result.data.spdMin, 2)} in`}`);
    lines.push(`  Maximum PDD allowed: ${result.data.pddMax === null ? "-" : `${formatNumber(result.data.pddMax, 2)} in`}`);
    lines.push(`  UG: ${result.data.ug === null ? "-" : formatNumber(result.data.ug, 4)}`);
    lines.push(`  PASS/FAIL: ${result.data.ugPass === null ? "PENDING" : result.data.ugPass ? "PASS" : "FAIL"}`);
    lines.push(`  Est Time: ${result.data.exposureMinutes === null ? "-" : `${formatNumber(result.data.exposureMinutes, 1)} min`}`);
    lines.push(`  Notes: -`);
  });

  return lines;
}

function generatePdf() {
  const summary = evaluateAllShots();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ format: "letter", unit: "pt" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const lines = buildPdfLines(summary);
  const pageHeight = doc.internal.pageSize.height;
  let y = 44;
  lines.forEach((line) => {
    if (y > pageHeight - 44) {
      doc.addPage("letter");
      y = 44;
    }
    doc.text(line, 44, y);
    y += 16;
  });

  doc.save(`rt-shot-safety-${fields.jobDate.value || "report"}.pdf`);
}

addMaterialBtn.addEventListener("click", () => addMaterial());
addShotBtn.addEventListener("click", addShot);
generatePdfBtn.addEventListener("click", generatePdf);

Object.values(fields).forEach((field) => {
  field.addEventListener("input", () => {
    if (field === fields.focusSpot) syncShotDFixedValue();
    if (field === fields.isotope) {
      setGammaDefault();
      refreshAllMaterialRowsFromLookup();
    }
    evaluateAllShots();
  });
  field.addEventListener("change", () => {
    if (field === fields.focusSpot) syncShotDFixedValue();
    if (field === fields.isotope) {
      setGammaDefault();
      refreshAllMaterialRowsFromLookup();
    }
    evaluateAllShots();
  });
});

fields.jobDate.valueAsDate = new Date();
setGammaDefault();
addMaterial({ materialName: "Steel", thickness: "1.00" });
addShot();
syncShotDFixedValue();
evaluateAllShots();
