#!/usr/bin/env node
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(path.join(import.meta.dirname, ".."));
const requireFromHere = createRequire(import.meta.url);

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

async function inspect(page) {
  const bodyText = await page.locator("body").innerText();
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll("body *"))
      .filter((el) => {
        if (el.classList?.contains("hero-bg")) return false;
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

  return {
    title: await page.title(),
    h1: await page.locator("h1").first().innerText(),
    syntheticMention: bodyText.includes("Synthetic Education Data"),
    projectCards: await page.locator(".project-card").count(),
    artifactCards: await page.locator(".artifact-link-card").count(),
    overflow,
  };
}

const cases = [
  ["home-desktop", "index.html", 1440, 1000],
  ["home-mobile", "index.html", 390, 900],
  ["synthetic-desktop", path.join("projects", "synthetic-education-data.html"), 1440, 1000],
  ["synthetic-mobile", path.join("projects", "synthetic-education-data.html"), 390, 900],
  ["assessment-desktop", path.join("projects", "assessment-intelligence.html"), 1440, 1000],
  ["content-desktop", path.join("projects", "content-intelligence-reporting.html"), 1440, 1000],
];

let playwright;
try {
  playwright = await loadPlaywright();
} catch (error) {
  if (error?.code === "ERR_MODULE_NOT_FOUND") {
    console.log("Playwright is not installed; skipping visual smoke checks.");
    process.exit(0);
  }
  throw error;
}

const { chromium } = playwright;
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const [label, file, width, height] of cases) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(pathToFileURL(path.join(root, file)).href, { waitUntil: "load" });
    results.push({ label, ...(await inspect(page)) });
    await page.close();
  }
} finally {
  await browser.close();
}

const failures = results.filter((result) => result.overflow.length > 0);
console.log(JSON.stringify(results, null, 2));

if (failures.length) {
  process.exitCode = 1;
}
