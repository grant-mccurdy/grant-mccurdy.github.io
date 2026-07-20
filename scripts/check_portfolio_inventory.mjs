import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "data", "portfolio-projects.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const directoryHtml = fs.readFileSync(path.join(root, "projects", "index.html"), "utf8");
const homeHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const demosHtml = fs.readFileSync(path.join(root, "demos", "index.html"), "utf8");
const allowedTiers = new Set(["flagship", "technical-depth", "active-prototype"]);
const errors = [];

const valuesFor = (html, attribute) =>
  [...html.matchAll(new RegExp(`${attribute}="([^"]+)"`, "g"))].map((match) => match[1]);

if (registry.schemaVersion !== 2 || !Array.isArray(registry.projects)) {
  errors.push("Registry must use schemaVersion 2 and contain a projects array.");
}

const blockFor = (html, attribute, id, tag) => {
  const expression = new RegExp(
    `<${tag}[^>]*${attribute}="${id}"[^>]*>[\\s\\S]*?<\\/${tag}>`,
    "i"
  );
  return html.match(expression)?.[0] || "";
};

const normalizedUrl = (value, pagePath = "index.html") => {
  try {
    return new URL(value, `https://grant-mccurdy.github.io/${pagePath}`).href;
  } catch {
    return "";
  }
};

const ids = registry.projects.map((project) => project.id);
if (new Set(ids).size !== ids.length) errors.push("Project IDs must be unique.");
for (const project of registry.projects) {
  for (const field of [
    "id",
    "title",
    "tier",
    "statusLabel",
    "portalPath",
    "sourceUrl",
    "primaryEvidenceUrl",
    "summary"
  ]) {
    if (!project[field]) errors.push(`${project.id || "unknown"}: missing ${field}.`);
  }
  if (!Array.isArray(project.capabilities) || project.capabilities.length < 2) {
    errors.push(`${project.id}: capabilities must contain at least two entries.`);
  }
  if (!allowedTiers.has(project.tier)) errors.push(`${project.id}: unsupported tier ${project.tier}.`);
  try {
    const source = new URL(project.sourceUrl);
    if (source.protocol !== "https:") throw new Error("not HTTPS");
  } catch {
    errors.push(`${project.id}: sourceUrl must be an HTTPS URL.`);
  }

  const localPortalPath = project.portalPath.replace(/^\/+/, "");
  const portalFile = localPortalPath.endsWith("/") ? `${localPortalPath}index.html` : localPortalPath;
  if (!fs.existsSync(path.join(root, portalFile))) errors.push(`${project.id}: portalPath does not exist.`);

  const directoryBlock = blockFor(directoryHtml, "data-project-id", project.id, "article");
  if (!directoryBlock) {
    errors.push(`${project.id}: missing from project directory.`);
  } else {
    if (!directoryBlock.includes(project.title)) errors.push(`${project.id}: directory title does not match registry.`);
    if (!directoryBlock.includes(project.statusLabel)) errors.push(`${project.id}: directory status does not match registry.`);
    const expectedBrief = normalizedUrl(project.portalPath);
    if (![...directoryBlock.matchAll(/href="([^"]+)"/g)].some((match) => normalizedUrl(match[1], "projects/index.html") === expectedBrief)) {
      errors.push(`${project.id}: directory does not link to canonical portalPath.`);
    }
  }

  if (project.demo) {
    for (const field of ["title", "url", "task", "dataBoundary"]) {
      if (!project.demo[field]) errors.push(`${project.id}: demo is missing ${field}.`);
    }
    const demoBlock = blockFor(demosHtml, "data-demo-project-id", project.id, "article");
    if (!demoBlock) {
      errors.push(`${project.id}: demo metadata exists but demos directory entry is missing.`);
    } else {
      if (!demoBlock.includes(project.demo.title)) errors.push(`${project.id}: demo title does not match registry.`);
      const expectedDemo = normalizedUrl(project.demo.url);
      if (![...demoBlock.matchAll(/href="([^"]+)"/g)].some((match) => normalizedUrl(match[1], "demos/index.html") === expectedDemo)) {
        errors.push(`${project.id}: demos directory does not link to registered demo URL.`);
      }
    }
  }
}

const directoryIds = valuesFor(directoryHtml, "data-project-id");
const featuredIds = valuesFor(homeHtml, "data-home-project-id");
const expectedFeatured = registry.projects.filter((project) => project.homeFeatured).map((project) => project.id);

if (directoryIds.length !== new Set(directoryIds).size) errors.push("Project directory contains duplicate project IDs.");
for (const id of directoryIds) if (!ids.includes(id)) errors.push(`${id}: directory entry is not in curated registry.`);
for (const id of expectedFeatured) if (!featuredIds.includes(id)) errors.push(`${id}: flagged for homepage but missing.`);
for (const id of featuredIds) if (!expectedFeatured.includes(id)) errors.push(`${id}: homepage feature is not approved by registry.`);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

const demoCount = registry.projects.filter((project) => project.demo).length;
console.log(
  `Portfolio inventory valid: ${ids.length} curated projects, ${featuredIds.length} homepage flagships, ${demoCount} demos.`
);
