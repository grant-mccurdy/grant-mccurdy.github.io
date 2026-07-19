import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "assets", "images", "social");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
};
const captures = [
  ["portfolio", "/"],
  ["hotel-comp-policy-model", "/projects/hotel-comp-policy-model/"],
  ["assessment-intelligence", "/dashboard/assessment.html"],
  ["content-intelligence", "/projects/content-intelligence.html"],
  ["education-data-simulation-engine", "/data-lab.html"],
  ["statistical-risk-modeling-r", "/projects/statistical-risk-modeling-r.html"],
  ["graduate-statistics-portfolio", "/projects/graduate-statistics-portfolio.html"],
  ["assessment-to-remediation-pipeline", "/projects/assessment-to-remediation-pipeline.html"],
  ["instructional-ai-workflows", "/projects/instructional-ai-workflows.html"],
];

const server = http.createServer((request, response) => {
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

fs.mkdirSync(output, { recursive: true });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const browser = await chromium.launch({ headless: true });

try {
  for (const [name, pathname] of captures) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 640 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
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
    await page.goto(`http://127.0.0.1:${port}${pathname}`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.querySelectorAll("[data-reveal]").forEach((element) => element.classList.add("is-visible"));
      document.querySelectorAll("video").forEach((video) => video.pause());
    });
    await page.screenshot({ path: path.join(output, `${name}.png`) });
    console.log(`captured assets/images/social/${name}.png`);
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
