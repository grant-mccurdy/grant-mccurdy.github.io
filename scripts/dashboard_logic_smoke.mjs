#!/usr/bin/env node
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve(path.join(import.meta.dirname, ".."));
const requireFromHere = createRequire(import.meta.url);
const dashboardPath = path.join("dashboard", "assessment.html");
const sourcePath = path.join(root, "data", "synthetic", "assessment-dashboard.json");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (originalError) {
    const candidates = [
      process.env.PLAYWRIGHT_MODULE_DIR,
      ...(process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : []),
    ].filter(Boolean);

    for (const candidate of candidates) {
      for (const specifier of [path.join(candidate, "playwright"), candidate]) {
        try {
          return requireFromHere(specifier);
        } catch {
          // Try the next candidate.
        }
      }
    }

    throw originalError;
  }
}

function staticServer() {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(requestUrl.pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const target = path.resolve(root, relativePath);

    if (target !== root && !target.startsWith(root + path.sep)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    let filePath = target;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] ?? "application/octet-stream" });
    fs.createReadStream(filePath).pipe(response);
  });
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start dashboard logic smoke server");
  }
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function fmtPct(value) {
  return `${Math.round(value)}%`;
}

function fmtPts(value, precision = 0) {
  if (!Number.isFinite(value)) return "-";
  const rounded = Number(value.toFixed(precision));
  const displayValue = Object.is(rounded, -0) ? 0 : rounded;
  return `${displayValue > 0 ? "+" : ""}${displayValue.toFixed(precision)} pts`;
}

function fmtPtsAuto(value) {
  const precision = Math.abs(value) > 0 && Math.abs(value) < 1 ? 1 : 0;
  return fmtPts(value, precision);
}

function weightedAverage(rows, key) {
  const students = rows.reduce((sum, row) => sum + (Number(row.students) || 0), 0);
  if (!students) return 0;
  return rows.reduce((sum, row) => sum + row[key] * row.students, 0) / students;
}

function mean(values) {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (!numeric.length) return 0;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function averageFinite(values) {
  const numeric = values.filter((value) => Number.isFinite(value));
  return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : NaN;
}

function periodWindowText(period) {
  return `${period.assessmentWindow ?? ""} ${period.season ?? ""} ${period.label ?? ""}`.toLowerCase();
}

function isBeginningWindow(period) {
  const text = periodWindowText(period);
  return text.includes("beginning") || /\bboy\b/.test(text);
}

function isEndWindow(period) {
  const text = periodWindowText(period);
  return text.includes("end") || /\beoy\b/.test(text);
}

function boyEoyPairs(periods) {
  const sorted = [...periods].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const pairs = [];
  sorted.forEach((period, index) => {
    if (!isBeginningWindow(period)) return;
    for (let nextIndex = index + 1; nextIndex < sorted.length; nextIndex += 1) {
      const candidate = sorted[nextIndex];
      if (isBeginningWindow(candidate)) break;
      if (isEndWindow(candidate)) {
        pairs.push({ begin: period, end: candidate });
        break;
      }
    }
  });
  return pairs;
}

function aggregateScorePeriodData(source) {
  return source.periods.map((period) => {
    const rows = source.studentRecords.filter((row) => row.periodId === period.id && row.completed);
    return {
      period,
      rows,
      score: mean(rows.map((row) => row.score)),
    };
  });
}

function averageBoyEoyDeltaForPeriodData(periodData, metricKey = "score") {
  const periodById = new Map(periodData.map((periodItem) => [periodItem.period.id, periodItem]));
  const deltas = boyEoyPairs(periodData.map((periodItem) => periodItem.period)).map(({ begin, end }) => {
    const beginValue = periodById.get(begin.id)?.[metricKey];
    const endValue = periodById.get(end.id)?.[metricKey];
    return Number.isFinite(beginValue) && Number.isFinite(endValue) ? endValue - beginValue : NaN;
  });
  return averageFinite(deltas);
}

function sourceExpectations(source) {
  const { periods, records, studentRecords } = source;
  const latestPeriod = periods[periods.length - 1];
  const latestRows = records.filter((row) => row.periodId === latestPeriod.id);
  const latestScore = weightedAverage(latestRows, "score");
  const averageBoyEoyDelta = averageBoyEoyDeltaForPeriodData(aggregateScorePeriodData(source));
  const completed = latestRows.reduce((sum, row) => sum + (Number(row.completed) || 0), 0);
  const targetCompleted = latestRows
    .filter((row) => row.score >= (source.bands.mastery.byCourse?.[row.course] ?? source.bands.mastery.line[latestPeriod.order - 1]))
    .reduce((sum, row) => sum + (Number(row.completed) || 0), 0);
  const subjectLineCount = new Set(records.map((row) => row.course)).size;
  const tableRows = new Set(latestRows.map((row) => row.course)).size;
  const subjectViolinCount = [...new Set(studentRecords.map((row) => row.course))]
    .reduce((count, course) => count + periods.filter((period) => {
      const scores = studentRecords.filter((row) => (
        row.periodId === period.id &&
        row.course === course &&
        row.completed &&
        Number.isFinite(row.score)
      ));
      return scores.length >= 5;
    }).length, 0);
  const benchmarkEntries = Object.entries(source.bands.mastery.byCourse ?? {})
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }));
  const benchmarkTest = benchmarkEntries.find(([, value]) => value !== benchmarkEntries[0]?.[1]) ?? benchmarkEntries[0] ?? ["", 70];

  return {
    assetVersion: readDashboardAssetVersion(),
    cards: {
      students: latestRows.reduce((sum, row) => sum + (Number(row.students) || 0), 0).toLocaleString(),
      latest: fmtPct(latestScore),
      change: fmtPtsAuto(averageBoyEoyDelta),
      completion: fmtPct(weightedAverage(latestRows, "completion")),
      target: completed ? fmtPct((targetCompleted / completed) * 100) : "-",
    },
    subjectLineCount,
    tableRows,
    subjectViolinCount,
    academicYearCount: new Set(periods.map((period) => period.academicYear)).size,
    periodCount: periods.length,
    firstPeriodId: periods[0]?.id ?? "",
    latestPeriodId: periods.at(-1)?.id ?? "",
    defaultTrendStartId: periods.at(-10)?.id ?? periods[0]?.id ?? "",
    defaultTrendEndOptionIds: periods.slice(-10).map((period) => period.id),
    arbitraryTrendStartId: periods[3]?.id ?? periods[0]?.id ?? "",
    arbitraryTrendEndId: periods[8]?.id ?? periods.at(-1)?.id ?? "",
    arbitraryTrendEndOptionIds: periods.slice(3).map((period) => period.id),
    arbitraryTrendWindowCount: periods.slice(3, 9).length,
    arbitraryTrendYearCount: new Set(periods.slice(3, 9).map((period) => period.academicYear)).size,
    benchmarkCourseCount: benchmarkEntries.length,
    benchmarkTestCourse: benchmarkTest[0],
    benchmarkTestValue: benchmarkTest[1],
  };
}

function readDashboardAssetVersion() {
  const html = fs.readFileSync(path.join(root, dashboardPath), "utf8");
  return html.match(/data-asset-version="([^"]+)"/)?.[1] ?? "";
}

function findEmptyCourseTeacherCombo(source) {
  const courses = [...new Set(source.sections.map((section) => section.course))];
  const teachers = [...new Set(source.sections.map((section) => section.teacher))];
  for (const course of courses) {
    for (const teacher of teachers) {
      if (!source.sections.some((section) => section.course === course && section.teacher === teacher)) {
        return { course, teacher };
      }
    }
  }
  return null;
}

async function setSelect(page, selector, value) {
  await page.evaluate(({ selector, value }) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing select ${selector}`);
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, { selector, value });
  await page.waitForTimeout(80);
}

async function setRange(page, selector, value) {
  await page.evaluate(({ selector, value }) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing range ${selector}`);
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, { selector, value });
  await page.waitForTimeout(80);
}

async function setInput(page, selector, value) {
  await page.evaluate(({ selector, value }) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing input ${selector}`);
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, { selector, value });
  await page.waitForTimeout(80);
}

async function checkValue(page, containerSelector, value) {
  await page.evaluate(({ containerSelector, value }) => {
    const input = [...document.querySelectorAll(`${containerSelector} input[type="checkbox"]`)]
      .find((item) => item.value === value);
    if (!input) throw new Error(`Missing checkbox ${value} in ${containerSelector}`);
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { containerSelector, value });
  await page.waitForTimeout(120);
}

async function selectDashboardView(page, view) {
  await page.locator(`[data-dashboard-view="${view}"]`).click();
  await page.waitForFunction((activeView) => {
    const activeButton = document.querySelector(`[data-dashboard-view="${activeView}"]`);
    const activePanel = document.querySelector(`[data-dashboard-panel="${activeView}"]`);
    return activeButton?.getAttribute("aria-selected") === "true" && activePanel && !activePanel.hidden;
  }, view);
}

async function resetDashboard(page) {
  await selectDashboardView(page, "compare");
  await page.evaluate(() => {
    const comparisonTools = document.querySelector("#dashboard-comparison-tools");
    if (comparisonTools && !comparisonTools.open) {
      comparisonTools.open = true;
      comparisonTools.dispatchEvent(new Event("toggle"));
    }
  });
  await page.waitForTimeout(40);
  await page.locator("#slice-filter-clear").click();
  await setInput(page, "#line-filter", "");
  await setSelect(page, "#metric-select", "score");
  await setSelect(page, "#season-select", "All");
  const trendBounds = await page.evaluate(() => {
    const options = [...document.querySelectorAll("#trend-start-select option")];
    return {
      first: options[0]?.value ?? "",
      latest: options.at(-1)?.value ?? "",
    };
  });
  await setSelect(page, "#trend-start-select", trendBounds.first);
  await setSelect(page, "#trend-end-select", trendBounds.latest);
  await setSelect(page, "#line-sort-select", "latest");
  await setSelect(page, "#line-limit-select", "10");
  await setRange(page, "#line-min-n", "5");
  await page.evaluate(() => {
    const violin = document.querySelector("#toggle-violin-plots");
    if (violin && !violin.checked) {
      violin.checked = true;
      violin.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const benchmark = document.querySelector("#toggle-mastery-line");
    if (benchmark && !benchmark.checked) {
      benchmark.checked = true;
      benchmark.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await page.waitForTimeout(120);
}

async function checkFirstN(page, selector, count) {
  const optionCount = await page.locator(selector).count();
  const selected = Math.min(count, optionCount);
  for (let index = 0; index < selected; index += 1) {
    await page.locator(selector).nth(index).check();
  }
  await page.waitForTimeout(160);
  return selected;
}

async function snapshot(page) {
  return page.evaluate(() => {
    const pageText = document.body.innerText;
    const svgText = [...document.querySelectorAll("svg")].map((svg) => svg.outerHTML).join("\n");
    return {
      dashboardError: pageText.includes("Dashboard data did not load"),
      badTextValue: /NaN|undefined|Infinity/.test(pageText),
      badSvgValue: /NaN|undefined|Infinity/.test(svgText),
      legacyGrowthCopy: /Growth From Baseline|Growth Ranking|first selected period|score change from Assignment 01/.test(pageText),
      assetVersion: document.documentElement.dataset.assetVersion,
      cssHref: document.querySelector("link[rel='stylesheet']")?.href ?? "",
      dashboardScriptSrc: [...document.scripts].map((script) => script.src).find((src) => src.includes("assessment-dashboard")) ?? "",
      oldControls: {
        groupSelects: document.querySelectorAll("#group-select").length,
        presetRows: document.querySelectorAll(".preset-row").length,
        sliceMenus: document.querySelectorAll(".slice-filter-menu").length,
      },
      compareRadios: [...document.querySelectorAll("input[name='compare-by']")].map((input) => ({
        value: input.value,
        checked: input.checked,
      })),
      summary: document.querySelector("#slice-filter-summary")?.textContent ?? "",
      metricOptions: [...document.querySelectorAll("#metric-select option")].map((option) => option.value),
      cards: {
        students: document.querySelector("#metric-students")?.textContent.trim() ?? "",
        latest: document.querySelector("#metric-latest")?.textContent.trim() ?? "",
        change: document.querySelector("#metric-change")?.textContent.trim() ?? "",
        completion: document.querySelector("#metric-completion")?.textContent.trim() ?? "",
        target: document.querySelector("#metric-target")?.textContent.trim() ?? "",
      },
      timeCaption: document.querySelector("#time-caption")?.textContent ?? "",
      timeChartText: document.querySelector("#time-chart")?.textContent ?? "",
      trendStart: document.querySelector("#trend-start-select")?.value ?? "",
      trendEnd: document.querySelector("#trend-end-select")?.value ?? "",
      trendStartOptions: document.querySelectorAll("#trend-start-select option").length,
      trendEndOptions: document.querySelectorAll("#trend-end-select option").length,
      trendEndOptionIds: [...document.querySelectorAll("#trend-end-select option")].map((option) => option.value),
      trendWindowCount: document.querySelectorAll("#time-chart .x-label").length,
      trendYearLabelCount: document.querySelectorAll("#time-chart .trend-year-label").length,
      benchmarkChecked: document.querySelector("#toggle-mastery-line")?.checked ?? false,
      benchmarkCourse: document.querySelector("#trend-benchmark-course")?.value ?? "",
      benchmarkCourseDisabled: document.querySelector("#trend-benchmark-course")?.disabled ?? false,
      benchmarkCourseOptions: document.querySelectorAll("#trend-benchmark-course option").length,
      benchmarkLineCount: document.querySelectorAll("#time-chart .benchmark-line").length,
      benchmarkLegend: document.querySelector("#time-legend")?.textContent ?? "",
      movementCaption: document.querySelector("#growth-caption")?.textContent ?? "",
      lineCount: document.querySelectorAll(".comparison-series-line").length,
      lineLabels: [...document.querySelectorAll(".right-label-text")].map((node) => node.textContent.trim()).slice(0, 8),
      violinCount: document.querySelectorAll(".violin-plot").length,
      violinTitles: [...document.querySelectorAll(".violin-plot title")].map((node) => node.textContent.trim()).slice(0, 8),
      emptyChartText: [...document.querySelectorAll(".empty-chart-text")].map((node) => node.textContent.trim()),
      tableRows: document.querySelectorAll("#course-table tr").length,
      tableCount: document.querySelector("#table-count")?.textContent ?? "",
      activeView: document.querySelector("[data-dashboard-view][aria-selected='true']")?.dataset.dashboardView ?? "",
      visiblePanels: [...document.querySelectorAll("[data-dashboard-panel]")]
        .filter((panel) => !panel.hidden)
        .map((panel) => panel.dataset.dashboardPanel),
      taskTabCount: document.querySelectorAll("[role='tab'][data-dashboard-view]").length,
      performanceGrowthPoints: document.querySelectorAll(".performance-growth-point").length,
      performanceGrowthLabels: document.querySelectorAll(".performance-growth-label").length,
      performanceGrowthCaption: document.querySelector("#performance-growth-caption")?.textContent ?? "",
      performanceGrowthGuide: document.querySelector("#performance-growth-guide")?.textContent.replace(/\s+/g, " ").trim() ?? "",
      performanceGrowthReviewReasons: [...document.querySelectorAll(".performance-growth-item[data-review-reasons]")]
        .flatMap((node) => node.dataset.reviewReasons.split(",").filter(Boolean)),
      performanceGrowthBenchmarkLines: document.querySelectorAll("#performance-growth-chart .performance-benchmark-line").length,
      decisionSignalCount: document.querySelectorAll("#insight-list li").length,
      mobileOverflow: [...document.querySelectorAll("body *")]
        .filter((element) => {
          if (element.closest(".chart-frame, .table-wrap")) return false;
          const rect = element.getBoundingClientRect();
          return rect.width && rect.height && (rect.right > document.documentElement.clientWidth + 2 || rect.left < -2);
        })
        .slice(0, 8)
        .map((element) => ({
          tag: element.tagName,
          className: String(element.className),
          text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
        })),
    };
  });
}

function pushFailure(failures, label, details) {
  failures.push({ label, details });
}

function assertCondition(failures, condition, label, details = null) {
  if (!condition) pushFailure(failures, label, details);
}

function cardsMatch(actual, expected) {
  return Object.entries(expected).every(([key, value]) => actual[key] === value);
}

async function runDesktopChecks(page, expected, emptyCombo) {
  const failures = [];
  const overview = await snapshot(page);
  assertCondition(failures, overview.activeView === "overview" && overview.visiblePanels.join(",") === "overview", "overview is the only default task view", overview);
  assertCondition(failures, overview.taskTabCount === 3, "three semantic task tabs render", overview.taskTabCount);
  assertCondition(failures, overview.lineCount === Math.min(5, expected.subjectLineCount), "overview limits the default trend to five lines", overview.lineCount);
  assertCondition(failures, overview.violinCount === 0, "overview omits distribution overlays by default", overview.violinCount);
  assertCondition(failures, overview.performanceGrowthPoints > 0 && overview.performanceGrowthGuide.includes("Descriptive, not causal"), "overview renders a bounded performance-growth synthesis", overview);
  assertCondition(failures, overview.performanceGrowthLabels >= 2 && overview.performanceGrowthLabels <= 4, "synthesis renders only the disclosed boundary labels", overview.performanceGrowthLabels);
  assertCondition(failures, ["lowest-latest-mean", "highest-latest-mean", "weakest-observed-growth", "strongest-observed-growth"].every((reason) => overview.performanceGrowthReviewReasons.includes(reason)), "synthesis labels cover the four disclosed boundary rules", overview.performanceGrowthReviewReasons);
  assertCondition(failures, overview.performanceGrowthCaption.includes("meet n >= 10 in the latest window and at least one complete BOY/EOY pair") && overview.performanceGrowthCaption.includes("every eligible subject is shown"), "synthesis caption explains eligibility and complete inclusion", overview.performanceGrowthCaption);
  assertCondition(failures, overview.performanceGrowthGuide.includes("Right is a higher latest mean") && overview.performanceGrowthGuide.includes("Lowest and highest latest mean") && overview.performanceGrowthGuide.includes("weakest and strongest observed growth"), "synthesis guide explains position, size, and label selection", overview.performanceGrowthGuide);
  assertCondition(failures, overview.performanceGrowthBenchmarkLines === 0, "cross-course synthesis omits the inapplicable single program benchmark", overview.performanceGrowthBenchmarkLines);
  assertCondition(failures, overview.decisionSignalCount === 3, "overview contains three decision signals", overview.decisionSignalCount);
  assertCondition(failures, cardsMatch(overview.cards, expected.cards), "overview metrics match source JSON", { actual: overview.cards, expected: expected.cards });
  assertCondition(failures, overview.trendStart === expected.defaultTrendStartId && overview.trendEnd === expected.latestPeriodId && overview.trendWindowCount === 10 && overview.trendYearLabelCount === 5, "trend defaults to the latest five paired academic years", overview);
  assertCondition(failures, overview.timeCaption.includes("5 academic years (10 assessment windows)"), "trend caption names the academic-year interval", overview.timeCaption);
  assertCondition(failures, overview.trendStartOptions === expected.periodCount, "trend start exposes every assessment window", overview.trendStartOptions);
  assertCondition(failures, JSON.stringify(overview.trendEndOptionIds) === JSON.stringify(expected.defaultTrendEndOptionIds), "trend end exposes only windows at or after the selected start", overview.trendEndOptionIds);
  assertCondition(failures, !/\b(?:assignment|task)\b/i.test(overview.timeChartText), "trend does not expose generic task labels", overview.timeChartText);
  assertCondition(failures, overview.benchmarkCourseOptions === expected.benchmarkCourseCount, "course benchmark selector covers every course", overview.benchmarkCourseOptions);
  assertCondition(failures, overview.benchmarkChecked && !overview.benchmarkCourseDisabled && overview.benchmarkLineCount === 1, "course benchmark is visible by default", overview);
  assertCondition(failures, overview.benchmarkLegend.includes(overview.benchmarkCourse) && overview.benchmarkLegend.includes("%"), "benchmark legend names the selected course and cut score", overview.benchmarkLegend);

  await page.locator("#toggle-mastery-line").uncheck();
  await page.waitForTimeout(100);
  const benchmarkOff = await snapshot(page);
  assertCondition(failures, benchmarkOff.benchmarkLineCount === 0 && benchmarkOff.benchmarkCourseDisabled, "benchmark toggle removes the line and disables its course selector", benchmarkOff);
  await page.locator("#toggle-mastery-line").check();
  await setSelect(page, "#trend-benchmark-course", expected.benchmarkTestCourse);
  const benchmarkCourse = await snapshot(page);
  assertCondition(failures, benchmarkCourse.benchmarkLineCount === 1 && benchmarkCourse.benchmarkLegend.includes(expected.benchmarkTestCourse) && benchmarkCourse.benchmarkLegend.includes(`${expected.benchmarkTestValue}%`), "benchmark selector renders the chosen course threshold", benchmarkCourse);

  await setSelect(page, "#trend-start-select", expected.arbitraryTrendStartId);
  await setSelect(page, "#trend-end-select", expected.arbitraryTrendEndId);
  const arbitraryRange = await snapshot(page);
  assertCondition(failures, arbitraryRange.trendWindowCount === expected.arbitraryTrendWindowCount && arbitraryRange.trendYearLabelCount === expected.arbitraryTrendYearCount, "trend accepts an arbitrary partial-year interval", arbitraryRange);
  assertCondition(failures, JSON.stringify(arbitraryRange.trendEndOptionIds) === JSON.stringify(expected.arbitraryTrendEndOptionIds), "changing the trend start rebuilds the valid end-window subset", arbitraryRange.trendEndOptionIds);
  await setSelect(page, "#trend-start-select", expected.firstPeriodId);
  await setSelect(page, "#trend-end-select", expected.latestPeriodId);
  const allYears = await snapshot(page);
  assertCondition(failures, allYears.trendWindowCount === expected.academicYearCount * 2 && allYears.trendYearLabelCount === expected.academicYearCount && allYears.timeCaption.includes(`${expected.academicYearCount} academic years`), "trend can expand to the full academic-year history", allYears);
  await setSelect(page, "#trend-end-select", expected.firstPeriodId);
  await setSelect(page, "#trend-start-select", expected.latestPeriodId);
  const crossedRange = await snapshot(page);
  assertCondition(failures, crossedRange.trendStart === expected.latestPeriodId && crossedRange.trendEnd === expected.latestPeriodId && crossedRange.trendWindowCount === 1 && crossedRange.trendEndOptions === 1, "crossed boundaries collapse to the newly selected assessment window and its one valid end option", crossedRange);

  await selectDashboardView(page, "compare");
  const compareView = await snapshot(page);
  assertCondition(failures, compareView.activeView === "compare" && compareView.visiblePanels.join(",") === "compare", "compare tab reveals only comparison workspace", compareView);
  await selectDashboardView(page, "quality");
  const qualityView = await snapshot(page);
  assertCondition(failures, qualityView.activeView === "quality" && qualityView.visiblePanels.join(",") === "quality", "quality tab reveals only quality workspace", qualityView);

  await resetDashboard(page);

  const base = await snapshot(page);
  assertCondition(failures, !base.dashboardError, "dashboard loads", base);
  assertCondition(failures, !base.badTextValue && !base.badSvgValue, "no invalid text/svg values", base);
  assertCondition(failures, base.assetVersion === expected.assetVersion, "asset version matches HTML", base);
  assertCondition(failures, base.cssHref.includes(`?v=${expected.assetVersion}`), "CSS cache key matches asset version", base.cssHref);
  assertCondition(failures, base.dashboardScriptSrc.includes(`?v=${expected.assetVersion}`), "dashboard JS cache key matches asset version", base.dashboardScriptSrc);
  assertCondition(failures, base.oldControls.groupSelects === 0 && base.oldControls.presetRows === 0 && base.oldControls.sliceMenus === 0, "old controls absent", base.oldControls);
  assertCondition(failures, base.compareRadios.length === 3 && base.compareRadios.find((item) => item.value === "course")?.checked, "compare radios default to subject", base.compareRadios);
  assertCondition(failures, !base.metricOptions.includes("growth"), "growth baseline metric option removed", base.metricOptions);
  assertCondition(failures, base.summary.includes("Comparing all subjects") && base.summary.includes("filters: all teachers, all sections"), "default comparison summary is simplified", base.summary);
  assertCondition(failures, !base.legacyGrowthCopy, "old growth copy absent", base);
  assertCondition(failures, cardsMatch(base.cards, expected.cards), "metrics remain stable in compare view", { actual: base.cards, expected: expected.cards });
  assertCondition(failures, base.movementCaption.includes("average End-minus-Beginning delta"), "movement caption uses BOY/EOY language", base.movementCaption);
  assertCondition(failures, base.lineCount === expected.subjectLineCount, "default subject line count matches source JSON", base);
  assertCondition(failures, base.lineLabels.length > 0 && base.lineLabels.every((label) => label.includes("x\u0304\u03b4")), "line labels show visible average delta notation", base.lineLabels);
  assertCondition(failures, base.tableRows === expected.tableRows, "default table rows match source JSON", base);
  assertCondition(failures, base.violinCount === expected.subjectViolinCount, "default violin count matches source JSON", base);
  assertCondition(failures, base.violinTitles.every((title) => title.includes("subject score distribution")), "default violins are subject distributions", base.violinTitles);

  const selectedTeachers = await checkFirstN(page, "#teacher-filter-options input[type='checkbox']", 2);
  const teacher = await snapshot(page);
  assertCondition(failures, teacher.compareRadios.find((item) => item.value === "teacher")?.checked, "teacher checkbox auto-switches comparison mode", teacher.compareRadios);
  assertCondition(failures, teacher.summary.includes(`Comparing ${selectedTeachers} teachers`), "teacher selection summary", teacher.summary);
  assertCondition(failures, teacher.lineCount === selectedTeachers, "teacher selected line count", teacher);
  assertCondition(failures, teacher.violinTitles.length > 0 && teacher.violinTitles.every((title) => title.includes("teacher score distribution")), "teacher violins are teacher distributions", teacher.violinTitles);

  await resetDashboard(page);
  const selectedSubjects = await checkFirstN(page, "#course-filter-options input[type='checkbox']", 2);
  const subject = await snapshot(page);
  assertCondition(failures, subject.compareRadios.find((item) => item.value === "course")?.checked, "subject checkbox keeps subject comparison mode", subject.compareRadios);
  assertCondition(failures, subject.summary.includes(`Comparing ${selectedSubjects} subjects`), "subject selection summary", subject.summary);
  assertCondition(failures, subject.lineCount === selectedSubjects, "subject selected line count", subject);
  assertCondition(failures, subject.violinTitles.length > 0 && subject.violinTitles.every((title) => title.includes("subject score distribution")), "subject violins are subject distributions", subject.violinTitles);

  await resetDashboard(page);
  const selectedSections = await checkFirstN(page, "#section-filter-options input[type='checkbox']", 2);
  const section = await snapshot(page);
  assertCondition(failures, section.compareRadios.find((item) => item.value === "section")?.checked, "section checkbox auto-switches comparison mode", section.compareRadios);
  assertCondition(failures, section.summary.includes(`Comparing ${selectedSections} sections`), "section selection summary", section.summary);
  assertCondition(failures, section.lineCount === selectedSections, "section selected line count", section);
  assertCondition(failures, section.violinTitles.length > 0 && section.violinTitles.every((title) => title.includes("section score distribution")), "section violins are section distributions", section.violinTitles);

  await resetDashboard(page);
  await page.locator("#course-filter-options input[type='checkbox']").first().check();
  await page.locator("input[name='compare-by'][value='teacher']").check();
  await page.waitForTimeout(160);
  const crossFiltered = await snapshot(page);
  assertCondition(failures, crossFiltered.summary.includes("1 subject") && crossFiltered.summary.includes("Comparing all teachers"), "non-active subject filter summary", crossFiltered.summary);
  assertCondition(failures, crossFiltered.lineCount > 0 && crossFiltered.lineCount <= 5, "non-active filter constrains teacher comparisons", crossFiltered);

  for (const compareBy of ["course", "teacher", "section"]) {
    await resetDashboard(page);
    await page.locator(`input[name='compare-by'][value='${compareBy}']`).check();
    for (const metric of ["score", "proficiency", "completion"]) {
      await setSelect(page, "#metric-select", metric);
      const state = await snapshot(page);
      assertCondition(failures, !state.dashboardError && !state.badTextValue && !state.badSvgValue, `${compareBy}/${metric} renders cleanly`, state);
      if (metric === "completion") {
        assertCondition(failures, state.violinCount === 0, `${compareBy}/completion has no violins`, state);
      }
    }
  }

  await resetDashboard(page);
  await setSelect(page, "#season-select", "Beginning");
  const beginning = await snapshot(page);
  assertCondition(failures, beginning.timeCaption.includes("7 academic years (7 assessment windows)"), "Beginning season limits to one BOY window per academic year", beginning.timeCaption);
  assertCondition(failures, beginning.cards.change === "-" && beginning.movementCaption.includes("No complete BOY/EOY pairs"), "Beginning-only window shows no BOY/EOY delta", beginning);
  await setSelect(page, "#season-select", "End");
  const ending = await snapshot(page);
  assertCondition(failures, ending.timeCaption.includes("7 academic years (7 assessment windows)"), "End season limits to one EOY window per academic year", ending.timeCaption);
  assertCondition(failures, ending.cards.change === "-" && ending.movementCaption.includes("No complete BOY/EOY pairs"), "End-only window shows no BOY/EOY delta", ending);

  await page.locator("#section-filter-search").fill("01-01");
  await page.waitForTimeout(160);
  const sectionSearchCount = await page.locator("#section-filter-options input[type='checkbox']").count();
  assertCondition(failures, sectionSearchCount > 0 && sectionSearchCount < 174, "section search filters checkbox list", sectionSearchCount);

  await selectDashboardView(page, "quality");
  await setSelect(page, "#table-completion-filter", "95");
  const tableFiltered = await snapshot(page);
  assertCondition(failures, tableFiltered.tableRows >= 0, "table completion filter renders", tableFiltered.tableCount);
  await page.locator("button[data-sort='students']").click();
  await page.locator("button[data-sort='students']").click();
  const tableSorted = await snapshot(page);
  assertCondition(failures, tableSorted.tableRows >= 0, "table sort toggles render", tableSorted.tableCount);

  if (emptyCombo) {
    await resetDashboard(page);
    await page.locator("input[name='compare-by'][value='teacher']").check();
    await checkValue(page, "#course-filter-options", emptyCombo.course);
    await checkValue(page, "#teacher-filter-options", emptyCombo.teacher);
    const empty = await snapshot(page);
    assertCondition(failures, empty.lineCount === 0 && empty.violinCount === 0, "empty subject/teacher intersection renders no lines or violins", empty);
    assertCondition(failures, empty.emptyChartText.length > 0, "empty subject/teacher intersection shows empty states", empty.emptyChartText);
  }

  return {
    failures,
    summary: {
      defaultLineCount: base.lineCount,
      defaultViolinCount: base.violinCount,
      defaultTableRows: base.tableRows,
      teacherLineCount: teacher.lineCount,
      subjectLineCount: subject.lineCount,
      sectionLineCount: section.lineCount,
    },
  };
}

async function runMobileChecks(page) {
  const failures = [];
  const views = {};
  for (const view of ["overview", "compare", "quality"]) {
    await selectDashboardView(page, view);
    views[view] = await snapshot(page);
    assertCondition(failures, views[view].activeView === view && views[view].visiblePanels.join(",") === view, `mobile ${view} view is isolated`, views[view]);
    assertCondition(failures, views[view].mobileOverflow.length === 0, `mobile ${view} has no non-chart horizontal overflow`, views[view].mobileOverflow);
  }
  assertCondition(failures, !views.overview.dashboardError, "mobile dashboard loads", views.overview);
  assertCondition(failures, views.compare.compareRadios.length === 3, "mobile compare radios present", views.compare.compareRadios);
  assertCondition(failures, views.overview.performanceGrowthPoints > 0, "mobile synthesis chart renders", views.overview.performanceGrowthPoints);
  return { failures, summary: { overflowCount: Math.max(...Object.values(views).map((view) => view.mobileOverflow.length)) } };
}

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const expected = sourceExpectations(source);
const emptyCombo = findEmptyCourseTeacherCombo(source);
const { chromium } = await loadPlaywright();
const server = staticServer();
const baseUrl = await listen(server);
const browser = await chromium.launch({ headless: true });
const consoleMessages = [];

try {
  const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  desktopPage.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleMessages.push({ type: message.type(), text: message.text() });
  });
  desktopPage.on("pageerror", (error) => consoleMessages.push({ type: "pageerror", text: error.stack || error.message }));
  await desktopPage.goto(`${baseUrl}/${dashboardPath}`, { waitUntil: "networkidle" });
  await desktopPage.locator("#time-chart svg").waitFor({ state: "visible", timeout: 8000 });
  const desktop = await runDesktopChecks(desktopPage, expected, emptyCombo);
  await desktopPage.close();

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 900 } });
  mobilePage.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleMessages.push({ type: message.type(), text: message.text() });
  });
  mobilePage.on("pageerror", (error) => consoleMessages.push({ type: "pageerror", text: error.stack || error.message }));
  await mobilePage.goto(`${baseUrl}/${dashboardPath}`, { waitUntil: "networkidle" });
  await mobilePage.locator("#time-chart svg").waitFor({ state: "visible", timeout: 8000 });
  const mobile = await runMobileChecks(mobilePage);
  await mobilePage.close();

  const failures = [...desktop.failures, ...mobile.failures];
  if (consoleMessages.length) {
    failures.push({ label: "console/page errors", details: consoleMessages });
  }

  const result = {
    status: failures.length ? "failed" : "passed",
    expected,
    emptyCombo,
    desktop: desktop.summary,
    mobile: mobile.summary,
    failures,
  };

  if (failures.length) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
} finally {
  await browser.close();
  await closeServer(server);
}
