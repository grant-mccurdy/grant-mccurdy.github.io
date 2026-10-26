import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { domainRows, questionRows, comparisonRows, selectRows, toCsv, orderedGroups, populationSummary, profileRows, pairwiseCells, responseCounts } from "../assets/js/department-model.js";

const root = path.resolve(import.meta.dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/logos/report-data.json")));
const out = path.join(root, process.env.DASHBOARD_BASE_URL ? "tmp/logos-live" : "tmp/logos-alignment");
fs.mkdirSync(out, { recursive: true });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, actual + " != " + expected);
assert.equal(questionRows(data, {}, "all").length, 30);
assert.equal(questionRows(data, {}).length, 7);
for (const row of questionRows(data, {}, "all")) {
  close(row.mean, data.items.find((item) => item.position === row.position).facility * 100);
  assert.equal(row.n, 500);
}
for (const row of domainRows(data, {})) close(row.mean, data.domain_pooled.find((item) => item.domain === row.domain).mean);
for (const course of data.course_order) {
  const rows = questionRows(data, { course }, "all");
  const expected = data.course_pooled.find((row) => row.course === course);
  close(100 * rows.reduce((sum, row) => sum + row.correct, 0) / (30 * expected.n), expected.mean);
  for (const profile of profileRows(data, { course })) {
    const questions = questionRows(data, { course }, "all", profile.domain);
    close(profile.mean, questions.reduce((sum, row) => sum + row.mean, 0) / questions.length);
  }
}
assert.equal(questionRows(data, { course: "AP Calculus AB", track: "Regular" }, "all").length, 0);
assert.equal(comparisonRows(data, "Classes within course and track").length, 14);
assert.equal(comparisonRows(data, "Within-course tracks").length, 4);
assert.equal(comparisonRows(data, "Adjacent courses, tracks pooled").length, 4);
assert.ok(comparisonRows(data, "Within-course tracks").every((row) => row.interpretation === "inconclusive" && !row.equivalent));
close(populationSummary(data, {}).mean, data.overall[0].mean);
assert.equal(populationSummary(data, {}).classes, 21);
assert.equal(populationSummary(data, { course: "AP Calculus AB", track: "Regular" }).mean, null);
assert.equal(responseCounts(data).reduce((sum, row) => sum + row.count, 0), 15000);
close(responseCounts(data)[0].count / 150, data.overall[0].mean);
const groups = orderedGroups(data, data.course);
const cells = pairwiseCells(data, groups);
assert.equal(cells.length, 90);
for (const cell of cells) {
  const reverse = cells.find((row) => row.a === cell.b && row.b === cell.a);
  close(cell.difference, -reverse.difference);
  close(cell.low, -reverse.high);
  assert.equal(cell.p_holm, reverse.p_holm);
}
assert.equal(toCsv(["label"], [['a,"b"']]), '"label"\r\n"a,""b"""');
console.log("PASS model: report parity, weighted profiles, signed comparisons, original families, response counts and empty populations.");

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png" };
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  let target = path.resolve(root, "." + decodeURIComponent(url.pathname));
  if (target !== root && !target.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
  if (!fs.existsSync(target)) { response.writeHead(404).end(); return; }
  response.writeHead(200, { "Content-Type": types[path.extname(target)] || "application/octet-stream" });
  fs.createReadStream(target).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = process.env.DASHBOARD_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ headless: true });
const errors = [], results = [];
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "Page overflows horizontally");
}
async function chartChecks(page) {
  const checks = await page.locator(".dashboard-view:not([hidden])").evaluate((panel) => {
    const luminance = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => {
      const c = v / 255;
      return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
    const contrasts = [...panel.querySelectorAll(".chart-mark .cell-value")].map((text) => {
      const background = text.parentElement.querySelector("rect");
      const a = luminance(getComputedStyle(text).fill), b = luminance(getComputedStyle(background).fill);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    const clipped = [...panel.querySelectorAll("svg text")].filter((node) => {
      const box = node.getBBox(), bounds = node.ownerSVGElement.viewBox.baseVal;
      return box.x < -1 || box.x + box.width > bounds.width + 1 || box.y < -1 || box.y + box.height > bounds.height + 1;
    }).map((node) => node.textContent);
    const overlaps = [...panel.querySelectorAll(".chart-mark")].filter((node) => {
      const a = node.querySelector(".row-label")?.getBBox(), b = node.querySelector(".row-secondary")?.getBBox();
      return a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    }).map((node) => node.getAttribute("aria-label"));
    return { contrasts, clipped, overlaps, svg: panel.querySelectorAll("svg").length, images: panel.querySelectorAll("img,svg image,object,embed").length };
  });
  assert.ok(checks.svg > 0, "Native charts are missing");
  assert.equal(checks.images, 0, "Report images must not substitute for native charts");
  assert.deepEqual(checks.clipped, [], "SVG text is clipped");
  assert.deepEqual(checks.overlaps, [], "Chart row labels overlap");
  assert.ok(checks.contrasts.every((value) => value >= 4.5), "Heatmap values fail text contrast");
}
async function csvDownload(page, button) {
  const download = page.waitForEvent("download");
  await page.locator(button).click();
  return fs.readFileSync(await (await download).path(), "utf8");
}
try {
  for (const width of [1440, 768, 632, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/dashboard/assessment.html");
    await page.locator("#department-app").waitFor({ state: "visible" });
    assert.deepEqual(await page.locator("#department-metrics dd strong").allTextContents(), ["61.8%", "500", "21", "97.6%"]);
    assert.equal(await page.locator("#department-findings li").count(), 3);
    assert.equal(await page.locator("#course-chart .chart-mark").count(), 10);
    assert.equal(await page.locator("main details, main summary").count(), 0);
    assert.equal(await page.locator("#course-chart .violin-density").count(), 10);
    const shapes = await page.locator("#course-chart .violin-density").evaluateAll((nodes) => nodes.map((node) => ({ points: node.getAttribute("d").split("L").length, area: node.getBBox().width * node.getBBox().height })));
    assert.ok(shapes.every((shape) => shape.points === 1024 && shape.area > 100));
    assert.equal(await page.locator("#pairwise-chart .chart-mark").count(), 90);
    await page.locator('[data-data-view="pairwise"]').click();
    assert.equal(await page.locator("#department-table").inputValue(), "pairwise");
    assert.equal(await page.locator("#pairwise-data").isVisible(), true);
    await page.locator('[data-view="overview"]').click();
    await page.locator('[data-data-view="course"]').click();
    assert.equal(await page.locator("#department-table").inputValue(), "course");
    assert.equal(await page.locator("#course-data").isVisible(), true);
    await page.locator('[data-view="overview"]').click();
    const plotted = await page.locator("#course-chart .chart-mark").evaluateAll((nodes) => nodes.map((node) => Number(node.dataset.value)));
    groups.forEach((row, index) => close(plotted[index], row.mean));
    const point = page.locator("#course-chart .chart-mark").first();
    await point.hover();
    assert.match(await page.locator("#chart-tooltip").innerText(), /Algebra I.*47.6%/);
    await point.focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.locator("#course-chart .chart-mark").nth(1).evaluate((el) => el === document.activeElement), true);
    await page.keyboard.press("Enter");
    assert.match(await page.locator("#course-chart .chart-selection").innerText(), /Honors\/AP/);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#chart-tooltip").isVisible(), false);
    assert.match(await page.locator("#course-note").innerText(), /density|distribution/i);
    await page.locator("#department-reference").uncheck();
    assert.equal(await page.locator("#course-chart .reference-line").count(), 0);
    await page.locator('[data-view="compare"]').click();
    assert.equal(await page.locator("#domain-chart .chart-mark").count(), 24);
    await page.selectOption("#department-profile", "Geometry/Trigonometry");
    assert.equal(await page.locator("#domain-chart .chart-mark").count(), 6);
    await page.locator("#department-reset").click();
    for (const view of ["overview", "compare", "questions", "quality"]) {
      await page.locator('[data-view="' + view + '"]').click();
      await noOverflow(page);
      await chartChecks(page);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      assert.deepEqual(axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), [], "Accessibility " + view + " " + width);
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: path.join(out, "dashboard-" + view + "-" + width + ".png"), fullPage: true });
      results.push({ view, width, nativeCharts: true, accessibility: "pass", overflow: false });
    }
    await page.locator('[data-view="overview"]').click();
    await page.locator('[data-drill="2"]').click();
    assert.equal(await page.locator("#tab-compare").getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#group-chart .chart-mark").count(), 3);
    assert.match(await page.locator("#department-selection").innerText(), /75 students/);
    const expected = orderedGroups(data, selectRows(data.section, { course: "Geometry", track: "Regular" }), "high");
    await page.selectOption("#department-sort", "high");
    close(Number(await page.locator("#group-chart .chart-mark").first().getAttribute("data-value")), expected[0].mean);
    await chartChecks(page);
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: path.join(out, "dashboard-geometry-" + width + ".png"), fullPage: true });
    await page.reload();
    await page.locator("#department-app").waitFor({ state: "visible" });
    assert.equal(await page.locator("#department-group").inputValue(), "section");
    assert.equal(await page.locator("#department-sort").inputValue(), "high");
    assert.equal(await page.locator("#group-chart .chart-mark").count(), 3);
    await page.locator('[data-view="quality"]').click();
    await page.selectOption("#department-table", "class");
    const csv = await csvDownload(page, "#class-download");
    assert.ok(csv.includes("SEC-06") && csv.includes("SEC-08") && !csv.includes("SEC-01"));
    await page.locator('[data-class-sort="mean"]').click();
    await page.locator('[data-class-sort="mean"]').click();
    assert.equal(await page.locator("#class-data tbody th").first().innerText(), expected[0].section_id);
    await page.locator('[data-view="overview"]').click();
    assert.deepEqual(await page.locator("#department-metrics dd strong").allTextContents(), ["56.9%", "75", "3", "97.6%"]);
    await page.locator("#department-reset").click();
    await page.selectOption("#department-course", "AP Calculus AB");
    await page.selectOption("#department-track", "Regular");
    assert.match(await page.locator("#course-chart").innerText(), /No groups/);
    assert.equal(await page.locator("#course-chart .chart-mark").count(), 0);
    await page.locator('[data-view="questions"]').click();
    assert.equal(await page.locator("#department-download").isDisabled(), true);
    await page.locator("#department-reset").click();
    assert.equal(await page.locator("#question-chart .chart-mark").count(), 70);
    await page.selectOption("#department-question-scope", "all");
    assert.equal(await page.locator("#question-chart .chart-mark").count(), 300);
    await chartChecks(page);
    await page.selectOption("#department-domain", "Geometry/Trigonometry");
    assert.equal(await page.locator("#question-chart .chart-mark").count(), 50);
    await page.selectOption("#department-course", "Algebra II");
    await page.selectOption("#department-track", "Regular");
    assert.equal(await page.locator("#question-chart .chart-mark").count(), 5);
    await page.selectOption("#department-question-sort", "accuracy");
    const firstQuestion = page.locator("#question-chart .chart-mark").first();
    assert.equal(await firstQuestion.getAttribute("data-position"), "26");
    await firstQuestion.click();
    assert.match(await page.locator("#question-evidence").innerText(), /Q26.*Geometry|Q26/s);
    const selectedQuestion = data.item_course.find((row) => row.position === 26 && row.course === "Algebra II" && row.track === "Regular");
    assert.ok((await page.locator("#question-evidence").innerText()).includes(selectedQuestion.correct + " of " + selectedQuestion.n));
    const questionsCsv = await csvDownload(page, "#department-download");
    assert.ok(questionsCsv.includes("Q26") && questionsCsv.includes("Algebra II") && !questionsCsv.includes("Honors/AP"));
    await page.locator("#department-reset").click();
    await page.locator('[data-view="overview"]').click();
    assert.equal(await page.locator("#pairwise-chart .chart-mark").count(), 90);
    await page.locator('#pairwise-chart [data-row="0"][data-column="1"]').focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.locator('#pairwise-chart [data-row="2"][data-column="1"]').evaluate((el) => el === document.activeElement), true);
    await page.locator('[data-view="compare"]').click();
    assert.equal(await page.locator("#difference-chart .chart-mark").count(), 4);
    await page.selectOption("#department-family", "Classes within course and track");
    assert.equal(await page.locator("#difference-chart .chart-mark").count(), 14);
    await page.selectOption("#department-family", "Adjacent courses, tracks pooled");
    assert.equal(await page.locator("#difference-chart .chart-mark").count(), 4);
    await page.locator("#tab-compare").focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator("#tab-questions").getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#tab-questions").evaluate((el) => el === document.activeElement), true);
    await page.goBack();
    assert.equal(await page.locator("#tab-compare").getAttribute("aria-selected"), "true");
    await page.locator('[data-view="overview"]').click();
    if (width === 320) {
      await page.evaluate(() => {
        const sizes = [...document.querySelectorAll("main :not(svg *)")].map((el) => [el, parseFloat(getComputedStyle(el).fontSize)]);
        sizes.forEach(([el, size]) => { el.style.fontSize = size * 2 + "px"; });
      });
      await noOverflow(page);
      await page.screenshot({ path: path.join(out, "dashboard-text-200-320.png"), fullPage: true });
    }
    console.log("PASS " + width + "px: native charts, SVG bounds/contrast, keyboard and pointer inspection, filters, URL history, CSV, empty states and accessibility.");
    await context.close();
  }
  const resizeContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const resize = await resizeContext.newPage();
  await resize.goto(base + "/dashboard/assessment.html?course=Geometry&track=Regular&group=section#courses");
  await resize.locator("#course-chart svg").waitFor();
  assert.equal(await resize.locator("#tab-overview").getAttribute("aria-selected"), "true");
  await resize.locator('[data-view="compare"]').click();
  await resize.setViewportSize({ width: 320, height: 800 });
  await resize.waitForFunction(() => Number(document.querySelector("#group-chart svg").getAttribute("width")) < 400);
  await noOverflow(resize); await chartChecks(resize);
  await resizeContext.close();
  const offlineContext = await browser.newContext({ javaScriptEnabled: false });
  const offline = await offlineContext.newPage();
  await offline.goto(base + "/dashboard/assessment.html");
  assert.ok(await offline.locator("noscript a").first().isVisible());
  await offlineContext.close();
  const failureContext = await browser.newContext();
  const failurePage = await failureContext.newPage();
  await failurePage.route("**/data/logos/report-data.json", (route) => route.fulfill({ status: 503, body: "" }));
  await failurePage.goto(base + "/dashboard/assessment.html");
  await failurePage.locator("#department-retry").waitFor();
  assert.equal(await failurePage.locator("#department-app").isVisible(), false);
  await failurePage.unroute("**/data/logos/report-data.json");
  await failurePage.locator("#department-retry").click();
  await failurePage.locator("#department-app").waitFor({ state: "visible" });
  await failureContext.close();
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2) + "\n");
  console.log("PASS resize, legacy URLs, no-JavaScript fallback, load-failure recovery and zero page errors. Screenshots: tmp/logos-alignment/");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
