import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const [schoolsImage, growthImage, instructorHtml] = process.argv.slice(2);
if (!schoolsImage || !growthImage || !instructorHtml) {
  throw new Error("Provide the reviewed Schools image, growth figure, and instructor-review HTML paths.");
}
const output = path.resolve(import.meta.dirname, "../assets/images/previews");
fs.mkdirSync(output, { recursive: true });
fs.copyFileSync(schoolsImage, path.join(output, "schools-algebra.png"));
fs.copyFileSync(growthImage, path.join(output, "growth-distribution.png"));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 740 }, deviceScaleFactor: 1 });
  await page.route("**/*", (route) => route.request().url().startsWith("file:")
    ? route.continue() : route.abort());
  await page.goto(pathToFileURL(path.resolve(instructorHtml)).href);
  await page.screenshot({ path: path.join(output, "instructor-review.png") });
} finally {
  await browser.close();
}
console.log("Copied two reviewed figures and captured the instructor-review viewport.");
