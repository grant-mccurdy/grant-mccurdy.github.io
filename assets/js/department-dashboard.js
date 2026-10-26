import { domainNames, selectRows, questionRows, comparisonRows, toCsv, orderedGroups, populationSummary, profileRows, pairwiseCells, responseCounts } from "./department-model.js?v=20261026a";
import { escapeText as esc, number as num, percent as pct, signed, domainColors, domainShapes, intervalChart, violinChart, profileChart, differenceChart, questionChart, pairwiseChart, responseChart } from "./department-charts.js?v=20261026a";

const byId = (id) => document.getElementById(id);
const views = ["overview", "compare", "questions", "quality"];
const controls = Object.fromEntries(["course", "track", "group", "sort", "profile", "domain", "question-scope", "question-sort", "family", "table"].map((key) => [key, byId("department-" + key)]));
const tooltip = byId("chart-tooltip");
let data, narrative, distributions, view = "overview", classSort = "section_id", classDirection = 1;
let questionExport = [], classExport = [];
const groupHeaders = ["Course", "Track", "Students", "Mean %", "Median %", "SD", "95% CI"];
const classHeaders = ["Class", "Course", "Track", "Period", "Students", "Mean %", "Median %", "SD", "95% CI"];
const questionHeaders = ["Question", "Content area", "Skill", "Course", "Track", "Correct", "Students", "Correct %"];
const filters = () => ({ course: controls.course.value, track: controls.track.value });
const ci = (row) => num(row.low) + " to " + num(row.high);
const groupValues = (row) => [row.course, row.track, row.n, num(row.mean), num(row.median), num(row.sd), ci(row)];
const classValues = (row) => [row.section_id, row.course, row.track, row.period, row.n, num(row.mean), num(row.median), num(row.sd), ci(row)];

function table(id, headers, rows, caption, sortKeys = []) {
  byId(id).innerHTML = "<table><caption>" + esc(caption) + "</caption><thead><tr>" + headers.map((heading, index) =>
    '<th scope="col"' + (sortKeys[index] ? ' aria-sort="' + (classSort === sortKeys[index] ? (classDirection === 1 ? "ascending" : "descending") : "none") + '"' : "") + ">"
    + (sortKeys[index] ? '<button type="button" class="table-sort" data-class-sort="' + sortKeys[index] + '">' + esc(heading) + (classSort === sortKeys[index] ? (classDirection === 1 ? " &#8593;" : " &#8595;") : "") + "</button>" : esc(heading)) + "</th>").join("")
    + "</tr></thead><tbody>" + (rows.length ? rows.map((row) => "<tr>" + row.map((cell, index) => index ? "<td>" + esc(cell) + "</td>" : '<th scope="row">' + esc(cell) + "</th>").join("") + "</tr>").join("")
      : '<tr><td colspan="' + headers.length + '">No records match these filters.</td></tr>') + "</tbody></table>";
}

function renderOverview(groups, summary) {
  byId("department-metrics").innerHTML = [
    ["Mean correct", pct(summary.mean), "Selected population"], ["Students", summary.n, "Selected population"],
    ["Classes", summary.classes, "Selected population"], ["Questions attempted", pct(data.questions_attempted), "Whole department"],
  ].map(([label, value, note]) => '<div class="metric-card"><dt>' + label + "</dt><dd><strong>" + value + "</strong><small>" + note + "</small></dd></div>").join("");
  violinChart(byId("course-chart"), groups, distributions.groups, { reference: byId("department-reference").checked ? data.overall[0].mean : null });
  pairwiseChart(byId("pairwise-chart"), data, groups);
  byId("course-note").textContent = "Fictional score distributions. Box: middle 50%; line: median; diamond: mean. Width shows relative density within each group, not student count. Course progression is not longitudinal growth."
    + (byId("department-reference").checked ? " Dashed line: whole-department mean, " + pct(data.overall[0].mean) + "." : "");
}

function renderProfiles() {
  const rows = profileRows(data, filters(), controls.profile.value);
  const courses = data.course_order.filter((course) => rows.some((row) => row.course === course));
  profileChart(byId("domain-chart"), rows, courses, controls.profile.value);
  byId("domain-legend").innerHTML = Object.entries(domainNames).filter(([key]) => !controls.profile.value || key === controls.profile.value)
    .map(([key, label]) => '<span><i class="shape-' + domainShapes[key] + '" style="background:' + domainColors[key] + '"></i>' + esc(label) + "</span>").join("")
    + '<span class="profile-scope">' + esc(controls.track.value || "Tracks pooled; weighted by students") + "</span>";
}

function renderCompare() {
  const classes = controls.group.value === "section";
  const rows = orderedGroups(data, selectRows(classes ? data.section : data.course, filters()), controls.sort.value);
  intervalChart(byId("group-chart"), rows, { section: classes });
  const comparisons = comparisonRows(data, controls.family.value, controls.course.value);
  differenceChart(byId("difference-chart"), comparisons);
  renderProfiles();
}

function renderTables(groups) {
  table("course-data", groupHeaders, groups.map(groupValues), "Course score summaries");
  const profiles = profileRows(data, filters(), controls.profile.value);
  table("domain-data", ["Course", "Content area", "Students", "Mean %"], profiles.map((row) => [row.course, domainNames[row.domain], row.n, num(row.mean)]), "Content-area means for selected students");
  const comparisons = comparisonRows(data, controls.family.value, controls.course.value);
  table("difference-data", ["Group A", "Group B", "n A / B", "A minus B (pp)", "95% CI", "Holm p", "Interpretation", "Cluster sensitivity"], comparisons.map((row) => {
    const clustered = data.clustered.find((item) => item.a === row.a && item.b === row.b);
    const sensitivity = clustered ? clustered.status + (clustered.low == null ? "" : "; CI " + ci(clustered)) : "Not in report export";
    return [row.a, row.b, row.n_a + " / " + row.n_b, signed(row.difference), ci(row), row.p_holm < .001 ? "<0.001" : num(row.p_holm, 3), row.interpretation, sensitivity];
  }), "Original planned tests: " + controls.family.value);
  table("pairwise-data", ["Row group", "Column group", "Difference (pp)", "95% CI", "Holm p", "Interpretation"],
    pairwiseCells(data, groups).filter((row) => row.row > row.column).map((row) => [row.a, row.b, signed(row.difference), ci(row),
      row.p_holm < .001 ? "<0.001" : num(row.p_holm, 3), row.p_holm < .05 ? "difference detected" : "inconclusive"]),
    "Selected pairs from the original 45-pair exploratory family");
  table("question-data", questionHeaders, questionResultRows(), "Question results for selected course-track groups");
  document.querySelectorAll("[data-table]").forEach((panel) => { panel.hidden = panel.dataset.table !== controls.table.value; });
}

const selectedQuestions = () => questionRows(data, filters(), controls["question-scope"].value, controls.domain.value)
    .sort((a, b) => controls["question-sort"].value === "accuracy" ? a.mean - b.mean || a.position - b.position : a.position - b.position);
function questionResultRows() {
  return selectedQuestions().flatMap((question) => orderedGroups(data, selectRows(data.course, filters())).map((group) => {
    const row = data.item_course.find((r) => r.position === question.position && r.course === group.course && r.track === group.track);
    return ["Q" + question.position, domainNames[question.domain], question.skill, row.course, row.track, row.correct, row.n, num(row.correct_rate)];
  }));
}

function renderQuestions(groups) {
  questionChart(byId("question-chart"), selectedQuestions(), groups, data);
  questionExport = questionResultRows();
  byId("department-download").disabled = !questionExport.length;
  byId("question-evidence").innerHTML = '<p class="panel-kicker">Whole-department review</p><h3>Geometry-to-Algebra II transition</h3><p>' + esc(narrative.analysis["teaching-priorities"].lead) + "</p>";
}

function renderQuality() {
  renderTables(orderedGroups(data, selectRows(data.course, filters())));
  const counts = responseCounts(data);
  responseChart(byId("response-chart"), counts, data.response_count);
  byId("response-counts").innerHTML = counts.map((row) => '<div><dt><i style="background:' + row.color + '"></i>' + row.label + "</dt><dd>" + row.count.toLocaleString() + "</dd></div>").join("");
  const fields = [["Form", data.form.id], ["Revision / scoring", data.form.revision + " / " + data.form.scoring_version], ["Questions / content areas", "30 / 4"], ["Students / classes", data.students + " / " + data.classes], ["Internal consistency (alpha)", num(data.reliability.alpha, 3)]];
  byId("source-meta").innerHTML = fields.map(([label, value]) => "<div><dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd></div>").join("");
  const rows = selectRows(data.section, filters()).sort((a, b) => classDirection * (typeof a[classSort] === "number" ? a[classSort] - b[classSort] : String(a[classSort]).localeCompare(String(b[classSort]), undefined, { numeric: true })));
  classExport = rows.map(classValues);
  table("class-data", classHeaders, classExport, rows.length + " classes in the selected population", ["section_id", "course", "track", "period", "n", "mean", "median", "sd"]);
  byId("class-download").disabled = !rows.length;
}

function render() {
  tooltip.hidden = true;
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.setAttribute("aria-selected", String(active)); button.tabIndex = active ? 0 : -1;
  });
  views.forEach((key) => { byId(key).hidden = key !== view; });
  const summary = populationSummary(data, filters());
  byId("department-selection").textContent = (controls.course.value || "All courses") + " / " + (controls.track.value || "All tracks") + " / " + summary.n + " students";
  const groups = orderedGroups(data, selectRows(data.course, filters()));
  if (view === "overview") renderOverview(groups, summary);
  if (view === "compare") renderCompare();
  if (view === "questions") renderQuestions(groups);
  if (view === "quality") renderQuality();
}

function syncUrl(push = false) {
  const url = new URL(location.href);
  for (const [key, control] of Object.entries(controls)) {
    if (control.selectedIndex > 0) url.searchParams.set(key, control.value);
    else url.searchParams.delete(key);
  }
  if (!byId("department-reference").checked) url.searchParams.set("reference", "off");
  else url.searchParams.delete("reference");
  url.hash = view;
  history[push ? "pushState" : "replaceState"](null, "", url);
}

function readUrl() {
  const url = new URL(location.href), hash = url.hash.slice(1);
  const legacy = { courses: "overview", comparisons: "overview", content: "compare" };
  view = views.includes(hash) ? hash : legacy[hash] || "overview";
  for (const [key, control] of Object.entries(controls)) {
    const option = [...control.options].find((entry) => entry.value === url.searchParams.get(key));
    control.value = option ? option.value : control.options[0].value;
  }
  byId("department-reference").checked = url.searchParams.get("reference") !== "off";
}

function navigate(next, focus = false) {
  view = next; render(); syncUrl(true);
  if (focus) {
    byId("tab-" + view).focus({ preventScroll: true });
    document.querySelector(".dashboard-task-tabs").scrollIntoView({ block: "start", behavior: "instant" });
  }
}

function showTooltip(mark, event) {
  tooltip.textContent = mark.dataset.tooltip;
  tooltip.hidden = false;
  const rect = mark.getBoundingClientRect();
  const x = event?.clientX ?? rect.left + rect.width / 2;
  const y = event?.clientY ?? rect.top;
  tooltip.style.left = Math.max(8, Math.min(innerWidth - tooltip.offsetWidth - 8, x + 12)) + "px";
  tooltip.style.top = Math.max(8, Math.min(innerHeight - tooltip.offsetHeight - 8, y - tooltip.offsetHeight - 12)) + "px";
}

function selectMark(mark) {
  const container = mark.closest(".native-chart");
  container.querySelectorAll(".is-selected").forEach((node) => node.classList.remove("is-selected"));
  mark.classList.add("is-selected");
  const selection = container.querySelector(".chart-selection");
  selection.textContent = mark.dataset.tooltip; selection.hidden = false;
  if (mark.dataset.position) {
    const question = data.questions.find((q) => q.position === Number(mark.dataset.position));
    const record = data.item_course.find((r) => r.position === question.position && r.course === mark.dataset.course && r.track === mark.dataset.track);
    byId("question-evidence").innerHTML = '<p class="panel-kicker">Q' + question.position + " / " + esc(domainNames[question.domain]) + "</p><h3>" + esc(question.skill)
      + "</h3><p><strong>" + pct(record.correct_rate) + " correct</strong> (" + record.correct + " of " + record.n + ") / " + esc(record.course + " / " + record.track)
      + '</p><p>Confirm content exposure and inspect student explanations before deciding on reteaching.</p><a href="https://logoseducation.group/assessment-preview/short/assessment.pdf">Assessment booklet &#8599;</a>';
  }
}

function wireCharts() {
  const app = byId("department-app");
  app.addEventListener("pointerover", (event) => {
    const mark = event.target.closest(".chart-mark");
    if (mark) showTooltip(mark, event);
  });
  app.addEventListener("pointerout", (event) => {
    const mark = event.target.closest(".chart-mark");
    if (mark && !mark.contains(event.relatedTarget)) tooltip.hidden = true;
  });
  app.addEventListener("focusin", (event) => {
    if (event.target.matches(".chart-mark")) showTooltip(event.target);
  });
  app.addEventListener("focusout", () => { tooltip.hidden = true; });
  app.addEventListener("click", (event) => {
    const mark = event.target.closest(".chart-mark");
    if (mark) selectMark(mark);
    const sort = event.target.closest("[data-class-sort]");
    if (sort) {
      const key = sort.dataset.classSort;
      classDirection = classSort === key ? -classDirection : 1; classSort = key;
      renderQuality();
      byId("class-data").querySelector('[data-class-sort="' + key + '"]').focus({ preventScroll: true });
    }
  });
  app.addEventListener("keydown", (event) => {
    const mark = event.target.closest(".chart-mark");
    if (!mark) return;
    if (["Enter", " "].includes(event.key)) { event.preventDefault(); selectMark(mark); return; }
    if (event.key === "Escape") { tooltip.hidden = true; return; }
    const chart = mark.closest(".native-chart"), marks = [...chart.querySelectorAll(".chart-mark")];
    const index = marks.indexOf(mark), columns = Number(chart.dataset.columns);
    const offsets = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
    let next = event.key === "Home" ? 0 : event.key === "End" ? marks.length - 1 : index + (offsets[event.key] ?? NaN);
    if (mark.dataset.row != null && Object.hasOwn(offsets, event.key)) {
      const dr = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
      const dc = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      let row = Number(mark.dataset.row) + dr, column = Number(mark.dataset.column) + dc;
      const maxRow = Math.max(...marks.map((node) => Number(node.dataset.row)));
      const maxColumn = Math.max(...marks.map((node) => Number(node.dataset.column)));
      next = index;
      while (row >= 0 && column >= 0 && row <= maxRow && column <= maxColumn) {
        const match = marks.findIndex((node) => Number(node.dataset.row) === row && Number(node.dataset.column) === column);
        if (match >= 0) { next = match; break; }
        row += dr; column += dc;
      }
    }
    if (!Number.isFinite(next)) return;
    event.preventDefault();
    mark.tabIndex = -1;
    const target = marks[Math.max(0, Math.min(marks.length - 1, next))];
    target.tabIndex = 0; target.focus();
  });
  addEventListener("scroll", () => { tooltip.hidden = true; }, true);
}

function download(name, headers, rows) {
  const url = URL.createObjectURL(new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function start() {
  const responses = await Promise.all(["report-data", "report-narrative", "score-distributions"].map((file) => fetch("../data/logos/" + file + ".json")));
  if (responses.some((response) => !response.ok)) throw new Error("Evidence unavailable");
  [data, narrative, distributions] = await Promise.all(responses.map((response) => response.json()));
  if (!data.synthetic || data.form.item_count !== 30 || !Array.isArray(narrative.findings)) throw new Error("Unexpected evidence");
  if (!distributions.synthetic || distributions.form_sha256 !== data.form.sha256 || distributions.groups.reduce((n, row) => n + row.n, 0) !== data.students) throw new Error("Unexpected score distributions");
  for (const course of data.course_order) controls.course.add(new Option(course, course));
  for (const [key, label] of Object.entries(domainNames)) {
    controls.domain.add(new Option(label, key)); controls.profile.add(new Option(label, key));
  }
  byId("department-findings").innerHTML = narrative.findings.map((finding, index) => '<li><span class="insight-label">' + ["Transition readiness", "Track expectations", "Class variation"][index]
    + "</span><strong>" + esc(finding.title) + "</strong><p>" + esc(finding.evidence) + '</p><button type="button" class="signal-link" data-drill="' + index + '">' + esc(finding.link) + " &#8594;</button></li>").join("");
  byId("teaching-checks").innerHTML = narrative.teaching_checks.map(([label, skill, task]) => "<div><dt>" + esc(label) + "</dt><dd>" + esc(skill) + " " + esc(task) + "</dd></div>").join("");
  byId("department-app").hidden = false; byId("department-status").hidden = true;
  readUrl(); render(); wireCharts();
  document.querySelectorAll("[data-data-view]").forEach((button) => button.addEventListener("click", () => {
    controls.table.value = button.dataset.dataView;
    navigate("quality", true);
    controls.table.focus();
    byId("values-title").scrollIntoView({ block: "center" });
  }));
  Object.values(controls).forEach((control) => control.addEventListener("change", () => { render(); syncUrl(); }));
  byId("department-reference").addEventListener("change", () => { render(); syncUrl(); });
  const tabs = [...document.querySelectorAll("[data-view]")];
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => navigate(tab.dataset.view));
    tab.addEventListener("keydown", (event) => {
      const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault(); navigate(tabs[next].dataset.view, true);
    });
  });
  document.querySelectorAll("[data-drill]").forEach((button) => button.addEventListener("click", () => {
    Object.values(controls).forEach((control) => { control.selectedIndex = 0; });
    const index = Number(button.dataset.drill);
    if (index === 0) { controls.course.value = "Algebra II"; navigate("questions", true); }
    if (index === 1) navigate("compare", true);
    if (index === 2) { controls.course.value = "Geometry"; controls.track.value = "Regular"; controls.group.value = "section"; controls.family.value = "Classes within course and track"; navigate("compare", true); }
  }));
  byId("department-reset").addEventListener("click", () => {
    Object.values(controls).forEach((control) => { control.selectedIndex = 0; });
    byId("department-reference").checked = true; render(); syncUrl();
  });
  byId("department-download").addEventListener("click", () => download("logos-question-results.csv", questionHeaders, questionExport));
  byId("class-download").addEventListener("click", () => download("logos-class-results.csv", classHeaders, classExport));
  addEventListener("popstate", () => { readUrl(); render(); });
  addEventListener("hashchange", () => { readUrl(); render(); });
  let lastWidth = byId("department-app").clientWidth, pending;
  new ResizeObserver(() => {
    const width = byId("department-app").clientWidth;
    if (width === lastWidth) return;
    lastWidth = width; cancelAnimationFrame(pending); pending = requestAnimationFrame(render);
  }).observe(byId("department-app"));
}

start().catch(() => {
  byId("department-app").hidden = true; byId("department-status").hidden = false;
  byId("department-status").innerHTML = 'Dashboard evidence could not be loaded. <button type="button" id="department-retry">Try again</button> or <a href="https://logoseducation.group/sample-report/">read the department report</a>.';
  byId("department-retry").addEventListener("click", () => location.reload());
});
