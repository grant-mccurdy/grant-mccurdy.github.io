const state = {
  data: null,
  assessmentId: null,
  course: "All Courses",
};

const fmtPercent = (value) => `${Math.round(value)}%`;
const weightedAverage = (rows, key) => {
  const total = rows.reduce((sum, row) => sum + row.students, 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + row[key] * row.students, 0) / total;
};

const els = {
  assessmentSelect: document.querySelector("#assessment-select"),
  courseSelect: document.querySelector("#course-select"),
  students: document.querySelector("#metric-students"),
  proficiency: document.querySelector("#metric-proficiency"),
  growth: document.querySelector("#metric-growth"),
  completion: document.querySelector("#metric-completion"),
  barChart: document.querySelector("#bar-chart"),
  skillChart: document.querySelector("#skill-chart"),
  table: document.querySelector("#course-table"),
  barCaption: document.querySelector("#bar-caption"),
  skillCaption: document.querySelector("#skill-caption"),
};

function getAssessment() {
  return state.data.assessments.find((item) => item.id === state.assessmentId);
}

function getRows() {
  const rows = getAssessment().courses;
  if (state.course === "All Courses") return rows;
  return rows.filter((row) => row.course === state.course);
}

function renderMetrics(rows) {
  const students = rows.reduce((sum, row) => sum + row.students, 0);
  const proficiency = weightedAverage(rows, "proficiency");
  const growth = weightedAverage(rows, "growth");
  const completion = weightedAverage(rows, "completion");

  els.students.textContent = students.toLocaleString();
  els.proficiency.textContent = fmtPercent(proficiency);
  els.growth.textContent = growth === 0 ? "Baseline" : `+${Math.round(growth)} pts`;
  els.completion.textContent = fmtPercent(completion);
}

function renderBars(container, items, options = {}) {
  const width = 720;
  const rowHeight = 48;
  const labelWidth = 180;
  const chartWidth = width - labelWidth - 58;
  const height = Math.max(72, items.length * rowHeight + 26);
  const max = options.max ?? 100;

  const rows = items.map((item, index) => {
    const y = 20 + index * rowHeight;
    const barWidth = Math.max(2, (item.value / max) * chartWidth);
    return `
      <g>
        <text x="0" y="${y + 19}" class="chart-label">${item.label}</text>
        <rect x="${labelWidth}" y="${y}" width="${chartWidth}" height="24" rx="4" class="chart-track"></rect>
        <rect x="${labelWidth}" y="${y}" width="${barWidth}" height="24" rx="4" class="chart-bar"></rect>
        <text x="${labelWidth + chartWidth + 14}" y="${y + 18}" class="chart-value">${Math.round(item.value)}%</text>
      </g>
    `;
  }).join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
      ${rows}
    </svg>
  `;
}

function renderCourseChart(rows) {
  renderBars(
    els.barChart,
    rows.map((row) => ({ label: row.course, value: row.proficiency }))
  );
  els.barCaption.textContent = getAssessment().name;
}

function renderSkillChart(rows) {
  const skillTotals = new Map();
  const studentTotals = new Map();

  rows.forEach((row) => {
    Object.entries(row.skills).forEach(([skill, value]) => {
      skillTotals.set(skill, (skillTotals.get(skill) ?? 0) + value * row.students);
      studentTotals.set(skill, (studentTotals.get(skill) ?? 0) + row.students);
    });
  });

  const items = [...skillTotals.entries()]
    .map(([label, total]) => ({ label, value: total / studentTotals.get(label) }))
    .sort((a, b) => b.value - a.value);

  renderBars(els.skillChart, items);
  els.skillCaption.textContent = state.course;
}

function renderTable(rows) {
  els.table.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.course}</td>
      <td>${row.students}</td>
      <td>${fmtPercent(row.proficiency)}</td>
      <td>${row.growth === 0 ? "Baseline" : `+${row.growth} pts`}</td>
      <td>${fmtPercent(row.completion)}</td>
    </tr>
  `).join("");
}

function render() {
  const rows = getRows();
  renderMetrics(rows);
  renderCourseChart(rows);
  renderSkillChart(rows);
  renderTable(rows);
}

function initControls() {
  els.assessmentSelect.innerHTML = state.data.assessments.map((assessment) => `
    <option value="${assessment.id}">${assessment.name}</option>
  `).join("");

  const courses = state.data.assessments[0].courses.map((row) => row.course);
  els.courseSelect.innerHTML = [
    `<option value="All Courses">All Courses</option>`,
    ...courses.map((course) => `<option value="${course}">${course}</option>`)
  ].join("");

  els.assessmentSelect.addEventListener("change", (event) => {
    state.assessmentId = event.target.value;
    render();
  });

  els.courseSelect.addEventListener("change", (event) => {
    state.course = event.target.value;
    render();
  });
}

fetch("../data/synthetic/assessment-dashboard.json")
  .then((response) => {
    if (!response.ok) throw new Error(`Could not load dashboard data: ${response.status}`);
    return response.json();
  })
  .then((data) => {
    state.data = data;
    state.assessmentId = data.assessments[0].id;
    initControls();
    render();
  })
  .catch((error) => {
    document.querySelector(".dashboard-shell").innerHTML = `
      <div class="dashboard-panel">
        <h2>Dashboard data did not load</h2>
        <p>${error.message}</p>
      </div>
    `;
  });
