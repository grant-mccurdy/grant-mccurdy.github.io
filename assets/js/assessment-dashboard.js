const {
  averageFinite,
  boyEoyPairs,
  clamp,
  escapeHtml,
  escapeSvgText,
  fmtPct,
  fmtPts,
  fmtPtsAuto,
  mean,
  quantile,
  unique,
} = window.AssessmentCore;
const {
  layoutRightLabels,
  niceTicks,
  pointsToCurvePath: buildCurvePath,
  pointsToPath,
} = window.AssessmentCharts;

const state = {
  source: null,
  records: [],
  groupBy: "course",
  metric: "score",
  season: "All",
  toggles: {
    department: true,
    network: false,
    mastery: true,
    violins: false,
    sections: false,
  },
  visual: {
    center: "mean",
    ribbonOpacity: 0.16,
    ribbonRange: "50",
    ribbonPopulation: "completed",
    smoothCurves: true,
  },
  lines: {
    minN: 10,
    sortCut: "latest",
    filter: "",
    limit: "5",
  },
  trend: {
    historyYears: "5",
    benchmarkCourse: "",
  },
  filters: {
    courses: [],
    teachers: [],
    sections: [],
    sectionQuery: "",
  },
  ui: {
    activeView: "overview",
    sectionFiltersRendered: false,
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
  completion: "Completion",
};

const sliceLabels = {
  course: "subject",
  grade: "grade",
  teacher: "teacher",
  section: "section",
};

const palette = ["#2563eb", "#0891b2", "#16a34a", "#7c3aed", "#db2777", "#4f46e5", "#0d9488", "#65a30d", "#0284c7", "#9333ea"];
const assetVersion = document.documentElement.dataset.assetVersion || "dashboard-views-v1";

const els = {
  taskButtons: [...document.querySelectorAll("[data-dashboard-view]")],
  taskPanels: [...document.querySelectorAll("[data-dashboard-panel]")],
  comparisonTools: document.querySelector("#dashboard-comparison-tools"),
  compareBy: [...document.querySelectorAll("input[name='compare-by']")],
  metric: document.querySelector("#metric-select"),
  season: document.querySelector("#season-select"),
  trendHistory: document.querySelector("#trend-history-select"),
  trendBenchmarkCourse: document.querySelector("#trend-benchmark-course"),
  departmentBand: document.querySelector("#toggle-department-band"),
  networkBand: document.querySelector("#toggle-network-band"),
  masteryLine: document.querySelector("#toggle-mastery-line"),
  violinPlots: document.querySelector("#toggle-violin-plots"),
  sectionLines: document.querySelector("#toggle-section-lines"),
  ribbonRange: document.querySelector("#ribbon-range-select"),
  center: document.querySelector("#center-select"),
  ribbonPopulation: document.querySelector("#ribbon-population-select"),
  ribbonOpacity: document.querySelector("#ribbon-opacity"),
  ribbonOpacityValue: document.querySelector("#ribbon-opacity-value"),
  smoothCurves: document.querySelector("#toggle-smooth-curves"),
  lineMinN: document.querySelector("#line-min-n"),
  lineMinNValue: document.querySelector("#line-min-n-value"),
  lineSort: document.querySelector("#line-sort-select"),
  lineFilter: document.querySelector("#line-filter"),
  lineLimit: document.querySelector("#line-limit-select"),
  sliceSummary: document.querySelector("#slice-filter-summary"),
  sliceClear: document.querySelector("#slice-filter-clear"),
  courseFilters: document.querySelector("#course-filter-options"),
  teacherFilters: document.querySelector("#teacher-filter-options"),
  sectionFilters: document.querySelector("#section-filter-options"),
  sectionFilterCount: document.querySelector("#section-filter-count"),
  sectionFilterSearch: document.querySelector("#section-filter-search"),
  sectionFilterSelectVisible: document.querySelector("#section-filter-select-visible"),
  sectionFilterClear: document.querySelector("#section-filter-clear"),
  sourceProject: document.querySelector("#source-project"),
  sourceGenerated: document.querySelector("#source-generated"),
  sourceCounts: document.querySelector("#source-counts"),
  sourceContract: document.querySelector("#source-contract"),
  students: document.querySelector("#metric-students"),
  latest: document.querySelector("#metric-latest"),
  latestLabel: document.querySelector("#metric-latest-label"),
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
  performanceGrowthChart: document.querySelector("#performance-growth-chart"),
  performanceGrowthCaption: document.querySelector("#performance-growth-caption"),
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

function centerValue(values) {
  return state.visual.center === "median" ? quantile(values, 0.5) : mean(values);
}

function averageBoyEoyDeltaForRows(rows, metricKey = state.metric, pairs = null) {
  const rowByPeriod = new Map(rows.map((row) => [row.periodId, row]));
  const sourcePeriods = pairs ?? boyEoyPairs(rows.map((row) => ({
    id: row.periodId,
    label: row.periodLabel,
    season: row.season,
    assessmentWindow: row.assessmentWindow,
    order: row.order,
  })));
  const deltas = sourcePeriods.map(({ begin, end }) => {
    const beginValue = rowByPeriod.get(begin.id)?.[metricKey];
    const endValue = rowByPeriod.get(end.id)?.[metricKey];
    return Number.isFinite(beginValue) && Number.isFinite(endValue) ? endValue - beginValue : NaN;
  });
  const numeric = deltas.filter((value) => Number.isFinite(value));

  return {
    value: averageFinite(numeric),
    count: numeric.length,
    pairCount: sourcePeriods.length,
  };
}

function averageBoyEoyDeltaForPeriodData(periodData, metricKey = state.metric) {
  const periodById = new Map(periodData.map((periodItem) => [periodItem.period.id, periodItem]));
  const pairs = boyEoyPairs(periodData.map((periodItem) => periodItem.period));
  const deltas = pairs.map(({ begin, end }) => {
    const beginValue = periodById.get(begin.id)?.[metricKey];
    const endValue = periodById.get(end.id)?.[metricKey];
    return Number.isFinite(beginValue) && Number.isFinite(endValue) ? endValue - beginValue : NaN;
  });
  const numeric = deltas.filter((value) => Number.isFinite(value));

  return {
    value: averageFinite(numeric),
    count: numeric.length,
    pairCount: pairs.length,
  };
}

function averageBoyEoyDeltaFromLineValues(values) {
  const valueByPeriod = new Map(values.map((value) => [value.period.id, value.value]));
  const pairs = boyEoyPairs(values.map((value) => value.period));
  const deltas = pairs.map(({ begin, end }) => {
    const beginValue = valueByPeriod.get(begin.id);
    const endValue = valueByPeriod.get(end.id);
    return Number.isFinite(beginValue) && Number.isFinite(endValue) ? endValue - beginValue : NaN;
  });
  const numeric = deltas.filter((value) => Number.isFinite(value));

  return {
    value: averageFinite(numeric),
    count: numeric.length,
    pairCount: pairs.length,
  };
}

function boyEoyDeltasByGroup(periodData, metricKey = state.metric) {
  const minN = Math.max(1, Number(state.lines.minN) || 1);
  const pairs = boyEoyPairs(periodData.map((periodItem) => periodItem.period));
  const groupsByPeriod = new Map(periodData.map((periodItem) => [
    periodItem.period.id,
    new Map(periodItem.groups.map((group) => [group.key, group])),
  ]));
  const keys = unique(periodData.flatMap((periodItem) => periodItem.groups.map((group) => group.key)));

  return keys.map((key) => {
    const deltas = pairs.map(({ begin, end }) => {
      const beginGroup = groupsByPeriod.get(begin.id)?.get(key);
      const endGroup = groupsByPeriod.get(end.id)?.get(key);
      if (groupSampleSize(beginGroup) < minN || groupSampleSize(endGroup) < minN) return NaN;
      const beginValue = beginGroup?.[metricKey];
      const endValue = endGroup?.[metricKey];
      return Number.isFinite(beginValue) && Number.isFinite(endValue) ? endValue - beginValue : NaN;
    });
    const numeric = deltas.filter((value) => Number.isFinite(value));
    return {
      key,
      value: averageFinite(numeric),
      count: numeric.length,
      pairCount: pairs.length,
    };
  }).filter((item) => item.count > 0 && Number.isFinite(item.value));
}

function deltaSortValue(value, fallback = Number.NEGATIVE_INFINITY) {
  return Number.isFinite(value) ? value : fallback;
}

function currentMetricLabel() {
  if (state.metric === "score") {
    return state.visual.center === "median" ? "Median Score" : "Mean Score";
  }
  return metricLabels[state.metric];
}

function currentSliceLabel(plural = false) {
  const label = sliceLabels[state.groupBy] ?? state.groupBy;
  return plural ? `${label}s` : label;
}

function periodDisplayLabel(period) {
  return period.shortLabel ?? period.label;
}

function inferredAcademicYear(period) {
  if (period.academicYear) return String(period.academicYear);
  const order = Number(period.order);
  if (!Number.isFinite(order) || order < 1) return "";
  const start = 2019 + Math.floor((order - 1) / 2);
  return `${start}-${String(start + 1).slice(-2)}`;
}

function periodWindowCode(period, compact = false) {
  const explicit = String(period.windowCode ?? "").toUpperCase();
  if (explicit === "BOY" || explicit === "EOY") return compact ? explicit[0] : explicit;
  const phase = String(period.assessmentWindow ?? period.season ?? "").toLowerCase();
  if (phase.includes("beginning")) return compact ? "B" : "BOY";
  if (phase.includes("end")) return compact ? "E" : "EOY";
  return "";
}

function periodAxisLabelParts(period) {
  const academicYear = inferredAcademicYear(period);
  const windowCode = periodWindowCode(period);
  if (academicYear && windowCode) {
    return {
      primary: academicYear,
      secondary: windowCode,
      title: period.label ?? `${academicYear} ${windowCode} standardized math assessment`,
    };
  }

  return {
    primary: period.shortLabel ?? period.label,
    secondary: "",
    title: period.label ?? period.shortLabel ?? "",
  };
}

function periodCompactAxisLabel(period) {
  const academicYear = inferredAcademicYear(period);
  const windowCode = periodWindowCode(period, true);
  return academicYear && windowCode ? `${academicYear.slice(2)} ${windowCode}` : periodDisplayLabel(period);
}

function periodAxisLabel(period, x, y, options = {}) {
  const {
    anchor = "middle",
    className = "axis-label x-label",
    compact = false,
    rotate = "",
  } = options;

  if (compact || rotate) {
    const label = compact ? periodCompactAxisLabel(period) : `${periodAxisLabelParts(period).primary} ${periodAxisLabelParts(period).secondary}`.trim();
    return `<text x="${x}" y="${y}" class="${className}" text-anchor="${anchor}"${rotate}>${escapeSvgText(label)}<title>${escapeSvgText(periodAxisLabelParts(period).title)}</title></text>`;
  }

  const label = periodAxisLabelParts(period);
  return `
    <text x="${x}" y="${y}" class="${className}" text-anchor="${anchor}">
      <title>${escapeSvgText(label.title)}</title>
      <tspan x="${x}">${escapeSvgText(label.primary)}</tspan>
      ${label.secondary ? `<tspan x="${x}" dy="16" class="x-label-sub">${escapeSvgText(label.secondary)}</tspan>` : ""}
    </text>
  `;
}

function compactDirectLabel(value, maxLength = 18) {
  const label = String(value);
  return label.length > maxLength ? `${label.slice(0, maxLength - 3)}...` : label;
}

function sourceRecordCounts(source) {
  return source.source?.recordCounts ?? {
    periods: source.periods?.length ?? 0,
    sections: source.sections?.length ?? 0,
    aggregateRecords: source.records?.length ?? 0,
    syntheticStudentRecords: source.studentRecords?.length ?? 0,
  };
}

function formatContract(value) {
  if (!value) return "Static JSON";
  if (value === "sql-extract-dashboard-json-v1") return "SQL extract JSON v1";
  return String(value)
    .replace("static-assessment-dashboard-json-", "Static JSON ")
    .replaceAll("-", " ")
    .replace(/\bv(\d+)\b/i, "v$1");
}

const isCompactViewport = () => window.matchMedia("(max-width: 700px)").matches;

function renderSourceMetadata(source) {
  const metadata = source.source ?? {};
  const counts = sourceRecordCounts(source);
  const project = metadata.project ?? "assessment-intelligence";
  if (els.sourceProject) els.sourceProject.textContent = project;
  if (els.sourceGenerated) els.sourceGenerated.textContent = source.generated ?? "-";
  if (els.sourceCounts) {
    els.sourceCounts.textContent = `${counts.sections ?? 0} sections / ${counts.syntheticStudentRecords ?? 0} entity-period rows`;
  }
  if (els.sourceContract) els.sourceContract.textContent = formatContract(metadata.contract);
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
  const stops = [
    [220, 38, 38],
    [234, 88, 12],
    [22, 163, 74],
    [37, 99, 235],
  ];
  const scaled = clamp(intensity, 0, 1) * (stops.length - 1);
  const left = Math.floor(scaled);
  const right = Math.min(stops.length - 1, left + 1);
  const mix = scaled - left;
  const rgb = stops[left].map((channel, index) => Math.round(channel + (stops[right][index] - channel) * mix));
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

function sectionFilterValue(item) {
  return item.sectionId ?? item.id ?? item.section ?? "";
}

function selectedFilterIncludes(key, value) {
  const selected = state.filters[key] ?? [];
  return !selected.length || selected.includes(value);
}

function filterKeyForGroupBy(groupBy = state.groupBy) {
  return {
    course: "courses",
    teacher: "teachers",
    section: "sections",
  }[groupBy] ?? null;
}

function hasExplicitComparisonSelection() {
  const key = filterKeyForGroupBy();
  return Boolean(key && state.filters[key]?.length);
}

function recordMatchesSliceFilters(record) {
  return (
    selectedFilterIncludes("courses", record.course) &&
    selectedFilterIncludes("teachers", record.teacher) &&
    selectedFilterIncludes("sections", sectionFilterValue(record))
  );
}

function filterRecords(records = state.records) {
  return records.filter((record) => {
    const seasonMatch = state.season === "All" || record.season === state.season;
    return seasonMatch && recordMatchesSliceFilters(record);
  });
}

function filterStudentRecords(records = state.source?.studentRecords ?? []) {
  return records.filter((record) => {
    const seasonMatch = state.season === "All" || record.season === state.season;
    return seasonMatch && recordMatchesSliceFilters(record);
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

function groupSampleSize(group) {
  return group?.totalStudents ?? group?.students ?? group?.rows?.length ?? 0;
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
  return [...periods].reverse().find((period) => period.rows.length || period.groups.length) ?? periods[periods.length - 1] ?? { groups: [], rows: [] };
}

function metricValue(item) {
  return item[state.metric] ?? 0;
}

function metricAllowsBands() {
  return state.metric === "score";
}

function benchmarkCourses() {
  return Object.keys(state.source?.bands?.mastery?.byCourse ?? {})
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function benchmarkValueForCourse(course, period, index = 0) {
  const mastery = state.source?.bands?.mastery ?? {};
  const configured = mastery.byCourse?.[course];
  if (Number.isFinite(configured)) return configured;
  if (Array.isArray(configured)) {
    return configured[period?.order - 1] ?? configured[index] ?? mastery.line?.[period?.order - 1] ?? 70;
  }
  if (configured && typeof configured === "object") {
    const line = configured.line;
    if (Array.isArray(line)) return line[period?.order - 1] ?? line[index] ?? configured.value ?? 70;
    if (Number.isFinite(configured.value)) return configured.value;
  }
  return mastery.line?.[period?.order - 1] ?? mastery.line?.[index] ?? 70;
}

function activeBenchmarkCourse() {
  const courses = benchmarkCourses();
  if (courses.includes(state.trend.benchmarkCourse)) return state.trend.benchmarkCourse;
  return courses[0] ?? "";
}

function activeBenchmarkDescriptor(periods = []) {
  const course = activeBenchmarkCourse();
  const values = periods.map((period, index) => benchmarkValueForCourse(course, period, index));
  const uniqueValues = [...new Set(values.filter(Number.isFinite).map((value) => Number(value.toFixed(1))))];
  const valueLabel = uniqueValues.length === 1 ? ` (${uniqueValues[0]}%)` : "";
  return {
    course,
    values,
    label: course ? `${course} proficiency benchmark${valueLabel}` : `Program reference benchmark${valueLabel}`,
  };
}

function renderMetrics(records) {
  const latest = latestPeriodData(records);
  const latestRows = latest?.rows ?? [];
  els.latestLabel.textContent = "Latest mean score";

  if (!latestRows.length) {
    els.students.textContent = "0";
    els.latest.textContent = "-";
    els.change.textContent = "-";
    els.completion.textContent = "-";
    els.target.textContent = "-";
    return;
  }

  const latestValue = latest ? latest.score : 0;
  const averageDelta = averageBoyEoyDeltaForPeriodData(periodDataForTimeSeries(records), "score");
  const students = latestRows.reduce((sum, row) => sum + row.students, 0);
  const targetRows = latestRows.filter((row) => row.score >= benchmarkValueForCourse(row.course, latest.period));
  const completed = latestRows.reduce((sum, row) => sum + (row.completed ?? row.students), 0);

  els.students.textContent = students.toLocaleString();
  els.latest.textContent = fmtPct(latestValue);
  els.change.textContent = Number.isFinite(averageDelta.value) ? fmtPtsAuto(averageDelta.value) : "-";
  els.completion.textContent = fmtPct(weightedAverage(latestRows, "completion"));
  els.target.textContent = completed ? fmtPct((targetRows.reduce((sum, row) => sum + (row.completed ?? row.students), 0) / completed) * 100) : "-";
}

function pointsToCurvePath(points, firstCommand = "M") {
  return buildCurvePath(points, { firstCommand, smooth: state.visual.smoothCurves });
}

function visiblePeriodWindow(periodData) {
  if (state.trend.historyYears === "all") return periodData;
  const requestedYears = Math.max(1, Number(state.trend.historyYears) || 1);
  const orderedYears = [];
  periodData.forEach(({ period }) => {
    const academicYear = inferredAcademicYear(period);
    if (academicYear && !orderedYears.includes(academicYear)) orderedYears.push(academicYear);
  });
  const visibleYears = new Set(orderedYears.slice(-requestedYears));
  return periodData.filter(({ period }) => visibleYears.has(inferredAcademicYear(period)));
}

function buildLineSeries(periodData) {
  const minN = Math.max(1, Number(state.lines.minN) || 1);
  const filter = hasExplicitComparisonSelection() ? "" : state.lines.filter.trim().toLowerCase();
  const groups = unique(periodData.flatMap((item) => item.groups.map((group) => group.key)));

  return groups.map((group, groupIndex) => {
    if (filter && !group.toLowerCase().includes(filter)) return null;

    const values = periodData.map((periodItem, periodIndex) => {
      const groupItem = periodItem.groups.find((item) => item.key === group);
      const value = groupItem ? metricValue(groupItem) : NaN;
      const n = groupSampleSize(groupItem);
      if (!groupItem || !Number.isFinite(value) || n < minN) return null;
      return {
        period: periodItem.period,
        periodIndex,
        value,
        n,
      };
    }).filter(Boolean);

    if (values.length < 2) return null;
    const first = values[0];
    const latest = values[values.length - 1];
    const averageDelta = averageBoyEoyDeltaFromLineValues(values);
    return {
      key: group,
      color: palette[groupIndex % palette.length],
      values,
      first,
      latest,
      change: averageDelta.value,
      deltaPairCount: averageDelta.count,
      hasGap: values.some((value, index) => index > 0 && value.periodIndex - values[index - 1].periodIndex > 1),
    };
  }).filter(Boolean);
}

function sortLineSeries(series) {
  const sorted = [...series];
  if (state.lines.sortCut === "gain") {
    return sorted.sort((a, b) => deltaSortValue(b.change) - deltaSortValue(a.change) || b.latest.value - a.latest.value);
  }
  if (state.lines.sortCut === "decline") {
    return sorted.sort((a, b) => deltaSortValue(a.change, Number.POSITIVE_INFINITY) - deltaSortValue(b.change, Number.POSITIVE_INFINITY) || a.latest.value - b.latest.value);
  }
  if (state.lines.sortCut === "name") {
    return sorted.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  }
  return sorted.sort((a, b) => b.latest.value - a.latest.value || b.change - a.change);
}

function lineLimitValue() {
  return state.lines.limit === "all" ? Number.POSITIVE_INFINITY : Number(state.lines.limit);
}

function lineChartDomain(series, periods) {
  const values = series.flatMap((line) => line.values.map((value) => value.value));

  if (metricAllowsBands()) {
    periods.forEach((period) => {
      const scores = scoreRowsForPeriod(period.id).map((record) => record.score);
      values.push(quantile(scores, 0.1), quantile(scores, 0.9));
    });
  }

  if (state.toggles.department && metricAllowsBands()) {
    const band = bandFromStudentRecords("department", periods) ?? state.source.bands.department;
    values.push(...periods.flatMap((period, index) => [
      band.lower[period.order - 1] ?? band.lower[index],
      band.upper[period.order - 1] ?? band.upper[index],
    ]));
  }

  if (state.toggles.network && metricAllowsBands()) {
    const band = bandFromStudentRecords("network", periods) ?? state.source.bands.network;
    values.push(...periods.flatMap((period, index) => [
      band.lower[period.order - 1] ?? band.lower[index],
      band.upper[period.order - 1] ?? band.upper[index],
    ]));
  }

  if (state.toggles.mastery && metricAllowsBands()) {
    values.push(...activeBenchmarkDescriptor(periods).values);
  }

  const numeric = values.filter(Number.isFinite);
  if (!numeric.length) return { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] };
  const minValue = Math.min(...numeric);
  const maxValue = Math.max(...numeric);
  const padding = Math.max(4, (maxValue - minValue) * 0.14);
  const floor = clamp(minValue - padding, 0, 100);
  const ceiling = clamp(maxValue + padding, 0, 100);
  return niceTicks(floor, ceiling, 5);
}

function renderTimeSeries(records) {
  const compact = isCompactViewport();
  const width = compact ? 560 : 1120;
  const height = compact ? 380 : 470;
  const margin = compact
    ? { top: 42, right: 24, bottom: 58, left: 52 }
    : { top: 46, right: 300, bottom: 72, left: 74 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const periodData = visiblePeriodWindow(periodDataForTimeSeries(records));
  const periods = periodData.map((item) => item.period);
  const lineSeries = sortLineSeries(buildLineSeries(periodData));
  const explicitComparison = hasExplicitComparisonSelection();
  const maxLines = explicitComparison ? Number.POSITIVE_INFINITY : lineLimitValue();
  const selectedSeries = lineSeries.slice(0, compact && !explicitComparison ? Math.min(maxLines, 5) : maxLines);
  const domain = lineChartDomain(selectedSeries, periods);
  const yMax = domain.max;
  const yMin = domain.min;
  const x = (index) => margin.left + (periods.length <= 1 ? innerWidth / 2 : (index / (periods.length - 1)) * innerWidth);
  const y = (value) => margin.top + innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight;
  const bandScale = (value) => y(value);

  const grid = domain.ticks.filter((tick) => tick >= yMin && tick <= yMax).map((tick) => `
    <g>
      <line x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}" class="axis-grid"></line>
      <text x="${margin.left - 12}" y="${y(tick) + 5}" class="axis-label" text-anchor="end">${tick.toFixed(0)}</text>
    </g>
  `).join("");

  const departmentBand = !compact && state.toggles.department && metricAllowsBands() ? renderBand("department", periods, x, bandScale) : "";
  const networkBand = !compact && state.toggles.network && metricAllowsBands() ? renderBand("network", periods, x, bandScale) : "";
  const masteryLine = state.toggles.mastery && metricAllowsBands() ? renderBenchmark(periods, x, y) : "";
  const violinPlots = !compact && state.toggles.violins && metricAllowsBands() ? renderViolinPlots(periods, selectedSeries, x, y, yMin, yMax) : "";

  const labelY = layoutRightLabels(selectedSeries, y, margin.top + 12, margin.top + innerHeight - 10);
  const labelX = width - margin.right + 44;
  const labelDotX = width - margin.right + 20;
  const groupLines = selectedSeries.map((line) => {
    const points = line.values.map((value) => ({
      ...value,
      x: x(value.periodIndex),
      y: y(value.value),
    }));
    const labelPosition = labelY.get(line.key) ?? y(line.latest.value);
    const lastPoint = points[points.length - 1];
    const deltaLabel = Number.isFinite(line.change) ? fmtPtsAuto(line.change) : "no B/E";
    const lineLabel = compactDirectLabel(line.key);
    const deltaSymbol = `<tspan class="delta-symbol">x&#772;</tspan><tspan class="delta-symbol-sub" dy="0.34em">&#948;</tspan>`;
    const lineClass = line.hasGap ? "direct-series-line direct-series-gap" : "direct-series-line";
    const circles = points.map((point, index) => `
      <circle cx="${point.x}" cy="${point.y}" r="${compact ? (index === points.length - 1 ? 5.4 : 4.4) : (index === points.length - 1 ? 5.2 : 4.6)}" fill="${line.color}" class="series-point comparison-series-point"></circle>
    `).join("");
    const directLabel = compact ? "" : `
      <g>
        <title>${escapeSvgText(line.key)} average BOY/EOY delta ${escapeSvgText(deltaLabel)}</title>
        <line x1="${lastPoint.x + 9}" x2="${labelDotX - 8}" y1="${lastPoint.y}" y2="${labelPosition}" stroke="${line.color}" class="direct-label-guide"></line>
        <circle cx="${labelDotX}" cy="${labelPosition}" r="4.7" fill="${line.color}" class="right-label-dot"></circle>
        <text x="${labelX}" y="${labelPosition + 5}" class="right-label-text">
          <tspan>${escapeSvgText(lineLabel)}</tspan><tspan> (</tspan>${deltaSymbol}<tspan dy="-0.34em"> ${escapeSvgText(deltaLabel)})</tspan>
        </text>
      </g>
    `;
    return `
      <path d="${pointsToCurvePath(points)}" fill="none" stroke="${line.color}" class="series-line comparison-series-line ${lineClass}"></path>
      ${circles}
      ${directLabel}
    `;
  }).join("");

  const sectionLines = !compact && state.toggles.sections ? renderSectionLines(records, periods, x, y) : "";

  const xLabels = periods.map((period, index) =>
    periodAxisLabel(period, x(index), height - 47),
  ).join("");

  const emptyState = selectedSeries.length ? "" : `
    <text x="${margin.left + innerWidth / 2}" y="${margin.top + innerHeight / 2}" class="empty-chart-text" text-anchor="middle">No lines match the current filters.</text>
  `;

  els.timeChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="${width}" height="${height}" class="chart-bg"></rect>
      ${grid}
      ${networkBand}
      ${departmentBand}
      ${masteryLine}
      ${violinPlots}
      ${sectionLines}
      ${groupLines}
      ${emptyState}
      <line x1="${margin.left}" x2="${width - margin.right}" y1="${margin.top + innerHeight}" y2="${margin.top + innerHeight}" class="axis-line"></line>
      <line x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${margin.top + innerHeight}" class="axis-line"></line>
      ${xLabels}
      <text x="${margin.left}" y="18" class="axis-title">${currentMetricLabel()}</text>
    </svg>
  `;

  const lineLabel = `${selectedSeries.length} ${currentSliceLabel()} line${selectedSeries.length === 1 ? "" : "s"}`;
  const academicYearCount = new Set(periods.map(inferredAcademicYear).filter(Boolean)).size;
  const windowLabel = `${academicYearCount} academic year${academicYearCount === 1 ? "" : "s"} (${periods.length} assessment window${periods.length === 1 ? "" : "s"})`;
  const pairCount = boyEoyPairs(periods).length;
  const deltaNote = pairCount
    ? `Labels show average End-minus-Beginning delta across ${pairCount} complete pair${pairCount === 1 ? "" : "s"}.`
    : "No complete BOY/EOY pairs are available for the current window filter.";
  els.timeCaption.textContent = `${lineLabel} shown across ${windowLabel}. ${deltaNote}`;
  renderLegend(selectedSeries, periods);
}

function renderBand(key, periods, x, y) {
  const computed = bandFromStudentRecords(key, periods);
  const band = computed ?? state.source.bands[key];
  const lower = periods.map((period, index) => ({ x: x(index), y: y(band.lower[period.order - 1] ?? band.lower[index]) }));
  const upper = periods.map((period, index) => ({ x: x(index), y: y(band.upper[period.order - 1] ?? band.upper[index]) }));
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
  const benchmark = activeBenchmarkDescriptor(periods);
  const points = periods.map((period, index) => ({ x: x(index), y: y(benchmark.values[index]) }));
  return `<path d="${pointsToCurvePath(points)}" class="benchmark-line"><title>${escapeSvgText(benchmark.label)}. Synthetic demonstration threshold.</title></path>`;
}

function renderViolinPlots(periods, selectedSeries, x, y, yMin, yMax) {
  if (!selectedSeries.length) return "";
  const periodSpacing = periods.length > 1 ? Math.abs(x(1) - x(0)) : 48;
  const visibleCount = selectedSeries.length;
  const clusterWidth = visibleCount > 1 ? clamp(periodSpacing * 0.64, 34, 132) : 0;
  const offsetStep = visibleCount > 1 ? clusterWidth / (visibleCount - 1) : 0;
  const maxHalfWidth = visibleCount > 1 ? clamp(offsetStep * 0.28, 2.2, 7) : clamp(periodSpacing * 0.13, 8, 16);
  const minScoresForViolin = Math.max(4, Math.max(1, Number(state.lines.minN) || 1));
  const comparisonLabel = currentSliceLabel();

  return periods.map((period, index) => {
    const periodRows = scoreRowsForPeriod(period.id);
    return selectedSeries.map((line, lineIndex) => {
      if (!line.values.some((value) => value.period.id === period.id)) return "";
      const scores = periodRows
        .filter((record) => groupKeyFromStudentRecord(record, state.groupBy) === line.key)
        .map((record) => record.score)
        .filter((score) => Number.isFinite(score));
      if (scores.length < minScoresForViolin) return "";
      const p10 = quantile(scores, 0.1);
      const p25 = quantile(scores, 0.25);
      const median = quantile(scores, 0.5);
      const p75 = quantile(scores, 0.75);
      const p90 = quantile(scores, 0.9);
      const minScore = Math.max(yMin, p10 - 4);
      const maxScore = Math.min(yMax, p90 + 4);
      const span = Math.max(1, maxScore - minScore);
      const bandwidth = Math.max(2.5, span / 7);
      const steps = 18;
      const density = Array.from({ length: steps }, (_, step) => {
        const value = minScore + (span * step) / (steps - 1);
        const scoreDensity = scores.reduce((sum, score) => {
          const z = (score - value) / bandwidth;
          return sum + Math.exp(-0.5 * z * z);
        }, 0);
        return { value, density: scoreDensity };
      });
      const maxDensity = Math.max(...density.map((point) => point.density));
      if (!maxDensity) return "";
      const offset = visibleCount > 1 ? (lineIndex - (visibleCount - 1) / 2) * offsetStep : 0;
      const px = x(index) + offset;
      const leftPoints = density.map((point) => {
        const halfWidth = 1.2 + (point.density / maxDensity) * maxHalfWidth;
        return `${px - halfWidth},${y(point.value)}`;
      });
      const rightPoints = [...density].reverse().map((point) => {
        const halfWidth = 1.2 + (point.density / maxDensity) * maxHalfWidth;
        return `${px + halfWidth},${y(point.value)}`;
      });
      const iqrWidth = maxHalfWidth * 0.72;
      return `
        <g class="violin-plot" style="--violin-color: ${line.color}">
          <title>${escapeSvgText(period.label)} / ${escapeSvgText(line.key)}: ${comparisonLabel} score distribution p25 ${Math.round(p25)}%, median ${Math.round(median)}%, p75 ${Math.round(p75)}%, n=${scores.length}</title>
          <polygon points="${leftPoints.concat(rightPoints).join(" ")}" class="violin-shape"></polygon>
          <line x1="${px}" x2="${px}" y1="${y(p10)}" y2="${y(p90)}" class="violin-whisker"></line>
          <line x1="${px - iqrWidth}" x2="${px + iqrWidth}" y1="${y(p25)}" y2="${y(p25)}" class="violin-iqr"></line>
          <line x1="${px - iqrWidth}" x2="${px + iqrWidth}" y1="${y(p75)}" y2="${y(p75)}" class="violin-iqr"></line>
          <circle cx="${px}" cy="${y(median)}" r="3.1" class="violin-median"></circle>
        </g>
      `;
    }).join("");
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
  const compact = isCompactViewport();
  const width = compact ? 620 : 980;
  const height = compact ? 210 : 170;
  const margin = compact ? { top: 20, right: 24, bottom: 46, left: 48 } : { top: 18, right: 34, bottom: 42, left: 54 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const allPeriods = state.source.periods.filter((period) => state.season === "All" || period.season === state.season);
  const preserveSparseSqlWindows = state.source?.source?.contract === "sql-extract-dashboard-json-v1";
  const periods = compact && !preserveSparseSqlWindows ? allPeriods.slice(-7) : allPeriods;
  const matchingStudentRecords = filterStudentRecords();

  if (!matchingStudentRecords.length) {
    els.completionChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false"><text x="${width / 2}" y="${height / 2}" class="empty-chart-text" text-anchor="middle">No completion records match the selected slice filters.</text></svg>`;
    els.completionCaption.textContent = "No completion records match the selected slice filters.";
    return;
  }

  const x = (index) => margin.left + (periods.length <= 1 ? innerWidth / 2 : (index / (periods.length - 1)) * innerWidth);
  const y = (value) => margin.top + innerHeight - (value / 100) * innerHeight;

  const rows = periods.map((period) => {
    const assigned = matchingStudentRecords.filter((record) => record.periodId === period.id);
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
  const labels = rows.map((row, index) =>
    periodAxisLabel(row.period, x(index), height - 13, { className: "axis-label mini-x-label", compact: true }),
  ).join("");

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
  els.completionCaption.textContent = latest ? `${latest.period.label}: ${Math.round(latest.completion)}% completed (${latest.completed}/${latest.assigned})` : "Assigned vs completed records";
}

function renderDistributionChart() {
  const compact = isCompactViewport();
  const width = compact ? 620 : 980;
  const height = compact ? 340 : 320;
  const margin = compact ? { top: 24, right: 24, bottom: 54, left: 48 } : { top: 24, right: 34, bottom: 70, left: 54 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const allPeriods = state.source.periods.filter((period) => state.season === "All" || period.season === state.season);
  const preserveSparseSqlWindows = state.source?.source?.contract === "sql-extract-dashboard-json-v1";
  const periods = compact && !preserveSparseSqlWindows ? allPeriods.slice(-7) : allPeriods;
  if (!filterStudentRecords().length) {
    els.distributionChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false"><text x="${width / 2}" y="${height / 2}" class="empty-chart-text" text-anchor="middle">No score records match the selected slice filters.</text></svg>`;
    els.distributionCaption.textContent = "No score records match the selected slice filters.";
    return;
  }

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
  const labels = periods.map((period, index) =>
    periodAxisLabel(period, x(index), height - (compact ? 25 : 28), {
      anchor: compact ? "middle" : "end",
      compact: true,
      rotate: compact ? "" : ` transform="rotate(-35 ${x(index)} ${height - 28})"`,
    }),
  ).join("");

  els.distributionChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="${width}" height="${height}" class="chart-bg"></rect>
      ${grid}
      ${boxes}
      <path d="${pointsToCurvePath(centerPoints)}" class="distribution-center-line"></path>
      <line x1="${margin.left}" x2="${width - margin.right}" y1="${margin.top + innerHeight}" y2="${margin.top + innerHeight}" class="axis-line"></line>
      <line x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${margin.top + innerHeight}" class="axis-line"></line>
      ${labels}
      <text x="${margin.left}" y="18" class="axis-title">Score Distribution</text>
    </svg>
  `;

  const population = state.visual.ribbonPopulation === "completed" ? "completed assessments" : "assigned records";
  els.distributionCaption.textContent = `Score distribution with p10-p90 whiskers and p25-p75 boxes for ${population}`;
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

function renderLegend(series, periods) {
  const populationLabel = state.visual.ribbonPopulation === "completed" ? "completed" : "assigned";
  const rangeLabel = `middle ${state.visual.ribbonRange}%`;
  const departmentLabel = `Main ${rangeLabel} ${populationLabel}`;
  const networkLabel = `Wider context ${populationLabel}`;
  const masteryLabel = activeBenchmarkDescriptor(periods).label;
  const lineSummary = `<span>${series.length} ${currentSliceLabel(true)} from ${periods.length} windows</span>`;
  const ribbonItems = [
    lineSummary,
    state.toggles.department && metricAllowsBands() ? `<span><i class="legend-swatch ribbon-key department-key"></i>${departmentLabel}</span>` : "",
    state.toggles.network && metricAllowsBands() ? `<span><i class="legend-swatch ribbon-key network-key"></i>${networkLabel}</span>` : "",
    state.toggles.mastery && metricAllowsBands() ? `<span><i class="legend-line benchmark-key"></i>${masteryLabel}</span>` : "",
    state.toggles.violins && metricAllowsBands() ? `<span><i class="legend-swatch violin-key"></i>Group score distributions</span>` : "",
    state.toggles.sections ? `<span><i class="legend-line section-key"></i>Section lines</span>` : "",
  ].filter(Boolean).join("");

  els.timeLegend.innerHTML = ribbonItems;
}

function renderBars(container, items, options = {}) {
  const compact = isCompactViewport();
  const width = compact ? 620 : 720;
  const rowHeight = compact ? 42 : 46;
  const labelWidth = options.labelWidth ?? (compact ? 170 : 210);
  const chartWidth = width - labelWidth - 68;
  const height = Math.max(82, items.length * rowHeight + 28);
  const max = options.max ?? 100;
  const min = options.min ?? 0;
  const range = Math.max(1, max - min);
  const zeroBaseline = Boolean(options.zeroBaseline && min < 0 && max > 0);
  const zeroX = labelWidth + ((clamp(0, min, max) - min) / range) * chartWidth;

  if (!items.length) {
    const emptyLabel = options.emptyLabel ?? "No comparison segments match the selected filters.";
    container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false"><text x="${width / 2}" y="${height / 2}" class="empty-chart-text" text-anchor="middle">${emptyLabel}</text></svg>`;
    return;
  }

  const barClass = options.barClass ?? "chart-bar-score";
  const rows = items.map((item, index) => {
    const y = 20 + index * rowHeight;
    const value = clamp(item.value, min, max);
    const valueX = labelWidth + ((value - min) / range) * chartWidth;
    const barX = zeroBaseline ? Math.min(zeroX, valueX) : labelWidth;
    const barWidth = zeroBaseline ? Math.max(2, Math.abs(valueX - zeroX)) : Math.max(2, ((value - min) / range) * chartWidth);
    const label = options.format ? options.format(item.value) : fmtPct(item.value);
    const itemBarClass = typeof barClass === "function" ? barClass(item) : barClass;
    return `
      <g>
        <text x="0" y="${y + 19}" class="chart-label">${item.label}</text>
        <rect x="${labelWidth}" y="${y}" width="${chartWidth}" height="24" rx="4" class="chart-track"></rect>
        <rect x="${barX}" y="${y}" width="${barWidth}" height="24" rx="4" class="chart-bar ${itemBarClass}"></rect>
        <text x="${labelWidth + chartWidth + 14}" y="${y + 18}" class="chart-value">${label}</text>
      </g>
    `;
  }).join("");

  const zeroLine = zeroBaseline
    ? `<line x1="${zeroX}" x2="${zeroX}" y1="12" y2="${height - 8}" class="chart-zero-line"></line>`
    : "";

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">${rows}${zeroLine}</svg>`;
}

function renderComparisonBars(records) {
  const latest = latestPeriodData(records);
  const items = latest.groups.map((group) => ({ label: group.key, value: metricValue(group) }))
    .sort((a, b) => b.value - a.value);

  renderBars(els.barChart, items, {
    min: 0,
    max: 100,
    format: fmtPct,
    barClass: state.metric === "completion" ? "chart-bar-completion" : "chart-bar-score",
  });
  els.barCaption.textContent = `${latest.period?.label ?? ""} by ${currentSliceLabel()}`;
}

function renderBoyEoyMovementBars(records) {
  const periodData = periodDataForTimeSeries(records);
  const pairs = boyEoyPairs(periodData.map((periodItem) => periodItem.period));
  const items = boyEoyDeltasByGroup(periodData).map((group) => ({ label: group.key, value: group.value, count: group.count }))
    .sort((a, b) => b.value - a.value);
  const values = items.map((item) => item.value);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const padding = Math.max(1, (maxValue - minValue) * 0.12);
  const min = minValue < 0 ? Math.floor(minValue - padding) : 0;
  const max = Math.ceil(maxValue + padding);

  renderBars(els.growthChart, items, {
    min,
    max,
    format: fmtPtsAuto,
    barClass: (item) => item.value < 0 ? "chart-bar-decline" : "chart-bar-growth",
    zeroBaseline: true,
    emptyLabel: "No complete BOY/EOY pairs match the selected filters.",
  });
  els.growthCaption.textContent = pairs.length
    ? `${currentMetricLabel()} average End-minus-Beginning delta across ${pairs.length} complete pair${pairs.length === 1 ? "" : "s"} by ${currentSliceLabel()}.`
    : "No complete BOY/EOY pairs match the current window filter.";
}

function renderPerformanceGrowthMap(records) {
  const compact = isCompactViewport();
  const width = compact ? 620 : 940;
  const height = compact ? 390 : 420;
  const margin = compact
    ? { top: 38, right: 24, bottom: 62, left: 58 }
    : { top: 42, right: 48, bottom: 68, left: 68 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const latest = latestPeriodData(records);
  const growthByGroup = new Map(
    boyEoyDeltasByGroup(periodDataForTimeSeries(records), "score").map((group) => [group.key, group]),
  );
  const minN = Math.max(1, Number(state.lines.minN) || 1);
  const items = latest.groups
    .filter((group) => groupSampleSize(group) >= minN && growthByGroup.has(group.key))
    .map((group) => ({
      key: group.key,
      score: group.score,
      growth: growthByGroup.get(group.key).value,
      pairCount: growthByGroup.get(group.key).count,
      n: groupSampleSize(group),
    }))
    .filter((item) => Number.isFinite(item.score) && Number.isFinite(item.growth))
    .sort((left, right) => left.key.localeCompare(right.key, undefined, { numeric: true }));

  if (!items.length) {
    els.performanceGrowthChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false"><text x="${width / 2}" y="${height / 2}" class="empty-chart-text" text-anchor="middle">No groups have both current-score and paired-growth evidence for this slice.</text></svg>`;
    els.performanceGrowthCaption.textContent = "No groups meet the current minimum sample and paired-window requirements.";
    return;
  }

  const benchmark = state.source.bands?.mastery?.line?.[(latest.period?.order ?? 1) - 1] ?? 70;
  const scores = items.map((item) => item.score);
  const growthValues = items.map((item) => item.growth);
  const xDomain = niceTicks(
    clamp(Math.min(benchmark, ...scores) - 4, 0, 100),
    clamp(Math.max(benchmark, ...scores) + 4, 0, 100),
    5,
  );
  const yDomain = niceTicks(Math.min(0, ...growthValues), Math.max(0, ...growthValues) + 1, 5);
  const x = (value) => margin.left + ((value - xDomain.min) / (xDomain.max - xDomain.min)) * innerWidth;
  const y = (value) => margin.top + innerHeight - ((value - yDomain.min) / (yDomain.max - yDomain.min)) * innerHeight;

  const verticalGrid = xDomain.ticks.map((tick) => `
    <g>
      <line x1="${x(tick)}" x2="${x(tick)}" y1="${margin.top}" y2="${margin.top + innerHeight}" class="axis-grid"></line>
      <text x="${x(tick)}" y="${height - 35}" class="axis-label" text-anchor="middle">${Math.round(tick)}</text>
    </g>
  `).join("");
  const horizontalGrid = yDomain.ticks.map((tick) => `
    <g>
      <line x1="${margin.left}" x2="${margin.left + innerWidth}" y1="${y(tick)}" y2="${y(tick)}" class="axis-grid"></line>
      <text x="${margin.left - 12}" y="${y(tick) + 4}" class="axis-label" text-anchor="end">${tick > 0 ? "+" : ""}${Number(tick.toFixed(1))}</text>
    </g>
  `).join("");
  const zeroY = y(clamp(0, yDomain.min, yDomain.max));
  const benchmarkX = x(clamp(benchmark, xDomain.min, xDomain.max));
  const highlightedItems = [...new Map([
    items.reduce((lowest, item) => item.score < lowest.score ? item : lowest),
    items.reduce((highest, item) => item.score > highest.score ? item : highest),
    items.reduce((strongest, item) => item.growth > strongest.growth ? item : strongest),
    items.reduce((largest, item) => item.n > largest.n ? item : largest),
  ].map((item) => [item.key, item])).values()];
  const highlightIndexByKey = new Map(highlightedItems.map((item, index) => [item.key, index]));
  const points = items.map((item, index) => {
    const px = x(item.score);
    const py = y(item.growth);
    const radius = clamp(5 + Math.sqrt(item.n) * 0.22, 6, 11);
    const highlightIndex = highlightIndexByKey.get(item.key);
    const isHighlighted = Number.isInteger(highlightIndex);
    const labelOnLeft = px > margin.left + innerWidth * 0.62;
    const labelX = labelOnLeft ? px - radius - 9 : px + radius + 9;
    const labelY = py + (highlightIndex % 2 === 0 ? -12 : 18);
    const label = compactDirectLabel(item.key, compact ? 14 : 20);
    const directLabel = isHighlighted ? `
        <line x1="${px}" y1="${py}" x2="${labelX}" y2="${labelY - 4}" class="performance-growth-leader"></line>
        <text x="${labelX}" y="${labelY}" class="performance-growth-label" text-anchor="${labelOnLeft ? "end" : "start"}">${escapeSvgText(label)}</text>` : "";
    return `
      <g class="performance-growth-item${isHighlighted ? " is-highlighted" : ""}">
        <title>${escapeSvgText(item.key)}: latest mean ${Math.round(item.score)}%, average paired growth ${escapeSvgText(fmtPtsAuto(item.growth))}, n=${item.n}, ${item.pairCount} complete pairs</title>
        <circle cx="${px}" cy="${py}" r="${radius}" fill="${palette[index % palette.length]}" class="performance-growth-point"></circle>
        ${directLabel}
      </g>
    `;
  }).join("");

  els.performanceGrowthChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="${width}" height="${height}" class="chart-bg"></rect>
      ${verticalGrid}
      ${horizontalGrid}
      <line x1="${benchmarkX}" x2="${benchmarkX}" y1="${margin.top}" y2="${margin.top + innerHeight}" class="performance-benchmark-line"></line>
      <line x1="${margin.left}" x2="${margin.left + innerWidth}" y1="${zeroY}" y2="${zeroY}" class="performance-zero-line"></line>
      <text x="${benchmarkX + 7}" y="${margin.top + 14}" class="performance-guide-label">Benchmark ${Math.round(benchmark)}%</text>
      ${points}
      <line x1="${margin.left}" x2="${margin.left + innerWidth}" y1="${margin.top + innerHeight}" y2="${margin.top + innerHeight}" class="axis-line"></line>
      <line x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${margin.top + innerHeight}" class="axis-line"></line>
      <text x="${margin.left + innerWidth / 2}" y="${height - 8}" class="axis-title" text-anchor="middle">Latest mean score</text>
      <text x="18" y="${margin.top + innerHeight / 2}" class="axis-title" text-anchor="middle" transform="rotate(-90 18 ${margin.top + innerHeight / 2})">Average paired growth</text>
    </svg>
  `;
  els.performanceGrowthCaption.textContent = `${latest.period?.label ?? "Latest window"}: score versus average paired growth for ${items.length} ${currentSliceLabel(true)}; circle size reflects n. Labels mark decision-relevant extremes. Descriptive, not causal.`;
}

function renderSkillHeatmap(records) {
  const latest = latestPeriodData(records);
  const rows = latest.rows;
  if (!rows.length) {
    els.skillChart.innerHTML = `<svg viewBox="0 0 760 96" aria-hidden="true" focusable="false"><text x="380" y="52" class="empty-chart-text" text-anchor="middle">No skill rows match the selected slice filters.</text></svg>`;
    els.skillCaption.textContent = "No skill rows match the selected slice filters.";
    return;
  }

  const skills = unique(rows.flatMap((record) => Object.keys(record.skills)));
  const absoluteSkills = state.source.source?.skillMode === "absolute";
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
      const base = skillRows.length ? weightedAverage(skillRows.map((row) => ({
        ...row,
        skillValue: absoluteSkills ? row.skills[skill] : row.score + row.skills[skill],
      })), "skillValue") : 0;
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
  els.skillCaption.textContent = absoluteSkills ? `${latest.period?.label ?? ""} SQL extract indicators` : `${latest.period?.label ?? ""} synthetic skill scores`;
}

function renderTable(records) {
  const displayedPeriods = state.source.periods.filter((period) => state.season === "All" || period.season === state.season);
  const firstOrder = Math.min(...displayedPeriods.map((period) => period.order));
  const lastOrder = Math.max(...displayedPeriods.map((period) => period.order));
  const firstLabel = periodByOrder(firstOrder).label;
  const lastLabel = periodByOrder(lastOrder).label;
  const pairs = boyEoyPairs(displayedPeriods);
  const sections = aggregate(records, "section");
  const sectionRows = buildSectionTableRows(sections, firstOrder, lastOrder, pairs);
  const filteredSectionRows = filterTableRows(sectionRows);
  const summaryMode = state.table.course === "All";
  const displayRows = summaryMode ? buildSegmentSummaryRows(filteredSectionRows) : filteredSectionRows;
  const sortedRows = sortTableRows(displayRows);

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
    const emptyLabel = summaryMode ? "segments" : "sections";
    els.table.innerHTML = `<tr><td colspan="9" class="empty-table">No ${emptyLabel} match the current filters.</td></tr>`;
  }

  els.tableFirstPeriod.firstChild.textContent = `${firstLabel} `;
  els.tableLatestPeriod.firstChild.textContent = `${lastLabel} `;
  els.tableCount.textContent = summaryMode
    ? `${sortedRows.length} segment ${sortedRows.length === 1 ? "summary" : "summaries"} from ${filteredSectionRows.length} ${filteredSectionRows.length === 1 ? "section" : "sections"}`
    : `${sortedRows.length} of ${sectionRows.length} sections`;
  renderTableSortState();
}

function buildSectionTableRows(sections, firstOrder, lastOrder, pairs) {
  return sections.map((section) => {
    const first = section.rows.find((row) => row.order === firstOrder);
    const latest = section.rows.find((row) => row.order === lastOrder);
    const fallback = latest ?? first ?? section.rows[section.rows.length - 1] ?? section.rows[0] ?? {};
    const averageDelta = averageBoyEoyDeltaForRows(section.rows, "score", pairs);
    return {
      course: fallback.course ?? "",
      grade: fallback.grade ?? "",
      teacher: fallback.teacher ?? "",
      section: fallback.section ?? "",
      students: latest?.students ?? fallback.students ?? 0,
      first: first?.score,
      latest: latest?.score,
      change: averageDelta.value,
      completion: latest?.completion,
    };
  });
}

function buildSegmentSummaryRows(rows) {
  const grouped = new Map();
  rows.forEach((row) => {
    if (!grouped.has(row.course)) grouped.set(row.course, []);
    grouped.get(row.course).push(row);
  });

  return [...grouped.entries()].map(([course, groupRows]) => ({
    course,
    grade: state.table.grade === "All" ? "All" : state.table.grade,
    teacher: state.table.teacher === "All" ? "All" : state.table.teacher,
    section: `${groupRows.length} ${groupRows.length === 1 ? "section" : "sections"}`,
    students: groupRows.reduce((sum, row) => sum + (Number(row.students) || 0), 0),
    first: weightedTableValue(groupRows, "first"),
    latest: weightedTableValue(groupRows, "latest"),
    change: weightedTableValue(groupRows, "change"),
    completion: weightedTableValue(groupRows, "completion"),
  }));
}

function weightedTableValue(rows, key) {
  const weightedRows = rows
    .map((row) => ({ value: row[key], weight: Number(row.students) || 0 }))
    .filter((row) => Number.isFinite(row.value) && row.weight > 0);
  const weightTotal = weightedRows.reduce((sum, row) => sum + row.weight, 0);
  return weightTotal ? weightedRows.reduce((sum, row) => sum + row.value * row.weight, 0) / weightTotal : NaN;
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
  if (!records.length || !latest.rows?.length) {
    els.insights.innerHTML = `<li>No records match the selected slice filters.</li>`;
    return;
  }

  const minN = Math.max(1, Number(state.lines.minN) || 1);
  const latestGroups = latest.groups.filter((group) => groupSampleSize(group) >= minN);
  const rankedMovement = boyEoyDeltasByGroup(periodDataForTimeSeries(records))
    .sort((a, b) => b.value - a.value);
  const strongest = rankedMovement[0];
  const watch = [...latestGroups].sort((a, b) => a.score - b.score)[0];
  const completion = weightedAverage(latest.rows, "completion");
  const completionLabel = completion < 95 && Math.round(completion) === 95 ? `${completion.toFixed(1)}%` : fmtPct(completion);
  const completionPosition = completion >= 95 ? "at or above" : "below";

  const notes = [
    strongest
      ? {
          label: "Momentum",
          title: `${strongest.key} shows the strongest paired growth`,
          detail: `${fmtPtsAuto(strongest.value)} across ${strongest.count} complete pair${strongest.count === 1 ? "" : "s"}. Check whether the pattern persists across sections and student groups.`
        }
      : {
          label: "Momentum",
          title: "Paired growth is not available",
          detail: `No complete beginning-to-end pair meets the minimum n of ${minN}.`
        },
    watch
      ? {
          label: "Review priority",
          title: `${watch.key} has the lowest latest mean`,
          detail: `${fmtPct(watch.score)} with n=${groupSampleSize(watch).toLocaleString()}. Use item and section detail to investigate before assigning a cause.`
        }
      : {
          label: "Review priority",
          title: "No group meets the comparison threshold",
          detail: `Lower the minimum n only when the smaller-group uncertainty is acceptable.`
        },
    {
      label: "Participation",
      title: `Completion is ${completionPosition} target`,
      detail: `${completionLabel} in ${latest.period?.label ?? "the latest window"} against the 95% operating target. Review missingness before interpreting score movement.`
    }
  ];

  els.insights.innerHTML = notes.map((note) => `
    <li>
      <span class="insight-label">${escapeHtml(note.label)}</span>
      <strong>${escapeHtml(note.title)}</strong>
      <p>${escapeHtml(note.detail)}</p>
    </li>
  `).join("");
}

function countedOptions(items, key) {
  const counts = new Map();
  items.forEach((item) => {
    const value = item[key];
    if (!value) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([value, count]) => ({
      value,
      label: value,
      meta: `${count} ${count === 1 ? "section" : "sections"}`,
    }));
}

function sectionFilterOptions() {
  return [...state.source.sections]
    .sort((a, b) => {
      const courseCompare = a.course.localeCompare(b.course, undefined, { numeric: true });
      if (courseCompare) return courseCompare;
      return a.section.localeCompare(b.section, undefined, { numeric: true });
    })
    .map((section) => ({
      value: sectionFilterValue(section),
      label: section.section,
      meta: `${section.course} / ${section.teacher}`,
      searchText: `${section.section} ${section.course} ${section.teacher} ${section.grade}`.toLowerCase(),
    }));
}

function visibleSectionOptions() {
  const query = state.filters.sectionQuery.trim().toLowerCase();
  const options = sectionFilterOptions();
  return query ? options.filter((option) => option.searchText.includes(query)) : options;
}

const filterDescriptors = [
  { key: "courses", groupBy: "course", singular: "subject", plural: "subjects" },
  { key: "teachers", groupBy: "teacher", singular: "teacher", plural: "teachers" },
  { key: "sections", groupBy: "section", singular: "section", plural: "sections" },
];

function descriptorForFilterKey(key) {
  return filterDescriptors.find((descriptor) => descriptor.key === key);
}

function syncCompareControls() {
  els.compareBy.forEach((input) => {
    input.checked = input.value === state.groupBy;
  });
}

function selectedCountLabel(key, allLabel, singular, plural) {
  const count = state.filters[key].length;
  if (!count) return allLabel;
  return `${count} ${count === 1 ? singular : plural}`;
}

function renderSliceSummary() {
  const active = filterDescriptors.find((descriptor) => descriptor.groupBy === state.groupBy) ?? filterDescriptors[0];
  const activeCount = state.filters[active.key].length;
  const activeTarget = activeCount
    ? `${activeCount} ${activeCount === 1 ? active.singular : active.plural}`
    : `all ${active.plural}`;
  const filters = filterDescriptors.filter((descriptor) => descriptor.key !== active.key).map((descriptor) => {
    const selected = state.filters[descriptor.key].length;
    return selected
      ? `${selected} ${selected === 1 ? descriptor.singular : descriptor.plural}`
      : `all ${descriptor.plural}`;
  }).join(", ");
  els.sliceSummary.textContent = `Comparing ${activeTarget}; filters: ${filters}`;
  els.sectionFilterCount.textContent = selectedCountLabel("sections", "All sections", "section", "sections");
}

function renderCheckboxOptions(container, key, options) {
  const selected = new Set(state.filters[key]);
  const descriptor = filterDescriptors.find((item) => item.key === key);
  container.closest(".slice-filter-group")?.classList.toggle("is-active", descriptor?.groupBy === state.groupBy);
  container.innerHTML = options.length ? options.map((option) => `
    <label class="slice-check-option">
      <input type="checkbox" data-slice-filter="${key}" value="${escapeHtml(option.value)}"${selected.has(option.value) ? " checked" : ""}>
      <span>${escapeHtml(option.label)}</span>
      ${option.meta ? `<small>${escapeHtml(option.meta)}</small>` : ""}
    </label>
  `).join("") : `<p class="slice-empty">No matching options.</p>`;
}

function renderSectionFilters() {
  if (!state.ui.sectionFiltersRendered) {
    els.sectionFilters.innerHTML = `<p class="slice-empty">Section options load when comparison tools are opened.</p>`;
    renderSliceSummary();
    return;
  }
  renderCheckboxOptions(els.sectionFilters, "sections", visibleSectionOptions());
  renderSliceSummary();
}

function ensureSectionFilters() {
  if (state.ui.sectionFiltersRendered || !state.source) return;
  state.ui.sectionFiltersRendered = true;
  renderSectionFilters();
}

function renderSliceFilters() {
  if (!state.source) return;
  renderCheckboxOptions(els.courseFilters, "courses", countedOptions(state.source.sections, "course"));
  renderCheckboxOptions(els.teacherFilters, "teachers", countedOptions(state.source.sections, "teacher"));
  renderSectionFilters();
  els.sectionFilterSearch.value = state.filters.sectionQuery;
}

function setSliceFilter(key, value, checked) {
  const selected = new Set(state.filters[key]);
  if (checked) {
    selected.add(value);
  } else {
    selected.delete(value);
  }
  state.filters[key] = [...selected].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function handleSliceCheckboxChange(event) {
  const checkbox = event.target.closest("input[data-slice-filter]");
  if (!checkbox) return;
  const filterKey = checkbox.dataset.sliceFilter;
  setSliceFilter(filterKey, checkbox.value, checkbox.checked);
  if (checkbox.checked) {
    const descriptor = descriptorForFilterKey(filterKey);
    if (descriptor) state.groupBy = descriptor.groupBy;
  }
  syncCompareControls();
  renderSliceFilters();
  render();
}

function clearAllSliceFilters() {
  state.filters.courses = [];
  state.filters.teachers = [];
  state.filters.sections = [];
  state.filters.sectionQuery = "";
  renderSliceFilters();
  render();
}

function clearSectionFilters() {
  state.filters.sections = [];
  state.filters.sectionQuery = "";
  renderSectionFilters();
  els.sectionFilterSearch.value = "";
  render();
}

function selectVisibleSections() {
  const selected = new Set(state.filters.sections);
  visibleSectionOptions().forEach((option) => selected.add(option.value));
  state.filters.sections = [...selected].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  state.groupBy = "section";
  syncCompareControls();
  renderSliceFilters();
  render();
}

function syncControls() {
  syncCompareControls();
  els.metric.value = state.metric;
  els.season.value = state.season;
  els.trendHistory.value = state.trend.historyYears;
  els.departmentBand.checked = state.toggles.department;
  els.networkBand.checked = state.toggles.network;
  els.masteryLine.checked = state.toggles.mastery;
  els.trendBenchmarkCourse.value = activeBenchmarkCourse();
  els.trendBenchmarkCourse.disabled = !state.toggles.mastery;
  els.violinPlots.checked = state.toggles.violins;
  els.sectionLines.checked = state.toggles.sections;
  els.ribbonRange.value = state.visual.ribbonRange;
  els.center.value = state.visual.center;
  els.ribbonPopulation.value = state.visual.ribbonPopulation;
  els.ribbonOpacity.value = state.visual.ribbonOpacity;
  els.ribbonOpacityValue.textContent = `${Math.round(state.visual.ribbonOpacity * 100)}%`;
  els.smoothCurves.checked = state.visual.smoothCurves;
  els.lineMinN.value = state.lines.minN;
  els.lineMinNValue.textContent = state.lines.minN;
  els.lineSort.value = state.lines.sortCut;
  els.lineFilter.value = state.lines.filter;
  els.lineLimit.value = state.lines.limit;
}

function render() {
  renderSliceSummary();
  const records = filterRecords();
  renderMetrics(records);
  renderTimeSeries(records);
  renderCompletionChart();
  renderDistributionChart();
  renderComparisonBars(records);
  renderBoyEoyMovementBars(records);
  renderPerformanceGrowthMap(records);
  renderSkillHeatmap(records);
  renderTable(records);
  renderInsights(records);
}

function initControls() {
  const courses = unique(state.source.sections.map((section) => section.course));
  const configuredBenchmarkCourses = benchmarkCourses();
  state.trend.benchmarkCourse = configuredBenchmarkCourses.includes(state.trend.benchmarkCourse)
    ? state.trend.benchmarkCourse
    : configuredBenchmarkCourses[0] ?? "";
  els.trendBenchmarkCourse.innerHTML = configuredBenchmarkCourses.length
    ? configuredBenchmarkCourses.map((course) => `<option value="${escapeHtml(course)}">${escapeHtml(course)} (${benchmarkValueForCourse(course, state.source.periods.at(-1))}%)</option>`).join("")
    : `<option value="">Program reference</option>`;
  els.tableCourse.innerHTML = [`<option value="All">All Subjects</option>`, ...courses.map((course) => `<option value="${course}">${course}</option>`)].join("");
  els.tableGrade.innerHTML = [`<option value="All">All Grades</option>`, ...unique(state.source.sections.map((section) => section.grade)).map((grade) => `<option value="${grade}">${grade}</option>`)].join("");
  els.tableTeacher.innerHTML = [`<option value="All">All Teachers</option>`, ...unique(state.source.sections.map((section) => section.teacher)).map((teacher) => `<option value="${teacher}">${teacher}</option>`)].join("");
  renderSliceFilters();

  els.compareBy.forEach((input) => {
    input.addEventListener("change", (event) => {
      if (!event.target.checked) return;
      state.groupBy = event.target.value;
      if (state.groupBy === "section") ensureSectionFilters();
      renderSliceFilters();
      render();
    });
  });

  [els.courseFilters, els.teacherFilters, els.sectionFilters].forEach((container) => {
    container.addEventListener("change", handleSliceCheckboxChange);
  });

  els.sectionFilterSearch.addEventListener("input", (event) => {
    ensureSectionFilters();
    state.filters.sectionQuery = event.target.value;
    renderSectionFilters();
  });

  els.sectionFilterSelectVisible.addEventListener("click", selectVisibleSections);
  els.sectionFilterClear.addEventListener("click", clearSectionFilters);
  els.sliceClear.addEventListener("click", clearAllSliceFilters);

  const setActiveTask = (view) => {
    if (!els.taskPanels.some((panel) => panel.dataset.dashboardPanel === view)) return;
    state.ui.activeView = view;
    els.taskButtons.forEach((button) => {
      const active = button.dataset.dashboardView === view;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    els.taskPanels.forEach((panel) => {
      const active = panel.dataset.dashboardPanel === view;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    if (view === "compare") ensureSectionFilters();
  };

  els.taskButtons.forEach((button, index) => {
    button.addEventListener("click", () => setActiveTask(button.dataset.dashboardView));
    button.addEventListener("keydown", (event) => {
      const lastIndex = els.taskButtons.length - 1;
      const targetIndex = event.key === "ArrowRight"
        ? (index + 1) % els.taskButtons.length
        : event.key === "ArrowLeft"
          ? (index - 1 + els.taskButtons.length) % els.taskButtons.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? lastIndex
              : -1;
      if (targetIndex < 0) return;
      event.preventDefault();
      const target = els.taskButtons[targetIndex];
      setActiveTask(target.dataset.dashboardView);
      target.focus();
    });
  });
  els.comparisonTools.addEventListener("toggle", () => {
    if (!els.comparisonTools.open) return;
    ensureSectionFilters();
  });
  setActiveTask(state.ui.activeView);

  els.metric.addEventListener("change", (event) => {
    state.metric = event.target.value;
    render();
  });

  els.season.addEventListener("change", (event) => {
    state.season = event.target.value;
    render();
  });

  els.trendHistory.addEventListener("change", (event) => {
    state.trend.historyYears = event.target.value;
    render();
  });

  els.trendBenchmarkCourse.addEventListener("change", (event) => {
    state.trend.benchmarkCourse = event.target.value;
    render();
  });

  els.lineMinN.addEventListener("input", (event) => {
    state.lines.minN = Number(event.target.value);
    els.lineMinNValue.textContent = state.lines.minN;
    render();
  });

  els.lineSort.addEventListener("change", (event) => {
    state.lines.sortCut = event.target.value;
    render();
  });

  els.lineFilter.addEventListener("input", (event) => {
    state.lines.filter = event.target.value;
    render();
  });

  els.lineLimit.addEventListener("change", (event) => {
    state.lines.limit = event.target.value;
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
    els.trendBenchmarkCourse.disabled = !state.toggles.mastery;
    render();
  });

  els.violinPlots.addEventListener("change", (event) => {
    state.toggles.violins = event.target.checked;
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

let resizeTimer = null;
window.addEventListener("resize", () => {
  if (!state.source) return;
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(render, 150);
}, { passive: true });

fetch(`../data/synthetic/assessment-dashboard.json?v=${assetVersion}`)
  .then((response) => {
    if (!response.ok) throw new Error(`Could not load dashboard data: ${response.status}`);
    return response.json();
  })
  .then((source) => {
    state.source = source;
    state.records = buildRecords(source);
    renderSourceMetadata(source);
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
