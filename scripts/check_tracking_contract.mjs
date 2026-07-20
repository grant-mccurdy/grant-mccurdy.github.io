import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const allowedProjects = new Set([
  "portfolio",
  "hotel-comp-policy-model",
  "assessment-intelligence",
  "content-intelligence",
  "education-data-simulation-engine",
  "statistical-risk-modeling-r",
  "graduate-statistics-portfolio",
  "assessment-to-remediation-pipeline",
  "instructional-ai-workflows",
  "linkedin",
]);
const allowedDestinations = new Set(["live-demo", "source", "project-brief", "report", "linkedin"]);
const files = [
  "index.html",
  "projects/index.html",
  "projects/assessment-to-remediation-pipeline.html",
  "projects/instructional-ai-workflows.html",
];
const errors = [];
let trackedLinks = 0;

for (const relative of files) {
  const html = fs.readFileSync(path.join(root, relative), "utf8");
  for (const match of html.matchAll(/<a\b[^>]*data-track-(?:project|destination)=[^>]*>/g)) {
    trackedLinks += 1;
    const tag = match[0];
    const project = tag.match(/data-track-project="([^"]+)"/)?.[1];
    const destination = tag.match(/data-track-destination="([^"]+)"/)?.[1];
    if (!project || !destination) errors.push(`${relative}: tracked links require both tracking attributes.`);
    if (project && !allowedProjects.has(project)) errors.push(`${relative}: unknown project ID ${project}.`);
    if (destination && !allowedDestinations.has(destination)) {
      errors.push(`${relative}: unknown destination type ${destination}.`);
    }
  }
}

const registry = fs.readFileSync(path.join(root, "data", "portfolio-projects.json"), "utf8");
if (registry.includes("public-workspace")) errors.push("Curated project registry still points to public-workspace.");
const siteScript = fs.readFileSync(path.join(root, "assets", "js", "site.js"), "utf8");
if (!siteScript.includes("portfolio-event-v1") || !siteScript.includes("/events")) {
  errors.push("Site event sender is missing the versioned Worker contract.");
}
if (!files.every((relative) => fs.readFileSync(path.join(root, relative), "utf8").includes("https://www.linkedin.com/in/grant-mccurdy/"))) {
  errors.push("A curated static shell is missing the approved LinkedIn URL.");
}
if (trackedLinks < 20) errors.push(`Expected at least 20 curated tracked links; found ${trackedLinks}.`);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(`Tracking contract valid: ${trackedLinks} curated links use bounded project and destination values.`);
