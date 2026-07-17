import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "data", "portfolio-projects.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const directoryHtml = fs.readFileSync(path.join(root, "projects", "index.html"), "utf8");
const homeHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const allowedTiers = new Set(["flagship", "technical-depth", "active-prototype"]);
const errors = [];

const valuesFor = (html, attribute) =>
  [...html.matchAll(new RegExp(`${attribute}="([^"]+)"`, "g"))].map((match) => match[1]);

if (registry.schemaVersion !== 1 || !Array.isArray(registry.projects)) {
  errors.push("Registry must use schemaVersion 1 and contain a projects array.");
}

const ids = registry.projects.map((project) => project.id);
if (new Set(ids).size !== ids.length) errors.push("Project IDs must be unique.");
for (const project of registry.projects) {
  for (const field of ["id", "title", "tier", "statusLabel", "portalPath", "sourceUrl", "primaryEvidenceUrl"]) {
    if (!project[field]) errors.push(`${project.id || "unknown"}: missing ${field}.`);
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
}

const directoryIds = valuesFor(directoryHtml, "data-project-id");
const featuredIds = valuesFor(homeHtml, "data-home-project-id");
const expectedFeatured = registry.projects.filter((project) => project.homeFeatured).map((project) => project.id);

if (directoryIds.length !== new Set(directoryIds).size) errors.push("Project directory contains duplicate project IDs.");
for (const id of ids) if (!directoryIds.includes(id)) errors.push(`${id}: missing from project directory.`);
for (const id of directoryIds) if (!ids.includes(id)) errors.push(`${id}: directory entry is not in curated registry.`);
for (const id of expectedFeatured) if (!featuredIds.includes(id)) errors.push(`${id}: flagged for homepage but missing.`);
for (const id of featuredIds) if (!expectedFeatured.includes(id)) errors.push(`${id}: homepage feature is not approved by registry.`);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Portfolio inventory valid: ${ids.length} curated projects, ${featuredIds.length} homepage flagships.`);
