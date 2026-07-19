import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
};
const cases = [
  { path: "/", viewport: { width: 1440, height: 1000 } },
  { path: "/", viewport: { width: 390, height: 844 } },
  { path: "/projects/", viewport: { width: 1280, height: 900 } },
  { path: "/dashboard/assessment.html", viewport: { width: 1280, height: 900 } },
  { path: "/data-lab.html", viewport: { width: 1280, height: 900 } },
  { path: "/projects/content-intelligence.html", viewport: { width: 1280, height: 900 } },
  { path: "/projects/assessment-to-remediation-pipeline.html", viewport: { width: 1280, height: 900 } },
  { path: "/projects/instructional-ai-workflows.html", viewport: { width: 1280, height: 900 } },
];

function staticServer() {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const relative = requestUrl.pathname === "/" ? "index.html" : decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
    let target = path.resolve(root, relative);
    if (target !== root && !target.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": mimeTypes[path.extname(target)] || "application/octet-stream" });
    fs.createReadStream(target).pipe(response);
  });
}

const server = staticServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  for (const testCase of cases) {
    const context = await browser.newContext({ viewport: testCase.viewport });
    const page = await context.newPage();
    await page.route("https://portfolio-rag-api.grant-mccurdy.workers.dev/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/analytics/datasets") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            generatedAt: "2026-07-19T00:00:00Z",
            defaultDatasetId: "synthetic_education_warehouse",
            datasets: [{
              id: "synthetic_education_warehouse",
              title: "Synthetic Education Warehouse",
              dialect: "sqlite",
              tables: 15,
              columns: 234,
              capabilities: ["dataset_overview"],
              suggestedQuestions: ["What stands out in the data?"],
            }],
          }),
        });
        return;
      }
      await route.fulfill({ status: 202, contentType: "application/json", body: "{}" });
    });
    await page.goto(`http://127.0.0.1:${port}${testCase.path}`, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    if (results.violations.length) {
      for (const violation of results.violations) {
        failures.push(
          `${testCase.path} ${testCase.viewport.width}px: ${violation.id} (${violation.impact}) ${violation.nodes
            .map((node) => node.target.join(" "))
            .join(", ")}`,
        );
      }
    } else {
      console.log(`PASS ${testCase.path} at ${testCase.viewport.width}px`);
    }
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL ${failure}`).join("\n"));
  process.exit(1);
}
console.log(`Accessibility smoke passed for ${cases.length} core page and viewport combinations.`);
