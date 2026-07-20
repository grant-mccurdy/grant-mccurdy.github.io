import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "data", "portfolio-projects.json"), "utf8"));
const outputPath = path.join(root, "sitemap.xml");
const checkOnly = process.argv.includes("--check");
const baseUrl = "https://grant-mccurdy.github.io/";

const xmlEscape = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const routes = new Map();
const addRoute = (url, lastmod) => {
  const absolute = new URL(url, baseUrl);
  if (absolute.origin !== new URL(baseUrl).origin) return;
  routes.set(absolute.href, lastmod);
};

addRoute("./", registry.siteLastReviewed);
addRoute("projects/", registry.siteLastReviewed);
addRoute("demos/", registry.siteLastReviewed);
addRoute(
  "projects/hotel-comp-policy-model/",
  registry.projects.find((project) => project.id === "hotel-comp-policy-model")?.lastReviewed
);

for (const project of registry.projects) {
  addRoute(project.portalPath, project.lastReviewed);
  if (project.demo) addRoute(project.demo.url, project.lastReviewed);
}

const entries = [...routes.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(
    ([url, lastmod]) =>
      `  <url>\n    <loc>${xmlEscape(url)}</loc>\n    <lastmod>${xmlEscape(lastmod)}</lastmod>\n  </url>`
  )
  .join("\n");
const rendered = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;

if (checkOnly) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
  if (current !== rendered) {
    console.error("sitemap.xml is stale. Run: node scripts/build_sitemap.mjs");
    process.exit(1);
  }
  console.log(`Sitemap valid: ${routes.size} canonical routes.`);
} else {
  fs.writeFileSync(outputPath, rendered);
  console.log(`Wrote sitemap.xml with ${routes.size} canonical routes.`);
}
