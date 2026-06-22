#!/usr/bin/env node
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve(path.join(import.meta.dirname, ".."));
const requireFromHere = createRequire(import.meta.url);
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
    throw new Error("Could not start visual smoke server");
  }
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function inspect(page) {
  const bodyText = await page.locator("body").innerText();
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll("body *"))
      .filter((el) => {
        if (el.closest(".hero-media")) return false;
        if (el.closest(".chart-frame, .table-wrap")) return false;
        const rect = el.getBoundingClientRect();
        return (
          rect.width &&
          rect.height &&
          (rect.right > document.documentElement.clientWidth + 2 || rect.left < -2)
        );
      })
      .slice(0, 5)
      .map((el) => ({
        tag: el.tagName,
        className: String(el.className),
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
      })),
  );

  const heroVideo = await page.evaluate(async () => {
    const video = document.querySelector(".hero-video");
    if (!video) return null;
    if (video.readyState < 1) {
      await new Promise((resolve) => {
        video.addEventListener("loadedmetadata", resolve, { once: true });
        window.setTimeout(resolve, 2500);
      });
    }
    return {
      currentSrc: video.currentSrc,
      duration: video.duration,
      loop: video.loop,
      muted: video.muted,
      readyState: video.readyState,
      videoHeight: video.videoHeight,
      videoWidth: video.videoWidth,
    };
  });

  return {
    title: await page.title(),
    h1: await page.locator("h1").first().innerText(),
    simulationTitleMention: bodyText.includes("Education Data Simulation Engine"),
    projectCards: await page.locator(".project-card").count(),
    artifactCards: await page.locator(".artifact-link-card").count(),
    dashboardError: bodyText.includes("Dashboard data did not load"),
    heroVideo,
    overflow,
  };
}

const cases = [
  ["home-desktop", "index.html", 1440, 1000],
  ["home-mobile", "index.html", 390, 900],
  ["synthetic-desktop", path.join("projects", "education-data-simulation-engine.html"), 1440, 1000],
  ["synthetic-mobile", path.join("projects", "education-data-simulation-engine.html"), 390, 900],
  ["data-lab-desktop", "data-lab.html", 1440, 1000],
  ["data-lab-mobile", "data-lab.html", 390, 900],
  ["assessment-desktop", path.join("projects", "assessment-intelligence.html"), 1440, 1000],
  ["assessment-mobile", path.join("projects", "assessment-intelligence.html"), 390, 900],
  ["remediation-desktop", path.join("projects", "assessment-to-remediation-pipeline.html"), 1440, 1000],
  ["remediation-mobile", path.join("projects", "assessment-to-remediation-pipeline.html"), 390, 900],
  ["content-desktop", path.join("projects", "content-intelligence.html"), 1440, 1000],
  ["content-mobile", path.join("projects", "content-intelligence.html"), 390, 900],
  ["workflow-desktop", path.join("projects", "instructional-ai-workflows.html"), 1440, 1000],
  ["workflow-mobile", path.join("projects", "instructional-ai-workflows.html"), 390, 900],
  ["dashboard-desktop", path.join("dashboard", "assessment.html"), 1440, 1000],
  ["dashboard-mobile", path.join("dashboard", "assessment.html"), 390, 900],
];

const { chromium } = await loadPlaywright();
const server = staticServer();
const baseUrl = await listen(server);
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const [label, file, width, height] of cases) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`${baseUrl}/${file.replaceAll(path.sep, "/")}`, { waitUntil: "networkidle" });
    results.push({ label, ...(await inspect(page)) });
    await page.close();
  }
} finally {
  await browser.close();
  await closeServer(server);
}

const heroVideoFailed = (result) => {
  if (!result.label.startsWith("home-")) return false;
  return (
    !result.heroVideo ||
    !result.heroVideo.currentSrc.includes("assets/video/workflow-hero.mp4") ||
    !result.heroVideo.loop ||
    !result.heroVideo.muted ||
    result.heroVideo.videoWidth < 1 ||
    result.heroVideo.videoHeight < 1
  );
};

const failures = results.filter(
  (result) => result.overflow.length > 0 || result.dashboardError || heroVideoFailed(result),
);
console.log(JSON.stringify(results, null, 2));

if (failures.length) {
  process.exitCode = 1;
}
