const checks = [
  {
    name: "portfolio Worker",
    url: "https://portfolio-rag-api.grant-mccurdy.workers.dev/health",
    verify: async (response) => {
      const payload = await response.json();
      return payload.ok === true && payload.service === "portfolio-rag-api";
    },
  },
  {
    name: "hotel decision desk",
    url: "https://hotel-comp-decision-desk.grant-mccurdy.workers.dev/",
    marker: "Hotel",
  },
  {
    name: "assessment dashboard",
    url: "https://grant-mccurdy.github.io/dashboard/assessment.html",
    marker: "Assessment",
  },
  {
    name: "assessment remediation review packet",
    url: "https://grant-mccurdy.github.io/assessment-to-remediation-pipeline/",
    marker: "Assessment-to-Remediation",
  },
  {
    name: "instructional workflow reviewer demo",
    url: "https://grant-mccurdy.github.io/instructional-ai-workflows/",
    marker: "Teacher-controlled",
  },
];

const failures = [];
for (const check of checks) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(check.url, {
      headers: { "user-agent": "grant-mccurdy-portfolio-live-smoke/1.0" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const valid = check.verify
      ? await check.verify(response)
      : (await response.text()).includes(check.marker);
    if (!valid) throw new Error("expected response marker was not found");
    console.log(`PASS ${check.name}`);
  } catch (error) {
    failures.push(`${check.name}: ${error.message}`);
    console.error(`FAIL ${check.name}: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

if (failures.length) process.exit(1);
console.log(`Live service smoke passed for ${checks.length} public surfaces.`);
