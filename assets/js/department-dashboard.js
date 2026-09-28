import { domainNames, selectRows, questionRows, domainRows, comparisonRows, toCsv } from "./department-model.js";

const byId = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const num = (value, digits = 1) => value == null ? "Not estimable" : Number(value).toFixed(digits);
const pct = (value) => value == null ? "Not estimable" : `${num(value)}%`;
const controls = Object.fromEntries(["course", "track", "group", "domain", "question-scope", "family"].map((key) => [key, byId(`department-${key}`)]));
const routes = { overview: "", courses: "course-patterns", content: "content-areas", questions: "teaching-priorities", comparisons: "comparisons" };
const titles = { courses: "Course and class patterns", content: "Content areas", questions: "Question-level evidence", comparisons: "Course and track comparisons" };
const figures = {
  courses: ["course-distributions", "Course scores overlap across tracks, with substantial variation within courses."],
  classes: ["section-periods", "The Regular Geometry class spread is a priority for follow-up."],
  content: ["domain-course-track", "Four content areas across courses and tracks. These are different students assessed once."],
  questions: ["item-priorities", "Seven teaching-review questions from the paired assessment. Darker blue indicates lower accuracy."],
  allQuestions: ["item-course", "All 30 questions across courses and tracks. Darker blue indicates lower accuracy."],
  comparisons: ["pairwise-audit", "Exploratory audit of all 45 group pairs, separate from the 22 planned comparisons above. Signed cells are row minus column; NS is inconclusive."],
};
let data, narrative, view = "overview", tableHeaders = [], tableRows = [];

function showTable(headers, rows, caption) {
  tableHeaders = headers;
  tableRows = rows;
  byId("department-table").innerHTML = `<caption>${esc(caption)}</caption><thead><tr>${headers.map((heading) => `<th scope="col">${esc(heading)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell, i) => i ? `<td>${esc(cell)}</td>` : `<th scope="row">${esc(cell)}</th>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">No groups match these filters.</td></tr>`}</tbody>`;
  byId("department-download").disabled = !rows.length;
}

function bars(rows, label) {
  byId("department-chart").innerHTML = rows.length
    ? `<p class="chart-unit">Percent correct / 0 to 100%</p><ol class="department-bars" aria-label="Percent correct for selected groups">${rows.map((row) => `<li><span>${esc(label(row))}</span><div class="department-bar-track" aria-hidden="true"><div class="department-bar ${row.track === "Honors/AP" ? "honors" : ""}" style="width:${Math.max(0, Math.min(100, row.mean))}%"></div></div><strong>${pct(row.mean)}</strong></li>`).join("")}</ol>` : "";
}

function overview() {
  byId("department-metrics").innerHTML = [["Students", data.students], ["Classes", data.classes], ["Mean correct", pct(data.overall[0].mean)], ["Questions attempted", pct(data.questions_attempted)]]
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
  const destinations = { "teaching-priorities": "questions", comparisons: "comparisons", "class-patterns": "courses" };
  byId("department-findings").innerHTML = narrative.findings.map((finding, i) =>
    `<article><span class="finding-index">0${i + 1}</span><h3>${esc(finding.title)}</h3><p>${esc(finding.evidence)}</p><p class="finding-implication">${esc(finding.implication)}</p><a href="#${destinations[finding.route]}" ${finding.route === "class-patterns" ? 'data-geometry="true"' : ""}>${esc(finding.link)} <span aria-hidden="true">&#8594;</span></a></article>`).join("");
  byId("department-actions").innerHTML = narrative.actions.map((action) =>
    `<article><h3>${esc(action.title)}</h3><p class="action-owner">${esc(action.owner)}</p><p>${esc(action.action)}</p><details><summary>Evidence and review point</summary><p>${esc(action.evidence)}</p><p>${esc(action.review)}</p></details></article>`).join("");
}

function syncUrl() {
  const url = new URL(location.href);
  for (const [key, control] of Object.entries(controls)) {
    if (control.selectedIndex > 0) url.searchParams.set(key, control.value);
    else url.searchParams.delete(key);
  }
  url.hash = view;
  history.replaceState(null, "", url);
}

function render() {
  byId("overview").hidden = view !== "overview";
  byId("department-explore").hidden = view === "overview";
  document.querySelectorAll("[data-view]").forEach((link) => {
    if (link.dataset.view === view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (view === "overview") return;
  const classes = view === "courses" && controls.group.value === "section";
  const route = classes ? "class-patterns" : routes[view];
  const reading = narrative.analysis[route];
  byId("explore-title").textContent = titles[view];
  byId("explore-lead").textContent = reading.title;
  byId("group-control").hidden = view !== "courses";
  byId("domain-control").hidden = view !== "questions";
  byId("question-control").hidden = view !== "questions";
  byId("family-control").hidden = view !== "comparisons";
  controls.track.parentElement.hidden = view === "comparisons";
  const filters = { course: controls.course.value, track: view === "comparisons" ? "" : controls.track.value };
  const population = selectRows(data.course, filters).reduce((sum, row) => sum + row.n, 0);
  byId("department-selection").textContent = view === "comparisons" ? `${filters.course || "All courses"} / Original planned comparison families` : `${filters.course || "All courses"} / ${filters.track || "All tracks"} / ${population} students`;
  let interpretation;
  if (view === "courses") {
    const rows = selectRows(classes ? data.section : data.course, filters);
    bars(rows, (row) => classes ? `${row.course} / ${row.section_id} / P${row.period}` : `${row.course} / ${row.track}`);
    showTable(["Group", "Track", "Students", "Mean %", "Median %", "SD", "95% interval"], rows.map((row) => [classes ? `${row.course} / ${row.section_id} / P${row.period}` : row.course, row.track, row.n, num(row.mean), num(row.median), num(row.sd), `${num(row.low)} to ${num(row.high)}`]), classes ? "Class score summaries" : "Course and track score summaries");
    interpretation = "Mean percentages and student-level 95% intervals describe this administration. They do not measure growth, instructional impact, or teacher effectiveness.";
  } else if (view === "content") {
    const rows = domainRows(data, filters);
    bars(rows, (row) => domainNames[row.domain]);
    showTable(["Content area", "Questions", "Students", "Mean %"], rows.map((row) => [domainNames[row.domain], data.questions.filter((q) => q.domain === row.domain).length, row.n, num(row.mean)]), "Content-area means for the selected population");
    interpretation = "Means are weighted by group size. Domains use different questions and difficulty; percentages are not on a common proficiency scale. Each student contributes to every domain.";
  } else if (view === "questions") {
    const rows = questionRows(data, filters, controls["question-scope"].value, controls.domain.value);
    bars(rows, (row) => `Q${row.position} / ${row.skill}`);
    showTable(["Question", "Content area", "Skill", "Correct", "Students", "Correct %"], rows.map((row) => [`Q${row.position}`, domainNames[row.domain], row.skill, row.correct, row.n, num(row.mean)]), "Question results for the selected population");
    interpretation = "Percent correct uses all students assigned each question, including unanswered questions. Question numbers match the 30-question form. A wrong answer alone does not diagnose a misconception.";
  } else {
    const rows = comparisonRows(data, controls.family.value, filters.course);
    byId("department-chart").replaceChildren();
    showTable(["Group A", "Group B", "n A / n B", "A minus B (pp)", "95% interval", "Holm p", "Interpretation"], rows.map((row) => [row.a, row.b, `${row.n_a} / ${row.n_b}`, `${row.difference >= 0 ? "+" : ""}${num(row.difference)}`, `${num(row.low)} to ${num(row.high)}`, row.p_holm < 0.001 ? "<0.001" : num(row.p_holm, 3), row.interpretation]), `Planned comparisons: ${controls.family.value}`);
    byId("department-selection").textContent += ` / ${rows.length} comparisons`;
    interpretation = "Signed differences are Group A minus Group B in percentage points. Intervals are the original student-level 95% intervals; decisions use Holm-adjusted p values. Inconclusive does not mean equivalent. No tests are recalculated after filtering.";
  }
  byId("department-interpretation").textContent = interpretation;
  const figureKey = classes ? "classes" : view === "questions" && controls["question-scope"].value === "all" ? "allQuestions" : view;
  const [figure, caption] = figures[figureKey];
  const src = `../assets/images/logos/${figure}.svg`;
  byId("department-figure").src = src;
  byId("department-figure").alt = caption;
  byId("department-figure-full").href = src;
  byId("department-figure-caption").textContent = caption;
  byId("department-report-section").href = `https://logoseducation.group/sample-report/${route}/`;
  byId("department-reading").innerHTML = `<h3>Department interpretation</h3><p>${esc(reading.lead)}</p><details><summary>Evidence and next decision</summary>${reading.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}<p><strong>Next decision:</strong> ${esc(reading.decision)}</p></details>${view === "questions" ? `<h3>Proposed follow-up tasks</h3><dl class="teaching-checks">${narrative.teaching_checks.map(([q, skill, task]) => `<div><dt>${esc(q)}</dt><dd>${esc(skill)} ${esc(task)}</dd></div>`).join("")}</dl>` : ""}`;
}

function readUrl() {
  const url = new URL(location.href);
  view = Object.hasOwn(routes, url.hash.slice(1)) ? url.hash.slice(1) : "overview";
  for (const [key, control] of Object.entries(controls)) {
    const option = [...control.options].find((entry) => entry.value === url.searchParams.get(key));
    control.value = option ? option.value : control.options[0].value;
  }
}

async function start() {
  const responses = await Promise.all(["report-data", "report-narrative"].map((file) => fetch(`../data/logos/${file}.json`)));
  if (responses.some((response) => !response.ok)) throw new Error("Evidence unavailable");
  [data, narrative] = await Promise.all(responses.map((response) => response.json()));
  if (!data.synthetic || data.form.item_count !== 30 || !Array.isArray(narrative.findings)) throw new Error("Unexpected evidence");
  for (const course of data.course_order) controls.course.add(new Option(course, course));
  for (const [key, label] of Object.entries(domainNames)) controls.domain.add(new Option(label, key));
  overview(); readUrl(); render();
  byId("department-app").hidden = false;
  byId("department-status").hidden = true;
  Object.values(controls).forEach((control) => control.addEventListener("change", () => { render(); syncUrl(); }));
  document.querySelectorAll('[href^="#"]').forEach((link) => {
    if (!Object.hasOwn(routes, link.hash.slice(1))) return;
    link.addEventListener("click", (event) => {
      event.preventDefault(); view = link.hash.slice(1);
      if (link.dataset.geometry) { controls.group.value = "section"; controls.course.value = "Geometry"; controls.track.value = "Regular"; }
      render(); syncUrl();
      const heading = byId(view === "overview" ? "overview-title" : "explore-title");
      heading.tabIndex = -1; heading.focus({ preventScroll: true });
    });
  });
  window.addEventListener("popstate", () => { readUrl(); render(); });
  window.addEventListener("hashchange", () => { readUrl(); render(); });
  byId("department-reset").addEventListener("click", () => { Object.values(controls).forEach((control) => { control.selectedIndex = 0; }); render(); syncUrl(); });
  byId("department-download").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([toCsv(tableHeaders, tableRows)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `logos-${view}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

start().catch(() => {
  byId("department-status").innerHTML = 'Dashboard evidence could not be loaded. <button type="button" id="department-retry">Try again</button> or <a href="https://logoseducation.group/sample-report/">read the department report</a>.';
  byId("department-retry").addEventListener("click", () => location.reload());
});
