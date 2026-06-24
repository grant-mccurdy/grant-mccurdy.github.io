#!/usr/bin/env node
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve(path.join(import.meta.dirname, ".."));
const requireFromHere = createRequire(import.meta.url);
const dashboardPath = path.join("dashboard", "assessment.html");
const sourcePath = path.join(root, "data", "synthetic", "assessment-dashboard.json");
const auditId = new Date().toISOString().replaceAll(":", "").replace(/\.\d+Z$/, "Z");
const outputDir = path.join(root, "tmp", "dashboard-audit", auditId);
const screenshotDir = path.join(outputDir, "screenshots");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
};

fs.mkdirSync(screenshotDir, { recursive: true });

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
          // Continue through configured module locations.
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
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, "index.html");
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
  if (!address || typeof address === "string") throw new Error("Could not start dashboard audit server");
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

function unique(items) {
  return [...new Set(items)].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}

function findEmptyCourseTeacherCombo(source) {
  const courses = unique(source.sections.map((section) => section.course));
  const teachers = unique(source.sections.map((section) => section.teacher));
  for (const course of courses) {
    for (const teacher of teachers) {
      if (!source.sections.some((section) => section.course === course && section.teacher === teacher)) {
        return { course, teacher };
      }
    }
  }
  return null;
}

async function setValue(page, selector, value, eventName = "change") {
  await page.evaluate(({ selector, value, eventName }) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing control ${selector}`);
    element.value = value;
    element.dispatchEvent(new Event(eventName, { bubbles: true }));
  }, { selector, value, eventName });
  await page.waitForTimeout(80);
}

async function setChecked(page, selector, checked) {
  await page.evaluate(({ selector, checked }) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing checkbox ${selector}`);
    element.checked = checked;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, { selector, checked });
  await page.waitForTimeout(80);
}

async function checkValue(page, containerSelector, value) {
  await page.evaluate(({ containerSelector, value }) => {
    const input = [...document.querySelectorAll(`${containerSelector} input[type="checkbox"]`)]
      .find((item) => item.value === value);
    if (!input) throw new Error(`Missing checkbox value ${value} in ${containerSelector}`);
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { containerSelector, value });
  await page.waitForTimeout(120);
}

async function checkFirstN(page, selector, count) {
  const optionCount = await page.locator(selector).count();
  const selected = Math.min(count, optionCount);
  for (let index = 0; index < selected; index += 1) {
    await page.locator(selector).nth(index).check();
  }
  await page.waitForTimeout(150);
  return selected;
}

async function openDetails(page, selector, open) {
  await page.evaluate(({ selector, open }) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing details ${selector}`);
    element.open = open;
  }, { selector, open });
  await page.waitForTimeout(80);
}

async function resetDashboard(page) {
  await page.locator("#slice-filter-clear").click();
  await page.locator("#table-reset").click();
  await page.locator("input[name='compare-by'][value='course']").check();
  await setValue(page, "#metric-select", "score");
  await setValue(page, "#season-select", "All");
  await setValue(page, "#line-sort-select", "latest");
  await setValue(page, "#line-filter", "", "input");
  await setValue(page, "#line-limit-select", "10");
  await setValue(page, "#line-min-n", "5", "input");
  await setValue(page, "#ribbon-range-select", "50");
  await setValue(page, "#center-select", "mean");
  await setValue(page, "#ribbon-population-select", "completed");
  await setValue(page, "#ribbon-opacity", "0.16", "input");
  await setChecked(page, "#toggle-department-band", true);
  await setChecked(page, "#toggle-network-band", false);
  await setChecked(page, "#toggle-mastery-line", true);
  await setChecked(page, "#toggle-violin-plots", true);
  await setChecked(page, "#toggle-section-lines", false);
  await setChecked(page, "#toggle-smooth-curves", true);
  await openDetails(page, ".dashboard-source-strip", false);
  await openDetails(page, ".advanced-dashboard-controls", false);
  await page.waitForTimeout(120);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const bodyText = document.body.innerText;
    const svgText = [...document.querySelectorAll("svg")].map((svg) => svg.outerHTML).join("\n");
    const activeCompare = document.querySelector("input[name='compare-by']:checked")?.value ?? "";
    const metric = document.querySelector("#metric-select")?.value ?? "";
    const currentSliceLabel = { course: "subject", teacher: "teacher", section: "section" }[activeCompare] ?? activeCompare;
    const visibleOverflow = [...document.querySelectorAll("body *")]
      .filter((element) => {
        if (element.closest(".chart-frame, .table-wrap")) return false;
        const rect = element.getBoundingClientRect();
        return rect.width && rect.height && (rect.right > document.documentElement.clientWidth + 2 || rect.left < -2);
      })
      .slice(0, 12)
      .map((element) => ({
        tag: element.tagName,
        className: String(element.className),
        text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 90),
      }));
    const clippedControls = [...document.querySelectorAll("button, label, summary, .metric-card, .slice-check-option")]
      .filter((element) => !element.closest(".chart-frame, .table-wrap") && element.scrollWidth > element.clientWidth + 2)
      .slice(0, 12)
      .map((element) => ({
        tag: element.tagName,
        className: String(element.className),
        text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 90),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }));
    const distributionAxisTitle = [...document.querySelectorAll("#distribution-chart .axis-title")]
      .map((node) => node.textContent.trim()).join(" ");

    return {
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      compact: innerWidth <= 700,
      dashboardError: bodyText.includes("Dashboard data did not load"),
      invalidText: /NaN|undefined|Infinity/.test(bodyText),
      invalidSvg: /NaN|undefined|Infinity/.test(svgText),
      legacyGrowthCopy: /Growth From Baseline|Growth Ranking|first selected period|score change from Assignment 01/.test(bodyText),
      activeCompare,
      metric,
      season: document.querySelector("#season-select")?.value ?? "",
      summary: document.querySelector("#slice-filter-summary")?.textContent.trim() ?? "",
      cards: {
        latestLabel: [...document.querySelectorAll(".metric-card span")].find((node) => node.textContent.includes("Latest"))?.textContent.trim() ?? "",
        latest: document.querySelector("#metric-latest")?.textContent.trim() ?? "",
        delta: document.querySelector("#metric-change")?.textContent.trim() ?? "",
      },
      sourceOpen: document.querySelector(".dashboard-source-strip")?.open ?? false,
      advancedOpen: document.querySelector(".advanced-dashboard-controls")?.open ?? false,
      toggles: {
        department: document.querySelector("#toggle-department-band")?.checked ?? false,
        network: document.querySelector("#toggle-network-band")?.checked ?? false,
        mastery: document.querySelector("#toggle-mastery-line")?.checked ?? false,
        violins: document.querySelector("#toggle-violin-plots")?.checked ?? false,
        sections: document.querySelector("#toggle-section-lines")?.checked ?? false,
        smooth: document.querySelector("#toggle-smooth-curves")?.checked ?? false,
      },
      checkedCounts: {
        courses: document.querySelectorAll("#course-filter-options input:checked").length,
        teachers: document.querySelectorAll("#teacher-filter-options input:checked").length,
        sections: document.querySelectorAll("#section-filter-options input:checked").length,
      },
      captions: {
        time: document.querySelector("#time-caption")?.textContent.trim() ?? "",
        distribution: document.querySelector("#distribution-caption")?.textContent.trim() ?? "",
        movement: document.querySelector("#growth-caption")?.textContent.trim() ?? "",
        latest: document.querySelector("#bar-caption")?.textContent.trim() ?? "",
      },
      chartCounts: {
        lines: document.querySelectorAll(".comparison-series-line").length,
        violins: document.querySelectorAll(".violin-plot").length,
        sectionLines: document.querySelectorAll(".section-shadow-line").length,
        emptyStates: document.querySelectorAll(".empty-chart-text").length,
        movementBars: document.querySelectorAll("#growth-chart .chart-bar").length,
      },
      rightLabels: [...document.querySelectorAll(".right-label-text")].map((node) => node.textContent.trim()).slice(0, 12),
      violinTitles: [...document.querySelectorAll(".violin-plot title")].map((node) => node.textContent.trim()).slice(0, 12),
      distributionAxisTitle,
      currentSliceLabel,
      tableRows: document.querySelectorAll("#course-table tr").length,
      tableCount: document.querySelector("#table-count")?.textContent.trim() ?? "",
      visibleOverflow,
      clippedControls,
    };
  });
}

function evaluateScenario(scenario, snap, messages) {
  const issues = [];
  const add = (message, details = null) => issues.push({ message, details });
  if (snap.dashboardError) add("Dashboard failed to load");
  if (snap.invalidText || snap.invalidSvg) add("Rendered invalid numeric/text value", { invalidText: snap.invalidText, invalidSvg: snap.invalidSvg });
  if (snap.legacyGrowthCopy) add("Legacy first-to-last growth wording is still visible");
  if (snap.visibleOverflow.length) add("Non-chart horizontal overflow", snap.visibleOverflow);
  if (snap.clippedControls.length) add("Potential clipped control text", snap.clippedControls);
  if (messages.length) add("Console or page errors", messages);
  if (!snap.summary.startsWith("Comparing ")) add("Comparison summary does not use simplified wording", snap.summary);
  if (scenario.expectCompare && snap.activeCompare !== scenario.expectCompare) {
    add("Active comparison mode mismatch", { expected: scenario.expectCompare, actual: snap.activeCompare });
  }
  if (scenario.expectCheckedCount) {
    for (const [key, expected] of Object.entries(scenario.expectCheckedCount)) {
      if (snap.checkedCounts[key] !== expected) {
        add("Checked filter count mismatch", { key, expected, actual: snap.checkedCounts[key] });
      }
    }
  }
  if (scenario.expectNoPairs && (snap.cards.delta !== "-" || !snap.captions.movement.includes("No complete BOY/EOY pairs"))) {
    add("No-pair window should suppress BOY/EOY delta", { delta: snap.cards.delta, movement: snap.captions.movement });
  }
  if (scenario.expectLines !== undefined && snap.chartCounts.lines !== scenario.expectLines) {
    add("Line count mismatch", { expected: scenario.expectLines, actual: snap.chartCounts.lines });
  }
  if (scenario.expectEmpty && snap.chartCounts.emptyStates === 0) add("Expected empty chart state was not visible");
  if (!snap.compact && snap.metric === "score" && snap.toggles.violins && snap.chartCounts.lines > 0 && !scenario.expectEmpty && snap.chartCounts.violins === 0) {
    add("Score metric with violin toggle produced no violin plots");
  }
  if ((snap.metric !== "score" || !snap.toggles.violins) && snap.chartCounts.violins !== 0) {
    add("Violin plots rendered when they should be unavailable", { metric: snap.metric, toggles: snap.toggles, violins: snap.chartCounts.violins });
  }
  if (snap.chartCounts.violins && snap.violinTitles.some((title) => !title.includes(`${snap.currentSliceLabel} score distribution`))) {
    add("Violin titles do not match active comparison group", snap.violinTitles);
  }
  if (snap.metric !== "score" && (/Proficiency|Completion/.test(snap.captions.distribution) || /Proficiency|Completion/.test(snap.distributionAxisTitle))) {
    add("Distribution detail is score-based but uses selected metric copy", {
      metric: snap.metric,
      caption: snap.captions.distribution,
      axisTitle: snap.distributionAxisTitle,
    });
  }
  if (snap.metric !== "score" && /Score/i.test(snap.cards.latestLabel)) {
    add("Latest metric card uses score-specific label for non-score metric", snap.cards.latestLabel);
  }
  if (snap.rightLabels.some((label) => /\([+-]?\d+(\.\d+)?\)$/.test(label))) {
    add("Right-side line label is missing point units", snap.rightLabels);
  }
  return issues;
}

async function runScenario(page, viewportName, scenario, results, pageMessages) {
  await resetDashboard(page);
  await scenario.run(page);
  await page.waitForTimeout(180);
  if (scenario.scrollTo) await page.locator(scenario.scrollTo).scrollIntoViewIfNeeded();
  const snap = await snapshot(page);
  const relativeScreenshot = path.join("screenshots", `${slug(`${viewportName}-${scenario.name}`)}.png`);
  const absoluteScreenshot = path.join(outputDir, relativeScreenshot);
  await page.screenshot({ path: absoluteScreenshot, fullPage: false });
  const messages = pageMessages.splice(0, pageMessages.length);
  const issues = evaluateScenario(scenario, snap, messages);
  results.push({
    viewport: viewportName,
    scenario: scenario.name,
    screenshot: relativeScreenshot,
    state: snap,
    issues,
  });
}

function displayToggleScenarios() {
  const toggleKeys = [
    ["department", "#toggle-department-band"],
    ["network", "#toggle-network-band"],
    ["mastery", "#toggle-mastery-line"],
    ["violins", "#toggle-violin-plots"],
    ["sections", "#toggle-section-lines"],
  ];
  return Array.from({ length: 2 ** toggleKeys.length }, (_, mask) => ({
    name: `display toggles ${toggleKeys.map(([key], index) => `${key}-${Boolean(mask & (1 << index)) ? "on" : "off"}`).join(" ")}`,
    scrollTo: ".advanced-dashboard-controls",
    run: async (page) => {
      await openDetails(page, ".advanced-dashboard-controls", true);
      for (const [key, selector] of toggleKeys) {
        const index = toggleKeys.findIndex(([itemKey]) => itemKey === key);
        await setChecked(page, selector, Boolean(mask & (1 << index)));
      }
    },
  }));
}

function baseScenarios(source) {
  const emptyCombo = findEmptyCourseTeacherCombo(source);
  return [
    { name: "default collapsed", run: async () => {} },
    { name: "source details open", run: async (page) => openDetails(page, ".dashboard-source-strip", true) },
    { name: "advanced controls open", scrollTo: ".advanced-dashboard-controls", run: async (page) => openDetails(page, ".advanced-dashboard-controls", true) },
    { name: "compare teacher radio", expectCompare: "teacher", run: async (page) => page.locator("input[name='compare-by'][value='teacher']").check() },
    { name: "compare section radio", expectCompare: "section", run: async (page) => page.locator("input[name='compare-by'][value='section']").check() },
    {
      name: "teacher checkbox auto comparison",
      expectCompare: "teacher",
      expectCheckedCount: { teachers: 2 },
      expectLines: 2,
      run: async (page) => checkFirstN(page, "#teacher-filter-options input[type='checkbox']", 2),
    },
    {
      name: "subject checkbox comparison",
      expectCompare: "course",
      expectCheckedCount: { courses: 2 },
      expectLines: 2,
      run: async (page) => checkFirstN(page, "#course-filter-options input[type='checkbox']", 2),
    },
    {
      name: "section checkbox auto comparison",
      expectCompare: "section",
      expectCheckedCount: { sections: 2 },
      expectLines: 2,
      run: async (page) => checkFirstN(page, "#section-filter-options input[type='checkbox']", 2),
    },
    {
      name: "mixed inactive subject filter with teacher comparison",
      expectCompare: "teacher",
      run: async (page) => {
        await page.locator("#course-filter-options input[type='checkbox']").first().check();
        await page.locator("input[name='compare-by'][value='teacher']").check();
      },
    },
    {
      name: "empty subject teacher intersection",
      expectCompare: "teacher",
      expectEmpty: true,
      expectLines: 0,
      run: async (page) => {
        if (!emptyCombo) return;
        await checkValue(page, "#course-filter-options", emptyCombo.course);
        await checkValue(page, "#teacher-filter-options", emptyCombo.teacher);
      },
    },
    {
      name: "section search select visible",
      expectCompare: "section",
      run: async (page) => {
        await setValue(page, "#section-filter-search", "01-01", "input");
        await page.locator("#section-filter-select-visible").click();
      },
    },
    {
      name: "section clear after select visible",
      expectCompare: "section",
      expectCheckedCount: { sections: 0 },
      run: async (page) => {
        await setValue(page, "#section-filter-search", "01-01", "input");
        await page.locator("#section-filter-select-visible").click();
        await page.locator("#section-filter-clear").click();
      },
    },
    ...["score", "proficiency", "completion"].map((metric) => ({
      name: `metric ${metric}`,
      run: async (page) => setValue(page, "#metric-select", metric),
    })),
    ...["Beginning", "End"].map((season) => ({
      name: `window ${season}`,
      expectNoPairs: true,
      run: async (page) => setValue(page, "#season-select", season),
    })),
    ...["gain", "decline", "name"].map((sort) => ({
      name: `sort ${sort}`,
      run: async (page) => setValue(page, "#line-sort-select", sort),
    })),
    ...["5", "8", "12", "all"].map((limit) => ({
      name: `line limit ${limit}`,
      run: async (page) => setValue(page, "#line-limit-select", limit),
    })),
    ...["1", "20", "35"].map((minN) => ({
      name: `minimum n ${minN}`,
      run: async (page) => setValue(page, "#line-min-n", minN, "input"),
    })),
    ...["60", "80"].map((range) => ({
      name: `ribbon range ${range}`,
      run: async (page) => setValue(page, "#ribbon-range-select", range),
    })),
    { name: "center median", run: async (page) => setValue(page, "#center-select", "median") },
    { name: "population assigned", run: async (page) => setValue(page, "#ribbon-population-select", "assigned") },
    { name: "ribbon opacity low", run: async (page) => setValue(page, "#ribbon-opacity", "0.08", "input") },
    { name: "ribbon opacity high", run: async (page) => setValue(page, "#ribbon-opacity", "0.42", "input") },
    { name: "smooth curves off", run: async (page) => setChecked(page, "#toggle-smooth-curves", false) },
    ...["#table-course-filter", "#table-grade-filter", "#table-teacher-filter"].map((selector) => ({
      name: `table filter ${selector.replace("#table-", "").replace("-filter", "")}`,
      scrollTo: ".table-control-row",
      run: async (page) => {
        const value = await page.locator(`${selector} option`).nth(1).getAttribute("value");
        await setValue(page, selector, value);
      },
    })),
    {
      name: "table completion filter",
      scrollTo: ".table-control-row",
      run: async (page) => setValue(page, "#table-completion-filter", "95"),
    },
    ...["course", "grade", "teacher", "section", "students", "first", "latest", "change", "completion"].flatMap((key) => [
      {
        name: `table sort ${key} ascending`,
        scrollTo: ".table-control-row",
        run: async (page) => page.locator(`button[data-sort='${key}']`).click(),
      },
      {
        name: `table sort ${key} descending`,
        scrollTo: ".table-control-row",
        run: async (page) => {
          await page.locator(`button[data-sort='${key}']`).click();
          await page.locator(`button[data-sort='${key}']`).click();
        },
      },
    ]),
  ];
}

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const { chromium } = await loadPlaywright();
const server = staticServer();
const baseUrl = await listen(server);
const browser = await chromium.launch({ headless: true });
const viewports = [
  ["desktop", { width: 1440, height: 1200 }],
  ["tablet", { width: 900, height: 1100 }],
  ["mobile", { width: 390, height: 1000 }],
];
const results = [];

try {
  for (const [viewportName, viewport] of viewports) {
    const pageMessages = [];
    const page = await browser.newPage({ viewport });
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) pageMessages.push({ type: message.type(), text: message.text() });
    });
    page.on("pageerror", (error) => pageMessages.push({ type: "pageerror", text: error.stack || error.message }));
    await page.goto(`${baseUrl}/${dashboardPath}`, { waitUntil: "networkidle" });
    await page.locator("#time-chart svg").waitFor({ state: "visible", timeout: 8000 });
    const scenarios = viewportName === "desktop"
      ? [...baseScenarios(source), ...displayToggleScenarios()]
      : baseScenarios(source);
    for (const scenario of scenarios) {
      await runScenario(page, viewportName, scenario, results, pageMessages);
    }
    await page.close();
  }
} finally {
  await browser.close();
  await closeServer(server);
}

const issueResults = results.filter((result) => result.issues.length);
const report = {
  status: issueResults.length ? "failed" : "passed",
  auditId,
  outputDir,
  scenarioCount: results.length,
  screenshotCount: results.length,
  issueCount: issueResults.reduce((sum, result) => sum + result.issues.length, 0),
  issueResults,
  results,
};

const markdown = [
  `# Dashboard Toggle Audit ${auditId}`,
  "",
  `Status: ${report.status}`,
  `Scenarios: ${report.scenarioCount}`,
  `Screenshots: ${report.screenshotCount}`,
  `Issues: ${report.issueCount}`,
  "",
  "## Issues",
  issueResults.length
    ? issueResults.map((result) => [
      `### ${result.viewport} / ${result.scenario}`,
      `Screenshot: ${result.screenshot}`,
      ...result.issues.map((issue) => `- ${issue.message}${issue.details ? `: \`${JSON.stringify(issue.details).slice(0, 600)}\`` : ""}`),
    ].join("\n")).join("\n\n")
    : "No issues detected.",
  "",
].join("\n");

fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outputDir, "report.md"), markdown);

console.log(JSON.stringify({
  status: report.status,
  outputDir,
  scenarioCount: report.scenarioCount,
  screenshotCount: report.screenshotCount,
  issueCount: report.issueCount,
  issueResults: issueResults.map((result) => ({
    viewport: result.viewport,
    scenario: result.scenario,
    screenshot: result.screenshot,
    issues: result.issues,
  })),
}, null, 2));

if (issueResults.length) process.exitCode = 1;
