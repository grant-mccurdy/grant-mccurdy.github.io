import path from "node:path";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 750 }, deviceScaleFactor: 1 });
  const response = await page.goto("https://logoseducation.group/assessment-preview/", { waitUntil: "networkidle" });
  if (!response?.ok()) throw new Error("Assessment preview did not load.");
  await page.locator("#start").click();
  await page.locator("#question-title").waitFor({ state: "visible" });
  await page.locator("#assessment").screenshot({ path: path.resolve(import.meta.dirname, "../assets/images/previews/logos-assessment.png") });
  // Exercise only the public browser-local preview in an isolated context.
  for (let i = 0; i < 30; i++) {
    const radios = page.locator('#question-content input[type="radio"]');
    if (await radios.count()) await radios.nth(i % await radios.count()).check();
    else await page.locator('#numeric-answer').fill('4');
    if (i === 16) await page.locator('#assessment').screenshot({ path: path.resolve(import.meta.dirname, '../assets/images/previews/logos-question.png') });
    await page.locator('#next').click();
  }
  await page.locator('#finish-review').click();
  await page.locator('#confirm-finish').click();
  await page.waitForFunction(() => document.querySelector('#finish-content').textContent.includes('Practice topics') || document.querySelector('#finish-content').querySelector('table'));
  await page.locator('.diagnostic-section').filter({ has: page.getByRole('heading', { name: 'Content-area evidence', exact: true }) }).screenshot({ path: path.resolve(import.meta.dirname, '../assets/images/previews/logos-feedback.png') });
  console.log(await page.title());
} finally {
  await browser.close();
}
