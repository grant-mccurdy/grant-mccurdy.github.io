import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedLabels = ["Projects", "Demos", "GitHub", "LinkedIn"];
const errors = [];

const htmlFiles = [];
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
    if (entry.isDirectory()) {
      if ([".git", "node_modules", "artifacts"].includes(entry.name)) continue;
      if (relative === "projects/hotel-comp-policy-model") continue;
      visit(absolute);
    } else if (entry.name.endsWith(".html")) {
      htmlFiles.push({ absolute, relative });
    }
  }
};
visit(root);

for (const file of htmlFiles) {
  const html = fs.readFileSync(file.absolute, "utf8");
  if (!html.includes("assets/js/site.js")) continue;

  if (!/<a class="brand"[^>]*aria-label="Grant McCurdy home"/.test(html)) {
    errors.push(`${file.relative}: brand link needs a stable accessible name.`);
  }
  if ((html.match(/data-nav-toggle/g) || []).length !== 1) {
    errors.push(`${file.relative}: expected one static navigation toggle.`);
  }

  const nav = html.match(/<div class="nav-links" data-nav-links>([\s\S]*?)<\/div>/)?.[1] || "";
  const navLabels = [...nav.matchAll(/<a\b[^>]*>([^<]+)<\/a>/g)].map((match) => match[1].trim());
  if (JSON.stringify(navLabels) !== JSON.stringify(expectedLabels)) {
    errors.push(`${file.relative}: primary navigation must be ${expectedLabels.join(", ")}.`);
  }

  const footer = html.match(/<footer class="site-footer">([\s\S]*?)<\/footer>/)?.[1] || "";
  const footerLabels = [...footer.matchAll(/<a\b[^>]*>([^<]+)<\/a>/g)].map((match) => match[1].trim());
  if (JSON.stringify(footerLabels) !== JSON.stringify(expectedLabels)) {
    errors.push(`${file.relative}: footer navigation must be ${expectedLabels.join(", ")}.`);
  }
}

const siteScript = fs.readFileSync(path.join(root, "assets", "js", "site.js"), "utf8");
if (siteScript.includes('createElement("footer")')) {
  errors.push("assets/js/site.js must not generate navigation or footer content.");
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Site shell valid across ${htmlFiles.filter((file) => fs.readFileSync(file.absolute, "utf8").includes("assets/js/site.js")).length} hand-authored pages.`);
