const state = {
  source: null,
  records: [],
  focus: "All",
  groupBy: "course",
  metric: "score",
  season: "All",
  preset: "trend",
  toggles: {
    department: true,
    network: false,
    mastery: true,
    sections: false,
  },
  visual: {
    center: "mean",
    ribbonOpacity: 0.16,
    ribbonRange: "50",
    ribbonPopulation: "completed",
    smoothCurves: true,
  },
  table: {
    course: "All",
    grade: "All",
    teacher: "All",
    minCompletion: "All",
    sortKey: "course",
    sortDir: "asc",
  },
};

const metricLabels = {
  score: "Mean Score",
  proficiency: "Proficiency",
  growth: "Growth From Baseline",
  completion: "Completion",
};

const palette = ["#003260", "#c69a36", "#0a477b", "#7b8fa8", "#a87921", "#2f6690", "#6d91b8", "#d2a84b"];
const assetVersion = document.documentElement.dataset.assetVersion || "dashboard-views-v1";

const els = {
  presetButtons: [...document.querySelectorAll(".preset-button")],
  focus: document.querySelector("#focus-select"),
  group: document.querySelector("#group-select"),
  metric: document.querySelector("#metric-select"),
  season: document.querySelector("#season-select"),
  departmentBand: document.querySelector("#toggle-department-band"),
  networkBand: document.querySelector("#toggle-network-band"),
  masteryLine: document.querySelector("#toggle-mastery-line"),
  sectionLines: document.querySelector("#toggle-section-lines"),
  ribbonRange: document.querySelector("#ribbon-range-select"),
  center: document.querySelector("#center-select"),
  ribbonPopulation: document.querySelector("#ribbon-population-select"),
  ribbonOpacity: document.querySelector("#ribbon-opacity"),
  ribbonOpacityValue: document.querySelector("#ribbon-opacity-value"),
  smoothCurves: document.querySelector("#toggle-smooth-curves"),
  students: document.querySelector("#metric-students"),
  latest: document.querySelector("#metric-latest"),
  change: document.querySelector("#metric-change"),
  completion: document.querySelector("#metric-completion"),
  target: document.querySelector("#metric-target"),
  timeChart: document.querySelector("#time-chart"),
  timeLegend: document.querySelector("#time-legend"),
  timeCaption: document.querySelector("#time-caption"),
  completionChart: document.querySelector("#completion-chart"),
  completionCaption: document.querySelector("#completion-caption"),
  distributionChart: document.querySelector("#distribution-chart"),
  distributionCaption: document.querySelector("#distribution-caption"),
  barChart: document.querySelector("#bar-chart"),
  growthChart: document.querySelector("#growth-chart"),
  skillChart: document.querySelector("#skill-chart"),
  table: document.querySelector("#course-table"),
  tableCourse: document.querySelector("#table-course-filter"),
  tableGrade: document.querySelector("#table-grade-filter"),
  tableTeacher: document.querySelector("#table-teacher-filter"),
  tableCompletion: document.querySelector("#table-completion-filter"),
  tableReset: document.querySelector("#table-reset"),
  tableCount: document.querySelector("#table-count"),
  tableSortButtons: [...document.querySelectorAll(".table-sort")],
  tableFirstPeriod: document.querySelector("#table-first-period"),
  tableLatestPeriod: document.querySelector("#table-latest-period"),
  barCaption: document.querySelector("#bar-caption"),
  growthCaption: document.querySelector("#growth-caption"),
  skillCaption: document.querySelector("#skill-caption"),
  insights: document.querySelector("#insight-list"),
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const fmtPct = (value) => `${Math.round(value)}%`;
const fmtPts = (value) => `${value >= 0 ? "+" : ""}${Math.round(value)} pts`;
const unique = (items) => [...new Set(items)].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

function quantile(values, pct) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * pct;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] * (high - index) + sorted[high] * (index - low);
}

function mean(values) {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (!numeric.length) return 0;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function centerValue(values) {
  return state.visual.center === "median" ? quantile(values, 0.5) : mean(values);
}

function currentMetricLabel() {
  if (state.metric === "score") {
    return state.visual.center === "median" ? "Median Score" : "Mean Score";
  }
  return metricLabels[state.metric];
}

function groupKeyFromStudentRecord(record, groupBy = state.groupBy) {
  if (groupBy === "section") return `${record.course} ${record.section} (${record.teacher})`;
  return record[groupBy];
}

function scoreRowsForPeriod(periodId) {
  return filterStudentRecords().filter((record) => {
    if (record.periodId !== periodId) return false;
    return state.visual.ribbonPopulation === "completed" ? record.completed : true;
  });
}

function aggregateScoreByPeriod(groupBy = state.groupBy) {
  const periods = state.source.periods.filter((period) => state.season === "All" || period.season === state.season);
  const periodData = periods.map((period) => {
    const rows = scoreRowsForPeriod(period.id);
    const grouped = new Map();
    rows.forEach((record) => {
      const key = groupKeyFromStudentRecord(record, groupBy);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(record);
    });

    const groups = [...grouped.entries()].map(([key, groupRows]) => {
      const scores = groupRows.map((record) => record.score);
      return {
        key,
        rows: groupRows,
        students: groupRows.length,
        totalStudents: groupRows.length,
        score: centerValue(scores),
        growth: 0,
      };
    }).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

    const scores = rows.map((record) => record.score);
    return {
      period,
      groups,
      rows,
      score: centerValue(scores),
      growth: 0,
    };
  });

  const firstByKey = new Map((periodData[0]?.groups ?? []).map((group) => [group.key, group.score]));
  const firstOverall = periodData[0]?.score ?? 0;
  periodData.forEach((periodItem) => {
    periodItem.growth = periodItem.score - firstOverall;
    periodItem.groups.forEach((group) => {
      group.growth = group.score - (firstByKey.get(group.key) ?? group.score);
    });
  });

  return periodData;
}

function periodDataForTimeSeries(records) {
  return state.metric === "score" ? aggregateScoreByPeriod() : aggregateByPeriod(records);
}

function heatColor(intensity) {
  const start = [232, 239, 246];
  const end = [0, 50, 96];
  const rgb = start.map((channel, index) => Math.round(channel + (end[index] - channel) * intensity));
  return `rgb(${rgb.join(",")})`;
}

function periodByOrder(order) {
  return state.source.periods.find((period) => period.order === order);
}

function deterministicNoise(sectionIndex, periodIndex) {
  const seed = Math.sin((sectionIndex + 1) * 31.7 + (periodIndex + 1) * 17.3) * 10000;
  return (seed - Math.floor(seed) - 0.5) * 4.4;
}

function buildRecords(source) {
  if (Array.isArray(source.records) && source.records.length) {
    return source.records;
  }

  return source.sections.flatMap((section, sectionIndex) => {
    return source.periods.map((period, periodIndex) => {
      const yearStep = periodIndex / 2;
      const spring = period.season === "Spring" ? section.springLift : 0;
      const score = clamp(section.baseline + section.growth * yearStep + spring + deterministicNoise(sectionIndex, periodIndex), 35, 98);
      const proficiency = clamp(score - 8 + section.growth * 0.6 + deterministicNoise(sectionIndex + 4, periodIndex) * 0.55, 20, 96);
      const completion = clamp(91 + spring * 0.55 + section.growth * 0.65 + deterministicNoise(sectionIndex + 8, periodIndex) * 0.45, 82, 100);

      return {
        ...section,
        periodId: period.id,
        periodLabel: period.label,
        year: period.year,
        season: period.season,
        order: period.order,
        score,
        proficiency,
        completion,
        growth: score - section.baseline,
      };
    });
  });
}

function filterRecords(records = state.records) {
  return records.filter((record) => {
    const focusMatch = state.focus === "All" || record.course === state.focus;
    const seasonMatch = state.season === "All" || record.season === state.season;
    return focusMatch && seasonMatch;
  });
}

function filterStudentRecords(records = state.source?.studentRecords ?? []) {
  return records.filter((record) => {
    const focusMatch = state.focus === "All" || record.course === state.focus;
    const seasonMatch = state.season === "All" || record.season === state.season;
    return focusMatch && seasonMatch;
  });
}

function weightedAverage(records, key) {
  const students = records.reduce((sum, record) => sum + record.students, 0);
  if (!students) return 0;
  return records.reduce((sum, record) => sum + record[key] * record.students, 0) / students;
}

function groupKey(record, groupBy = state.groupBy) {
  if (groupBy === "section") return `${record.course} ${record.section} (${record.teacher})`;
  return record[groupBy];
}

function aggregate(records, groupBy = state.groupBy) {
  const groups = new Map();
  records.forEach((record) => {
    const key = groupKey(record, groupBy);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  });

  return [...groups.entries()].map(([key, rows]) => ({
    key,
    rows,
    students: Math.round(weightedAverage(rows, "students")),
    totalStudents: rows.reduce((sum, row) => sum + row.students, 0),
    score: weightedAverage(rows, "score"),
    proficiency: weightedAverage(rows, "proficiency"),
    completion: weightedAverage(rows, "completion"),
    growth: weightedAverage(rows, "growth"),
  })).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}

function aggregateByPeriod(records, groupBy = state.groupBy) {
  const periods = state.source.periods.filter((period) => state.season === "All" || period.season === state.season);
  return periods.map((period) => {
    const periodRows = records.filter((record) => record.periodId === period.id);
    return {
      period,
      groups: aggregate(periodRows, groupBy),
      rows: periodRows,
      score: weightedAverage(periodRows, "score"),
      proficiency: weightedAverage(periodRows, "proficiency"),
      completion: weightedAverage(periodRows, "completion"),
      growth: weightedAverage(periodRows, "growth"),
    };
  });
}

function latestPeriodData(records = filterRecords()) {
  const periods = aggregateByPeriod(records);
  return periods[periods.length - 1] ?? { groups: [], rows: [] };
}

function firstPeriodData(records = filterRecords()) {
  const periods = aggregateByPeriod(records);
  return periods[0] ?? { groups: [], rows: [] };
}

function metricValue(item) {
  return item[state.metric] ?? 0;
}

function metricAllowsBands() {
  return state.metric === "score";
}

function renderMetrics(records) {
  const periods = aggregateByPeriod(records);
  const first = periods[0];
  const latest = periods[periods.length - 1];
  const latestRows = latest?.rows ?? [];
  const firstValue = first ? first[state.metric] : 0;
  const latestValue = latest ? latest[state.metric] : 0;
  const students = latestRows.reduce((sum, row) => sum + row.students, 0);
  const targetRows = latestRows.filter((row) => row.score >= 76);
  const completed = latestRows.reduce((sum, row) => sum + (row.completed ?? row.students), 0);

  els.students.textContent = students.toLocaleString();
  els.latest.textContent = state.metric === "growth" ? fmtPts(latestValue) : fmtPct(latestValue);
  els.change.textContent = fmtPts(latestValue - firstValue);
  els.completion.textContent = fmtPct(weightedAverage(latestRows, "completion"));
  els.target.textContent = completed ? fmtPct((targetRows.reduce((sum, row) => sum + (row.completed ?? row.students), 0) / completed) * 100) : "-";
}

function pointsToPath(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function pointsToCurvePath(points, firstCommand = "M") {
  if (!state.visual.smoothCurves || points.length < 3) return pointsToPath(points).replace(/^M/, firstCommand);

  const tension = 0.82;
  const start = `${firstCommand} ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  const segments = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    const c1 = {
      x: p1.x + ((p2.x - p0.x) / 6) * tension,
      y: p1.y + ((p2.y - p0.y) / 6) * tension,
    };
    const c2 = {
      x: p2.x - ((p3.x - p1.x) / 6) * tension,
      y: p2.y - ((p3.y - p1.y) / 6) * tension,
    };
    segments.push(`C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`);
  }

  return [start, ...segments].join(" ");
}

function renderTimeSeries(records) {
  const width = 980;
  const height = 420;
  const margin = { top: 24, right: 34, bottom: 78, left: 54 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const periodData = periodDataForTimeSeries(records);
  const periods = periodData.map((item) => item.period);
  const groups = unique(periodData.flatMap((item) => item.groups.map((group) => group.key)));
  const yMax = state.metric === "growth" ? 42 : 100;
  const yMin = state.metric === "growth" ? -4 : state.metric === "score" && state.visual.ribbonPopulation === "assigned" ? 0 : state.metric === "score" ? 20 : 35;
  const x = (index) => margin.left + (periods.length <= 1 ? innerWidth / 2 : (index / (periods.length - 1)) * innerWidth);
  const y = (value) => margin.top + innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight;
  const bandScale = (value) => y(state.metric === "growth" ? value - state.source.sections[0].baseline : value);

  const ticks = state.metric === "score" && yMin === 0 ? [0, 25, 50, 75, 100] : state.metric === "score" ? [25, 50, 75, 100] : [40, 55, 70, 85, 100];
  const grid = ticks.filter((tick) => tick >= yMin && tick <= yMax).map((tick) => `
    <g>
      <line x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}" class="axis-grid"></line>
      <text x="${margin.left - 12}" y="${y(tick) + 5}" class="axis-label" text-anchor="end">${tick}</text>
    </g>
  `).join("");

  const departmentBand = state.toggles.department && metricAllowsBands() ? renderBand("department", periods, x, bandScale) : "";
  const networkBand = state.toggles.network && metricAllowsBands() ? renderBand("network", periods, x, bandScale) : "";
  const masteryLine = state.toggles.mastery && metricAllowsBands() ? renderBenchmark(periods, x, y) : "";
  const distributionGlyphs = metricAllowsBands() ? renderDistributionGlyphs(periods, x, y) : "";

  const showComparisons = state.preset !== "trend" || groups.length <= 4;
  const overallPoints = periodData.map((periodItem, periodIndex) => ({
    x: x(periodIndex),
    y: y(periodItem ? metricValue(periodItem) : NaN),
  })).filter((point) => Number.isFinite(point.y));

  const overallLine = overallPoints.length > 1 ? `
    <path d="${pointsToCurvePath(overallPoints)}" fill="none" class="series-line overall-series-line"></path>
    ${overallPoints.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="5" class="series-point overall-series-point"></circle>`).join("")}
  ` : "";

  const groupLines = !showComparisons ? "" : groups.map((group, groupIndex) => {
    const color = state.preset === "comparison" ? palette[groupIndex % palette.length] : "#7b8fa8";
    const points = periodData.map((periodItem, periodIndex) => {
      const groupItem = periodItem.groups.find((item) => item.key === group);
      return { x: x(periodIndex), y: y(groupItem ? metricValue(groupItem) : NaN) };
    }).filter((point) => Number.isFinite(point.y));

    if (points.length < 2) return "";
    const strokeWidth = state.preset === "comparison" ? 3 : 2;
    const circles = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="${state.preset === "comparison" ? 4.3 : 3.2}" fill="${color}" class="series-point comparison-series-point"></circle>`).join("");
    return `
      <path d="${pointsToCurvePath(points)}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="series-line comparison-series-line"></path>
      ${circles}
    `;
  }).join("");

  const sectionLines = state.toggles.sections ? renderSectionLines(records, periods, x, y) : "";

  const xLabels = periods.map((period, index) => `
    <text x="${x(index)}" y="${height - 36}" class="axis-label x-label" text-anchor="end" transform="rotate(-35 ${x(index)} ${height - 36})">${period.label}</text>
  `).join("");

  els.timeChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="${width}" height="${height}" class="chart-bg"></rect>
      ${grid}
      ${networkBand}
      ${departmentBand}
      ${masteryLine}
      ${distributionGlyphs}
      ${sectionLines}
      ${groupLines}
      ${overallLine}
      <line x1="${margin.left}" x2="${width - margin.right}" y1="${margin.top + innerHeight}" y2="${margin.top + innerHeight}" class="axis-line"></line>
      <line x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${margin.top + innerHeight}" class="axis-line"></line>
      ${xLabels}
      <text x="${margin.left}" y="18" class="axis-title">${currentMetricLabel()}</text>
    </svg>
  `;

  els.timeCaption.textContent = `${currentMetricLabel()} by ${state.groupBy} across ${state.season === "All" ? "fall and spring" : state.season.toLowerCase()} assessment periods`;
  renderLegend(groups);
}

function renderBand(key, periods, x, y) {
  const computed = bandFromStudentRecords(key, periods);
  const band = computed ?? state.source.bands[key];
  const lower = periods.map((period, index) => ({ x: x(index), y: y(band.lower[index] ?? band.lower[period.order - 1]) }));
  const upper = periods.map((period, index) => ({ x: x(index), y: y(band.upper[index] ?? band.upper[period.order - 1]) }));
  const lowerReverse = [...lower].reverse();
  const opacity = key === "department" ? state.visual.ribbonOpacity : state.visual.ribbonOpacity * 0.48;
  const path = `${pointsToCurvePath(upper)} ${pointsToCurvePath(lowerReverse, "L")} Z`;
  return `<path d="${path}" class="ribbon ribbon-${key}" style="opacity: ${opacity.toFixed(2)}"></path>`;
}

function bandFromStudentRecords(key, periods) {
  const studentRecords = filterStudentRecords();
  if (!studentRecords.length) return null;

  const lower = [];
  const upper = [];
  const ranges = {
    "50": { department: [0.25, 0.75], network: [0.1, 0.9] },
    "60": { department: [0.2, 0.8], network: [0.1, 0.9] },
    "80": { department: [0.1, 0.9], network: [0.05, 0.95] },
  };
  const [lowerQuantile, upperQuantile] = ranges[state.visual.ribbonRange]?.[key] ?? ranges["50"][key];

  periods.forEach((period) => {
    const rows = studentRecords.filter((record) => record.periodId === period.id);
    const scores = state.visual.ribbonPopulation === "completed"
      ? rows.filter((record) => record.completed).map((record) => record.score)
      : rows.map((record) => record.score);
    lower.push(quantile(scores, lowerQuantile));
    upper.push(quantile(scores, upperQuantile));
  });

  return { lower, upper };
}

function renderBenchmark(periods, x, y) {
  const points = periods.map((period, index) => ({ x: x(index), y: y(state.source.bands.mastery.line[period.order - 1]) }));
  return `<path d="${pointsToCurvePath(points)}" class="benchmark-line"></path>`;
}

function renderDistributionGlyphs(periods, x, y) {
  const studentRecords = filterStudentRecords();
  if (!studentRecords.length) return "";

  return periods.map((period, index) => {
    const rows = studentRecords.filter((record) => {
      if (record.periodId !== period.id) return false;
      return state.visual.ribbonPopulation === "completed" ? record.completed : true;
    });
    const scores = rows.map((record) => record.score).filter((score) => Number.isFinite(score));
    if (scores.length < 4) return "";
    const p10 = quantile(scores, 0.1);
    const p25 = quantile(scores, 0.25);
    const median = quantile(scores, 0.5);
    const p75 = quantile(scores, 0.75);
    const p90 = quantile(scores, 0.9);
    const px = x(index);
    return `
      <g class="distribution-glyph">
        <title>${period.label}: p25 ${Math.round(p25)}%, median ${Math.round(median)}%, p75 ${Math.round(p75)}%, n=${scores.length}</title>
        <line x1="${px}" x2="${px}" y1="${y(p10)}" y2="${y(p90)}" class="distribution-whisker"></line>
        <line x1="${px - 7}" x2="${px + 7}" y1="${y(p25)}" y2="${y(p25)}" class="distribution-box-edge"></line>
        <line x1="${px - 7}" x2="${px + 7}" y1="${y(p75)}" y2="${y(p75)}" class="distribution-box-edge"></line>
        <circle cx="${px}" cy="${y(median)}" r="3.2" class="distribution-median"></circle>
      </g>
    `;
  }).join("");
}

function periodScoreStats(period) {
  const rows = scoreRowsForPeriod(period.id);
  const scores = rows.map((record) => record.score).filter((score) => Number.isFinite(score));
  return {
    period,
    rows,
    n: scores.length,
    mean: mean(scores),
    p10: quantile(scores, 0.1),
    p25: quantile(scores, 0.25),
    median: quantile(scores, 0.5),
    p75: quantile(scores, 0.75),
    p90: quantile(scores, 0.9),
  };
}

function renderCompletionChart() {
  const width = 980;
  const height = 170;
  const margin = { top: 18, right: 34, bottom: 42, left: 54 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const periods = state.source.periods.filter((period) => state.season === "All" || period.season === state.season);
  const x = (index) => margin.left + (periods.length <= 1 ? innerWidth / 2 : (index / (periods.length - 1)) * innerWidth);
  const y = (value) => margin.top + innerHeight - (value / 100) * innerHeight;

  const rows = periods.map((period) => {
    const assigned = filterStudentRecords().filter((record) => record.periodId === period.id);
    const completed = assigned.filter((record) => record.completed);
    return {
      period,
      assigned: assigned.length,
      completed: completed.length,
      completion: assigned.length ? (completed.length / assigned.length) * 100 : 0,
    };
  });

  const grid = [50, 75, 100].map((tick) => `
    <g>
      <line x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}" class="axis-grid"></line>
      <text x="${margin.left - 12}" y="${y(tick) + 4}" class="axis-label" text-anchor="end">${tick}</text>
    </g>
  `).join("");

  const bars = rows.map((row, index) => {
    const barWidth = Math.min(34, innerWidth / Math.max(1, rows.length) * 0.34);
    const px = x(index) - barWidth / 2;
    const barHeight = margin.top + innerHeight - y(row.completion);
    return `
      <g>
        <title>${row.period.label}: ${Math.round(row.completion)}% completed (${row.completed}/${row.assigned})</title>
        <rect x="${px}" y="${margin.top}" width="${barWidth}" height="${innerHeight}" class="completion-track"></rect>
        <rect x="${px}" y="${y(row.completion)}" width="${barWidth}" height="${barHeight}" class="completion-bar"></rect>
      </g>
    `;
  }).join("");

  const points = rows.map((row, index) => ({ x: x(index), y: y(row.completion) }));
  const labels = rows.map((row, index) => `
    <text x="${x(index)}" y="${height - 13}" class="axis-label mini-x-label" text-anchor="middle">${row.period.label.replace(" ", "\n")}</text>
  `).join("");

  els.completionChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="${width}" height="${height}" class="chart-bg"></rect>
      ${grid}
      ${bars}
      <path d="${pointsToCurvePath(points)}" class="completion-line"></path>
      ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" class="completion-point"></circle>`).join("")}
      <line x1="${margin.left}" x2="${width - margin.right}" y1="${margin.top + innerHeight}" y2="${margin.top + innerHeight}" class="axis-line"></line>
      ${labels}
      <text x="${margin.left}" y="15" class="axis-title">Completion</text>
    </svg>
  `;

  const latest = rows[rows.length - 1];
  els.completionCaption.textContent = latest ? `${latest.period.label}: ${Math.round(latest.completion)}% completed (${latest.completed}/${latest.assigned})` : "Assigned vs completed assessment records";
}

function renderDistributionChart() {
  const width = 980;
  const height = 320;
  const margin = { top: 24, right: 34, bottom: 70, left: 54 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const periods = state.source.periods.filter((period) => state.season === "All" || period.season === state.season);
  const stats = periods.map(periodScoreStats);
  const yMin = state.visual.ribbonPopulation === "assigned" ? 0 : 20;
  const x = (index) => margin.left + (periods.length <= 1 ? innerWidth / 2 : (index / (periods.length - 1)) * innerWidth);
  const y = (value) => margin.top + innerHeight - ((value - yMin) / (100 - yMin)) * innerHeight;

  const ticks = yMin === 0 ? [0, 25, 50, 75, 100] : [25, 50, 75, 100];
  const grid = ticks.map((tick) => `
    <g>
      <line x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}" class="axis-grid"></line>
      <text x="${margin.left - 12}" y="${y(tick) + 4}" class="axis-label" text-anchor="end">${tick}</text>
    </g>
  `).join("");

  const boxes = stats.map((stat, index) => {
    const px = x(index);
    const boxWidth = 34;
    const boxY = y(stat.p75);
    const boxHeight = Math.max(2, y(stat.p25) - boxY);
    const center = state.visual.center === "median" ? stat.median : stat.mean;
    return `
      <g class="distribution-box">
        <title>${stat.period.label}: mean ${Math.round(stat.mean)}%, median ${Math.round(stat.median)}%, p25-p75 ${Math.round(stat.p25)}-${Math.round(stat.p75)}%, n=${stat.n}</title>
        <line x1="${px}" x2="${px}" y1="${y(stat.p10)}" y2="${y(stat.p90)}" class="distribution-detail-whisker"></line>
        <rect x="${px - boxWidth / 2}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" class="distribution-detail-box"></rect>
        <line x1="${px - boxWidth / 2}" x2="${px + boxWidth / 2}" y1="${y(stat.median)}" y2="${y(stat.median)}" class="distribution-detail-median"></line>
        <circle cx="${px}" cy="${y(center)}" r="4.3" class="distribution-detail-center"></circle>
      </g>
    `;
  }).join("");

  const centerPoints = stats.map((stat, index) => ({
    x: x(index),
    y: y(state.visual.center === "median" ? stat.median : stat.mean),
  }));
  const labels = periods.map((period, index) => `
    <text x="${x(index)}" y="${height - 28}" class="axis-label x-label" text-anchor="end" transform="rotate(-35 ${x(index)} ${height - 28})">${period.label}</text>
  `).join("");

  els.distributionChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="${width}" height="${height}" class="chart-bg"></rect>
      ${grid}
      ${boxes}
      <path d="${pointsToCurvePath(centerPoints)}" class="distribution-center-line"></path>
      <line x1="${margin.left}" x2="${width - margin.right}" y1="${margin.top + innerHeight}" y2="${margin.top + innerHeight}" class="axis-line"></line>
      <line x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${margin.top + innerHeight}" class="axis-line"></line>
      ${labels}
      <text x="${margin.left}" y="18" class="axis-title">${currentMetricLabel()}</text>
    </svg>
  `;

  const population = state.visual.ribbonPopulation === "completed" ? "completed assessments" : "assigned records";
  els.distributionCaption.textContent = `${currentMetricLabel()} with p10-p90 whiskers and p25-p75 boxes for ${population}`;
}

function renderSectionLines(records, periods, x, y) {
  const sections = aggregate(records, "section");
  return sections.map((section) => {
    const points = periods.map((period, index) => {
      const row = section.rows.find((record) => record.periodId === period.id);
      return row ? { x: x(index), y: y(row[state.metric]) } : null;
    }).filter(Boolean);
    return points.length > 1 ? `<path d="${pointsToCurvePath(points)}" class="section-shadow-line"></path>` : "";
  }).join("");
}

function renderLegend(groups) {
  const populationLabel = state.visual.ribbonPopulation === "completed" ? "completed" : "assigned";
  const rangeLabel = `middle ${state.visual.ribbonRange}%`;
  const departmentLabel = `Main ${rangeLabel} ${populationLabel}`;
  const networkLabel = `Wider context ${populationLabel}`;
  const masteryLabel = state.source.bands.mastery.label ?? "Mastery benchmark";
  const ribbonItems = [
    `<span><i class="legend-line overall-key"></i>Overall trend</span>`,
    state.toggles.department && metricAllowsBands() ? `<span><i class="legend-swatch ribbon-key department-key"></i>${departmentLabel}</span>` : "",
    state.toggles.network && metricAllowsBands() ? `<span><i class="legend-swatch ribbon-key network-key"></i>${networkLabel}</span>` : "",
    state.toggles.mastery && metricAllowsBands() ? `<span><i class="legend-line benchmark-key"></i>${masteryLabel}</span>` : "",
    metricAllowsBands() ? `<span><i class="legend-line distribution-key"></i>Period distribution</span>` : "",
    state.toggles.sections ? `<span><i class="legend-line section-key"></i>Section lines</span>` : "",
  ].filter(Boolean).join("");

  const groupItems = groups.map((group, index) => `
    <span><i class="legend-line" style="--legend-color: ${palette[index % palette.length]}"></i>${group}</span>
  `).join("");

  els.timeLegend.innerHTML = `${ribbonItems}${groupItems}`;
}

function renderBars(container, items, options = {}) {
  const width = 720;
  const rowHeight = 46;
  const labelWidth = options.labelWidth ?? 210;
  const chartWidth = width - labelWidth - 68;
  const height = Math.max(82, items.length * rowHeight + 28);
  const max = options.max ?? 100;
  const min = options.min ?? 0;
  const range = max - min;

  const rows = items.map((item, index) => {
    const y = 20 + index * rowHeight;
    const value = clamp(item.value, min, max);
    const barWidth = Math.max(2, ((value - min) / range) * chartWidth);
    const label = options.format ? options.format(item.value) : fmtPct(item.value);
    return `
      <g>
        <text x="0" y="${y + 19}" class="chart-label">${item.label}</text>
        <rect x="${labelWidth}" y="${y}" width="${chartWidth}" height="24" rx="4" class="chart-track"></rect>
        <rect x="${labelWidth}" y="${y}" width="${barWidth}" height="24" rx="4" class="chart-bar"></rect>
        <text x="${labelWidth + chartWidth + 14}" y="${y + 18}" class="chart-value">${label}</text>
      </g>
    `;
  }).join("");

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">${rows}</svg>`;
}

function renderComparisonBars(records) {
  const latest = latestPeriodData(records);
  const items = latest.groups.map((group) => ({ label: group.key, value: metricValue(group) }))
    .sort((a, b) => b.value - a.value);

  renderBars(els.barChart, items, {
    min: state.metric === "growth" ? -4 : 0,
    max: state.metric === "growth" ? 42 : 100,
    format: state.metric === "growth" ? fmtPts : fmtPct,
  });
  els.barCaption.textContent = `${latest.period?.label ?? ""} by ${state.groupBy}`;
}

function renderGrowthBars(records) {
  const latest = latestPeriodData(records);
  const items = latest.groups.map((group) => ({ label: group.key, value: group.growth }))
    .sort((a, b) => b.value - a.value);

  renderBars(els.growthChart, items, {
    min: -2,
    max: 42,
    format: fmtPts,
  });
  els.growthCaption.textContent = `${latest.period?.label ?? ""} change from first baseline`;
}

function renderSkillHeatmap(records) {
  const latest = latestPeriodData(records);
  const rows = latest.rows;
  const skills = unique(rows.flatMap((record) => Object.keys(record.skills)));
  const groups = aggregate(rows, state.groupBy);
  const width = Math.max(760, 160 + skills.length * 118);
  const rowHeight = 42;
  const left = 180;
  const top = 48;
  const height = top + groups.length * rowHeight + 20;
  const cellWidth = (width - left - 18) / Math.max(1, skills.length);

  const header = skills.map((skill, index) => `
    <text x="${left + index * cellWidth + cellWidth / 2}" y="24" class="heat-label" text-anchor="middle">${skill}</text>
  `).join("");

  const body = groups.map((group, groupIndex) => {
    const y = top + groupIndex * rowHeight;
    const label = `<text x="0" y="${y + 25}" class="chart-label">${group.key}</text>`;
    const cells = skills.map((skill, skillIndex) => {
      const skillRows = group.rows.filter((row) => row.skills[skill] !== undefined);
      const base = skillRows.length ? weightedAverage(skillRows.map((row) => ({ ...row, skillValue: row.score + row.skills[skill] })), "skillValue") : 0;
      const intensity = clamp((base - 45) / 45, 0, 1);
      const fill = heatColor(0.18 + intensity * 0.78);
      return `
        <rect x="${left + skillIndex * cellWidth}" y="${y}" width="${cellWidth - 7}" height="28" rx="4" fill="${fill}" class="heat-cell"></rect>
        <text x="${left + skillIndex * cellWidth + (cellWidth - 7) / 2}" y="${y + 19}" class="heat-value" text-anchor="middle">${base ? Math.round(base) : "-"}</text>
      `;
    }).join("");
    return `${label}${cells}`;
  }).join("");

  els.skillChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">${header}${body}</svg>`;
  els.skillCaption.textContent = `${latest.period?.label ?? ""} synthetic skill scores`;
}

function renderTable(records) {
  const displayedPeriods = state.source.periods.filter((period) => state.season === "All" || period.season === state.season);
  const firstOrder = Math.min(...displayedPeriods.map((period) => period.order));
  const lastOrder = Math.max(...displayedPeriods.map((period) => period.order));
  const firstLabel = periodByOrder(firstOrder).label;
  const lastLabel = periodByOrder(lastOrder).label;
  const sections = aggregate(records, "section");
  const rows = sections.map((section) => {
    const first = section.rows.find((row) => row.order === firstOrder);
    const latest = section.rows.find((row) => row.order === lastOrder);
    return {
      course: latest?.course ?? first?.course ?? "",
      grade: latest?.grade ?? first?.grade ?? "",
      teacher: latest?.teacher ?? first?.teacher ?? "",
      section: latest?.section ?? first?.section ?? "",
      students: latest?.students ?? first?.students ?? 0,
      first: first?.score,
      latest: latest?.score,
      change: first && latest ? latest.score - first.score : null,
      completion: latest?.completion,
    };
  });
  const filteredRows = filterTableRows(rows);
  const sortedRows = sortTableRows(filteredRows);

  els.table.innerHTML = sortedRows.map((row) => {
    return `
      <tr>
        <td>${row.course}</td>
        <td>${row.grade}</td>
        <td>${row.teacher}</td>
        <td>${row.section}</td>
        <td>${row.students}</td>
        <td>${Number.isFinite(row.first) ? fmtPct(row.first) : "-"}</td>
        <td>${Number.isFinite(row.latest) ? fmtPct(row.latest) : "-"}</td>
        <td>${Number.isFinite(row.change) ? fmtPts(row.change) : "-"}</td>
        <td>${Number.isFinite(row.completion) ? fmtPct(row.completion) : "-"}</td>
      </tr>
    `;
  }).join("");

  if (!sortedRows.length) {
    els.table.innerHTML = `<tr><td colspan="9" class="empty-table">No sections match the current filters.</td></tr>`;
  }

  els.tableFirstPeriod.firstChild.textContent = `${firstLabel} `;
  els.tableLatestPeriod.firstChild.textContent = `${lastLabel} `;
  els.tableCount.textContent = `${sortedRows.length} of ${rows.length} sections`;
  renderTableSortState();
}

function filterTableRows(rows) {
  return rows.filter((row) => {
    const minCompletion = Number(state.table.minCompletion);
    const completionMatch = state.table.minCompletion === "All" || (Number.isFinite(row.completion) && row.completion >= minCompletion);
    return (
      (state.table.course === "All" || row.course === state.table.course) &&
      (state.table.grade === "All" || String(row.grade) === state.table.grade) &&
      (state.table.teacher === "All" || row.teacher === state.table.teacher) &&
      completionMatch
    );
  });
}

function sortTableRows(rows) {
  const direction = state.table.sortDir === "asc" ? 1 : -1;
  const numericKeys = new Set(["grade", "students", "first", "latest", "change", "completion"]);
  return [...rows].sort((a, b) => {
    const left = a[state.table.sortKey];
    const right = b[state.table.sortKey];
    if (numericKeys.has(state.table.sortKey)) {
      const leftValue = Number.isFinite(left) ? left : Number.NEGATIVE_INFINITY;
      const rightValue = Number.isFinite(right) ? right : Number.NEGATIVE_INFINITY;
      if (leftValue !== rightValue) return (leftValue - rightValue) * direction;
    } else {
      const comparison = String(left).localeCompare(String(right), undefined, { numeric: true });
      if (comparison !== 0) return comparison * direction;
    }

    return `${a.course} ${a.grade} ${a.teacher} ${a.section}`.localeCompare(
      `${b.course} ${b.grade} ${b.teacher} ${b.section}`,
      undefined,
      { numeric: true },
    );
  });
}

function renderTableSortState() {
  els.tableSortButtons.forEach((button) => {
    const active = button.dataset.sort === state.table.sortKey;
    button.querySelector("span").textContent = active ? (state.table.sortDir === "asc" ? "▲" : "▼") : "";
    const label = button.firstChild?.textContent.trim() || button.dataset.sort;
    const nextDirection = active && state.table.sortDir === "asc" ? "descending" : "ascending";
    button.setAttribute("aria-label", `Sort by ${label} ${nextDirection}`);
  });
}

function renderInsights(records) {
  const latest = latestPeriodData(records);
  const first = firstPeriodData(records);
  const latestGroups = latest.groups;
  const firstGroups = new Map(first.groups.map((group) => [group.key, group]));
  const rankedGrowth = latestGroups.map((group) => {
    const start = firstGroups.get(group.key);
    return { key: group.key, change: start ? group.score - start.score : 0, score: group.score };
  }).sort((a, b) => b.change - a.change);

  const strongest = rankedGrowth[0];
  const watch = [...rankedGrowth].sort((a, b) => a.score - b.score)[0];
  const completion = weightedAverage(latest.rows, "completion");
  const band = state.source.bands.department;
  const latestTarget = band.lower[(latest.period?.order ?? 1) - 1];

  const notes = [
    strongest ? `${strongest.key} shows the strongest synthetic trend at ${fmtPts(strongest.change)} since the first selected period.` : "No trend is available for the current filter.",
    watch ? `${watch.key} is the lowest latest group at ${fmtPct(watch.score)}, making it a candidate for item-level review or targeted supports.` : "No watch group is available for the current filter.",
    `Latest completion is ${fmtPct(completion)}, which is ${completion >= 95 ? "above" : "below"} the operating target of 95%.`,
    `The score ribbons are calibrated from a private assessment score distribution, then regenerated as synthetic 30-question assessment data with declining non-participation over time.`,
    `The department range lower bound for the latest period is ${fmtPct(latestTarget)}; use the ribbon to compare current performance with the synthetic benchmark corridor.`
  ];

  els.insights.innerHTML = notes.map((note) => `<li>${note}</li>`).join("");
}

function syncControls() {
  els.focus.value = state.focus;
  els.group.value = state.groupBy;
  els.metric.value = state.metric;
  els.season.value = state.season;
  els.departmentBand.checked = state.toggles.department;
  els.networkBand.checked = state.toggles.network;
  els.masteryLine.checked = state.toggles.mastery;
  els.sectionLines.checked = state.toggles.sections;
  els.ribbonRange.value = state.visual.ribbonRange;
  els.center.value = state.visual.center;
  els.ribbonPopulation.value = state.visual.ribbonPopulation;
  els.ribbonOpacity.value = state.visual.ribbonOpacity;
  els.ribbonOpacityValue.textContent = `${Math.round(state.visual.ribbonOpacity * 100)}%`;
  els.smoothCurves.checked = state.visual.smoothCurves;
  renderPresetState();
}

function renderPresetState() {
  els.presetButtons.forEach((button) => {
    const active = button.dataset.preset === state.preset;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function applyPreset(preset) {
  state.preset = preset;

  if (preset === "trend") {
    state.focus = "All";
    state.groupBy = "course";
    state.metric = "score";
    state.season = "All";
    state.toggles.department = true;
    state.toggles.network = false;
    state.toggles.mastery = true;
    state.toggles.sections = false;
    state.visual.center = "mean";
    state.visual.ribbonRange = "50";
    state.visual.ribbonPopulation = "completed";
    state.visual.ribbonOpacity = 0.16;
    state.visual.smoothCurves = true;
  }

  if (preset === "comparison") {
    state.groupBy = "course";
    state.metric = "score";
    state.season = "All";
    state.toggles.department = true;
    state.toggles.network = false;
    state.toggles.mastery = true;
    state.toggles.sections = false;
    state.visual.center = "mean";
    state.visual.ribbonRange = "50";
    state.visual.ribbonPopulation = "completed";
    state.visual.ribbonOpacity = 0.12;
    state.visual.smoothCurves = true;
  }

  if (preset === "rollout") {
    state.groupBy = "course";
    state.metric = "completion";
    state.season = "All";
    state.toggles.department = false;
    state.toggles.network = false;
    state.toggles.mastery = false;
    state.toggles.sections = false;
    state.visual.center = "mean";
    state.visual.ribbonRange = "50";
    state.visual.ribbonPopulation = "assigned";
    state.visual.ribbonOpacity = 0.1;
    state.visual.smoothCurves = true;
  }

  if (preset === "distribution") {
    state.groupBy = "course";
    state.metric = "score";
    state.season = "All";
    state.toggles.department = true;
    state.toggles.network = true;
    state.toggles.mastery = true;
    state.toggles.sections = false;
    state.visual.center = "median";
    state.visual.ribbonRange = "80";
    state.visual.ribbonPopulation = "completed";
    state.visual.ribbonOpacity = 0.12;
    state.visual.smoothCurves = true;
  }

  syncControls();
  render();
}

function render() {
  const records = filterRecords();
  renderMetrics(records);
  renderTimeSeries(records);
  renderCompletionChart();
  renderDistributionChart();
  renderComparisonBars(records);
  renderGrowthBars(records);
  renderSkillHeatmap(records);
  renderTable(records);
  renderInsights(records);
  renderPresetState();
}

function initControls() {
  const courses = unique(state.source.sections.map((section) => section.course));
  els.focus.innerHTML = [`<option value="All">All Courses</option>`, ...courses.map((course) => `<option value="${course}">${course}</option>`)].join("");
  els.tableCourse.innerHTML = [`<option value="All">All Courses</option>`, ...courses.map((course) => `<option value="${course}">${course}</option>`)].join("");
  els.tableGrade.innerHTML = [`<option value="All">All Grades</option>`, ...unique(state.source.sections.map((section) => section.grade)).map((grade) => `<option value="${grade}">${grade}</option>`)].join("");
  els.tableTeacher.innerHTML = [`<option value="All">All Teachers</option>`, ...unique(state.source.sections.map((section) => section.teacher)).map((teacher) => `<option value="${teacher}">${teacher}</option>`)].join("");

  els.presetButtons.forEach((button) => {
    button.addEventListener("click", () => applyPreset(button.dataset.preset));
  });

  els.focus.addEventListener("change", (event) => {
    state.focus = event.target.value;
    render();
  });

  els.group.addEventListener("change", (event) => {
    state.groupBy = event.target.value;
    render();
  });

  els.metric.addEventListener("change", (event) => {
    state.metric = event.target.value;
    render();
  });

  els.season.addEventListener("change", (event) => {
    state.season = event.target.value;
    render();
  });

  els.tableCourse.addEventListener("change", (event) => {
    state.table.course = event.target.value;
    render();
  });

  els.tableGrade.addEventListener("change", (event) => {
    state.table.grade = event.target.value;
    render();
  });

  els.tableTeacher.addEventListener("change", (event) => {
    state.table.teacher = event.target.value;
    render();
  });

  els.tableCompletion.addEventListener("change", (event) => {
    state.table.minCompletion = event.target.value;
    render();
  });

  els.tableReset.addEventListener("click", () => {
    state.table.course = "All";
    state.table.grade = "All";
    state.table.teacher = "All";
    state.table.minCompletion = "All";
    state.table.sortKey = "course";
    state.table.sortDir = "asc";
    els.tableCourse.value = "All";
    els.tableGrade.value = "All";
    els.tableTeacher.value = "All";
    els.tableCompletion.value = "All";
    render();
  });

  els.tableSortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const sortKey = button.dataset.sort;
      if (state.table.sortKey === sortKey) {
        state.table.sortDir = state.table.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.table.sortKey = sortKey;
        state.table.sortDir = ["students", "first", "latest", "change", "completion"].includes(sortKey) ? "desc" : "asc";
      }
      render();
    });
  });

  els.departmentBand.addEventListener("change", (event) => {
    state.toggles.department = event.target.checked;
    render();
  });

  els.networkBand.addEventListener("change", (event) => {
    state.toggles.network = event.target.checked;
    render();
  });

  els.masteryLine.addEventListener("change", (event) => {
    state.toggles.mastery = event.target.checked;
    render();
  });

  els.sectionLines.addEventListener("change", (event) => {
    state.toggles.sections = event.target.checked;
    render();
  });

  els.ribbonRange.addEventListener("change", (event) => {
    state.visual.ribbonRange = event.target.value;
    render();
  });

  els.center.addEventListener("change", (event) => {
    state.visual.center = event.target.value;
    render();
  });

  els.ribbonPopulation.addEventListener("change", (event) => {
    state.visual.ribbonPopulation = event.target.value;
    render();
  });

  els.ribbonOpacity.addEventListener("input", (event) => {
    state.visual.ribbonOpacity = Number(event.target.value);
    els.ribbonOpacityValue.textContent = `${Math.round(state.visual.ribbonOpacity * 100)}%`;
    render();
  });

  els.smoothCurves.addEventListener("change", (event) => {
    state.visual.smoothCurves = event.target.checked;
    render();
  });

  syncControls();
}

fetch(`../data/synthetic/assessment-dashboard.json?v=${assetVersion}`)
  .then((response) => {
    if (!response.ok) throw new Error(`Could not load dashboard data: ${response.status}`);
    return response.json();
  })
  .then((source) => {
    state.source = source;
    state.records = buildRecords(source);
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
