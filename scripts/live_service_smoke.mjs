const REQUEST_TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 3;
const REQUEST_HEADERS = { "user-agent": "grant-mccurdy-portfolio-live-smoke/1.0" };

async function fetchChecked(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: REQUEST_HEADERS,
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

const checks = [
  {
    name: "portfolio Worker",
    run: async () => {
      const response = await fetchChecked("https://portfolio-rag-api.grant-mccurdy.workers.dev/health");
      const payload = await response.json();
      if (payload.ok !== true || payload.service !== "portfolio-rag-api") {
        throw new Error("health payload did not match the portfolio-rag-api contract");
      }
    },
  },
  {
    name: "hotel decision desk",
    run: () => verifyMarker("https://hotel-comp-decision-desk.grant-mccurdy.workers.dev/", "Hotel"),
  },
  {
    name: "assessment dashboard",
    run: () => verifyMarker("https://grant-mccurdy.github.io/dashboard/assessment.html", "Assessment"),
  },
  {
    name: "assessment remediation review packet",
    run: () => verifyMarker("https://grant-mccurdy.github.io/assessment-to-remediation-pipeline/", "Assessment-to-Remediation"),
  },
  {
    name: "instructional workflow reviewer demo",
    run: () => verifyMarker("https://grant-mccurdy.github.io/instructional-ai-workflows/", "Teacher-controlled"),
  },
  {
    name: "Content RAG corpus parity",
    run: async () => {
      const [sourceResponse, liveResponse] = await Promise.all([
        fetchChecked("https://raw.githubusercontent.com/grant-mccurdy/content-intelligence/main/sample_outputs/rag-index.json"),
        fetchChecked("https://portfolio-rag-api.grant-mccurdy.workers.dev/content/sources"),
      ]);
      const [source, live] = await Promise.all([sourceResponse.json(), liveResponse.json()]);
      const expected = { chunks: source.chunk_count, fingerprint: source.corpus_fingerprint };
      const actual = { chunks: live.chunks, fingerprint: live.corpusFingerprint };
      if (expected.chunks !== actual.chunks || expected.fingerprint !== actual.fingerprint) {
        throw new Error(`expected ${expected.chunks} / ${expected.fingerprint}; live has ${actual.chunks} / ${actual.fingerprint}`);
      }
    },
  },
];

async function verifyMarker(url, marker) {
  const response = await fetchChecked(url);
  if (!(await response.text()).includes(marker)) {
    throw new Error(`${url} did not include marker ${JSON.stringify(marker)}`);
  }
}

async function runWithRetries(check) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await check.run();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw lastError;
}

const failures = [];
for (const check of checks) {
  try {
    await runWithRetries(check);
    console.log(`PASS ${check.name}`);
  } catch (error) {
    failures.push(`${check.name}: ${error.message}`);
    console.error(`FAIL ${check.name}: ${error.message}`);
  }
}

if (failures.length) process.exit(1);
console.log(`Live service smoke passed for ${checks.length} public surfaces.`);
