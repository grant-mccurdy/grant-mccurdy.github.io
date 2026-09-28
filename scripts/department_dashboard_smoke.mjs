import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { domainRows, questionRows, comparisonRows, selectRows, toCsv } from "../assets/js/department-model.js";

const root = path.resolve(import.meta.dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/logos/report-data.json")));
const out = path.join(root, "tmp/logos-alignment");
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
}
assert.equal(questionRows(data, { course: "AP Calculus AB", track: "Regular" }, "all").length, 0);
assert.equal(comparisonRows(data, "Classes within course and track").length, 14);
assert.equal(comparisonRows(data, "Within-course tracks").length, 4);
assert.equal(comparisonRows(data, "Adjacent courses, tracks pooled").length, 4);
assert.ok(comparisonRows(data, "Within-course tracks").every((row) => row.interpretation === "inconclusive" && !row.equivalent));
assert.equal(toCsv(["label"], [['a,"b"']]), '"label"\r\n"a,""b"""');
console.log("PASS model: weighted means, question totals, empty selections, original comparison families and CSV escaping.");

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".mp4": "video/mp4" };
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
const base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ headless: true });
const errors = [];
const results = [];
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "Page overflows horizontally");
}
async function imageLoaded(page, selector) {
  await page.locator(selector).evaluate((image) => image.decode());
  assert.ok(await page.locator(selector).evaluate((image) => image.naturalWidth > 0));
}
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("https://portfolio-rag-api.grant-mccurdy.workers.dev/**", (route) => route.fulfill({ json: {} }));
    await page.goto(base + "/dashboard/assessment.html");
    await page.locator("#department-app").waitFor({ state: "visible" });
    assert.deepEqual(await page.locator(".department-metrics dd").allTextContents(), ["500", "21", "61.8%", "97.6%"]);
    assert.equal(await page.locator("#department-findings article").count(), 3);
    await imageLoaded(page, ".assessment-pair img");
    for (const view of ["overview", "courses", "content", "questions", "comparisons"]) {
      await page.locator('[data-view="' + view + '"]').click();
      if (view !== "overview") {
        await imageLoaded(page, "#department-figure");
        assert.ok(await page.locator("#department-table tbody tr").count() > 0);
      }
      await noOverflow(page);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      assert.deepEqual(axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })), [], "Accessibility " + view + " " + width);
      await page.screenshot({ path: path.join(out, "dashboard-" + view + "-" + width + ".png"), fullPage: true });
      results.push({ view, width, accessibility: "pass", overflow: false });
    }
    await page.locator('[data-view="courses"]').click();
    await page.selectOption("#department-course", "Geometry");
    await page.selectOption("#department-track", "Regular");
    await page.selectOption("#department-group", "section");
    assert.equal(await page.locator("#department-table tbody tr").count(), 3);
    assert.match(await page.locator("#department-selection").innerText(), /75 students/);
    const expected = selectRows(data.section, { course: "Geometry", track: "Regular" }).map((r) => r.mean.toFixed(1) + "%");
    assert.deepEqual(await page.locator(".department-bars strong").allTextContents(), expected);
    await imageLoaded(page, "#department-figure");
    assert.match(await page.locator("#department-figure").getAttribute("src"), /section-periods/);
    await page.screenshot({ path: path.join(out, "dashboard-geometry-" + width + ".png"), fullPage: true });
    await page.reload();
    await page.locator("#department-app").waitFor({ state: "visible" });
    assert.equal(await page.locator("#department-group").inputValue(), "section");
    assert.equal(await page.locator("#department-table tbody tr").count(), 3);
    const download = page.waitForEvent("download");
    await page.locator("#department-download").click();
    const downloaded = await download;
    const csv = fs.readFileSync(await downloaded.path(), "utf8");
    assert.ok(csv.includes("SEC-06") && csv.includes("SEC-08") && !csv.includes("SEC-01"));
    await page.locator("#department-reset").click();
    await page.selectOption("#department-course", "AP Calculus AB");
    await page.selectOption("#department-track", "Regular");
    assert.match(await page.locator("#department-table").innerText(), /No groups/);
    assert.equal(await page.locator("#department-download").isDisabled(), true);
    await page.locator("#department-reset").click();
    await page.locator('[data-view="questions"]').click();
    await page.selectOption("#department-question-scope", "all");
    assert.equal(await page.locator("#department-table tbody tr").count(), 30);
    await imageLoaded(page, "#department-figure");
    await page.selectOption("#department-domain", "Geometry/Trigonometry");
    assert.equal(await page.locator("#department-table tbody tr").count(), 5);
    await page.locator('[data-view="comparisons"]').click();
    await page.selectOption("#department-family", "Classes within course and track");
    assert.equal(await page.locator("#department-table tbody tr").count(), 14);
    await page.locator('[data-view="overview"]').click();
    if (width === 320) {
      await page.evaluate(() => {
        const sizes = [...document.querySelectorAll("main *")].map((el) => [el, parseFloat(getComputedStyle(el).fontSize)]);
        sizes.forEach(([el, size]) => { el.style.fontSize = size * 2 + "px"; });
      });
      await noOverflow(page);
      await page.screenshot({ path: path.join(out, "dashboard-text-200-320.png"), fullPage: true });
    }
    await page.goto(base + "/");
    await page.locator(".hero-content").waitFor();
    await noOverflow(page);
    await page.screenshot({ path: path.join(out, "home-" + width + ".png"), fullPage: true });
    console.log("PASS " + width + "px: all views, figures, filters, shareable state, CSV, empty results and accessibility.");
    await context.close();
  }
  const offlineContext = await browser.newContext({ javaScriptEnabled: false });
  const offline = await offlineContext.newPage();
  await offline.goto(base + "/dashboard/assessment.html");
  assert.ok(await offline.locator("noscript a").first().isVisible());
  await offlineContext.close();
  const failurePage = await browser.newPage();
  await failurePage.route("**/data/logos/report-data.json", (route) => route.fulfill({ status: 503, body: "" }));
  await failurePage.goto(base + "/dashboard/assessment.html");
  await failurePage.locator("#department-retry").waitFor();
  assert.equal(await failurePage.locator("#department-app").isVisible(), false);
  await failurePage.unroute("**/data/logos/report-data.json");
  await failurePage.locator("#department-retry").click();
  await failurePage.locator("#department-app").waitFor({ state: "visible" });
  await failurePage.close();
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2) + "\n");
  console.log("PASS no-JavaScript fallback, failed-load recovery and zero page errors. Screenshots: tmp/logos-alignment/");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
