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

function fmtPts(value) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded} pts`;
}

function weightedAverage(rows, key) {
  const students = rows.reduce((sum, row) => sum + (Number(row.students) || 0), 0);
  if (!students) return 0;
  return rows.reduce((sum, row) => sum + row[key] * row.students, 0) / students;
}

function sourceExpectations(source) {
  const { periods, records, studentRecords } = source;
  const firstPeriod = periods[0];
  const latestPeriod = periods[periods.length - 1];
  const firstRows = records.filter((row) => row.periodId === firstPeriod.id);
  const latestRows = records.filter((row) => row.periodId === latestPeriod.id);
  const latestScore = weightedAverage(latestRows, "score");
  const firstScore = weightedAverage(firstRows, "score");
  const completed = latestRows.reduce((sum, row) => sum + (Number(row.completed) || 0), 0);
  const targetScore = source.bands.mastery.line[latestPeriod.order - 1];
  const targetCompleted = latestRows
    .filter((row) => row.score >= targetScore)
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

  return {
    assetVersion: readDashboardAssetVersion(),
    cards: {
      students: latestRows.reduce((sum, row) => sum + (Number(row.students) || 0), 0).toLocaleString(),
      latest: fmtPct(latestScore),
      change: fmtPts(latestScore - firstScore),
      completion: fmtPct(weightedAverage(latestRows, "completion")),
      target: completed ? fmtPct((targetCompleted / completed) * 100) : "-",
    },
    subjectLineCount,
    tableRows,
    subjectViolinCount,
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

async function resetDashboard(page) {
  await page.locator("#slice-filter-clear").click();
  await page.locator("#line-filter").fill("");
  await setSelect(page, "#metric-select", "score");
  await setSelect(page, "#season-select", "All");
  await setSelect(page, "#line-sort-select", "latest");
  await setSelect(page, "#line-limit-select", "10");
  await setRange(page, "#line-min-n", "5");
  await page.evaluate(() => {
    const violin = document.querySelector("#toggle-violin-plots");
    if (violin && !violin.checked) {
      violin.checked = true;
      violin.dispatchEvent(new Event("change", { bubbles: true }));
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
      cards: {
        students: document.querySelector("#metric-students")?.textContent.trim() ?? "",
        latest: document.querySelector("#metric-latest")?.textContent.trim() ?? "",
        change: document.querySelector("#metric-change")?.textContent.trim() ?? "",
        completion: document.querySelector("#metric-completion")?.textContent.trim() ?? "",
        target: document.querySelector("#metric-target")?.textContent.trim() ?? "",
      },
      timeCaption: document.querySelector("#time-caption")?.textContent ?? "",
      lineCount: document.querySelectorAll(".comparison-series-line").length,
      violinCount: document.querySelectorAll(".violin-plot").length,
      violinTitles: [...document.querySelectorAll(".violin-plot title")].map((node) => node.textContent.trim()).slice(0, 8),
      emptyChartText: [...document.querySelectorAll(".empty-chart-text")].map((node) => node.textContent.trim()),
      tableRows: document.querySelectorAll("#course-table tr").length,
      tableCount: document.querySelector("#table-count")?.textContent ?? "",
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
  await resetDashboard(page);

  const base = await snapshot(page);
  assertCondition(failures, !base.dashboardError, "dashboard loads", base);
  assertCondition(failures, !base.badTextValue && !base.badSvgValue, "no invalid text/svg values", base);
  assertCondition(failures, base.assetVersion === expected.assetVersion, "asset version matches HTML", base);
  assertCondition(failures, base.cssHref.includes(`?v=${expected.assetVersion}`), "CSS cache key matches asset version", base.cssHref);
  assertCondition(failures, base.dashboardScriptSrc.includes(`?v=${expected.assetVersion}`), "dashboard JS cache key matches asset version", base.dashboardScriptSrc);
  assertCondition(failures, base.oldControls.groupSelects === 0 && base.oldControls.presetRows === 0 && base.oldControls.sliceMenus === 0, "old controls absent", base.oldControls);
  assertCondition(failures, base.compareRadios.length === 3 && base.compareRadios.find((item) => item.value === "course")?.checked, "compare radios default to subject", base.compareRadios);
  assertCondition(failures, cardsMatch(base.cards, expected.cards), "metric cards match source JSON", { actual: base.cards, expected: expected.cards });
  assertCondition(failures, base.lineCount === expected.subjectLineCount, "default subject line count matches source JSON", base);
  assertCondition(failures, base.tableRows === expected.tableRows, "default table rows match source JSON", base);
  assertCondition(failures, base.violinCount === expected.subjectViolinCount, "default violin count matches source JSON", base);
  assertCondition(failures, base.violinTitles.every((title) => title.includes("subject score distribution")), "default violins are subject distributions", base.violinTitles);

  await page.locator("input[name='compare-by'][value='teacher']").check();
  const selectedTeachers = await checkFirstN(page, "#teacher-filter-options input[type='checkbox']", 2);
  const teacher = await snapshot(page);
  assertCondition(failures, teacher.summary.includes(`Compare ${selectedTeachers} teachers`), "teacher selection summary", teacher.summary);
  assertCondition(failures, teacher.lineCount === selectedTeachers, "teacher selected line count", teacher);
  assertCondition(failures, teacher.violinTitles.length > 0 && teacher.violinTitles.every((title) => title.includes("teacher score distribution")), "teacher violins are teacher distributions", teacher.violinTitles);

  await resetDashboard(page);
  await page.locator("input[name='compare-by'][value='course']").check();
  const selectedSubjects = await checkFirstN(page, "#course-filter-options input[type='checkbox']", 2);
  const subject = await snapshot(page);
  assertCondition(failures, subject.summary.includes(`Compare ${selectedSubjects} subjects`), "subject selection summary", subject.summary);
  assertCondition(failures, subject.lineCount === selectedSubjects, "subject selected line count", subject);
  assertCondition(failures, subject.violinTitles.length > 0 && subject.violinTitles.every((title) => title.includes("subject score distribution")), "subject violins are subject distributions", subject.violinTitles);

  await resetDashboard(page);
  await page.locator("input[name='compare-by'][value='section']").check();
  const selectedSections = await checkFirstN(page, "#section-filter-options input[type='checkbox']", 2);
  const section = await snapshot(page);
  assertCondition(failures, section.summary.includes(`Compare ${selectedSections} sections`), "section selection summary", section.summary);
  assertCondition(failures, section.lineCount === selectedSections, "section selected line count", section);
  assertCondition(failures, section.violinTitles.length > 0 && section.violinTitles.every((title) => title.includes("section score distribution")), "section violins are section distributions", section.violinTitles);

  await resetDashboard(page);
  await page.locator("input[name='compare-by'][value='teacher']").check();
  await page.locator("#course-filter-options input[type='checkbox']").first().check();
  await page.waitForTimeout(160);
  const crossFiltered = await snapshot(page);
  assertCondition(failures, crossFiltered.summary.includes("filter 1 subject") && crossFiltered.summary.includes("Compare all teachers"), "non-active subject filter summary", crossFiltered.summary);
  assertCondition(failures, crossFiltered.lineCount > 0 && crossFiltered.lineCount <= 5, "non-active filter constrains teacher comparisons", crossFiltered);

  for (const compareBy of ["course", "teacher", "section"]) {
    await resetDashboard(page);
    await page.locator(`input[name='compare-by'][value='${compareBy}']`).check();
    for (const metric of ["score", "proficiency", "growth", "completion"]) {
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
  assertCondition(failures, beginning.timeCaption.includes("7 reporting windows"), "Beginning season limits to 7 windows", beginning.timeCaption);
  await setSelect(page, "#season-select", "End");
  const ending = await snapshot(page);
  assertCondition(failures, ending.timeCaption.includes("7 reporting windows"), "End season limits to 7 windows", ending.timeCaption);

  await page.locator("#section-filter-search").fill("01-01");
  await page.waitForTimeout(160);
  const sectionSearchCount = await page.locator("#section-filter-options input[type='checkbox']").count();
  assertCondition(failures, sectionSearchCount > 0 && sectionSearchCount < 174, "section search filters checkbox list", sectionSearchCount);

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
  const mobile = await snapshot(page);
  assertCondition(failures, !mobile.dashboardError, "mobile dashboard loads", mobile);
  assertCondition(failures, mobile.compareRadios.length === 3, "mobile compare radios present", mobile.compareRadios);
  assertCondition(failures, mobile.mobileOverflow.length === 0, "mobile has no non-chart horizontal overflow", mobile.mobileOverflow);
  return { failures, summary: { overflowCount: mobile.mobileOverflow.length } };
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
