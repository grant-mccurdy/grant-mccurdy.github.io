import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const company = read("data/company-case-studies.json");
const study = company.caseStudies[0];
const report = read(study.sharedAssessment.manifest);
const data = read("data/logos/report-data.json");
const rag = read("content/rag/project-map.json").companyCaseStudies[0];
assert.equal(study.classification, "synthetic-demonstration");
assert.equal(study.sharedAssessment.formSha256, report.form.sha256);
assert.equal(study.sharedAssessment.questions, report.form.item_count);
assert.equal(study.sharedAssessment.workingSeconds, report.form.working_seconds);
assert.equal(study.sharedAssessment.sections, data.classes);
assert.equal(study.sharedAssessment.responses, data.response_count);
assert.equal(study.schools.historicalStudents, data.students);
assert.equal(study.schools.authoredPracticeJourneys, 8);
assert.equal(rag.id, study.id);
assert.equal(rag.reviewedAt, study.lastReviewed);
assert.equal(study.evidence.find((entry) => entry.id.startsWith("tutor-")).liveReady, false);
assert.equal(study.evidence.find((entry) => entry.id.startsWith("schools-context-")).newPaidModelEvaluation, false);
assert.equal(new URL(study.companyPreviewUrl).hostname, "logoseducation.group");

const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer((request, response) => {
  let target = path.resolve(root, "." + decodeURIComponent(new URL(request.url, "http://localhost").pathname));
  if (target !== root && !target.startsWith(root + path.sep)) return response.writeHead(403).end();
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return response.writeHead(404).end();
  response.writeHead(200, { "content-type": mime[path.extname(target)] || "application/octet-stream" });
  fs.createReadStream(target).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const output = path.join(root, "tmp", "portfolio-refresh-20261005");
fs.mkdirSync(output, { recursive: true });
const cases = [
  ["assessment-desktop", "/projects/logos-assessment.html", 1440, 1000],
  ["assessment-mobile", "/projects/logos-assessment.html", 390, 844],
  ["report-desktop", "/projects/assessment-intelligence.html", 1440, 1000],
  ["report-mobile", "/projects/assessment-intelligence.html", 390, 844],
  ["home-desktop", "/", 1440, 1000],
  ["home-laptop", "/", 1280, 640],
  ["home-wide", "/", 1920, 1080],
  ["home-tablet", "/", 900, 700],
  ["home-browser-comments", "/", 632, 602],
  ["home-mobile", "/", 390, 844],
  ["home-small", "/", 320, 568],
  ["case-desktop", "/projects/logos-learning-systems.html", 1440, 1000],
  ["case-mobile", "/projects/logos-learning-systems.html", 390, 844],
  ["case-small", "/projects/logos-learning-systems.html", 320, 568],
  ["about-desktop", "/about.html", 1440, 1000],
  ["about-mobile", "/about.html", 390, 844],
  ["home-nojs", "/", 390, 844, false],
  ["case-nojs", "/projects/logos-learning-systems.html", 390, 844, false],
  ["case-large-text", "/projects/logos-learning-systems.html", 390, 844, true, true],
];
const results = [];
try {
  for (const [name, route, width, height, javaScriptEnabled = true, largeText = false] of cases.filter(([name]) => !process.env.PORTFOLIO_CASE || name.startsWith(process.env.PORTFOLIO_CASE))) {
    const context = await browser.newContext({ viewport: { width, height }, javaScriptEnabled, reducedMotion: "reduce" });
    // Isolated browser and local requests only: no shared profile or paid API.
    await context.route("**/*", (request) => new URL(request.request().url()).origin === origin
      ? request.continue() : request.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(origin + route, { waitUntil: "networkidle" });
    if (largeText) await page.addStyleTag({ content: "p, li, dd, dt, a { font-size: 200% !important; }" });
    await page.locator("img").evaluateAll(async (images) => {
      for (const img of images) { img.loading = "eager"; await img.decode(); }
    });
    const layout = await page.evaluate(() => {
      const brand = document.querySelector(".brand-text").getBoundingClientRect();
      const intro = document.querySelector(".work-intro");
      const project = document.querySelector("#work-heading");
      const media = document.querySelector(".project-preview img");
      return {
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        brandVisible: brand.width > 100 && brand.right <= innerWidth,
        firstContentClear: document.querySelector("h1").getBoundingClientRect().top >= document.querySelector(".site-header").getBoundingClientRect().bottom,
        nextSectionVisible: !intro || project.getBoundingClientRect().top < innerHeight - 24,
        backgroundFirst: !intro || document.querySelector("main > section:first-child h1")?.textContent === "Background",
        everyProjectPreview: !intro || [...document.querySelectorAll(".portfolio-project")].every((el) => el.querySelector("a.project-preview[href] img[alt]")),
        mediaClear: !media || media.getBoundingClientRect().top >= intro.getBoundingClientRect().bottom,
        distinctProjects: !intro || (document.querySelectorAll(".portfolio-project").length === 3 && document.querySelectorAll("[data-home-project-id]").length === 1),
        noRepeatedName: !intro || !intro.textContent.includes("Grant McCurdy"),
        imagesLoaded: [...document.images].every((img) => img.complete && img.naturalWidth > 0),
        logosTypography: [...document.querySelectorAll("h1, h2, .button, .footer-links a")].every((el) => getComputedStyle(el).fontFamily.startsWith("Arial")),
        lightFooter: getComputedStyle(document.querySelector(".site-footer")).backgroundColor === "rgb(255, 255, 255)",
        lightContact: [...document.querySelectorAll(".profile-contact-band")].every((el) => getComputedStyle(el).backgroundColor === "rgb(255, 255, 255)"),
      };
    });
    let navigation = true;
    if (width <= 960 && javaScriptEnabled) {
      const toggle = page.locator("[data-nav-toggle]");
      await toggle.focus();
      await page.keyboard.press("Enter");
      navigation = await page.locator("[data-nav-links]").isVisible();
      await page.keyboard.press("Escape");
      navigation &&= await page.locator("[data-nav-links]").isHidden();
      navigation &&= await toggle.evaluate((el) => el === document.activeElement);
    } else if (!javaScriptEnabled) {
      navigation = await page.locator(".nav-links a").first().isVisible();
    }
    if (name.startsWith("case")) {
      const links = await page.locator('a[href^="https:"]').evaluateAll((nodes) => nodes.map((a) => a.href));
      assert(links.every((url) => new URL(url).hostname === "logoseducation.group"), "Case study exposes an unexpected external origin");
    }
    await page.screenshot({ path: path.join(output, name + ".png") });
    if (name === "home-browser-comments") {
      await page.locator(".site-footer").scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, "home-footer-632.png") });
    }
    if (["home-desktop", "home-mobile", "case-desktop", "case-mobile", "about-desktop", "about-mobile"].includes(name)) {
      await page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-visible")));
      await page.screenshot({ path: path.join(output, name + "-full.png"), fullPage: true });
    }
    // A no-JavaScript menu is expanded in normal flow, so it need not retain the hero fold.
    const pass = !layout.overflow && layout.brandVisible && layout.firstContentClear &&
      layout.imagesLoaded && layout.backgroundFirst && layout.everyProjectPreview && layout.mediaClear && layout.distinctProjects && layout.noRepeatedName && layout.logosTypography && layout.lightFooter && layout.lightContact &&
      (!javaScriptEnabled || layout.nextSectionVisible) && navigation && !errors.length;
    results.push({ name, pass, ...layout, navigation, errors });
    console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${JSON.stringify(layout)}`);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 700, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: 'networkidle' });
  for (const [name, count] of [['assessment', 3], ['report', 4]]) {
    const gallery = page.locator(`[data-gallery="${name}"]`);
    await gallery.scrollIntoViewIfNeeded();
    assert.equal(await gallery.getAttribute('data-paused'), 'true', 'Reduced motion disables autoplay');
    const initial = await gallery.boundingBox();
    for (let i = 0; i < count; i++) {
      await page.waitForFunction(({ name, i }) => document.querySelector(`[data-gallery="${name}"]`).dataset.slide === String(i), { name, i });
      await gallery.locator('.project-preview img').evaluate((img) => img.decode());
      assert(Math.abs((await gallery.boundingBox()).height - initial.height) < 1, 'Slide height must remain stable');
      await gallery.screenshot({ path: path.join(output, `gallery-${name}-${i}.png`) });
      await gallery.getByRole('button', { name: 'Next preview', exact: true }).click();
    }
    await page.waitForFunction((name) => document.querySelector(`[data-gallery="${name}"]`).dataset.slide === '0', name);
    await gallery.getByRole('button', { name: 'Previous preview', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(({ name, count }) => document.querySelector(`[data-gallery="${name}"]`).dataset.slide === String(count - 1), { name, count });
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload({ waitUntil: 'networkidle' });
  const gallery = page.locator('[data-gallery="assessment"]');
  await gallery.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => document.querySelector('[data-gallery="assessment"]').dataset.slide === '1', null, { timeout: 9000 });
  await gallery.getByRole('button', { name: 'Pause previews', exact: true }).click();
  await page.mouse.move(0, 0);
  const pausedAt = await gallery.getAttribute('data-slide');
  await page.waitForTimeout(5800);
  assert.equal(await gallery.getAttribute('data-slide'), pausedAt, 'Pause must hold the current slide');
  await gallery.getByRole('button', { name: 'Play previews', exact: true }).click();
  await page.mouse.move(0, 0);
  await page.waitForFunction((previous) => document.querySelector('[data-gallery="assessment"]').dataset.slide !== previous, pausedAt, { timeout: 9000 });
  await page.locator('.site-footer').scrollIntoViewIfNeeded();
  const offscreenAt = await gallery.getAttribute('data-slide');
  await page.waitForTimeout(5800);
  assert.equal(await gallery.getAttribute('data-slide'), offscreenAt, 'Offscreen galleries must stop');
  await context.close();
  console.log('PASS galleries: all seven frames, stable dimensions, keyboard, reduced motion, autoplay, pause, resume, offscreen stop.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(results, null, 2) + "\n");
assert(results.every((result) => result.pass), "Portfolio refresh checks failed; inspect tmp/portfolio-refresh-20261005/");
console.log(`Portfolio refresh verified: ${results.length} layouts, evidence identity, private-origin boundary, images and keyboard navigation.`);
