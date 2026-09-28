import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "data", "portfolio-projects.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const directoryHtml = fs.readFileSync(path.join(root, "projects", "index.html"), "utf8");
const homeHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const demosHtml = fs.readFileSync(path.join(root, "demos", "index.html"), "utf8");
const retiredRouteHtml = fs.readFileSync(path.join(root, "projects", "hotel-comp-policy-model.html"), "utf8");
const legacyBundlePath = path.join(root, "projects", "hotel-comp-policy-model");
const legacyIndexHtml = fs.readFileSync(path.join(legacyBundlePath, "index.html"), "utf8");
const allowedTiers = new Set(["featured", "supporting"]);
const expectedProofFingerprint = "75479d72822392455359e9517c0e2751d36256044adfb6cc5ccf956d7cb30566";
const expectedSelectionSha256 = "29abc0e9a3b07916348cffb27ed2b9f5e6ee7a2a3e9acfe1ae4d45dc12ee5808";
const expectedProjectIds = [
  "statistical-risk-modeling-r",
  "assessment-intelligence",
  "assessment-to-remediation-pipeline",
  "education-data-simulation-engine",
  "instructional-ai-workflows",
  "content-intelligence",
  "graduate-statistics-portfolio",
];
const expectedFeaturedIds = [
  "statistical-risk-modeling-r",
  "assessment-intelligence",
  "assessment-to-remediation-pipeline",
];
const expectedSupportingIds = [
  "education-data-simulation-engine",
  "instructional-ai-workflows",
  "content-intelligence",
  "graduate-statistics-portfolio",
];
const expectedDemoIds = [
  "assessment-intelligence",
  "education-data-simulation-engine",
  "content-intelligence",
];
const expectedProjectProof = {
  "statistical-risk-modeling-r": {
    eligibility: "featured",
    revision: "e435ce01bc341263fd51d03995867c8e9dd39de5",
    status: "prototype",
    qualification: "Strongest campaign evidence for measurement, validation, and decision support. Public use should surface the below-target validity gates; an interview rebuild needs the reproducibility work item first.",
    claims: {
      "srm-claim-1": "ae4d976f02b8c136ce202ba143fca4674d1d1c6de6e48e872286741ec12a433a",
      "srm-claim-2": "46ed0efefa30fe20ed991a099c268f10f9fbc2461338687c31a1e732f659744f",
    },
  },
  "assessment-intelligence": {
    eligibility: "featured",
    revision: "272e879a2dc62c710283edf3bc30540c571ed535",
    status: "qualified",
    qualification: "Strongest education-data architecture candidate once the dbt check is relocatable. Static artifacts are reviewable now, but a live interview rebuild and public feature must use the repaired, release-synchronized commit.",
    claims: {
      "ai-claim-1": "8ee3cf13a819adee8e2380ffa378d68eef076d66b9687bc0d6fcb392d7f3b39a",
      "ai-claim-2": "0bd902f3881ae3daefeefd169b287d4eccbbbde376b275416a0cb40511faef14",
    },
  },
  "assessment-to-remediation-pipeline": {
    eligibility: "featured",
    revision: "e97d649448702953dc2a31df7bfacc36b45502fe",
    status: "prototype",
    qualification: "Strong visual and workflow story if explicitly framed as the implemented authoring-review-export slice. Accessibility and clean demo verification should be completed before a high-stakes interview walkthrough.",
    claims: {
      "atr-claim-1": "cf51a160bf9d1380fc395054ed504a0eb2194e9f2b039d3637118cce5b6c24b6",
      "atr-claim-2": "6b1a1b8e50593be06fdddfb8825a8211997f1ff9431aada0e96c8a9f9e3d8844",
    },
  },
  "education-data-simulation-engine": {
    eligibility: "supporting",
    revision: "8387e9b50ff3da3675e1e5ff0b1a5b7b53a21abd",
    status: "qualified",
    qualification: "Strong supporting architecture evidence and the privacy foundation for Assessment Intelligence; the local commit is demo-ready, but public featuring must wait for separately approved remote release synchronization.",
    claims: {
      "edse-claim-1": "34fb3ae8f62aa67d6e6321fb30018fe11a24cc92a4c70945bca4d0bb6e1c8789",
      "edse-claim-2": "9bc34bb53486648df9403cc3dd57cf635a24ebc3c3b50d8eae9ff6449069b095",
    },
  },
  "instructional-ai-workflows": {
    eligibility: "supporting",
    revision: "a4c5e832eb6f0ee14ed96ffcf2855cd729853d25",
    status: "prototype",
    qualification: "Clear supporting example of governed AI-assisted instructional workflow design; less technically deep than the top three campaign projects.",
    claims: {
      "iaw-claim-1": "f16fda11a6062a878c9c7800de00d5b18bfa4c3c103a781bdee5838e593169ac",
      "iaw-claim-2": "1bb2c7a62fbc22c97ec142d29444fb1b85f0c545068ae18bbe89489d0fc00d8d",
    },
  },
  "content-intelligence": {
    eligibility: "supporting",
    revision: "27931b8df9153bebee3c6916d14ea0fd44f5e742",
    status: "prototype",
    qualification: "Strong general AI systems alternate with unusually clear provenance and governance evidence; less education-specific than the top three.",
    claims: {
      "ci-claim-1": "c6508cb67632816703a5e7bbe9a4ae3d1441a1a2bb7b104d8fda1550e6bca1d5",
      "ci-claim-2": "4c35666bbb861cab904f06dd22adaefd8460f5beda9649964c228331e1ca2d2a",
    },
  },
  "graduate-statistics-portfolio": {
    eligibility: "supporting",
    revision: "e2b098b2b988dff84bb24ca0f23845973627caf3",
    status: "qualified",
    qualification: "Strong supporting credential evidence for statistical depth and reproducibility; local artifacts are demo-ready, but public featuring must wait for separately approved synchronization of the ahead-of-remote commit.",
    claims: {
      "gsp-claim-1": "6b315c6ac54bb2cbfbf7a4d14a77f80ea7d55a1d2ceef993d54d2aabd645be3a",
      "gsp-claim-2": "858f325382942afd2290becf520fc965d26e15869e36279738deed14ebe85699",
    },
  },
};
const errors = [];

const valuesFor = (html, attribute) =>
  [...html.matchAll(new RegExp(`${attribute}="([^"]+)"`, "g"))].map((match) => match[1]);
const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);

if (registry.schemaVersion !== 4 || !Array.isArray(registry.projects)) {
  errors.push("Registry must use schemaVersion 4 and contain a projects array.");
}
const proof = registry.portfolioProof;
if (
  proof?.contract !== "portfolio-proof.v1" ||
  proof?.producer !== "projects" ||
  proof?.sourceFingerprint !== expectedProofFingerprint ||
  proof?.selectionSha256 !== expectedSelectionSha256 ||
  proof?.projectCount !== 7 ||
  proof?.claimCount !== 14
) {
  errors.push("Registry must bind to the current seven-project, fourteen-claim Projects proof snapshot.");
}
if (!same(proof?.projectIds, expectedProjectIds)) errors.push("Projects proof order is stale or incomplete.");
if (!same(proof?.featuredProjectIds, expectedFeaturedIds)) errors.push("Projects featured eligibility is stale.");
if (!same(proof?.supportingProjectIds, expectedSupportingIds)) errors.push("Projects supporting eligibility is stale.");

const blockFor = (html, attribute, id, tag) => {
  const expression = new RegExp(`<${tag}[^>]*${attribute}="${id}"[^>]*>[\\s\\S]*?<\\/${tag}>`, "i");
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
if (!same(ids, expectedProjectIds)) errors.push("Registry must contain only the seven current Projects-proof projects, in order.");
const proofClaims = [];
for (const project of registry.projects) {
  for (const field of ["id", "title", "tier", "statusLabel", "portalPath", "sourceUrl", "primaryEvidenceUrl", "summary"]) {
    if (!project[field]) errors.push(`${project.id || "unknown"}: missing ${field}.`);
  }
  if (!Array.isArray(project.capabilities) || project.capabilities.length < 2) {
    errors.push(`${project.id}: capabilities must contain at least two entries.`);
  }
  if (!allowedTiers.has(project.tier)) errors.push(`${project.id}: unsupported tier ${project.tier}.`);

  const expected = expectedProjectProof[project.id];
  if (expected) {
    if (project.tier !== expected.eligibility || project.proofProfileEligibility !== expected.eligibility) {
      errors.push(`${project.id}: project eligibility does not match Projects proof.`);
    }
    if (project.sourceRevision !== expected.revision) errors.push(`${project.id}: repository revision is stale.`);
    if (!Array.isArray(project.proofClaims) || project.proofClaims.length !== 2) {
      errors.push(`${project.id}: expected exactly two proof claims.`);
    }
    const expectedClaimIds = Object.keys(expected.claims);
    const actualClaimIds = (project.proofClaims || []).map((claim) => claim.claimId);
    if (!same(actualClaimIds, expectedClaimIds)) errors.push(`${project.id}: claim IDs or order are stale.`);
    for (const claim of project.proofClaims || []) {
      proofClaims.push(claim);
      if (claim.status !== expected.status) errors.push(`${project.id}/${claim.claimId}: claim status is stale.`);
      if (claim.profileEligibility !== "qualified") errors.push(`${project.id}/${claim.claimId}: claim eligibility must remain qualified.`);
      if (claim.itemHash !== expected.claims[claim.claimId]) errors.push(`${project.id}/${claim.claimId}: claim hash is stale.`);
      if (claim.qualification !== expected.qualification) errors.push(`${project.id}/${claim.claimId}: qualification is stale.`);
      if (!claim.statement) errors.push(`${project.id}/${claim.claimId}: claim statement is missing.`);
      if (!Array.isArray(claim.evidenceIds) || !claim.evidenceIds.length) errors.push(`${project.id}/${claim.claimId}: evidence references are missing.`);
    }
  } else errors.push(`${project.id}: project is not present in the current Projects proof.`);

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

if (proofClaims.length !== 14 || new Set(proofClaims.map((claim) => claim.claimId)).size !== 14) {
  errors.push("Registry must contain fourteen unique current proof claims.");
}
const directoryIds = valuesFor(directoryHtml, "data-project-id");
const demoIds = valuesFor(demosHtml, "data-demo-project-id");
const featuredIds = valuesFor(homeHtml, "data-home-project-id");
const registryFeatured = registry.projects.filter((project) => project.homeFeatured).map((project) => project.id);
if (!same(registryFeatured, expectedFeaturedIds) || !same(featuredIds, expectedFeaturedIds)) {
  errors.push("Homepage must feature only the three current Projects-featured entries, in order.");
}
if (directoryIds.length !== new Set(directoryIds).size) errors.push("Project directory contains duplicate project IDs.");
if (!same(directoryIds, expectedProjectIds)) errors.push("Project directory must contain only the seven current Projects-proof projects, in order.");
if (!same(demoIds, expectedDemoIds)) errors.push("Demo directory must contain only demos owned by current Projects-proof projects, in order.");
for (const source of [homeHtml, directoryHtml, demosHtml]) {
  if (source.includes("hotel-comp-policy-model") || source.includes("Hotel Comp Policy Model")) {
    errors.push("Current public navigation must not expose a project outside the Projects proof.");
  }
}
for (const [label, source, systemsHref] of [
  ["legacy project route", retiredRouteHtml, "index.html"],
  ["legacy bundle entry route", legacyIndexHtml, "../index.html"],
]) {
  if (
    !source.includes('<meta name="robots" content="noindex, nofollow">') ||
    !source.includes("Project evidence is unavailable.") ||
    !source.includes(`href="${systemsHref}">Return to Systems</a>`) ||
    source.includes("data-track-project")
  ) {
    errors.push(`${label} must remain a claim-free, noindex evidence-unavailable page with a Systems return link.`);
  }
}
const legacyBundleEntries = fs.readdirSync(legacyBundlePath);
if (legacyBundleEntries.length !== 1 || legacyBundleEntries[0] !== "index.html") {
  errors.push("Legacy bundle must contain only the claim-free index.html route.");
}
for (const id of expectedSupportingIds) {
  const project = registry.projects.find((entry) => entry.id === id);
  if (project?.homeFeatured) errors.push(`${id}: supporting project must not be homepage-featured.`);
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

const demoCount = registry.projects.filter((project) => project.demo).length;
console.log(
  `Portfolio inventory valid: ${ids.length} curated projects, ${proof.projectCount} proof projects, ${proofClaims.length} proof claims, ${featuredIds.length} homepage features, ${demoCount} demos.`,
);
