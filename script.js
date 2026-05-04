let DATA, chart, fullSchedule = [];

window.onload = async () => {
  const res = await fetch("crop_water.json");
  DATA = await res.json();

  DATA.crops.forEach(c =>
    cropSel.innerHTML += `<option>${c.crop}</option>`
  );

  Object.keys(DATA.soil_et_modifier).forEach(s =>
    soilSel.innerHTML += `<option>${s}</option>`
  );

  generateBtn.onclick = generate;
};

function generate() {
  const crop = DATA.crops.find(c => c.crop === cropSel.value);
  const soilFactor = DATA.soil_et_modifier[soilSel.value];
  const rain = +rainMm.value || 0;

  let date = new Date(startDate.value);

  const rootDepth = 0.6;
  const fc = 0.28;
  const pwp = 0.14;
  const TAW = (fc - pwp) * rootDepth * 1000;
  const RAW = 0.5 * TAW;

  let depletion = 0;
  let cumulative = 0;

  fullSchedule = [];

  crop.stages.forEach(stage => {
    for (let d = 0; d < stage.days; d++) {

      const eto = DATA.evapotranspiration_reference_mm_day[getMonth(date)];
      const ETc = eto * stage.kc * soilFactor;

      depletion += ETc - (rain / 30);

      let irrigation = 0;

      if (depletion >= RAW) {
        irrigation = depletion;
        depletion = 0;
      }

      cumulative += ETc;

      fullSchedule.push({
        stage: stage.name,
        ETc,
        irrigation,
        cumulative
      });

      date.setDate(date.getDate() + 1);
    }
  });

  renderAll("All");
}

function renderAll(filter = "All") {
  let data = filter === "All"
    ? fullSchedule
    : fullSchedule.filter(d => d.stage === filter);

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("chart"), {
    data: {
      labels: data.map((_, i) => i + 1),
      datasets: [
        {
          type: "bar",
          label: "Irrigation",
          data: data.map(d => d.irrigation)
        },
        {
          type: "line",
          label: "Cumulative ET",
          data: data.map(d => d.cumulative)
        }
      ]
    }
  });

  renderFilters(filter);
  renderSummary(data);
  renderStages();
}

function renderFilters(active) {
  const stagesList = [...new Set(fullSchedule.map(d => d.stage))];

  filters.innerHTML =
    `<button class="${active==="All"?"active":""}" onclick="renderAll('All')">All</button>` +
    stagesList.map(s =>
      `<button class="${active===s?"active":""}" onclick="renderAll('${s}')">${s}</button>`
    ).join("");
}

function renderSummary(data) {
  const totalET = data.reduce((a,b)=>a+b.ETc,0);
  const events = data.filter(d=>d.irrigation>0).length;

  summary.innerHTML = `
    <div><b>${data.length}</b><br>Days</div>
    <div><b>${events}</b><br>Events</div>
    <div><b>${totalET.toFixed(1)}</b><br>ETcrop</div>
    <div><b>${(totalET*0.9).toFixed(1)}</b><br>Irrigation</div>
    <div><b>${(totalET*0.9).toFixed(1)}</b><br>Volume</div>
    <div><b>FAO</b><br>Model</div>
  `;
}

function renderStages() {
  const grouped = {};

  fullSchedule.forEach(d => {
    if (!grouped[d.stage]) grouped[d.stage] = 0;
    grouped[d.stage] += d.irrigation;
  });

  stages.innerHTML = Object.entries(grouped).map(([k,v]) => `
    <div class="stage-card">
      <h3>${k}</h3>
      <p>Irrigation: ${v.toFixed(1)} mm</p>
    </div>
  `).join("");
}

function getMonth(date){
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][date.getMonth()];
}