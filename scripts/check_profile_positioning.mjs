import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const home = read("index.html");
const about = read("about.html");
const evidence = read("evidence-methods.html");
const systems = read("projects/index.html");
const demos = read("demos/index.html");
const ragProfile = read("content/rag/profile.md");
const ragGuide = read("content/rag/site-guide.md");
const registry = JSON.parse(read("data/portfolio-projects.json"));
const ragMap = JSON.parse(read("content/rag/project-map.json"));
const errors = [];
const proofFingerprint = "75479d72822392455359e9517c0e2751d36256044adfb6cc5ccf956d7cb30566";
const expectedFeatured = [
  "statistical-risk-modeling-r",
  "assessment-intelligence",
  "assessment-to-remediation-pipeline",
];
const expectedSupporting = [
  "education-data-simulation-engine",
  "instructional-ai-workflows",
  "content-intelligence",
  "graduate-statistics-portfolio",
];

const requireText = (source, text, label) => {
  if (!source.includes(text)) errors.push(`${label}: missing ${JSON.stringify(text)}.`);
};
const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);

requireText(home, "<title>Grant McCurdy | AI-Enabled Learning, Assessment &amp; Data Systems</title>", "Homepage metadata");
requireText(
  home,
  '<meta name="description" content="Mathematics and learning-systems leader designing AI-enabled, data-informed systems for assessment, measurement, learning analytics, and organizational decision-making.">',
  "Homepage metadata",
);
const hero = home.match(/<section class="hero[^\"]*">([\s\S]*?)<\/section>/)?.[1] || "";
requireText(hero, "Mathematics and learning-systems leader", "Homepage hero");
requireText(
  hero,
  "<h1>Grant McCurdy</h1>",
  "Homepage hero",
);
requireText(
  hero,
  "I build assessment systems, education data workflows, and AI-assisted instructional tools.",
  "Homepage hero",
);
requireText(hero, 'href="https://logoseducation.group/"', "Homepage Logos connection");
requireText(hero, 'href="dashboard/assessment.html"', "Homepage assessment path");
for (const term of ["assessment and measurement", "learning analytics", "lms/api automation", "human-reviewed ai", "leadership"]) {
  requireText(hero.toLowerCase(), term, "Homepage first screen");
}

for (const phrase of ["Aspiring data analyst", "Career changer", "Teacher trying to leave education", "Entry-level technologist", "Machine-learning engineer"]) {
  if ([home, about, evidence, systems].some((source) => source.toLowerCase().includes(phrase.toLowerCase()))) {
    errors.push(`Public HTML contains avoided framing: ${phrase}.`);
  }
}

requireText(
  about,
  "Mathematics and learning-systems leader who designs AI-enabled, data-informed education systems—combining assessment and measurement, analytics, automation, and implementation to improve student success, instructional quality, and organizational decision-making.",
  "About page",
);
for (const label of ["Problem", "Role", "System", "Evidence", "Outcome", "Limitations"]) {
  requireText(evidence, `<strong>${label}</strong>`, "Evidence case-study template");
}

const featured = registry.projects.filter((project) => project.homeFeatured).map((project) => project.id);
if (!same(featured, expectedFeatured)) errors.push(`Homepage featured order must be ${expectedFeatured.join(", ")}.`);
if (!same(registry.portfolioProof?.featuredProjectIds, expectedFeatured)) errors.push("Registry featured eligibility is stale.");
if (!same(registry.portfolioProof?.supportingProjectIds, expectedSupporting)) errors.push("Registry supporting eligibility is stale.");
if (registry.portfolioProof?.sourceFingerprint !== proofFingerprint) errors.push("Registry is not bound to the current Projects proof fingerprint.");
if (registry.portfolioProof?.projectCount !== 7 || registry.portfolioProof?.claimCount !== 14) errors.push("Registry must bind seven projects and fourteen claims.");
for (const id of expectedFeatured) requireText(home, `data-home-project-id="${id}"`, "Homepage systems");
for (const id of expectedSupporting) {
  if (home.includes(`data-home-project-id="${id}"`)) errors.push(`${id}: supporting project appears as a homepage feature.`);
}
for (const [label, source] of [["homepage", home], ["systems directory", systems], ["demo directory", demos], ["RAG profile", ragProfile], ["RAG guide", ragGuide]]) {
  if (source.includes("hotel-comp-policy-model") || source.includes("Hotel Comp Policy Model")) {
    errors.push(`${label} must exclude projects outside the current Projects proof.`);
  }
}
if (
  systems.indexOf('id="featured-systems"') > systems.indexOf('id="statistical-risk-modeling-r"') ||
  systems.indexOf('id="supporting-systems"') > systems.indexOf('id="education-data-simulation-engine"')
) {
  errors.push("Project directory eligibility sections are out of order.");
}

const ragFeatured = ragMap.campaignEvidence?.featuredProjectIds;
const ragSupporting = ragMap.campaignEvidence?.supportingProjectIds;
if (ragMap.campaignEvidence?.sourceFingerprint !== proofFingerprint || !same(ragFeatured, expectedFeatured) || !same(ragSupporting, expectedSupporting)) {
  errors.push("RAG project map does not preserve the current proof fingerprint and eligibility split.");
}
const registryClaims = registry.projects.flatMap((project) => project.proofClaims || []);
const ragClaims = ragMap.projects.flatMap((project) => project.claims || []);
if (registryClaims.length !== 14 || ragClaims.length !== 14 || !same(ragClaims.map((claim) => claim.id), registryClaims.map((claim) => claim.claimId))) {
  errors.push("RAG project map must contain the same fourteen claim IDs as the registry.");
}

for (const project of registry.projects.filter((entry) => entry.proofClaims)) {
  const projectHtml = read(project.portalPath);
  const qualification = project.proofClaims[0]?.qualification;
  requireText(projectHtml, "Projects Qualification", `${project.id} proof section`);
  requireText(projectHtml, qualification, `${project.id} qualification`);
  for (const claim of project.proofClaims) {
    if (claim.qualification !== qualification) errors.push(`${project.id}: claim qualifications must remain identical to Projects proof.`);
  }
}

const remediation = read("projects/assessment-to-remediation-pipeline.html");
requireText(remediation, "Scoring, simulated attempts, remediation, reassessment, and mastery reporting remain planned.", "Assessment-to-Remediation qualification");
for (const qualification of ["does not claim to be a validated standardized test", "live LMS deployment", "production Canvas integration"]) {
  requireText(remediation, qualification, "Assessment-to-Remediation exclusion");
}
const instructionalAi = read("projects/instructional-ai-workflows.html");
requireText(instructionalAi, "pre-authored teacher observations", "Instructional AI qualification");
requireText(instructionalAi, "does not automatically grade raw student work", "Instructional AI exclusion");

const contact = about.match(/<section class="profile-contact-band" id="contact"([\s\S]*?)<\/section>/)?.[1] || "";
for (const url of ["https://www.linkedin.com/in/grant-mccurdy/", "https://github.com/grant-mccurdy"]) {
  requireText(contact, url, "Contact section");
}
if (/mailto:|tel:/i.test(contact)) errors.push("Contact section must use LinkedIn and GitHub only.");

requireText(ragProfile, "Mathematics and learning-systems leader building AI-enabled, data-informed", "RAG profile");
requireText(ragProfile, proofFingerprint, "RAG profile proof binding");
requireText(evidence, "does not update the live homepage helper by itself", "Corpus deployment boundary");
requireText(evidence, proofFingerprint, "Evidence page proof binding");

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Profile positioning, three-feature hierarchy, seven-project/fourteen-claim provenance, qualifications, and contact boundary are valid.");
